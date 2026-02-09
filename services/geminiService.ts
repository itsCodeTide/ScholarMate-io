import { GoogleGenAI, Type, Schema } from "@google/genai";
import { SlideData } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Gemini 3 Pro for maximum reasoning capability
const MODEL_NAME = 'gemini-3-pro-preview';

// Helper to clean markdown code blocks
const cleanCode = (text: string) => {
  return text.replace(/^```python\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
};

const cleanJson = (text: string) => {
  return text.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Retry wrapper for API calls to handle 429s
// Increased retries to 10 and initial delay to 10000ms to handle strict rate limits
const generateWithRetry = async (params: any, retries = 10, initialDelay = 10000) => {
  let currentDelay = initialDelay;
  for (let i = 0; i < retries; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      const isRateLimit = error.status === 429 || 
                          error.code === 429 || 
                          (error.message && error.message.includes('429')) ||
                          (error.message && error.message.includes('RESOURCE_EXHAUSTED'));

      if (isRateLimit && i < retries - 1) {
        console.warn(`Rate limit hit (Attempt ${i + 1}/${retries}). Retrying in ${currentDelay}ms...`);
        await delay(currentDelay);
        currentDelay *= 1.5; // Exponential backoff
      } else {
        throw error;
      }
    }
  }
  throw new Error("Failed to generate content after retries. The API quota may be exhausted.");
};

export const generateAnalysis = async (
  fileBase64: string,
  mimeType: string,
  onProgress: (step: string) => void
) => {
  const filePart = { inlineData: { mimeType, data: fileBase64 } };

  // STRICT SYSTEM INSTRUCTION provided by user
  const systemInstruction = `
    You are ScholarMate, a senior research scientist, ML engineer, and academic reviewer combined.
    Your job is to transform research papers into accurate, grounded, reproducible research artifacts.
    
    STRICT RULES:
    - Use ONLY the provided paper context.
    - Never hallucinate facts, numbers, or results.
    - If information is missing, explicitly say: "Not specified in the paper."
    - Be precise, technical, and concise.
    - Prefer correctness over verbosity.
    - Assume the user is a technical student or researcher.
    - All outputs must be structured, evaluable, and demo-ready.
  `;

  // --- STEP 1: SUMMARY ---
  onProgress('Step 1/7: Generating Deep Summary...');
  const summaryResp = await generateWithRetry({
    model: MODEL_NAME,
    config: { systemInstruction },
    contents: {
      parts: [
        filePart,
        { text: `
        Analyze this paper and provide a comprehensive, structured technical summary.
        
        Output Structure (Markdown):
        
        ## 1. Executive Summary
        *   **Context**: The broader field and specific problem addressed.
        *   **Core Contribution**: The main innovation or thesis.
        *   **Impact**: Why this work is significant.

        ## 2. Methodology & Architecture
        *   **Theoretical Basis**: Mathematical or theoretical foundation.
        *   **System Design**: Key components/algorithms.
        *   **Data Strategy**: Collection/generation methods.

        ## 3. Key Findings
        *   **Metrics**: Specific numerical results (SOTA comparison, accuracy).
        *   **Evidence**: Description of key graphs/visuals.

        ## 4. Conclusions
        *   Authors' final stance and future work.
        ` }
      ]
    }
  });
  const summary = summaryResp.text || "Failed to generate summary.";
  await delay(12000); // Increased buffer to 12s

  // --- STEP 2: CRITIQUE ---
  onProgress('Step 2/7: Generating Critical Review...');
  const critiqueResp = await generateWithRetry({
    model: MODEL_NAME,
    config: { systemInstruction },
    contents: {
      parts: [
        filePart,
        { text: `
        You are acting as an academic reviewer.

        TASK:
        Identify EXACTLY THREE concrete weaknesses or limitations of the paper.

        REQUIREMENTS:
        - Each point must be specific and technical.
        - Base each critique ONLY on what is stated or clearly missing in the paper.
        - Avoid generic criticism.
        - Focus on:
          - experimental design
          - dataset limitations
          - evaluation methodology
          - scalability or reproducibility

        OUTPUT FORMAT (Markdown):
        1. **Short Title**: Explanation (2–3 concise technical sentences).
        2. **Short Title**: Explanation (2–3 concise technical sentences).
        3. **Short Title**: Explanation (2–3 concise technical sentences).
        ` }
      ]
    }
  });
  const critique = critiqueResp.text || "Failed to generate critique.";
  await delay(12000);

  // --- STEP 3: EXPERIMENT PLAN ---
  onProgress('Step 3/7: Designing Experiment...');
  const experimentPrompt = `
    Design ONE reproducible mini-experiment inspired by the paper.

    GOAL:
    The experiment must help a student understand or validate
    a core idea from the paper.

    STRICT CONSTRAINTS:
    - Must run in under 5 minutes on a laptop.
    - Use only standard Python libraries (sklearn, numpy, pandas, matplotlib).
    - Must be educational and realistic.

    REQUIREMENTS:
    - If no dataset is provided, use a small synthetic dataset.
    - Clearly define:
      - Objective
      - Data
      - Method
      - Evaluation metric
    - Do NOT overcomplicate.

    OUTPUT FORMAT (Use Markdown):
    **Experiment Objective**: [text]
    
    **Data Description**: [text]
    
    **Method**: [text]
    
    **Evaluation Metric**: [text]
    
    **Expected Outcome**: [text]
  `;
  const experimentResp = await generateWithRetry({
    model: MODEL_NAME,
    config: { systemInstruction },
    contents: {
      parts: [
        filePart,
        { text: experimentPrompt }
      ]
    }
  });
  const experimentPlan = experimentResp.text || "Failed to generate experiment plan.";
  await delay(12000);

  // --- STEP 4: PYTHON CODE ---
  onProgress('Step 4/7: Generating Python Code...');
  const codePrompt = `
    Generate runnable Python code for the experiment described below.

    Experiment Plan:
    ${experimentPlan}

    STRICT RULES:
    - Use ONLY these libraries: numpy, pandas, scikit-learn, matplotlib
    - Do NOT use deep learning frameworks.
    - Do NOT use external files or APIs.
    - Generate any required data inside the code (e.g. using numpy.random or sklearn.datasets).
    - The code MUST run top-to-bottom with no edits.

    TASK:
    Implement the experiment exactly as described in the plan.
    Ensure strict reproducibility and clear output of results.

    OUTPUT FORMAT:
    - Output ONLY valid Python code.
    - Add comments to explain necessary lines and how they relate to the paper's concepts.
  `;
  
  const codeResp = await generateWithRetry({
    model: MODEL_NAME,
    contents: { parts: [{ text: codePrompt }] }
  });
  const pythonCode = cleanCode(codeResp.text || "# Failed to generate code.");
  await delay(12000);

  // --- STEP 5: SLIDES ---
  onProgress('Step 5/7: Generating Presentation Slides...');
  const slidesSchema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        bullets: { 
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      },
      required: ["title", "bullets"]
    }
  };

  const slidesPrompt = `
    Create content for a 5-slide technical presentation summarizing the paper and experiment.
    
    Context:
    ${summary}
    ${experimentPlan}

    TASK:
    Create slide text summarizing the paper and experiment.

    SLIDE STRUCTURE:
    1. Problem & Motivation
    2. Core Idea
    3. Method Overview
    4. Reproducible Experiment
    5. Key Takeaways & Next Steps

    REQUIREMENTS:
    - Each slide must have:
      - A clear title
      - 3–5 concise bullet points
    - Use technical but simple language.
    - Avoid marketing language.
    
    Return JSON array.
  `;

  const slidesResp = await generateWithRetry({
    model: MODEL_NAME,
    contents: {
      parts: [
        filePart,
        { text: slidesPrompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: slidesSchema
    }
  });
  let slides: SlideData[] = [];
  try {
    slides = JSON.parse(cleanJson(slidesResp.text || "[]"));
  } catch (e) {
    console.error("Failed to parse slides JSON", e);
    slides = [{ title: "Error", bullets: ["Failed to generate slides data."] }];
  }
  await delay(12000);

  // --- STEP 6: INTERPRETATION ---
  onProgress('Step 6/7: Generating Interpretation...');
  const interpretationPrompt = `
    Interpret the EXPECTED results of the mini-experiment described below.

    Experiment Plan:
    ${experimentPlan}

    TASK:
    Explain what the results demonstrate in relation to the paper.

    REQUIREMENTS:
    - Max 150 words.
    - Be honest about limitations (since it uses synthetic data).
    - Do not exaggerate conclusions.
    - Focus on educational value.
  `;

  const interpretationResp = await generateWithRetry({
    model: MODEL_NAME,
    contents: { parts: [{ text: interpretationPrompt }] }
  });
  const experimentInterpretation = interpretationResp.text || "Failed to generate interpretation.";
  await delay(12000);

  // --- STEP 7: VALIDATION ---
  onProgress('Step 7/7: Validating Results...');
  const validationPrompt = `
    Validate the following generated research artifacts against the original paper.

    Artifacts to Check:
    1. Summary: ${summary}
    2. Critique: ${critique}
    3. Experiment Plan: ${experimentPlan}

    TASK:
    Check for:
    - Hallucinated claims
    - Inconsistencies between summary, critique, and experiment
    - Unsupported assumptions

    If issues exist, list them clearly.
    If none exist, output:
    "Outputs are internally consistent and grounded."
  `;

  const validationResp = await generateWithRetry({
    model: MODEL_NAME,
    contents: {
      parts: [
        filePart,
        { text: validationPrompt }
      ]
    }
  });
  const validationReport = validationResp.text || "Validation check failed.";

  return {
    summary,
    critique,
    experimentPlan,
    pythonCode,
    experimentInterpretation,
    validationReport,
    slides
  };
};