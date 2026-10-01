<template>
  <div class="ingest-view">
    <div class="ingest-container">
      <!-- Header -->
      <div class="ingest-header" data-tauri-drag-region="deep">
        <div class="header-titles">
          <h2 class="view-title">录入标准格式错题</h2>
          <p class="view-subtitle">
            粘贴从 Gemini 生成的标准错题 HTML 代码块，系统将自动解析标签、注入唯一 UUID、查重并同步至所选错题本的本地 HTML 文件。
          </p>
        </div>
        <button class="btn-copy-prompt" title="复制最新规范的 Gemini 错题提示词" @click="copyGeminiPrompt">
          <Sparkles :size="15" />
          <span>复制 Gemini 提示词</span>
        </button>
      </div>

      <!-- Editor Panel -->
      <div class="input-card">
        <div class="card-toolbar">
          <div class="notebook-select-area">
            <span class="toolbar-label">归属错题本：</span>
            <select v-model="targetNotebookId" class="m3-select">
              <option value="auto">智能根据学科自动匹配</option>
              <option v-for="nb in notebooks" :key="nb.id" :value="nb.id">
                {{ nb.name }} ({{ nb.subject }})
              </option>
            </select>
          </div>

          <div class="toolbar-actions">
            <button class="btn-text" @click="readFromClipboard">
              <Clipboard :size="15" />
              <span>读取剪贴板</span>
            </button>
            <button v-if="rawInput" class="btn-text" @click="rawInput = ''">
              <Trash2 :size="15" />
              <span>清空</span>
            </button>
          </div>
        </div>

        <textarea
          v-model="rawInput"
          class="code-textarea"
          placeholder="在此粘贴包含 <div class=&quot;naosu-problem&quot; subject=&quot;[数学|物理|化学|生物]&quot; type=&quot;[单选|多选|填空|简答]&quot; date=&quot;YYYYMMDD&quot; summary=&quot;...&quot;> 的 HTML 代码块..."
          rows="12"
          @input="onInputChanged"
        ></textarea>

        <div class="card-footer">
          <div class="parse-summary">
            <span v-if="parsedProblems.length > 0" class="badge-success">
              已识别 {{ parsedProblems.length }} 道标准错题
            </span>
            <span v-else-if="rawInput.trim()" class="badge-warning">
              待解析内容
            </span>
          </div>

          <div class="footer-buttons">
            <button
              class="btn-primary btn-submit"
              :disabled="parsedProblems.length === 0 || isProcessing"
              @click="handleIngestAll"
            >
              <ArrowDownToLine :size="16" />
              <span>{{ isProcessing ? '正在处理...' : '确认录入错题' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Live Preview Area -->
      <div v-if="parsedProblems.length > 0" class="preview-section">
        <h3 class="preview-title">解析预览 (共 {{ parsedProblems.length }} 题)</h3>
        <div class="preview-list">
          <div
            v-for="(item, idx) in parsedProblems"
            :key="idx"
            class="preview-card"
          >
            <div class="preview-meta">
              <span class="preview-badge">{{ item.subject }}</span>
              <span
                class="preview-badge type clickable"
                title="点击切换题目类型 (单选/多选/填空/简答)"
                @click="cycleProblemType(idx)"
              >
                {{ item.type }}
              </span>
              <span class="preview-date">{{ item.date }}</span>
              <span class="preview-summary">{{ item.summary }}</span>
            </div>

            <!-- 交互式 Tag 标签编辑与已有标签推荐复选区 -->
            <div class="preview-tags-section">
              <div class="preview-tags-current">
                <span class="preview-tag-label">当前标签：</span>
                <div class="preview-tag-chips">
                  <span
                    v-for="tag in (item.tags || [])"
                    :key="tag"
                    class="preview-tag-chip"
                  >
                    #{{ tag }}
                    <button class="preview-tag-del" title="移除标签" @click="removePreviewTag(idx, tag)">
                      <X :size="11" />
                    </button>
                  </span>
                  <div class="preview-tag-input-wrap">
                    <input
                      v-model="previewTagInputs[idx]"
                      type="text"
                      class="preview-tag-input"
                      placeholder="+ 自定义新标签..."
                      @keydown.enter.prevent="addPreviewTag(idx)"
                    />
                  </div>
                </div>
              </div>

              <!-- 已有标签候选复用区 (M3 Suggestion Chips) -->
              <div v-if="getSuggestionsForProblem(item).length > 0" class="preview-tag-suggestions">
                <span class="suggestions-label">已有标签推荐：</span>
                <div class="suggestions-chips">
                  <button
                    v-for="sug in getSuggestionsForProblem(item)"
                    :key="sug.name"
                    class="suggestion-chip"
                    :title="`点击直接添加 #${sug.name}`"
                    @click="addSuggestedTag(idx, sug.name)"
                  >
                    <Plus :size="11" />
                    <span>{{ sug.name }}</span>
                    <span v-if="sug.count" class="sug-count">{{ sug.count }}</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Render with LaTeX & SVG & Tables -->
            <div
              class="preview-body selectable"
              v-html="formatProblemForExam(item.raw_html)"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Duplicate Alert Dialog -->
    <DuplicateDialog
      :visible="showDupDialog"
      :similarity="currentDupSim"
      :matched-problem="currentMatchedProb"
      @upgrade-importance="onUpgradeImportance"
      @import-anyway="onImportAnyway"
      @cancel="onCancelDup"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { Notebook, Problem, ProblemInput, TagCount } from '../types/problem';
import { parseProblemHtml } from '../utils/parser';
import { formatProblemForExam } from '../utils/examFormatter';
import {
  apiGetNotebooks,
  apiCheckDuplicate,
  apiSaveProblem,
  apiIncrementImportance,
  apiGetTags,
} from '../utils/api';
import DuplicateDialog from '../components/DuplicateDialog.vue';
import { Clipboard, Trash2, ArrowDownToLine, X, Plus, Sparkles } from 'lucide-vue-next';

const emit = defineEmits<{
  (e: 'nav', tab: string): void;
  (e: 'notify', msg: string): void;
}>();

const GEMINI_PROMPT_TEXT = `当我提示“把这道题整理为标准格式的错题”或“把今天问你的所有题整理为标准格式的错题”时，严禁输出任何废话/解释/前言/后缀/emoji，仅输出HTML代码，包裹在代码块中。纯题干：严禁包含答案、解析、易错反思、试卷页码。严禁包含任何emoji。属性限定：<div class="naosu-problem" subject="[数学|物理|化学|生物]" type="[单选|多选|填空|简答]" date="YYYYMMDD" summary="[20字内核心摘要]">每道题前必须加注释：<!--学科题型日期_摘要-->排版标签：题干容器：<div class="problem-body">...</div>公式：LaTeX行内 $...$ ，块级 $$...$$配图：<div class="img"><svg viewBox="0 0 W H">...</svg></div>（原生SVG纯黑白线条重绘，严禁色彩，不写死px宽高）填空：<span class="blank blank-[sm|md|lg|xl]"></span>选项：<div class="options"><span>A. xxx</span><span>B. xxx</span></div>引导与小问：<div class="sub-prompt">...</div>、<div class="sub-item">(1) ...</div>`;

const availableTypes = ['单选', '多选', '填空', '简答'];

async function copyGeminiPrompt() {
  try {
    await navigator.clipboard.writeText(GEMINI_PROMPT_TEXT);
    emit('notify', '已将最新 Gemini 标准错题提示词复制到剪贴板！');
  } catch (e) {
    emit('notify', '复制失败，请手动复制提示词');
  }
}

function cycleProblemType(idx: number) {
  const p = parsedProblems.value[idx];
  if (!p) return;
  const currIdx = availableTypes.indexOf(p.type);
  const nextType = availableTypes[(currIdx + 1) % availableTypes.length];
  p.type = nextType;
  p.raw_html = p.raw_html.replace(
    /(<div[^>]*class=["'][^"']*naosu-problem[^"']*["'][^>]*type=["'])[^"']*(")/i,
    `$1${nextType}$2`
  );
}

const notebooks = ref<Notebook[]>([]);
const targetNotebookId = ref('auto');
const rawInput = ref('');
const parsedProblems = ref<ProblemInput[]>([]);
const previewTagInputs = ref<string[]>([]);
const existingTags = ref<Record<string, TagCount[]>>({});
const isProcessing = ref(false);

// 查重弹窗状态
const showDupDialog = ref(false);
const currentDupSim = ref(0);
const currentMatchedProb = ref<Problem | null>(null);
const pendingProblem = ref<ProblemInput | null>(null);
const pendingQueue = ref<ProblemInput[]>([]);

async function loadNotebooks() {
  try {
    notebooks.value = await apiGetNotebooks();
  } catch (e) {
    console.error(e);
  }
}

async function loadExistingTagsForSubject(subject: string) {
  if (existingTags.value[subject] && existingTags.value[subject].length > 0) return;
  try {
    const list = await apiGetTags(undefined, subject);
    existingTags.value[subject] = list;
  } catch (e) {
    console.error('Failed to load existing tags', e);
  }
}

function onInputChanged() {
  if (!rawInput.value.trim()) {
    parsedProblems.value = [];
    previewTagInputs.value = [];
    return;
  }
  parsedProblems.value = parseProblemHtml(rawInput.value);
  previewTagInputs.value = new Array(parsedProblems.value.length).fill('');

  // 触发当前解析到的所有学科的已有标签异步加载
  const subjectsInBatch = new Set(parsedProblems.value.map((p) => p.subject));
  subjectsInBatch.forEach((sub) => loadExistingTagsForSubject(sub));
}

function addPreviewTag(index: number) {
  const text = (previewTagInputs.value[index] || '').trim().replace(/^#/, '');
  if (!text) return;
  if (!parsedProblems.value[index].tags) {
    parsedProblems.value[index].tags = [];
  }
  if (!parsedProblems.value[index].tags!.includes(text)) {
    parsedProblems.value[index].tags!.push(text);
  }
  previewTagInputs.value[index] = '';
}

function removePreviewTag(index: number, tag: string) {
  if (parsedProblems.value[index].tags) {
    parsedProblems.value[index].tags = parsedProblems.value[index].tags!.filter((t) => t !== tag);
  }
}

function getSuggestionsForProblem(item: ProblemInput): TagCount[] {
  const allForSubject = existingTags.value[item.subject] || [];
  const assigned = item.tags || [];
  return allForSubject.filter((t) => !assigned.includes(t.name));
}

function addSuggestedTag(index: number, tagName: string) {
  if (!parsedProblems.value[index].tags) {
    parsedProblems.value[index].tags = [];
  }
  if (!parsedProblems.value[index].tags!.includes(tagName)) {
    parsedProblems.value[index].tags!.push(tagName);
  }
}

async function readFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      rawInput.value = text;
      onInputChanged();
      emit('notify', '已从剪贴板读取代码并完成解析');
    }
  } catch (e) {
    emit('notify', '无法读取剪贴板，请直接手动粘贴');
  }
}

async function handleIngestAll() {
  if (parsedProblems.value.length === 0) return;

  isProcessing.value = true;
  pendingQueue.value = [...parsedProblems.value];
  processNextInQueue();
}

async function processNextInQueue() {
  if (pendingQueue.value.length === 0) {
    isProcessing.value = false;
    emit('notify', '全部错题已成功录入并同步至错题本 HTML 文件！');
    rawInput.value = '';
    parsedProblems.value = [];
    emit('nav', 'library');
    return;
  }

  const current = pendingQueue.value.shift()!;

  // 决定当前题目的 notebook_id
  if (targetNotebookId.value !== 'auto') {
    current.notebook_id = targetNotebookId.value;
  } else {
    // 自动寻找匹配学科的错题本
    let matchedNb = notebooks.value.find((n) => n.subject === current.subject);
    if (!matchedNb) {
      await loadNotebooks();
      matchedNb = notebooks.value.find((n) => n.subject === current.subject);
    }
    if (matchedNb) {
      current.notebook_id = matchedNb.id;
    } else if (notebooks.value.length > 0) {
      current.notebook_id = notebooks.value[0].id;
    }
  }

  pendingProblem.value = current;

  try {
    // 进行 Levenshtein 查重检查 (>85%)
    const dupResult = await apiCheckDuplicate(
      current.subject,
      current.stem_clean_text,
      0.85
    );

    if (dupResult.is_duplicate && dupResult.existing_problem) {
      currentDupSim.value = dupResult.similarity;
      currentMatchedProb.value = dupResult.existing_problem;
      showDupDialog.value = true;
    } else {
      await apiSaveProblem(current);
      processNextInQueue();
    }
  } catch (e: any) {
    emit('notify', '录入出错: ' + (e?.message || e));
    isProcessing.value = false;
  }
}

async function onUpgradeImportance() {
  showDupDialog.value = false;
  if (currentMatchedProb.value) {
    try {
      const newStars = await apiIncrementImportance(currentMatchedProb.value.uuid);
      emit('notify', `已提升已有错题「${currentMatchedProb.value.summary}」重要程度至 ${newStars} 级`);
    } catch (e) {
      emit('notify', '更新重要程度失败');
    }
  }
  processNextInQueue();
}

async function onImportAnyway() {
  showDupDialog.value = false;
  if (pendingProblem.value) {
    try {
      await apiSaveProblem(pendingProblem.value);
    } catch (e) {
      emit('notify', '导入失败');
    }
  }
  processNextInQueue();
}

function onCancelDup() {
  showDupDialog.value = false;
  processNextInQueue();
}

onMounted(() => {
  loadNotebooks();
});
</script>

<style scoped>
.ingest-view {
  height: 100%;
  overflow-y: auto;
  padding: 24px 36px 60px 36px;
  background-color: var(--md-sys-color-background);
}

.ingest-container {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.ingest-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  -webkit-app-region: drag;
  user-select: none;
}

.header-titles {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.btn-copy-prompt {
  -webkit-app-region: no-drag;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 16px;
  border-radius: var(--md-shape-corner-full);
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  border: 1px solid var(--md-sys-color-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
}
.btn-copy-prompt:hover {
  filter: brightness(1.08);
  box-shadow: var(--md-elevation-1);
  transform: translateY(-1px);
}

.view-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--md-sys-color-on-background);
}

.view-subtitle {
  font-size: 13px;
  color: var(--md-sys-color-on-surface-variant);
  line-height: 1.6;
}

.input-card {
  background-color: var(--md-sys-color-surface-container-lowest);
  border-radius: var(--md-shape-corner-xl);
  border: 1px solid var(--md-sys-color-outline-variant);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.card-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background-color: var(--md-sys-color-surface-container-high);
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  flex-wrap: wrap;
  gap: 10px;
}

.notebook-select-area {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface-variant);
}

.m3-select {
  height: 32px;
  border-radius: 6px;
  border: 1px solid var(--md-sys-color-outline-variant);
  background: var(--md-sys-color-surface-container-lowest);
  padding: 0 10px;
  font-size: 12px;
  color: var(--md-sys-color-on-surface);
  outline: none;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--md-sys-color-primary);
  padding: 6px 12px;
  border-radius: var(--md-shape-corner-full);
}
.btn-text:hover {
  background-color: var(--md-sys-color-surface-container);
}

