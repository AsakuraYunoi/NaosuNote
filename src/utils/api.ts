import type {
  DuplicateCheckResult,
  Notebook,
  Problem,
  ProblemInput,
  TagCount,
  SortOption,
  DeviceInfo,
  UserProfile,
  ProfileSummary,
} from '../types/problem';
import { INITIAL_PROBLEMS } from './seedData';

let invokeTauri: any = null;

async function getInvoke() {
  if (invokeTauri) return invokeTauri;
  try {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      const tauri = await import('@tauri-apps/api/core');
      invokeTauri = tauri.invoke;
    }
  } catch (e) {
    console.warn('Running outside Tauri environment, fallback active', e);
  }
  return invokeTauri;
}

// 默认种子错题本
let mockNotebooks: Notebook[] = [
  { id: 'nb-chem', name: '高考化学流程题专练', subject: '化学' },
  { id: 'nb-math', name: '高三数学导数突破', subject: '数学' },
  { id: 'nb-phy', name: '高考物理电磁感应', subject: '物理' },
  { id: 'nb-bio', name: '生物遗传系谱与PCR', subject: '生物' },
];

let mockStorage: Problem[] = INITIAL_PROBLEMS.map((p) => {
  if (p.subject === '化学') return { ...p, notebook_id: 'nb-chem', tags: ['工艺流程', '沉淀转化'] };
  if (p.subject === '数学') return { ...p, notebook_id: 'nb-math', tags: ['连分数', '数列递推'] };
  if (p.subject === '物理') return { ...p, notebook_id: 'nb-phy', tags: ['链条复合轨道', '动能定理', '滑动摩擦'] };
  if (p.subject === '生物') return { ...p, notebook_id: 'nb-bio', tags: ['伴性遗传', '基因分离定律'] };
  return p;
});

let mockCustomTags: string[] = [];

export async function apiGetDataDir(): Promise<string> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke('get_data_dir');
  }
  return '/Users/yunoi/Documents/Code/NaosuNote/data';
}

export async function apiGetDataSize(): Promise<number> {
  const invoke = await getInvoke();
  if (invoke) {
    try {
      const bytes: number = await invoke('get_data_size');
      if (typeof bytes === 'number') return bytes;
    } catch (e) {
      console.warn('apiGetDataSize fallback:', e);
    }
  }
  return 0;
}

export async function apiSelectDataDir(): Promise<string | null> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke('select_data_dir');
  }
  return null;
}

export async function apiOpenDataDir(): Promise<void> {
  const invoke = await getInvoke();
  if (invoke) {
    await invoke('open_data_dir');
  }
}

export async function apiOpenUrl(url: string): Promise<void> {
  const invoke = await getInvoke();
  if (invoke) {
    try {
      await invoke('open_url', { url });
      return;
    } catch (e) {
      console.warn('apiOpenUrl error:', e);
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function apiSyncAllMirrors(): Promise<void> {
  const invoke = await getInvoke();
  if (invoke) {
    await invoke('sync_all_mirrors');
  }
}

// --- 错题本 API ---

export async function apiGetNotebooks(): Promise<Notebook[]> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke('get_notebooks');
  }
  return mockNotebooks;
}

export async function apiCreateNotebook(name: string, subject: string): Promise<Notebook> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke('create_notebook', { name, subject });
  }
  const nb: Notebook = {
    id: 'nb-' + Date.now(),
    name,
    subject,
  };
  mockNotebooks.push(nb);
  return nb;
}

export async function apiRenameNotebook(id: string, newName: string): Promise<void> {
  const invoke = await getInvoke();
  if (invoke) {
    await invoke('rename_notebook', { id, newName });
  } else {
    const target = mockNotebooks.find((n) => n.id === id);
    if (target) target.name = newName;
  }
}

export async function apiDeleteNotebook(id: string): Promise<void> {
  const invoke = await getInvoke();
  if (invoke) {
    await invoke('delete_notebook', { id });
  } else {
    mockNotebooks = mockNotebooks.filter((n) => n.id !== id);
    mockStorage = mockStorage.filter((p) => p.notebook_id !== id);
  }
}

