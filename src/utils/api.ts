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
import { invoke, isTauri } from '@tauri-apps/api/core';
import { setRemoteAvatarUrl } from './avatar';

let invokeTauri: any = null;

async function getInvoke() {
  if (invokeTauri) return invokeTauri;
  try {
    if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || isTauri())) {
      invokeTauri = invoke;
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

export interface StorageOption {
  id: string;
  name: string;
  path: string;
  description: string;
  is_recommended: boolean;
}

export async function apiGetDataDir(): Promise<string> {
  const invoke = await getInvoke();
  if (invoke) {
    try {
      const dir: string = await invoke('get_data_dir');
      if (dir) return dir;
    } catch (e) {
      console.warn('apiGetDataDir invoke error:', e);
    }
  }
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('naosu_data_dir');
    if (saved) return saved;
  }
  const dev = await apiGetDeviceInfo().catch(() => null);
  if (dev?.os === 'android') {
    return '/storage/emulated/0/Documents/NaosuNoteData';
  }
  if (dev?.os === 'ios') {
    return 'Documents/NaosuNoteData';
  }
  return '~/Documents/NaosuNoteData';
}

export async function apiSetDataDir(path: string): Promise<string> {
  const cleanPath = path.trim();
  if (!cleanPath) throw new Error('保存目录路径不能为空');

  const invoke = await getInvoke();
  if (invoke) {
    const res: string = await invoke('set_data_dir', { path: cleanPath });
    if (typeof window !== 'undefined') {
      localStorage.setItem('naosu_data_dir', res);
    }
    return res;
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem('naosu_data_dir', cleanPath);
  }
  return cleanPath;
}

export async function apiGetStorageOptions(): Promise<StorageOption[]> {
  const invoke = await getInvoke();
  if (invoke) {
    try {
      const opts: StorageOption[] = await invoke('get_storage_options');
      if (Array.isArray(opts) && opts.length > 0) {
        return opts;
      }
    } catch (e) {
      console.warn('apiGetStorageOptions invoke error:', e);
    }
  }

  const dev = await apiGetDeviceInfo().catch(() => null);
  if (dev?.os === 'android' || (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent))) {
    return [
      {
        id: 'android_external_app',
        name: '外部应用私有目录 (Android/data)',
        path: '/storage/emulated/0/Android/data/com.naosunote.app/files/NaosuNoteData',
        description: '推荐！零权限要求，外部扩展存储空间，适合大容量配图与离线镜像存储',
        is_recommended: true,
      },
      {
        id: 'android_internal',
        name: '应用内部沙盒存储',
        path: '/data/user/0/com.naosunote.app/files/NaosuNoteData',
        description: '免外部存储权限，系统级安全隔离，卸载应用时自动清除',
        is_recommended: false,
      },
      {
        id: 'android_docs',
        name: '系统公共文档目录 (Documents)',
        path: '/storage/emulated/0/Documents/NaosuNoteData',
        description: '若手机系统已授予全部文件访问权限，可通过手机系统「文件」应用直接访问',
        is_recommended: false,
      },
      {
        id: 'custom',
        name: '自定义绝对路径',
        path: '',
        description: '自行指定设备上的有效绝对目录路径',
        is_recommended: false,
      },
    ];
  }

  if (dev?.os === 'ios' || (typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent))) {
    return [
      {
        id: 'ios_docs',
        name: '应用文稿目录 (Documents)',
        path: 'Documents/NaosuNoteData',
        description: '推荐！支持通过 iOS「文件」App 浏览与隔空投送 (AirDrop)',
        is_recommended: true,
      },
      {
        id: 'ios_app_support',
        name: '应用支持目录 (Application Support)',
        path: 'Library/Application Support/NaosuNoteData',
        description: '系统级私有存储，自动包含在 iCloud 整机备份中',
        is_recommended: false,
      },
      {
        id: 'custom',
        name: '自定义绝对路径',
        path: '',
        description: '自行指定设备上的有效绝对目录路径',
        is_recommended: false,
      },
    ];
  }

  return [
    {
      id: 'desktop_docs',
      name: '个人文档目录 (Documents)',
      path: '~/Documents/NaosuNoteData',
      description: '推荐！方便在访达或文件资源管理器中直接双击离线单文件镜像',
      is_recommended: true,
    },
    {
      id: 'desktop_app_data',
      name: '应用数据目录 (AppData)',
      path: '~/Library/Application Support/NaosuNoteData',
      description: '操作系统规范应用数据路径，保持个人文档整洁',
      is_recommended: false,
    },
    {
      id: 'custom',
      name: '自定义绝对路径',
      path: '',
      description: '自行指定设备上的有效绝对目录路径',
      is_recommended: false,
    },
  ];
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