.code-textarea {
  width: 100%;
  border: none;
  padding: 16px 20px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  color: var(--md-sys-color-on-surface);
  background: transparent;
  resize: vertical;
  outline: none;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-top: 1px solid var(--md-sys-color-surface-container-high);
  background-color: var(--md-sys-color-surface-container-low);
}

.badge-success {
  font-size: 12px;
  font-weight: 600;
  color: #166534;
  background: #dcfce7;
  padding: 4px 10px;
  border-radius: 6px;
}

.badge-warning {
  font-size: 12px;
  color: #854d0e;
  background: #fef9c3;
  padding: 4px 10px;
  border-radius: 6px;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 22px;
  border-radius: var(--md-shape-corner-full);
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  font-size: 14px;
  font-weight: 600;
  box-shadow: var(--md-elevation-1);
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  box-shadow: var(--md-elevation-2);
  filter: brightness(1.05);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.preview-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preview-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--md-sys-color-on-surface);
}

.preview-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preview-card {
  background: var(--md-sys-color-surface-container-lowest);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-shape-corner-lg);
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.preview-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 1px dashed var(--md-sys-color-outline-variant);
}

.preview-badge {
  font-size: 11px;
  font-weight: 700;
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  padding: 2px 8px;
  border-radius: 4px;
}