export async function apiExportNotebookHtml(id: string): Promise<string | null> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke('export_notebook_html', { id });
  }
  return null;
}

// --- 错题 API ---

export async function apiGetProblems(
  notebookId?: string,
  subject?: string,
  problemType?: string,
  search?: string,
  tags?: string[],
  sortBy?: string,
  startDate?: string,
  endDate?: string
): Promise<Problem[]> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke('get_problems', {
      notebookId,
      subject,
      problemType,
      tags,
      search,
      sortBy,
      startDate,
      endDate,
    });
  }

  let result = [...mockStorage];
  if (notebookId && notebookId !== 'all') {
    result = result.filter((p) => p.notebook_id === notebookId);
  }
  if (subject && subject !== '全部') {
    result = result.filter((p) => p.subject === subject);
  }
  if (problemType && problemType !== '全部') {
    result = result.filter((p) => p.type === problemType);
  }
  if (startDate) {
    const sNorm = startDate.replace(/-/g, '').trim();
    result = result.filter((p) => (p.date || '').replace(/-/g, '').slice(0, 8) >= sNorm);
  }
  if (endDate) {
    const eNorm = endDate.replace(/-/g, '').trim();
    result = result.filter((p) => (p.date || '').replace(/-/g, '').slice(0, 8) <= eNorm);
  }
  if (tags && tags.length > 0) {
    result = result.filter((p) => {
      const pTags = p.tags || [];
      return tags.every((t) => pTags.includes(t));
    });
  }
  if (search && search.trim()) {
    const tokens = search.trim().toLowerCase().split(/\s+/);
    result = result.filter((p) => {
      const stem = p.stem_clean_text.toLowerCase();
      const sum = (p.summary || '').toLowerCase();
      const sub = p.subject.toLowerCase();
      const tagStr = (p.tags || []).join(' ').toLowerCase();
      return tokens.every((token) =>
        stem.includes(token) ||
        sum.includes(token) ||
        sub.includes(token) ||
        tagStr.includes(token)
      );
    });
  }

  if (sortBy === 'difficulty_desc') {
    result.sort((a, b) => b.difficulty - a.difficulty || b.importance - a.importance);
  } else if (sortBy === 'difficulty_asc') {
    result.sort((a, b) => a.difficulty - b.difficulty || b.importance - a.importance);
  } else if (sortBy === 'importance_desc') {
    result.sort((a, b) => b.importance - a.importance || b.difficulty - a.difficulty);
  } else if (sortBy === 'date_asc') {
    result.sort((a, b) => a.date.localeCompare(b.date));
  } else {
    result.sort((a, b) => b.date.localeCompare(a.date));
  }

  return result;
}

export async function apiGetTags(
  notebookId?: string,
  subject?: string
): Promise<TagCount[]> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke('get_tags', { notebookId, subject });
  }

  let candidates = [...mockStorage];
  if (subject && subject !== '全部') {
    candidates = candidates.filter((p) => p.subject === subject);
  }
  if (notebookId && notebookId !== 'all') {
    candidates = candidates.filter((p) => p.notebook_id === notebookId);
  }

  const counts = new Map<string, number>();
  for (const p of candidates) {
    for (const t of p.tags || []) {
      const trimmed = t.trim();
      if (trimmed) {
        counts.set(trimmed, (counts.get(trimmed) || 0) + 1);
      }
    }
  }

  // 纳入 mockCustomTags 中独立创建的标签
  for (const ct of mockCustomTags) {
    if (!counts.has(ct)) {
      counts.set(ct, 0);
    }
  }

  const list: TagCount[] = Array.from(counts.entries()).map(([name, count]) => ({
    name,
    count,
  }));
  list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return list;
}

export async function apiCreateTag(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const invoke = await getInvoke();
  if (invoke) {
    await invoke('create_tag', { name: trimmed });
    return;
  }
  if (!mockCustomTags.includes(trimmed)) {
    mockCustomTags.push(trimmed);
  }
}

