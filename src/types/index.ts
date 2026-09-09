export type ThemePreference = 'light' | 'dark' | 'system';
export type FontFamilyPreference = 'sans' | 'mono';
export type NoteType = 'text' | 'handwritten';

export interface Note {
  id: string;
  user_id: string;
  title: string;
  slug?: string;
  note_type?: NoteType;
  content: string;
  created_at: string;
  updated_at: string;
  last_opened_at: string;
}

export interface UserSettings {
  user_id: string;
  theme: ThemePreference;
  font_size: number;
  font_family: FontFamilyPreference;
  word_wrap: boolean;
  line_numbers: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserAccount {
  id: string;
  username: string;
  created_at: string;
  updated_at: string;
}

export interface OfflineDraft {
  noteId: string;
  userId: string;
  title: string;
  content: string;
  note_type?: NoteType;
  updatedAt: number;
  synced: boolean;
}

export type SaveStatus = 'saved' | 'saving' | 'offline';

// ==============================================================================
// Handwritten Notebook Types
// ==============================================================================

export type DrawingTool =
  | 'pen'
  | 'pencil'
  | 'marker'
  | 'highlighter'
  | 'eraser'
  | 'lasso'
  | 'shape'
  | 'text'
  | 'hand';

export type EraserMode = 'stroke' | 'partial';
export type ShapeType = 'line' | 'arrow' | 'rectangle' | 'circle';
export type PaperTemplate = 'blank' | 'ruled' | 'grid' | 'dotgrid';

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
  tiltX?: number;
  tiltY?: number;
}

export interface Stroke {
  id: string;
  tool: 'pen' | 'pencil' | 'marker' | 'highlighter';
  color: string;
  size: number;
  opacity: number;
  points: StrokePoint[];
}

export interface CanvasShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  fillColor?: string;
  strokeWidth: number;
  opacity: number;
}

export interface CanvasTextBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
}

export interface CanvasImage {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  src: string;
}

export interface NotebookPage {
  id: string;
  template: PaperTemplate;
  paperColor: string;
  strokes: Stroke[];
  shapes: CanvasShape[];
  textBoxes: CanvasTextBox[];
  images: CanvasImage[];
}

export interface HandwrittenNoteData {
  version: 1;
  pages: NotebookPage[];
  currentPageIndex: number;
}