.preview-badge.type {
  background: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface-variant);
}

.preview-badge.type.clickable {
  cursor: pointer;
  user-select: none;
  transition: all 0.15s;
}
.preview-badge.type.clickable:hover {
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}

.preview-date {
  font-size: 11px;
  color: var(--md-sys-color-outline);
}

.preview-summary {
  font-size: 13px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
  margin-left: auto;
}

.preview-body {
  font-size: 14px;
  line-height: 1.7;
  container-type: inline-size;
}

.preview-tags-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px dashed var(--md-sys-color-outline-variant);
}

.preview-tags-current {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.preview-tag-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--md-sys-color-outline);
}

.preview-tag-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.preview-tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 24px;
  padding: 0 8px 0 6px;
  border-radius: var(--md-shape-corner-full);
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  font-size: 11px;
  font-weight: 600;
}

.preview-tag-del {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  color: var(--md-sys-color-on-primary-container);
  opacity: 0.7;
  cursor: pointer;
  transition: opacity 0.15s ease;
}
.preview-tag-del:hover {
  opacity: 1;
}

.preview-tag-input-wrap {
  display: inline-flex;
  align-items: center;
}

.preview-tag-input {
  height: 24px;
  width: 115px;
  padding: 0 10px;
  border-radius: var(--md-shape-corner-full);
  border: 1px dashed var(--md-sys-color-outline-variant);
  background: transparent;
  font-size: 11px;
  color: var(--md-sys-color-on-surface);
  outline: none;
  transition: all 0.15s ease;
}
.preview-tag-input:focus {
  border-color: var(--md-sys-color-primary);
  border-style: solid;
  background: var(--md-sys-color-surface-container-lowest);
}

/* 已有标签候选推荐池 */
.preview-tag-suggestions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding-left: 2px;
}

.suggestions-label {
  font-size: 11px;
  color: var(--md-sys-color-outline);
}

.suggestions-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.suggestion-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  border-radius: var(--md-shape-corner-sm);
  background-color: var(--md-sys-color-surface-container);
  border: 1px solid var(--md-sys-color-outline-variant);
  color: var(--md-sys-color-on-surface-variant);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.suggestion-chip:hover {
  background-color: var(--md-sys-color-surface-container-high);
  border-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-primary);
}

.sug-count {
  font-size: 10px;
  opacity: 0.6;
}
</style>
