import React from 'react';
import { BookOpen, FileText, AlertTriangle, FlaskConical, Code, Presentation, Upload, ShieldCheck } from 'lucide-react';
import { AnalysisStep, AppStatus } from '../types';

interface LayoutProps {
  currentStep: AnalysisStep;
  setStep: (step: AnalysisStep) => void;
  status: AppStatus;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ currentStep, setStep, status, children }) => {
  const navItems: { id: AnalysisStep; label: string; icon: React.ReactNode }[] = [
    { id: 'upload', label: 'Upload', icon: <Upload size={18} /> },
    { id: 'summary', label: 'Summary', icon: <FileText size={18} /> },
    { id: 'critique', label: 'Critique', icon: <AlertTriangle size={18} /> },
    { id: 'experiment', label: 'Experiment', icon: <FlaskConical size={18} /> },
    { id: 'code', label: 'Code', icon: <Code size={18} /> },
    { id: 'slides', label: 'Slides', icon: <Presentation size={18} /> },
    { id: 'validation', label: 'Validation', icon: <ShieldCheck size={18} /> },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl z-10">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center space-x-2 text-white">
            <BookOpen className="text-blue-400" size={24} />
            <h1 className="text-xl font-bold tracking-tight">ScholarMate</h1>
          </div>
          <p className="text-xs text-slate-500 mt-2">Reproducible Research Assistant</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = currentStep === item.id;
            const isDisabled = status === AppStatus.IDLE && item.id !== 'upload';
            
            return (
              <button
                key={item.id}
                onClick={() => !isDisabled && setStep(item.id)}
                disabled={isDisabled}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200
                  ${isActive 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                    : 'hover:bg-slate-800 hover:text-white'
                  }
                  ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {item.icon}
                <span className="font-medium text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <div className={`w-2 h-2 rounded-full ${status === AppStatus.PROCESSING ? 'bg-yellow-400 animate-pulse' : status === AppStatus.COMPLETE ? 'bg-green-400' : 'bg-slate-600'}`}></div>
            <span>Status: {status}</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative">
        <div className="max-w-5xl mx-auto p-8 min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
};
