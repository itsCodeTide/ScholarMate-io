
import os
import json
import base64
import re
from google import genai
from google.genai import types

# Robust import for RAG
try:
    from utils.rag import RAGEngine
except ImportError:
    # Fallback for direct script execution
    from rag import RAGEngine

# Use Flash for speed
REASONING_MODEL = 'gemini-2.0-flash'

def get_client():
    api_key = os.environ.get("API_KEY")
    if not api_key:
        print("CRITICAL ERROR: API_KEY is missing.")
        raise ValueError("API_KEY not found in .env")
    return genai.Client(api_key=api_key)

def load_prompt(name):
    try:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        path = os.path.join(base_dir, 'prompts', f'{name}.txt')
        with open(path, 'r') as f:
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

def generate_safe(model, contents, config=None, label="Content"):
    client = get_client()
    try:
        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=config
        )
        return response.text
    except Exception as e:
        print(f"Error generating {label}: {e}")
        return f"Error generating {label}."

def run_analysis_pipeline(pdf_data):
    print("--- Starting Pipeline ---")
    
    # 1. Decode
    try:
        pdf_bytes = base64.b64decode(pdf_data['data'])
    except Exception as e:
        raise ValueError(f"Failed to decode PDF: {e}")

    # 2. RAG Init
    rag_text = ""
    try:
        rag = RAGEngine(pdf_bytes, api_key=os.environ.get("API_KEY"))
        rag_text = rag.full_text[:30000] 
    except Exception as e:
        print(f"RAG Error: {e}")
        rag_text = "Context unavailable."

    results = {}

    # 3. Generate Content
    # We run sequentially but without sleep to be fast
    
    print("Generating Summary...")
    results['summary'] = clean_text(generate_safe(
        REASONING_MODEL,
        contents=[types.Content(parts=[
            types.Part.from_text(text=f"Paper Text:\n{rag_text}"),
            types.Part.from_text(text=load_prompt('summary'))
        ])],
        config=types.GenerateContentConfig(system_instruction=SYSTEM_INSTRUCTION),
        label="Summary"
    ))

    print("Generating Critique...")
    results['critique'] = clean_text(generate_safe(
        REASONING_MODEL,
        contents=[types.Content(parts=[
            types.Part.from_text(text=f"Paper Text:\n{rag_text}"),
            types.Part.from_text(text=load_prompt('critique'))
        ])],
        config=types.GenerateContentConfig(system_instruction=SYSTEM_INSTRUCTION),
        label="Critique"
    ))

    print("Generating Experiment Plan...")
    results['experiment_plan'] = clean_text(generate_safe(
        REASONING_MODEL,
        contents=[types.Content(parts=[
            types.Part.from_text(text=f"Paper Text:\n{rag_text}"),
            types.Part.from_text(text=load_prompt('experiment'))
        ])],
        config=types.GenerateContentConfig(system_instruction=SYSTEM_INSTRUCTION),
        label="Experiment Plan"
    ))

    print("Generating Code...")
    code_raw = generate_safe(
        REASONING_MODEL,
        contents=[types.Content(parts=[
            types.Part.from_text(text=f"Experiment Plan:\n{results['experiment_plan']}"),
            types.Part.from_text(text=load_prompt('codegen'))
        ])],
        config=types.GenerateContentConfig(system_instruction=SYSTEM_INSTRUCTION),
        label="Python Code"
    )
    results['python_code'] = extract_code_block(code_raw)

    print("Generating Slides...")
    slides_raw = generate_safe(
        REASONING_MODEL,
        contents=[types.Content(parts=[
            types.Part.from_text(text=f"Summary:\n{results['summary']}\n\nPlan:\n{results['experiment_plan']}"),
            types.Part.from_text(text=load_prompt('slides'))
        ])],
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json"
        ),
        label="Slides"
    )
    slides_json = extract_json(slides_raw)
    results['slides'] = slides_json if slides_json else [{"title": "Error", "bullets": ["Generation failed"]}]

    print("Validating...")
    results['validation_report'] = clean_text(generate_safe(
        REASONING_MODEL,
        contents=[types.Content(parts=[
            types.Part.from_text(text=f"Summary: {results['summary']}\nCritique: {results['critique']}"),
            types.Part.from_text(text=load_prompt('validation'))
        ])],
        config=types.GenerateContentConfig(system_instruction=SYSTEM_INSTRUCTION),
        label="Validation"
    ))
    
    results['execution_output'] = "" 
    print("--- Finished ---")
    return results
