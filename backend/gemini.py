
import os
import json
import base64
import re
import time
import io
import traceback
from google import genai
from google.genai import types
from pypdf import PdfReader

# Priority list of models to try. 
# We start with the fastest/newest. If it fails (404/429), we fall back.
MODEL_PRIORITY_LIST = [
    'gemini-2.0-flash',          # Fastest, best reasoning
    'gemini-2.0-flash-exp',      # Experimental fallback
    'gemini-1.5-flash',          # Standard stable
    'gemini-1.5-flash-latest',   # Latest alias
    'gemini-1.5-flash-002',      # Specific version
    'gemini-1.5-flash-001',      # Older stable
]

def get_client():
    api_key = os.environ.get("API_KEY")
    if not api_key:
        print("CRITICAL ERROR: API_KEY is missing.")
        raise ValueError("API_KEY not found in environment variables.")
    return genai.Client(api_key=api_key)

def load_prompt(name):
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        path = os.path.join(base_dir, 'prompts', f'{name}.txt')
        with open(path, 'r', encoding='utf-8') as f:
            return f.read().strip()
    except FileNotFoundError:
        return ""

SYSTEM_INSTRUCTION = load_prompt('system')

def clean_text(text):
    if not text: return ""
    text = text.strip()
    text = re.sub(r"^```[a-zA-Z]*\n", "", text)
    text = re.sub(r"```$", "", text)
    return text.strip()

