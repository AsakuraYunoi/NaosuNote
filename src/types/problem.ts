export interface Notebook {
  id: string;
  name: string;
  subject: string;
  created_at?: string;
  updated_at?: string;
  is_deleted?: number;
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
  answer_markdown?: string;
  answer_images?: string[];
  created_at?: string;
  updated_at?: string;
  is_deleted?: number;
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
  answer_markdown?: string;
  answer_images?: string[];
  created_at?: string;
  updated_at?: string;
  is_deleted?: number;
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
  customProblemSpacings?: Record<string, number>;
}

// --- 题目可视化画布构件模型 (Canvas Block Models) ---

export type CanvasBlockType =
  | 'lead_text'
  | 'svg_img'
  | 'table'
  | 'sub_item'
  | 'options'
  | 'row_group';

export interface BaseCanvasBlock {
  id: string;
  type: CanvasBlockType;
}

export interface LeadTextBlock extends BaseCanvasBlock {
  type: 'lead_text';
  contentHtml: string; // 支持行内公式与填空横线
}

export interface SvgImgBlock extends BaseCanvasBlock {
  type: 'svg_img';
  svgContent: string; // 原生 <svg> 代码
  nominalWidth?: number;
  nominalHeight?: number;
  aspectRatio?: number;
}

export interface TableBlock extends BaseCanvasBlock {
  type: 'table';
  tableHtml: string; // <table ...> 代码
  nominalWidth?: number;
}

export interface OptionItem {
  label: string; // A, B, C, D
  textHtml: string;
}

export interface OptionsBlock extends BaseCanvasBlock {
  type: 'options';
  options: OptionItem[];
  columnLayout?: 'auto' | '1-col' | '2-col' | '4-col';
}

export interface SubItemBlock extends BaseCanvasBlock {
  type: 'sub_item';
  indexLabel: string; // 如 "(1)", "(2)"
  contentHtml: string;
  subBlocks?: (SvgImgBlock | TableBlock | OptionsBlock)[];
}

export interface RowGroupBlock extends BaseCanvasBlock {
  type: 'row_group';
  children: (SvgImgBlock | TableBlock)[];
}

export type CanvasBlock =
  | LeadTextBlock
  | SvgImgBlock
  | TableBlock
  | OptionsBlock
  | SubItemBlock
  | RowGroupBlock;

export interface ProblemCanvasDoc {
  uuid: string;
  subject: string;
  problemType: string;
  date: string;
  summary: string;
  blocks: CanvasBlock[];
}

// --- Device & Cloud Sync Types ---

export interface DeviceInfo {
  platform: 'desktop' | 'mobile';
  form_factor: 'desktop' | 'pad' | 'phone';
  os: string;
  screen_width_dp: number;
}

export interface UserProfile {
  uuid: string;
  identifier: string;
  nickname: string;
  avatar_url?: string;
  quota_bytes: number;
  created_at: string;
}

export interface ProfileSummary {
  uuid: string;
  nickname: string;
  identifier: string;
  avatar_url?: string;
  used_storage_bytes: number;
  max_quota_bytes: number;
  cloud_problem_count: number;
  cloud_notebook_count: number;
  last_sync_timestamp: number;
}



