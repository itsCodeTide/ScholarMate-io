
import subprocess
import sys
import os

def execute_experiment_script(code_path):
    if not os.path.exists(code_path):
        return "Error: Code file not found."

    try:
        with open(code_path, 'r') as f:
            original_code = f.read()
            
        if "matplotlib.use('Agg')" not in original_code:
            safe_code = "import matplotlib\nmatplotlib.use('Agg')\n" + original_code
            with open(code_path, 'w') as f:
                f.write(safe_code)

        result = subprocess.run(
            [sys.executable, code_path],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=os.path.dirname(code_path)
        )
        
        output = ""
        if result.stdout:
            output += f"[STDOUT]\n{result.stdout}\n"
        if result.stderr:
            output += f"\n[STDERR]\n{result.stderr}\n"
        if not output:
            output = "Script executed successfully but produced no output."
        return output
        
    except subprocess.TimeoutExpired:
        return "Error: Execution timed out after 60 seconds."
    except Exception as e:
        return f"System Error executing code: {str(e)}"