export async function apiRenameTag(oldName: string, newName: string): Promise<number> {
  const oldTrimmed = oldName.trim();
  const newTrimmed = newName.trim();
  if (!oldTrimmed || !newTrimmed) return 0;
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke('rename_tag', { oldName: oldTrimmed, newName: newTrimmed });
  }
  let count = 0;
  for (const p of mockStorage) {
    if (p.tags && p.tags.includes(oldTrimmed)) {
      p.tags = Array.from(new Set(p.tags.map((t) => (t === oldTrimmed ? newTrimmed : t))));
      count++;
    }
  }
  const idx = mockCustomTags.indexOf(oldTrimmed);
  if (idx >= 0) {
    mockCustomTags[idx] = newTrimmed;
  }
  return count;
}

export async function apiDeleteTag(name: string): Promise<number> {
  const trimmed = name.trim();
  if (!trimmed) return 0;
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke('delete_tag', { name: trimmed });
  }
  let count = 0;
  for (const p of mockStorage) {
    if (p.tags && p.tags.includes(trimmed)) {
      p.tags = p.tags.filter((t) => t !== trimmed);
      count++;
    }
  }
  mockCustomTags = mockCustomTags.filter((t) => t !== trimmed);
  return count;
}

export async function apiUpdateProblemTags(
  uuid: string,
  tags: string[]
): Promise<void> {
  const invoke = await getInvoke();
  if (invoke) {
    await invoke('update_problem_tags', { uuid, tags });
  } else {
    const target = mockStorage.find((p) => p.uuid === uuid);
    if (target) {
      target.tags = [...tags];
    }
  }
}

export async function apiUpdateProblemContent(
  uuid: string,
  rawHtml: string,
  stemCleanText: string,
  summary: string,
  problemType: string
): Promise<void> {
  const invoke = await getInvoke();
  if (invoke) {
    await invoke('update_problem_content', {
      uuid,
      rawHtml,
      stemCleanText,
      summary,
      problemType,
    });
  } else {
    const target = mockStorage.find((p) => p.uuid === uuid);
    if (target) {
      target.raw_html = rawHtml;
      target.stem_clean_text = stemCleanText;
      target.summary = summary;
      target.type = problemType;
      target.updated_at = new Date().toISOString();
    }
  }
}


export async function apiCheckDuplicate(
  subject: string,
  stemCleanText: string,
  threshold: number = 0.85
): Promise<DuplicateCheckResult> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke('check_duplicate', {
      subject,
      stemCleanText,
      threshold,
    });
  }

  function calcSim(s1: string, s2: string): number {
    const c1 = Array.from(s1);
    const c2 = Array.from(s2);
    const len1 = c1.length;
    const len2 = c2.length;
    if (len1 === 0 && len2 === 0) return 1.0;
    if (len1 === 0 || len2 === 0) return 0.0;
    const dp: number[][] = Array.from({ length: len1 + 1 }, () =>
      Array(len2 + 1).fill(0)
    );
    for (let i = 0; i <= len1; i++) dp[i][0] = i;
    for (let j = 0; j <= len2; j++) dp[0][j] = j;
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = c1[i - 1] === c2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    const dist = dp[len1][len2];
    return 1.0 - dist / Math.max(len1, len2);
  }

  let maxSim = 0;
  let matched: Problem | null = null;
  const candidates = mockStorage.filter((p) => p.subject === subject);
  for (const c of candidates) {
    const sim = calcSim(stemCleanText, c.stem_clean_text);
    if (sim > maxSim) {
      maxSim = sim;
      matched = c;
    }
  }

  if (maxSim >= threshold) {
    return {
      is_duplicate: true,
      similarity: Math.round(maxSim * 100) / 100,
      existing_problem: matched,
    };
  }
  return {
    is_duplicate: false,
    similarity: Math.round(maxSim * 100) / 100,
    existing_problem: null,
  };
}