def extract_code_block(text):
    if not text: return "# No code generated"
    pattern = r"```(?:python)?\s*(.*?)```"
    match = re.search(pattern, text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return clean_text(text)

def extract_json(text):
    text = clean_text(text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        try:
            match = re.search(r'(\{.*\}|\[.*\])', text, re.DOTALL)
            if match:
                return json.loads(match.group(1))
        except:
            pass
    return []

def extract_text_from_pdf_bytes(pdf_bytes):
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        text_parts = []
        for page in reader.pages:
            txt = page.extract_text()
            if txt:
                text_parts.append(txt)
        return "\n".join(text_parts)
    except Exception as e:
        print(f"PDF Extraction Error: {e}")
        return ""

def verify_working_model(client):
    """
    Iterates through MODEL_PRIORITY_LIST to find a usable model.
    Returns the name of the first model that doesn't throw 404/429 on a trivial request.
    """
    print("Selecting best available model...")
    for model in MODEL_PRIORITY_LIST:
        try:
            # Tiny test request
            client.models.generate_content(
                model=model,
                contents="Test",
                config=types.GenerateContentConfig(max_output_tokens=5)
            )
            print(f"Model selected: {model}")
            return model
        except Exception as e:
            error_str = str(e)
            print(f"Skipping {model}: {error_str}")
            # If it's a 429 (Quota) or 404 (Not Found), keep trying others.
            # If it's an Auth error, we should probably stop, but continuing matches logic.
            continue
    
    raise ValueError("All models failed. Please check your API Key and Quota.")

def generate_safe_stream(client, model, contents, config=None, label="Content", retries=3):
    """
    Generator that handles API calls with robust backoff.
    Yields {"status": "processing", "message": "..."} while waiting.
    Yields the final result text as a string when done.
    """
    delay = 5
    
    for attempt in range(retries):
        try:
            response = client.models.generate_content(
                model=model,
                contents=contents,
                config=config
            )
            yield response.text
            return
        except Exception as e:
            error_str = str(e)
            print(f"Error generating {label} (Attempt {attempt+1}/{retries}): {error_str}")
            
            # Check for Rate Limit (429) or Quota Exceeded (Resource Exhausted)
            if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str or "quota" in error_str.lower():
                wait_time = delay * (attempt + 1)
                
                # Check if API gave a specific time (e.g. "retry in 49s")
                match = re.search(r'retry in (\d+\.?\d*)s', error_str)
                if match:
                    wait_time = float(match.group(1)) + 2 # Add buffer
                
                msg = f"Rate limit hit on {model}. Waiting {int(wait_time)}s..."
                yield json.dumps({"status": "processing", "message": msg}) + "\n"
                
                time.sleep(wait_time)
                delay += 5 
            elif "404" in error_str:
                 raise ValueError(f"Model {model} not found during execution. This shouldn't happen if verified.")
            else:
                time.sleep(2)
    
    raise Exception(f"Failed to generate {label} after retries.")

def run_analysis_pipeline_stream(pdf_data):
    """
    Main Pipeline Generator.
    """
    yield json.dumps({"status": "processing", "message": "Initializing analysis..."}) + "\n"
    
    try:
        client = get_client()
        
        # 0. Select Model
        yield json.dumps({"status": "processing", "message": "Connecting to best available AI model..."}) + "\n"
        active_model = verify_working_model(client)
        
        pdf_bytes = base64.b64decode(pdf_data['data'])
    except Exception as e:
        yield json.dumps({"status": "error", "message": str(e)}) + "\n"
        return

    # Extract text
    yield json.dumps({"status": "processing", "message": "Extracting text from PDF..."}) + "\n"
    full_text = extract_text_from_pdf_bytes(pdf_bytes)
    if not full_text:
        yield json.dumps({"status": "error", "message": "Could not extract text from PDF."}) + "\n"
        return
        
    context_text = full_text[:70000] # Safe token limit
    results = {}

    # Helper to run a step
    def run_step(step_name, prompt_name, context_input, config=None):
        prompt_text = load_prompt(prompt_name)
        contents = [
            types.Content(parts=[
                types.Part.from_text(text=f"Context:\n{context_input}"),
                types.Part.from_text(text=prompt_text)
            ])
        ]
        
        final_config = config
        if not final_config:
            final_config = types.GenerateContentConfig(system_instruction=SYSTEM_INSTRUCTION)

        generator = generate_safe_stream(
            client,
            active_model,
            contents=contents,
            config=final_config,
            label=step_name
        )
        
        result_text = ""
        for chunk in generator:
            if isinstance(chunk, str) and chunk.strip().startswith('{') and '"status":' in chunk:
                yield chunk
            else:
                result_text = chunk
        
        return clean_text(result_text)

    # 1. Summary
    yield json.dumps({"status": "processing", "message": "Generating Deep Summary..."}) + "\n"
    results['summary'] = yield from run_step("Summary", 'summary', context_text)
    time.sleep(1)

    # 2. Critique
    yield json.dumps({"status": "processing", "message": "Generating Critical Review..."}) + "\n"
    results['critique'] = yield from run_step("Critique", 'critique', context_text)
    time.sleep(1)

    # 3. Experiment Plan
    yield json.dumps({"status": "processing", "message": "Designing Reproducible Experiment..."}) + "\n"
    results['experiment_plan'] = yield from run_step("Experiment Plan", 'experiment', context_text)
    time.sleep(1)

    # 4. Code
    yield json.dumps({"status": "processing", "message": "Writing Python Code..."}) + "\n"
    code_raw = yield from run_step("Python Code", 'codegen', f"Experiment Plan:\n{results['experiment_plan']}")
    results['python_code'] = extract_code_block(code_raw)
    time.sleep(1)

    # 5. Slides
    yield json.dumps({"status": "processing", "message": "Creating Presentation Slides..."}) + "\n"
    slides_raw = yield from run_step(
        "Slides", 
        'slides', 
        f"Summary:\n{results['summary']}\n\nPlan:\n{results['experiment_plan']}",
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json"
        )
    )
    slides_json = extract_json(slides_raw)
    results['slides'] = slides_json if slides_json else [{"title": "Error", "bullets": ["Generation failed"]}]

    # 6. Validation
    yield json.dumps({"status": "processing", "message": "Validating Results..."}) + "\n"
    results['validation_report'] = yield from run_step(
        "Validation", 
        'validation', 
        f"Summary: {results['summary']}\nCritique: {results['critique']}"
    )
    
    results['experimentInterpretation'] = "The experiment results above are generated synthetically based on the paper's methodology. They demonstrate the expected trends if the hypothesis holds true."

    # Final Yield
    yield json.dumps({"status": "complete", "data": results}) + "\n"
