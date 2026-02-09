import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { SlideData } from '../types';
import pptxgen from 'pptxgenjs';

export const SlideDeck: React.FC<{ slides: SlideData[] }> = ({ slides }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = () => setCurrentIndex(prev => Math.min(prev + 1, slides.length - 1));
  const prevSlide = () => setCurrentIndex(prev => Math.max(prev - 1, 0));

  const exportPPTX = () => {
    try {
        // Handle ESM import default export quirk if running in certain bundlers
        const PptxGenJS = (pptxgen as any).default || pptxgen;
        const pres = new PptxGenJS();
        
        // Set Metadata
        pres.author = 'ScholarMate';
        pres.title = 'Research Analysis';
    
        slides.forEach((slide) => {
          const s = pres.addSlide();
          
          // Add Title
          s.addText(slide.title, {
            x: 0.5,
            y: 0.5,
            w: '90%',
            h: 1,
            fontSize: 24,
            bold: true,
            color: '363636',
            fontFace: 'Arial'
          });
    
          // Add Divider
          s.addShape(pres.ShapeType.rect, { x: 0.5, y: 1.5, w: '90%', h: 0.05, fill: { color: '0078D7' } });
    
          // Add Bullets
          const bulletText = slide.bullets.map(b => ({
            text: b,
            options: { breakLine: true, bullet: true }
          }));
    
          s.addText(bulletText, {
            x: 0.5,
            y: 1.8,
            w: '90%',
            h: '60%',
            fontSize: 18,
            color: '666666',
            fontFace: 'Arial',
            lineSpacing: 32
          });
        });
    
        pres.writeFile({ fileName: 'ScholarMate_Presentation.pptx' });
    } catch (e) {
        console.error("PPTX Export Failed", e);
        alert("Failed to export slides. The library might not be loaded correctly.");
    }
  };

  if (slides.length === 0) return <div>No slides generated.</div>;

  const currentSlide = slides[currentIndex];

  return (
    <div className="flex flex-col items-center space-y-6">
      <div className="flex justify-between items-center w-full px-2">
        <span className="text-slate-500 text-sm font-medium">Slide {currentIndex + 1} of {slides.length}</span>
        <button 
          onClick={exportPPTX}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          <Download size={16} />
          <span>Export PPTX</span>
        </button>
      </div>

      <div className="w-full aspect-video bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden relative flex flex-col">
        {/* Slide Header */}
        <div className="bg-blue-600 h-2 w-full"></div>
        <div className="flex-1 p-12 flex flex-col">
          <h2 className="text-3xl font-bold text-slate-900 mb-8 border-b-2 border-slate-100 pb-4">
            {currentSlide.title}
          </h2>
          <div className="flex-1 space-y-4">
            {currentSlide.bullets.map((bullet, idx) => (
              <div key={idx} className="flex items-start space-x-3">
                <span className="mt-2 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></span>
                <p className="text-xl text-slate-700 leading-relaxed">{bullet}</p>
              </div>
            ))}
          </div>
          <div className="mt-auto flex justify-between text-slate-400 text-sm">
            <span>ScholarMate Generated</span>
            <span>{currentIndex + 1} / {slides.length}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <button 
          onClick={prevSlide}
          disabled={currentIndex === 0}
          className="p-3 rounded-full bg-white shadow-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft size={24} />
        </button>
        
        <button 
          onClick={nextSlide}
          disabled={currentIndex === slides.length - 1}
          className="p-3 rounded-full bg-white shadow-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
};