export async function apiSaveProblem(input: ProblemInput): Promise<Problem> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke('save_problem', { input });
  }
  const problem: Problem = {
    ...input,
    uuid: input.uuid || 'mock-' + Date.now(),
    difficulty: 1,
    importance: 1,
  };
  mockStorage.unshift(problem);
  return problem;
}

export async function apiUpdateRatings(
  uuid: string,
  difficulty?: number,
  importance?: number
): Promise<void> {
  const invoke = await getInvoke();
  if (invoke) {
    await invoke('update_ratings', { uuid, difficulty, importance });
  } else {
    const target = mockStorage.find((p) => p.uuid === uuid);
    if (target) {
      if (difficulty !== undefined) target.difficulty = difficulty;
      if (importance !== undefined) target.importance = importance;
    }
  }
}

export async function apiIncrementImportance(uuid: string): Promise<number> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke('increment_importance', { uuid });
  }
  const target = mockStorage.find((p) => p.uuid === uuid);
  if (target) {
    target.importance = Math.min(5, (target.importance || 1) + 1);
    return target.importance;
  }
  return 1;
}

export async function apiDeleteProblem(uuid: string): Promise<void> {
  const invoke = await getInvoke();
  if (invoke) {
    await invoke('delete_problem', { uuid });
  } else {
    mockStorage = mockStorage.filter((p) => p.uuid !== uuid);
  }
}

export async function apiBackupDatabase(): Promise<string | null> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke('backup_database');
  }
  return null;
}

// 在系统默认浏览器中打开试卷并触发系统打印 / 另存为 PDF
export async function apiOpenPaperInBrowser(paperHtml: string): Promise<string> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke('open_paper_in_browser', { paperHtml });
  }

  // 纯浏览器环境下的回退：直接使用 window.open 打开并打印
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(paperHtml);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 500);
  }
  return 'opened_in_tab';
}

// 直接导出高保真矢量 PDF 到指定磁盘路径
export async function apiExportPdfDirect(paperHtml: string, title?: string): Promise<string | null> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke('export_pdf_direct', { paperHtml, title });
  }
  return null;
}

// --- 批量操作 API ---

export async function apiMoveOrCopyProblems(
  uuids: string[],
  targetNotebookId: string,
  isCopy: boolean
): Promise<number> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke('move_or_copy_problems', {
      uuids,
      targetNotebookId,
      isCopy,
    });
  }
  const targetNb = mockNotebooks.find((n) => n.id === targetNotebookId);
  if (!targetNb) return 0;
  if (isCopy) {
    const toCopy = mockStorage.filter((p) => uuids.includes(p.uuid));
    for (const p of toCopy) {
      mockStorage.push({
        ...p,
        uuid: 'copy-' + Math.random().toString(36).slice(2),
        notebook_id: targetNotebookId,
        subject: targetNb.subject,
      });
    }
    return toCopy.length;
  } else {
    let count = 0;
    for (const p of mockStorage) {
      if (uuids.includes(p.uuid)) {
        p.notebook_id = targetNotebookId;
        p.subject = targetNb.subject;
        count++;
      }
    }
    return count;
  }
}

export async function apiBatchDeleteProblems(uuids: string[]): Promise<number> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke('batch_delete_problems', { uuids });
  }
  const initialLen = mockStorage.length;
  mockStorage = mockStorage.filter((p) => !uuids.includes(p.uuid));
  return initialLen - mockStorage.length;
}

export async function apiBatchAddTag(uuids: string[], tag: string): Promise<number> {
  const trimmed = tag.trim();
  if (!trimmed) return 0;
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke('batch_add_tag_to_problems', { uuids, tag: trimmed });
  }
  let count = 0;
  for (const p of mockStorage) {
    if (uuids.includes(p.uuid)) {
      if (!p.tags) p.tags = [];
      if (!p.tags.includes(trimmed)) {
        p.tags.push(trimmed);
        count++;
      }
    }
  }
  return count;
}

