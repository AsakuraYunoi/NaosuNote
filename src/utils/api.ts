import type { DuplicateCheckResult, Notebook, Problem, ProblemInput, TagCount, SortOption } from '../types/problem';
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

export async function apiGetDataDir(): Promise<string> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke('get_data_dir');
  }
  return '/Users/yunoi/Documents/Code/NaosuNote/data';
}

export async function apiSelectDataDir(): Promise<string | null> {
  const invoke = await getInvoke();
  if (invoke) {
    return await invoke('select_data_dir');
  }
  return null;
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
  sortBy?: string
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

  const list: TagCount[] = Array.from(counts.entries()).map(([name, count]) => ({
    name,
    count,
  }));
  list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return list;
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

