import React from 'react';
import { Copy, Check, Download } from 'lucide-react';

export const CodeBlock: React.FC<{ code: string }> = ({ code }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reproduction_experiment.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-[#1e1e1e]">
      <div className="flex justify-between items-center px-4 py-2 bg-[#252526] border-b border-[#333]">
        <span className="text-xs text-slate-400 font-mono">reproduction_experiment.py</span>
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleDownload}
            className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white transition-colors"
            title="Download Python Script"
          >
            <Download size={14} />
            <span>Download</span>
          </button>
          <button 
            onClick={handleCopy}
            className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white transition-colors"
          >
            {copied ? <Check size={14} className="text-green-400"/> : <Copy size={14} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
      <div className="p-4 overflow-x-auto">
        <pre className="text-sm font-mono text-gray-300 leading-6">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};
