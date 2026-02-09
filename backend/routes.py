
from flask import Blueprint, request, jsonify, send_from_directory, Response, stream_with_context
import os
import traceback
import json
from .pdf_reader import process_pdf_upload
from .gemini import run_analysis_pipeline_stream

api_bp = Blueprint('api', __name__)

# Output Directories
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_FOLDER = os.path.join(BASE_DIR, 'outputs')
SLIDES_FOLDER = os.path.join(OUTPUT_FOLDER, 'slides')
CODE_FOLDER = os.path.join(OUTPUT_FOLDER, 'code')

for folder in [SLIDES_FOLDER, CODE_FOLDER]:
    os.makedirs(folder, exist_ok=True)

@api_bp.route('/analyze', methods=['POST'])
def analyze():
    print("Received analysis request.")
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    try:
        # Process PDF first (fast operation)
        pdf_data = process_pdf_upload(file)
        
        # Generator for streaming response
        def generate():
            try:
                # Iterate through the pipeline generator
                for chunk in run_analysis_pipeline_stream(pdf_data):
                    yield chunk
            except Exception as e:
                traceback.print_exc()
                yield json.dumps({"status": "error", "message": str(e)}) + "\n"

        return Response(stream_with_context(generate()), mimetype='application/x-ndjson')

    except ValueError as e:
        print(f"Validation Error: {e}")
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        print("SERVER ERROR:")
        traceback.print_exc()
        return jsonify({'error': 'Server Error', 'details': str(e)}), 500

@api_bp.route('/download/<type>/<filename>')
def download_file(type, filename):
    directory = SLIDES_FOLDER if type == 'slides' else CODE_FOLDER
    try:
        return send_from_directory(directory, filename, as_attachment=True)
    except FileNotFoundError:
        return jsonify({'error': 'File not found'}), 404
