
import io
import json
import numpy as np
from pypdf import PdfReader
from google import genai
from google.genai import types

class RAGEngine:
    def __init__(self, pdf_bytes, api_key):
        self.client = genai.Client(api_key=api_key)
        self.full_text = self._extract_text(pdf_bytes)
        
        # Disabled embedding generation by default to prevent 429s and improve latency 
        # for the summary pipeline which uses full text context.
        self.embeddings = np.array([])
        
    def _extract_text(self, pdf_bytes):
        try:
            reader = PdfReader(io.BytesIO(pdf_bytes))
            text_parts = []
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
            full_text = "\n".join(text_parts)
            return " ".join(full_text.split())
        except Exception as e:
            print(f"Error extracting text: {e}")
            return ""
