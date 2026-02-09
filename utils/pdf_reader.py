import base64

def process_pdf_upload(file_storage):
    """
    Reads a Flask FileStorage object and returns the base64 encoded string
    and mime type suitable for Gemini API.
    """
    if not file_storage:
        raise ValueError("No file provided")
    
    file_bytes = file_storage.read()
    base64_data = base64.b64encode(file_bytes).decode('utf-8')
    return {
        "mime_type": "application/pdf",
        "data": base64_data
    }
