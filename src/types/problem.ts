export interface Notebook {
  id: string;
  name: string;
  subject: string;
  created_at?: string;
}

export interface Problem {
  uuid: string;
  notebook_id?: string;
  subject: string;
  type: string;
  date: string;
  summary: string;
  raw_html: string;
  stem_clean_text: string;
  difficulty: number;
  importance: number;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface ProblemInput {
  uuid?: string;
  notebook_id?: string;
  subject: string;
  type: string;
  date: string;
  summary: string;
  raw_html: string;
  stem_clean_text: string;
  tags?: string[];
}

export interface TagCount {
  name: string;
  count: number;
}

export type ProblemType = '单选' | '多选' | '填空' | '简答';

export type SortOption =
  | 'date_desc'
  | 'date_asc'
  | 'difficulty_desc'
  | 'difficulty_asc'
  | 'importance_desc';

export interface DuplicateCheckResult {
  is_duplicate: boolean;
  similarity: number;
  existing_problem?: Problem | null;
}

export type PaperSize = 'A4' | 'B5';
export type PaperMargin = 'compact' | 'normal' | 'spacious';
export type FontSize = number;
export type LayoutDensity = 'compact' | 'standard' | 'ultra';
export type SpacingPreset = 'compact' | 'standard' | 'spacious';

export interface PaperConfig {
  title: string;
  subtitle: string;
  paperSize: PaperSize;
  margin: PaperMargin;
  fontSize: FontSize;
  lineSpacing: SpacingPreset;
  problemSpacing: SpacingPreset;
  density?: LayoutDensity;
  autoFitSinglePage: boolean;
  showDate: boolean;
  showSubjectHeader: boolean;
  showPageNumber: boolean;
}