// --- 答案区 API ---

export async function apiSaveAnswerImage(
  uuid: string,
  pageIndex: number,
  imageBytes: Uint8Array
): Promise<string> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke('save_answer_image', {
      uuid,
      pageIndex,
      imageBytes: Array.from(imageBytes),
    });
  }
  return `${uuid}_p${pageIndex}.webp`;
}

export async function apiDeleteAnswerImage(filename: string): Promise<void> {
  const invoke = await getInvoke();
  if (invoke) {
    await invoke('delete_answer_image', { filename });
  }
}

export async function apiReadAnswerImage(filename: string): Promise<Uint8Array | null> {
  const invoke = await getInvoke();
  if (invoke) {
    try {
      const raw: any = await invoke('read_answer_image', { filename });
      if (raw instanceof Uint8Array) {
        return raw;
      }
      if (raw instanceof ArrayBuffer) {
        return new Uint8Array(raw);
      }
      if (Array.isArray(raw)) {
        return new Uint8Array(raw);
      }
      if (raw && typeof raw === 'object' && 'buffer' in raw) {
        return new Uint8Array(raw.buffer);
      }
    } catch (err) {
      console.warn(`[apiReadAnswerImage] Failed to read ${filename}:`, err);
      return null;
    }
  }
  return null;
}

export async function apiUpdateProblemAnswer(
  uuid: string,
  answerMarkdown: string,
  answerImages: string[]
): Promise<void> {
  const invoke = await getInvoke();
  if (invoke) {
    await invoke('update_problem_answer', {
      uuid,
      answerMarkdown,
      answerImages,
    });
  } else {
    const target = mockStorage.find((p) => p.uuid === uuid);
    if (target) {
      target.answer_markdown = answerMarkdown;
      target.answer_images = [...answerImages];
    }
  }
}

// 弹出系统原生文件保存选择器，保存二进制数据 (如 PNG、PDF、WebP)
export async function apiSaveBinaryFileWithDialog(params: {
  title: string;
  defaultName: string;
  filterName: string;
  filterExts: string[];
  data: number[];
}): Promise<string | null> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke('save_binary_file_with_dialog', params);
  }
  return null;
}

// 弹出系统原生文件保存选择器，保存文本数据 (如 HTML、Markdown、JSON)
export async function apiSaveTextFileWithDialog(params: {
  title: string;
  defaultName: string;
  filterName: string;
  filterExts: string[];
  content: string;
}): Promise<string | null> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke('save_text_file_with_dialog', params);
  }
  return null;
}

// 弹出系统原生文件保存选择器，下载并保存指定答案图片
export async function apiExportAnswerImage(
  filename: string,
  suggestedName?: string
): Promise<string | null> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke('export_answer_image', { filename, suggestedName });
  }
  return null;
}

// 在系统资源管理器 / macOS 访达中定位并高亮文件
export async function apiShowInFolder(path: string): Promise<void> {
  const invoke = await getInvoke();
  if (invoke) {
    await invoke('show_in_folder', { path });
  }
}

// 弹出系统原生文件保存选择器，将题目直接渲染导出为高清晰度 PNG 图片
export async function apiExportProblemImage(
  paperHtml: string,
  title?: string
): Promise<string | null> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke('export_problem_image', { paperHtml, title });
  }
  return null;
}

// --- Device Info & Form Factor Detection ---

