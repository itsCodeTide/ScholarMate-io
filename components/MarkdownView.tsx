import React from 'react';

// Helper to parse bold text **like this** within a string
const parseLineWithBold = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, j) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={j} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

// Simple formatter to handle basic Markdown syntax without a heavy library
const formatText = (text: string) => {
  if (!text) return null;
  
  return text.split('\n').map((line, i) => {
    // Headers
    if (line.startsWith('## ')) {
      return <h2 key={i} className="text-2xl font-bold text-slate-800 mt-8 mb-4 border-b pb-2">{line.replace('## ', '')}</h2>;
    }
    if (line.startsWith('### ')) {
      return <h3 key={i} className="text-xl font-semibold text-slate-700 mt-6 mb-3">{line.replace('### ', '')}</h3>;
    }
    
    // Lists
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const content = line.replace(/^[-*]\s/, '');
      return <li key={i} className="ml-4 list-disc text-slate-700 mb-2 pl-1 leading-relaxed">{parseLineWithBold(content)}</li>;
    }
    
    // Numbered Lists
    if (/^\d+\.\s/.test(line.trim())) {
      const content = line.replace(/^\d+\.\s/, '');
      return <li key={i} className="ml-4 list-decimal text-slate-700 mb-2 pl-1 leading-relaxed">{parseLineWithBold(content)}</li>;
    }

    // Empty lines
    if (line.trim() === '') {
      return <div key={i} className="h-3"></div>;
    }

    // Paragraphs
    return (
      <p key={i} className="mb-3 text-slate-700 leading-relaxed">
        {parseLineWithBold(line)}
      </p>
    );
  });
};

export const MarkdownView: React.FC<{ content: string }> = ({ content }) => {
  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
      <article className="prose prose-slate max-w-none">
        {formatText(content)}
      </article>
    </div>
  );
};