export async function apiUpsertNotebook(id: string, name: string, subject: string): Promise<Notebook> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke('upsert_notebook', { id, name, subject });
  }
  let existing = mockNotebooks.find((n) => n.id === id);
  if (existing) {
    existing.name = name;
    existing.subject = subject;
    return existing;
  }
  const nb: Notebook = { id, name, subject };
  mockNotebooks.push(nb);
  return nb;
}

export async function apiGetNotebooksForSync(): Promise<Notebook[]> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke('get_notebooks_for_sync');
  }
  return mockNotebooks;
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

export async function apiGetProblemsForSync(): Promise<Problem[]> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke('get_problems_for_sync');
  }
  return mockStorage;
}

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
  triggerSilentCloudSync();
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

export async function apiSaveAnswerImageByFilename(
  filename: string,
  imageBytes: Uint8Array
): Promise<void> {
  const invoke = await getInvoke();
  if (invoke) {
    await invoke('save_answer_image_by_filename', {
      filename,
      imageBytes: Array.from(imageBytes),
    });
  }
}

export async function apiGetLocalImageFilenames(): Promise<string[]> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke('get_local_image_filenames');
  }
  return [];
}

export async function apiPruneLocalUnreferencedImages(): Promise<string[]> {
  const invoke = await getInvoke();
  if (invoke) {
    try {
      return await invoke('prune_local_unreferenced_images');
    } catch (e) {
      console.warn('Failed to prune local unreferenced images:', e);
      return [];
    }
  }
  return [];
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

    // 2. 浏览器/WebView 原生特性与 UserAgent 高精度探测
    const ua = navigator.userAgent || '';
    const isAndroid = /Android/i.test(ua);
    const isIOSPhone = /iPhone|iPod/i.test(ua);
    const isIPad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const viewportWidth = window.innerWidth || 390;
    const minScreen = Math.min(window.screen.width || 390, window.screen.height || 844);

    if (isAndroid) {
      const isPhone = /Mobile/i.test(ua) || viewportWidth < 768 || minScreen < 600;
      return {
        platform: 'mobile',
        form_factor: isPhone ? 'phone' : 'pad',
        os: 'android',
        screen_width_dp: viewportWidth,
      };
    }

    if (isIOSPhone) {
      return {
        platform: 'mobile',
        form_factor: 'phone',
        os: 'ios',
        screen_width_dp: viewportWidth,
      };
    }

    if (isIPad) {
      return {
        platform: 'mobile',
        form_factor: 'pad',
        os: 'ios',
        screen_width_dp: viewportWidth,
      };
    }
  }

  // 3. 调用底层 Rust 读取原生硬件信息
  const invoke = await getInvoke();
  if (invoke) {
    try {
      const info: DeviceInfo = await invoke('get_device_info');
      if (info && info.platform) {
        return info;
      }
    } catch (e) {
      console.warn('apiGetDeviceInfo invocation fallback:', e);
    }
  }

  // 4. 视口宽度兜底自适应 (桌面浏览器缩放调试等场景)
  if (typeof window !== 'undefined') {
    const width = window.innerWidth;
    if (width < 768) {
      return { platform: 'mobile', form_factor: 'phone', os: 'web', screen_width_dp: width };
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
      setRemoteAvatarUrl(user.avatar_url);
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
  pulledNotebooks: number;
  pushedNotebooks: number;
  uploadedImages: number;
  downloadedImages: number;
  deletedProblems: number;
}

export function parseSqliteUtcToMs(timeStr?: string): number {
  if (!timeStr) return 0;
  if (/^\d+$/.test(timeStr)) return Number(timeStr);
  const iso = timeStr.replace(' ', 'T') + (timeStr.endsWith('Z') ? '' : 'Z');
  const t = Date.parse(iso);
  return isNaN(t) ? 0 : t;
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
    pulledNotebooks: 0,
    pushedNotebooks: 0,
    uploadedImages: 0,
    downloadedImages: 0,
    deletedProblems: 0,
  };

  onProgress?.('正在校验云端凭证...');

  // 1. 拉取云端数据
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

  // 本地与云端数据比对
  const localProblems = await apiGetProblemsForSync();
  const localProblemsMap = new Map<string, Problem>(localProblems.map((p) => [p.uuid, p]));

  // 合并错题本
  for (const nb of remoteNotebooks || []) {
    if (nb.is_deleted) {
      try {
        await apiDeleteNotebook(nb.id);
      } catch (_) {}
    } else {
      try {
        await apiUpsertNotebook(nb.id, nb.name, nb.subject);
        result.pulledNotebooks++;
      } catch (e) {
        console.warn('Failed to upsert pulled notebook:', nb.id, e);
      }
    }
  }

  // 合并错题
  for (const prob of remoteProblems || []) {
    if (prob.is_deleted) {
      try {
        const local = localProblemsMap.get(prob.uuid);
        if (local && !local.is_deleted) {
          await apiDeleteProblem(prob.uuid);
          result.deletedProblems++;
        }
      } catch (_) {}
    } else {
      try {
        const local = localProblemsMap.get(prob.uuid);
        const localUpdatedMs = parseSqliteUtcToMs(local?.updated_at);
        // 本地记录较新时跳过覆盖
        if (local && !local.is_deleted && localUpdatedMs >= prob.updated_at) {
          continue;
        }

        const dateStr = prob.date || local?.date || new Date().toISOString().split('T')[0];
        const createdSqliteStr = prob.created_at || local?.created_at;
        const updatedSqliteStr = new Date(prob.updated_at || Date.now())
          .toISOString()
          .replace('T', ' ')
          .replace(/\..+/, '');

        await apiSaveProblem({
          uuid: prob.uuid,
          notebook_id: prob.notebook_id,
          subject: prob.subject,
          type: prob.problem_type || prob.type || '简答',
          date: dateStr,
          summary: prob.summary,
          raw_html: prob.raw_html,
          stem_clean_text: prob.stem_clean_text,
          tags: prob.tags,
          answer_markdown: prob.answer_markdown,
          answer_images: prob.answer_images,
          created_at: createdSqliteStr,
          updated_at: updatedSqliteStr,
          is_deleted: 0,
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

  // 1.5 整理本地图片缓存，清理已被删除错题遗留的孤儿图片
  try {
    await apiPruneLocalUnreferencedImages();
  } catch (pruneErr) {
    console.warn('Prune local unreferenced images error:', pruneErr);
  }

  // 2. 推送本地数据
  onProgress?.('正在推送本地最新变更...');
  const currentLocalProblems = await apiGetProblemsForSync();
  const currentLocalNotebooks = await apiGetNotebooksForSync();
  const localTags = await apiGetTags();

  // 转换时间戳格式
  const pushNotebooks = currentLocalNotebooks.map((n: Notebook) => ({
    id: n.id,
    name: n.name,
    subject: n.subject,
    is_deleted: n.is_deleted ? 1 : 0,
    updated_at: parseSqliteUtcToMs(n.updated_at) || Date.now(),
  }));

  const pushProblems = currentLocalProblems.map((p: Problem) => ({
    uuid: p.uuid,
    notebook_id: p.notebook_id,
    subject: p.subject,
    type: p.type,
    date: p.date,
    summary: p.summary,
    raw_html: p.raw_html,
    stem_clean_text: p.stem_clean_text,
    difficulty: p.difficulty,
    importance: p.importance,
    tags: p.tags,
    answer_markdown: p.answer_markdown,
    answer_images: p.answer_images,
    created_at: p.created_at,
    is_deleted: p.is_deleted ? 1 : 0,
    updated_at: parseSqliteUtcToMs(p.updated_at) || Date.now(),
  }));

  // 筛选增量数据：使用客户端本地时间基准防范双机时钟漂移（允许 30 秒容差）
  const lastClientSync = Number(localStorage.getItem('naosu_client_last_sync_timestamp') || '0');
  const thresholdMs = lastClientSync > 0 ? Math.max(0, lastClientSync - 30000) : 0;
  const filteredProblems = pushProblems.filter((p) => p.updated_at >= thresholdMs);
  const filteredNotebooks = pushNotebooks.filter((n) => n.updated_at >= thresholdMs);

  const pushPayload = {
    client_timestamp: Date.now(),
    notebooks: filteredNotebooks,
    problems: filteredProblems,
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
    result.pushedProblems = pushJson.data?.applied_problems ?? pushJson.data?.applied_count ?? 0;
    result.pushedNotebooks = pushJson.data?.applied_notebooks ?? 0;
    localStorage.setItem('naosu_client_last_sync_timestamp', String(Date.now()));
  }

  // 3. 同步图片附件
  onProgress?.('正在比对本地与云端图片...');
  const localDiskFiles = await apiGetLocalImageFilenames();
  const allActiveProblems = (await apiGetProblems()).filter((p) => !p.is_deleted);
  const requiredImageSet = new Set<string>();

  for (const p of allActiveProblems) {
    if (p.answer_images && Array.isArray(p.answer_images)) {
      for (const imgName of p.answer_images) {
        if (imgName && typeof imgName === 'string' && imgName.trim()) {
          requiredImageSet.add(imgName.trim());
        }
      }
    }
  }

  // 本地仅向云端申报属于有效题目的文件，避免上报已删除或孤儿文件
  const validLocalFiles = localDiskFiles.filter((f) => requiredImageSet.has(f));

  try {
    const checkImgRes = await fetch(`${baseUrl}/api/sync/images/check-missing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        local_disk_filenames: validLocalFiles,
        required_filenames: Array.from(requiredImageSet),
        client_image_filenames: Array.from(requiredImageSet),
      }),
    });

    const checkImgJson = await checkImgRes.json();
    if (checkImgRes.ok && checkImgJson.code === 200 && checkImgJson.data) {
      const { need_upload, need_download } = checkImgJson.data;

      // 上传本地存在但服务端缺失的图片
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

      // 下载服务端存在但本地缺失的图片
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
              await apiSaveAnswerImageByFilename(filename, u8);
              result.downloadedImages++;
            }
          } catch (e) {
            console.warn(`Failed to download image ${filename}:`, e);
          }
          downIdx++;
          onProgress?.(`正在下载云端图片 (${downIdx}/${need_download.length})...`);
        }

        // 触发图片同步完成事件
        if (typeof window !== 'undefined' && result.downloadedImages > 0) {
          window.dispatchEvent(new CustomEvent('naosu:images-synced', { detail: { count: result.downloadedImages } }));
        }
      }
    }
  } catch (imgErr) {
    console.warn('Image sync error:', imgErr);
  }

  // 4. 同步头像
  try {
    const summary = await apiGetProfileSummary();
    if (summary.avatar_url) {
      setRemoteAvatarUrl(summary.avatar_url);
    }
  } catch (avErr) {
    console.warn('Avatar sync check:', avErr);
  }

  // 5. 记录同步时间与更新镜像
  if (server_timestamp) {
    localStorage.setItem('naosu_last_sync_timestamp', String(server_timestamp));
    const nowStr = new Date(server_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    localStorage.setItem('naosu_last_sync_time', `今天 ${nowStr}`);
  }

  try {
    await apiPruneLocalUnreferencedImages();
  } catch (_) {}

  await apiSyncAllMirrors();
  onProgress?.('同步完成');

  return result;
}

// 静默后台自动同步触发器（防抖，用于保存题目、修改解析图片后自动触发云同步）
let silentSyncTimer: any = null;
let isSilentSyncing = false;

export function triggerSilentCloudSync(delayMs = 800): void {
  const token = getAuthToken();
  if (!token) return;

  if (silentSyncTimer) {
    clearTimeout(silentSyncTimer);
  }

  silentSyncTimer = setTimeout(async () => {
    silentSyncTimer = null;
    if (isSilentSyncing) return;
    try {
      isSilentSyncing = true;
      const res = await apiSyncCloud();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('naosu:silent-sync-complete', { detail: res }));
      }
    } catch (e) {
      console.warn('[SilentCloudSync] Error during background sync:', e);
    } finally {
      isSilentSyncing = false;
    }
  }, delayMs);
}






