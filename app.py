import os
from flask import Flask, send_from_directory, jsonify, request
from flask_cors import CORS
from backend.routes import api_bp

# Initialize Flask with the static folder pointing to the root 'static' directory
app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)

# Register API routes
app.register_blueprint(api_bp, url_prefix='/api')

# Global Error Handler for 500s to ensure JSON output
@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal Server Error", "details": str(error)}), 500

@app.route('/')
def serve_index():
    # Serve the React App entry point
    if os.path.exists(os.path.join(app.static_folder, 'index.html')):
        return send_from_directory(app.static_folder, 'index.html')
    return "Frontend not built. Please run the build script.", 404

@app.route('/<path:path>')
def serve_static(path):
    # CRITICAL FIX: If an API path falls through here, return 404 JSON, NOT index.html
    if path.startswith('api/'):
        return jsonify({"error": "API endpoint not found"}), 404

    # Check if the file exists in the static folder (e.g. assets/style.css)
    if os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    
    # If file not found and not an API route, serve index.html for React Router
    return serve_index()

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
