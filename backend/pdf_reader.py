
import base64
import io
from pypdf import PdfReader

def process_pdf_upload(file_storage):
    """
    Reads a Flask FileStorage object, validates it is a working PDF,
    and returns the base64 encoded string and mime type.
    """
    if not file_storage:
        raise ValueError("No file provided")
    
    # Read bytes
    file_bytes = file_storage.read()
    
    if len(file_bytes) == 0:
        raise ValueError("The uploaded file is empty.")
    
    # Validate PDF integrity
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        if len(reader.pages) == 0:
            raise ValueError("The PDF contains no pages.")
        
        # Try extracting text from the first page to ensure it's readable
        _ = reader.pages[0].extract_text()
        
    except Exception as e:
        # Re-raise as a ValueError for the app to handle as a user error
        raise ValueError(f"The file appears to be corrupted or is not a valid PDF. Details: {str(e)}")

    base64_data = base64.b64encode(file_bytes).decode('utf-8')
    return {
        "mime_type": "application/pdf",
        "data": base64_data
    }