export async function apiGetDeviceInfo(): Promise<DeviceInfo> {
  // 1. 支持前端开发者通过 URL 参数或 localStorage 显式强制模拟测试 (e.g. ?device=phone)
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const forceParam = urlParams.get('device');
    if (forceParam === 'phone' || forceParam === 'pad' || forceParam === 'desktop') {
      return {
        platform: forceParam === 'desktop' ? 'desktop' : 'mobile',
        form_factor: forceParam,
        os: 'simulated',
        screen_width_dp: forceParam === 'phone' ? 390 : 1024,
      };
    }
    const savedForce = localStorage.getItem('naosu_force_device_mode');
    if (savedForce === 'phone' || savedForce === 'pad' || savedForce === 'desktop') {
      return {
        platform: savedForce === 'desktop' ? 'desktop' : 'mobile',
        form_factor: savedForce,
        os: 'simulated',
        screen_width_dp: savedForce === 'phone' ? 390 : 1024,
      };
    }
  }

  // 2. 调用底层 Rust 读取原生硬件信息
  const invoke = await getInvoke();
  if (invoke) {
    try {
      const info: DeviceInfo = await invoke('get_device_info');
      if (info && info.form_factor) {
        return info;
      }
    } catch (e) {
      console.warn('apiGetDeviceInfo invocation fallback:', e);
    }
  }

  // 3. 浏览器纯前端兜底探测 (根据视口宽度自适应)
  if (typeof window !== 'undefined') {
    const width = window.innerWidth;
    if (width < 640) {
      return { platform: 'mobile', form_factor: 'phone', os: 'web', screen_width_dp: width };
    } else if (width < 1024) {
      return { platform: 'mobile', form_factor: 'pad', os: 'web', screen_width_dp: width };
    }
  }

  return {
    platform: 'desktop',
    form_factor: 'desktop',
    os: 'web',
    screen_width_dp: 1200,
  };
}

// --- Cloud Server URL & Credentials Management ---

export const DEFAULT_SERVER_URL = 'https://naosunote.yunoi.online';

export function getServerBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('naosu_server_url') || DEFAULT_SERVER_URL;
  }
  return DEFAULT_SERVER_URL;
}

export function setServerBaseUrl(url: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('naosu_server_url', url.replace(/\/+$/, ''));
  }
}

export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('naosu_auth_token');
  }
  return null;
}

export function getStoredUserProfile(): UserProfile | null {
  if (typeof window !== 'undefined') {
    const json = localStorage.getItem('naosu_user_profile');
    if (json) {
      try {
        return JSON.parse(json);
      } catch (e) {
        console.warn('Failed to parse stored user profile', e);
      }
    }
  }
  return null;
}

// --- Cloud Authentication API ---

export async function apiLogin(
  identifier: string,
  password: string
): Promise<{ token: string; user: UserProfile }> {
  const baseUrl = getServerBaseUrl();
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });

  const json = await res.json();
  if (!res.ok || json.code !== 200 || !json.data) {
    throw new Error(json.message || '登录失败，请检查账号密码');
  }

  const { token, user } = json.data;
  if (typeof window !== 'undefined') {
    localStorage.setItem('naosu_auth_token', token);
    localStorage.setItem('naosu_is_logged_in', 'true');
    localStorage.setItem('naosu_user_name', user.nickname);
    localStorage.setItem('naosu_user_email', user.identifier);
    localStorage.setItem('naosu_user_profile', JSON.stringify(user));
    if (user.avatar_url) {
      import('./avatar').then(({ setRemoteAvatarUrl }) => {
        setRemoteAvatarUrl(user.avatar_url);
      }).catch(() => {});
    }
  }

  return { token, user };
}

export function apiLogout(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('naosu_auth_token');
    localStorage.removeItem('naosu_user_profile');
    localStorage.setItem('naosu_is_logged_in', 'false');
  }
}

export async function apiGetProfileSummary(): Promise<ProfileSummary> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('未登录');
  }

  const baseUrl = getServerBaseUrl();
  const res = await fetch(`${baseUrl}/api/user/profile-summary`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const json = await res.json();
  if (!res.ok || json.code !== 200 || !json.data) {
    throw new Error(json.message || '获取个人信息概况失败');
  }

  return json.data;
}

// --- Cloud Sync API (Pull & Push & Images) ---

export interface SyncResult {
  pulledProblems: number;
  pushedProblems: number;
  uploadedImages: number;
  downloadedImages: number;
}

