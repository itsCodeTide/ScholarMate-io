export enum AppStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export interface AnalysisResult {
  summary: string;
  critique: string;
  experimentPlan: string;
  pythonCode: string;
  experimentInterpretation: string;
  validationReport: string;
  slides: SlideData[];
}

export interface SlideData {
  title: string;
  bullets: string[];
}

export type AnalysisStep = 'upload' | 'summary' | 'critique' | 'experiment' | 'code' | 'slides' | 'validation';

export interface FileData {
  name: string;
  base64: string;
  mimeType: string;
}