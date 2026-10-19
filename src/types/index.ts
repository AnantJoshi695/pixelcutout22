export interface ImageData {
  original: HTMLImageElement;
  processed: HTMLImageElement | null;
  /**
   * AI foreground mask (alpha channel = foreground coverage).
   * Kept separately from `processed` so the Recover tool can always fall back
   * to the untrimmed original pixels and so the editor can rebuild the
   * composite without destroying the source image.
   */
  aiMask?: HTMLImageElement | null;
  fileName: string;
  fileSize: number;
  dimensions: {
    width: number;
    height: number;
  };
}

export interface BrushSettings {
  size: number;
  hardness: number;
  opacity: number;
}

export interface EditorState {
  image: ImageData | null;
  tool: EditorTool;
  brushSettings: BrushSettings;
  zoom: number;
  pan: { x: number; y: number };
  background: BackgroundSettings;
  processing: boolean;
  error: string | null;
}

export type EditorTool = 'select' | 'remove' | 'recover' | 'eraser';

export interface BackgroundSettings {
  type: 'transparent' | 'solid' | 'gradient' | 'image' | 'blur';
  color?: string;
  gradient?: {
    type: 'linear' | 'radial';
    colors: string[];
  };
  image?: string;
  blurAmount?: number;
}

export interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
}

export type Theme = 'light' | 'dark' | 'system';

export interface ProcessingStep {
  message: string;
  progress?: number;
}

export type ExportFormat = 'png' | 'jpeg' | 'webp';

/**
 * Processing effort the user picks before a cut-out is produced. Each level
 * uses a genuinely different model precision *and* a different amount of
 * alpha-mask refinement — see `services/backgroundRemovalService.ts`.
 */
export type ProcessingQuality = 'fast' | 'high' | 'ultra';