export async function apiSyncCloud(
  onProgress?: (msg: string) => void
): Promise<SyncResult> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('请先登录账号以启用云端同步');
  }

  const baseUrl = getServerBaseUrl();
  const result: SyncResult = {
    pulledProblems: 0,
    pushedProblems: 0,
    uploadedImages: 0,
    downloadedImages: 0,
  };

  onProgress?.('正在校验云端凭证...');

  // 1. Pull 阶段：拉取云端新增/修改数据
  onProgress?.('正在拉取云端错题增量...');
  const lastSyncTimestamp = Number(localStorage.getItem('naosu_last_sync_timestamp') || '0');

  const pullRes = await fetch(`${baseUrl}/api/sync/pull`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ last_sync_timestamp: lastSyncTimestamp }),
  });

  const pullJson = await pullRes.json();
  if (!pullRes.ok || pullJson.code !== 200 || !pullJson.data) {
    throw new Error(pullJson.message || '从云端拉取失败');
  }

  const { notebooks: remoteNotebooks, problems: remoteProblems, tags: _remoteTags, server_timestamp } = pullJson.data;

  // 将远程数据合并到本地
  for (const nb of remoteNotebooks || []) {
    if (nb.is_deleted) {
      try { await apiDeleteNotebook(nb.id); } catch (_) {}
    } else {
      try {
        const localNbs = await apiGetNotebooks();
        const exists = localNbs.find((n: Notebook) => n.id === nb.id);
        if (!exists) {
          await apiCreateNotebook(nb.name, nb.subject);
        } else if (exists.name !== nb.name) {
          await apiRenameNotebook(nb.id, nb.name);
        }
      } catch (_) {}
    }
  }

  for (const prob of remoteProblems || []) {
    if (prob.is_deleted) {
      try { await apiDeleteProblem(prob.uuid); } catch (_) {}
    } else {
      try {
        await apiSaveProblem({
          uuid: prob.uuid,
          notebook_id: prob.notebook_id,
          subject: prob.subject,
          type: prob.problem_type || prob.type || '简答',
          date: prob.date || new Date().toISOString().split('T')[0],
          summary: prob.summary,
          raw_html: prob.raw_html,
          stem_clean_text: prob.stem_clean_text,
          tags: prob.tags,
          answer_markdown: prob.answer_markdown,
          answer_images: prob.answer_images,
        });
        if (prob.difficulty) {
          await apiUpdateRatings(prob.uuid, prob.difficulty, prob.importance || 1);
        }
        result.pulledProblems++;
      } catch (err) {
        console.warn('Failed to save pulled problem:', err);
      }
    }
  }

  // 2. Push 阶段：推送本地修改到云端
  onProgress?.('正在推送本地最新变更...');
  const localProblems = await apiGetProblems();
  const localNotebooks = await apiGetNotebooks();
  const localTags = await apiGetTags();

  const pushPayload = {
    client_timestamp: Date.now(),
    notebooks: localNotebooks.map((n: Notebook) => ({
      id: n.id,
      name: n.name,
      subject: n.subject,
      is_deleted: 0,
      updated_at: Date.now(),
    })),
    problems: localProblems.map((p: Problem) => ({
      uuid: p.uuid,
      notebook_id: p.notebook_id,
      subject: p.subject,
      type: p.type,
      summary: p.summary,
      raw_html: p.raw_html,
      stem_clean_text: p.stem_clean_text,
      difficulty: p.difficulty,
      importance: p.importance,
      tags: p.tags,
      answer_markdown: p.answer_markdown,
      answer_images: p.answer_images,
      is_deleted: 0,
      updated_at: Date.now(),
    })),
    tags: localTags.map((t: TagCount) => ({
      name: t.name,
      is_deleted: 0,
      updated_at: Date.now(),
    })),
  };

  const pushRes = await fetch(`${baseUrl}/api/sync/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(pushPayload),
  });

  const pushJson = await pushRes.json();
  if (pushRes.ok && pushJson.code === 200) {
    result.pushedProblems = pushJson.data?.applied_count || 0;
  }

  // 3. 图片资源比对与同步
  onProgress?.('正在比对本地与云端图片...');
  const allLocalImageNames: string[] = [];
  for (const p of localProblems) {
    if (p.answer_images && Array.isArray(p.answer_images)) {
      allLocalImageNames.push(...p.answer_images);
    }
  }

  try {
    const checkImgRes = await fetch(`${baseUrl}/api/sync/images/check-missing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ client_image_filenames: allLocalImageNames }),
    });

    const checkImgJson = await checkImgRes.json();
    if (checkImgRes.ok && checkImgJson.code === 200 && checkImgJson.data) {
      const { need_upload, need_download } = checkImgJson.data;

      // 逐张上传本地有但服务端缺失的图片
      if (Array.isArray(need_upload) && need_upload.length > 0) {
        onProgress?.(`正在上传图片 (0/${need_upload.length})...`);
        let upIdx = 0;
        for (const filename of need_upload) {
          try {
            const bytes = await apiReadAnswerImage(filename);
            if (!bytes || bytes.length === 0) {
              console.warn(`[apiSyncCloud] Image ${filename} byte content is empty or unreadable, skipping`);
              continue;
            }
            const formData = new FormData();
            const blob = new Blob([bytes as any], { type: 'image/webp' });
            formData.append('file', blob, filename);

            const uploadRes = await fetch(`${baseUrl}/api/sync/images/upload`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: formData,
            });

            const uploadJson = await uploadRes.json().catch(() => null);
            if (!uploadRes.ok || (uploadJson && uploadJson.code !== 200)) {
              console.error(`[apiSyncCloud] Failed to upload image ${filename}:`, uploadRes.status, uploadJson);
              throw new Error(uploadJson?.message || `HTTP ${uploadRes.status} ${uploadRes.statusText}`);
            }
            result.uploadedImages++;
          } catch (e: any) {
            console.warn(`Failed to upload image ${filename}:`, e);
            onProgress?.(`上传图片 ${filename} 提示: ${e?.message || e}`);
          }
          upIdx++;
          onProgress?.(`正在上传图片 (${upIdx}/${need_upload.length})...`);
        }
      }

      // 逐张下载服务端有但本地缺失的图片
      if (Array.isArray(need_download) && need_download.length > 0) {
        onProgress?.(`正在下载云端图片 (0/${need_download.length})...`);
        let downIdx = 0;
        for (const filename of need_download) {
          try {
            const imgRes = await fetch(`${baseUrl}/api/sync/images/download/${encodeURIComponent(filename)}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (imgRes.ok) {
              const arrayBuf = await imgRes.arrayBuffer();
              const u8 = new Uint8Array(arrayBuf);
              // 解析 uuid 和 page_index
              const match = filename.match(/^(.+)_p(\d+)\.webp$/);
              if (match) {
                const uuid = match[1];
                const pIdx = parseInt(match[2], 10);
                await apiSaveAnswerImage(uuid, pIdx, u8);
              }
              result.downloadedImages++;
            }
          } catch (e) {
            console.warn(`Failed to download image ${filename}:`, e);
          }
          downIdx++;
          onProgress?.(`正在下载云端图片 (${downIdx}/${need_download.length})...`);
        }
      }
    }
  } catch (imgErr) {
    console.warn('Image sync error:', imgErr);
  }

  // 4. 同步最新用户头像
  try {
    const summary = await apiGetProfileSummary();
    if (summary.avatar_url) {
      const { setRemoteAvatarUrl } = await import('./avatar');
      setRemoteAvatarUrl(summary.avatar_url);
    }
  } catch (avErr) {
    console.warn('Avatar sync check:', avErr);
  }

  // 4. 更新同步时间戳与本地镜像
  if (server_timestamp) {
    localStorage.setItem('naosu_last_sync_timestamp', String(server_timestamp));
    const nowStr = new Date(server_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    localStorage.setItem('naosu_last_sync_time', `今天 ${nowStr}`);
  }

  await apiSyncAllMirrors();
  onProgress?.('同步完成');

  return result;
}





