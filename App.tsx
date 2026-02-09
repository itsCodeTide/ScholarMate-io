import React, { useState, useCallback } from 'react';
import { Layout } from './components/Layout';
import { MarkdownView } from './components/MarkdownView';
import { CodeBlock } from './components/CodeBlock';
import { SlideDeck } from './components/SlideDeck';
import { generateAnalysis } from './services/geminiService';
import { AppStatus, AnalysisResult, AnalysisStep, FileData } from './types';
import { Upload, Loader2, FileText, CheckCircle2, AlertCircle, Lightbulb, ShieldCheck, Play, Terminal } from 'lucide-react';

// Define Pyodide on window
declare global {
  interface Window {
    loadPyodide: (config: any) => Promise<any>;
  }
}

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [currentStep, setCurrentStep] = useState<AnalysisStep>('upload');
  const [progressMsg, setProgressMsg] = useState('');
  const [file, setFile] = useState<FileData | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Execution State
  const [pyodide, setPyodide] = useState<any>(null);
  const [runStatus, setRunStatus] = useState<'IDLE' | 'LOADING' | 'RUNNING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [output, setOutput] = useState<string>('');
  const [runError, setRunError] = useState<string | null>(null);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Simple validation
      if (selectedFile.type !== 'application/pdf') {
        setError('Please upload a valid PDF file.');
        return;
      }

      setError(null);
      
      // Convert to Base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        setFile({
          name: selectedFile.name,
          base64,
          mimeType: selectedFile.type
        });
      };
      reader.readAsDataURL(selectedFile);
    }
  }, []);

  const startAnalysis = async () => {
    if (!file) return;

    setStatus(AppStatus.PROCESSING);
    setCurrentStep('summary'); // Auto-switch to first view
    
    try {
      const analysis = await generateAnalysis(file.base64, file.mimeType, (msg) => {
        setProgressMsg(msg);
      });
      setResult(analysis);
      setStatus(AppStatus.COMPLETE);
    } catch (err) {
      console.error(err);
      setError('Analysis failed. Please try again or check your API key.');
      setStatus(AppStatus.ERROR);
    }
  };

  const runExperiment = async () => {
    if (!result?.pythonCode) return;
    
    setRunStatus('LOADING');
    setRunError(null);
    setOutput('');
    
    // Logs capture
    const logs: string[] = [];

    try {
      let py = pyodide;
      if (!py) {
        if (!window.loadPyodide) {
           throw new Error("Pyodide script not loaded. Please check internet connection.");
        }
        py = await window.loadPyodide({
          indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.1/full/"
        });
        setPyodide(py);
      }

      setRunStatus('RUNNING');
      
      // Load packages - this can take time
      await py.loadPackage(['numpy', 'pandas', 'scikit-learn', 'matplotlib']);
      
      // Redirect stdout
      py.setStdout({ batched: (msg: string) => logs.push(msg) });
      py.setStderr({ batched: (msg: string) => logs.push(`[stderr] ${msg}`) });

      // Execute
      await py.runPythonAsync(result.pythonCode);
      
      setOutput(logs.join('\n'));
      setRunStatus('SUCCESS');

    } catch (err: any) {
      console.error(err);
      // Capture any partial logs
      if (logs.length > 0) {
        setOutput(logs.join('\n'));
      }
      
      // Extract meaningful error message
      let msg = err.message || err.toString();
      if (msg.includes("PythonError:")) {
        msg = msg.split("PythonError:")[1].trim();
      }
      setRunError(msg);
      setRunStatus('ERROR');
    }
  };

  const renderContent = () => {
    if (status === AppStatus.PROCESSING) {
      return (
        <div className="flex flex-col items-center justify-center h-96 space-y-6">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <div className="absolute top-0 left-0 w-16 h-16 flex items-center justify-center">
              <Loader2 className="text-blue-600 animate-pulse" size={24} />
            </div>
          </div>
          <div className="text-center">
            <h3 className="text-xl font-semibold text-slate-800">Analyzing Paper</h3>
            <p className="text-slate-500 mt-2">{progressMsg}</p>
            <p className="text-xs text-slate-400 mt-4 max-w-md mx-auto">
              Using Gemini 3 Pro to generate summary, critique, experiment plan, code, and slides.
            </p>
          </div>
        </div>
      );
    }

    if (currentStep === 'upload') {
      return (
        <div className="max-w-2xl mx-auto mt-12">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Upload className="text-blue-600" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Upload Research Paper</h2>
            <p className="text-slate-500 mb-8">Select a PDF to begin the reproducible research pipeline.</p>
            
            <div className="relative group">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className={`border-2 border-dashed rounded-xl p-8 transition-colors ${file ? 'border-green-400 bg-green-50' : 'border-slate-300 group-hover:border-blue-400 group-hover:bg-slate-50'}`}>
                {file ? (
                  <div className="flex items-center justify-center space-x-2 text-green-700">
                    <FileText size={20} />
                    <span className="font-medium">{file.name}</span>
                    <CheckCircle2 size={16} />
                  </div>
                ) : (
                  <div className="space-y-2 text-slate-400">
                    <p className="text-sm font-medium text-slate-600">Click to browse or drag file here</p>
                    <p className="text-xs">PDF up to 10MB</p>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center justify-center space-x-2">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={startAnalysis}
              disabled={!file}
              className="mt-8 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-blue-900/10"
            >
              Analyze Paper
            </button>
          </div>
          
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: "Deep Summary", desc: "Structured breakdown of core contributions." },
              { title: "Critical Review", desc: "Identify bias and methodology gaps." },
              { title: "Reproduction", desc: "Auto-generated Python code & synthetic data." }
            ].map((f, i) => (
              <div key={i} className="bg-white/50 p-6 rounded-xl border border-slate-100">
                <h4 className="font-semibold text-slate-800 mb-1">{f.title}</h4>
                <p className="text-sm text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (!result) return null;

    switch (currentStep) {
      case 'summary':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">Research Summary</h2>
            <MarkdownView content={result.summary} />
          </div>
        );
      case 'critique':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">Critical Analysis</h2>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-6 mb-6">
              <div className="flex items-start space-x-3">
                <AlertCircle className="text-amber-600 mt-1" size={20} />
                <div>
                  <h3 className="font-semibold text-amber-900">Limitation Check</h3>
                  <p className="text-amber-800 text-sm mt-1">
                    The following critique highlights potential gaps in the paper's methodology and validation strategy.
                  </p>
                </div>
              </div>
            </div>
            <MarkdownView content={result.critique} />
          </div>
        );
      case 'experiment':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">Experimental Design</h2>
            <MarkdownView content={result.experimentPlan} />
          </div>
        );
      case 'code':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-end">
              <h2 className="text-2xl font-bold text-slate-800">Reproduction Script</h2>
              <span className="text-xs font-mono bg-slate-200 px-2 py-1 rounded text-slate-600">Python 3.10+</span>
            </div>
            
            <CodeBlock code={result.pythonCode} />

            {/* Run Control Bar */}
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                        <Terminal size={20} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-800 text-sm">In-Browser Execution</h3>
                        <p className="text-xs text-slate-500">Run this code safely using Pyodide (WASM)</p>
                    </div>
                </div>
                <button
                    onClick={runExperiment}
                    disabled={runStatus === 'LOADING' || runStatus === 'RUNNING'}
                    className={`
                        flex items-center space-x-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all
                        ${runStatus === 'LOADING' || runStatus === 'RUNNING' 
                            ? 'bg-slate-100 text-slate-400 cursor-wait' 
                            : 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20'}
                    `}
                >
                    {runStatus === 'LOADING' || runStatus === 'RUNNING' ? (
                        <>
                            <Loader2 className="animate-spin" size={16} />
                            <span>{runStatus === 'LOADING' ? 'Loading Pyodide...' : 'Running...'}</span>
                        </>
                    ) : (
                        <>
                            <Play size={16} />
                            <span>Run Experiment</span>
                        </>
                    )}
                </button>
            </div>

            {/* ERROR ALERT */}
            {runStatus === 'ERROR' && runError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-start space-x-3">
                        <AlertCircle className="text-red-600 mt-0.5 shrink-0" size={20} />
                        <div className="flex-1 overflow-hidden">
                            <h3 className="font-bold text-red-900 text-sm">Execution Failed</h3>
                            <div className="mt-2 text-xs text-red-800 font-mono whitespace-pre-wrap break-words bg-red-100/50 p-3 rounded border border-red-200">
                                {runError}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Output Display */}
            {(runStatus === 'SUCCESS' || (output && runStatus === 'ERROR')) && (
                <div className="bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-slate-800">
                    <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-700 flex justify-between items-center">
                        <span className="text-xs text-slate-400 font-mono">STDOUT / LOGS</span>
                    </div>
                    <pre className="p-4 text-sm font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-96">
                        {output || <span className="text-slate-500 italic">No text output produced.</span>}
                    </pre>
                </div>
            )}
            
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
              <div className="flex items-start space-x-3">
                <Lightbulb className="text-blue-600 mt-1" size={20} />
                <div>
                  <h3 className="font-semibold text-blue-900">Expected Results Interpretation</h3>
                  <p className="text-blue-800 leading-relaxed mt-2 text-sm">
                    {result.experimentInterpretation}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      case 'slides':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">Presentation Deck</h2>
            <SlideDeck slides={result.slides} />
          </div>
        );
      case 'validation':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">Consistency Check</h2>
            <div className={`p-6 rounded-xl border ${result.validationReport.includes("consistent and grounded") ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"}`}>
              <div className="flex items-start space-x-3">
                {result.validationReport.includes("consistent and grounded") ? (
                  <CheckCircle2 className="text-green-600 mt-1" size={24} />
                ) : (
                  <AlertCircle className="text-red-600 mt-1" size={24} />
                )}
                <div className="flex-1">
                  <h3 className={`font-semibold ${result.validationReport.includes("consistent and grounded") ? "text-green-900" : "text-red-900"}`}>
                    {result.validationReport.includes("consistent and grounded") ? "Validation Passed" : "Issues Detected"}
                  </h3>
                  <div className={`mt-2 text-sm leading-relaxed ${result.validationReport.includes("consistent and grounded") ? "text-green-800" : "text-red-800"}`}>
                    <MarkdownView content={result.validationReport} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return <div>Unknown Step</div>;
    }
  };

  return (
    <Layout currentStep={currentStep} setStep={setCurrentStep} status={status}>
      {renderContent()}
    </Layout>
  );
};

export default App;