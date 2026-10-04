<template>
  <div class="ingest-phone-view">
    <!-- Top Mobile Header -->
    <header class="phone-header">
      <div class="header-title-box">
        <h2 class="title">录入标准错题</h2>
        <span class="subtitle">粘贴代码或拍照提取</span>
      </div>

      <button class="btn-prompt-copy" title="复制 Gemini 提示词" @click="copyGeminiPrompt">
        <Sparkles :size="14" />
        <span>复制提示词</span>
      </button>
    </header>

    <!-- Main Content Area -->
    <div class="ingest-scroll-body">
      <!-- Notebook Target Selector Card -->
      <div class="card-mobile">
        <label class="field-label">归属错题本</label>
        <select v-model="targetNotebookId" class="select-mobile">
          <option value="auto">智能根据学科自动匹配</option>
          <option v-for="nb in notebooks" :key="nb.id" :value="nb.id">
            {{ nb.name }} ({{ nb.subject }})
          </option>
        </select>
      </div>

      <!-- Input Mode Actions (Camera, Photo, Clipboard) -->
      <div class="quick-input-grid">
        <button class="quick-btn" @click="triggerCamera">
          <Camera :size="20" class="btn-icon camera-icon" />
          <span>拍照提取</span>
        </button>
        <button class="quick-btn" @click="triggerGallery">
          <ImageIcon :size="20" class="btn-icon gallery-icon" />
          <span>相册导入</span>
        </button>
        <button class="quick-btn" @click="readFromClipboard">
          <Clipboard :size="20" class="btn-icon clip-icon" />
          <span>读剪贴板</span>
        </button>
        <button v-if="rawInput" class="quick-btn" @click="rawInput = ''; onInputChanged()">
          <Trash2 :size="20" class="btn-icon trash-icon" />
          <span>清空内容</span>
        </button>
      </div>

      <!-- Hidden file inputs for Camera and Gallery -->
      <input
        ref="cameraInputRef"
        type="file"
        accept="image/*"
        capture="environment"
        style="display: none"
        @change="onImageSelected"
      />
      <input
        ref="galleryInputRef"
        type="file"
        accept="image/*"
        style="display: none"
        @change="onImageSelected"
      />

      <!-- HTML / Code Input Textarea -->
      <div class="card-mobile textarea-card">
        <div class="card-header-bar">
          <span class="field-label">HTML 错题代码</span>
          <span v-if="parsedProblems.length > 0" class="pill-badge pill-success">
            已解析 {{ parsedProblems.length }} 题
          </span>
          <span v-else-if="rawInput.trim()" class="pill-badge pill-warning">
            解析中...
          </span>
        </div>
        <textarea
          v-model="rawInput"
          class="mobile-textarea"
          placeholder="在此粘贴包含 <div class=&quot;naosu-problem&quot; ...> 的 HTML 代码块..."
          rows="6"
          @input="onInputChanged"
        ></textarea>
      </div>

      <!-- Live Preview Section -->
      <div v-if="parsedProblems.length > 0" class="preview-section-mobile">
        <h3 class="preview-header">错题解析预览 (共 {{ parsedProblems.length }} 题)</h3>

        <div
          v-for="(item, idx) in parsedProblems"
          :key="idx"
          class="preview-card-mobile"
        >
          <!-- Metadata row -->
          <div class="preview-meta-row">
            <span class="badge-subject" :class="'sub-' + item.subject">{{ item.subject }}</span>
            <button
              class="badge-type-btn"
              title="点击切换题型"
              @click="cycleProblemType(idx)"
            >
              {{ item.type }}
              <ChevronRight :size="12" />
            </button>
            <span class="preview-date">{{ item.date }}</span>
          </div>

          <p v-if="item.summary" class="preview-summary">{{ item.summary }}</p>

          <!-- Tags Editor -->
          <div class="tags-editor-wrap">
            <div class="tag-chips-list">
              <span
                v-for="tag in item.tags || []"
                :key="tag"
                class="preview-tag-chip"
              >
                #{{ tag }}
                <button class="del-tag-btn" @click="removePreviewTag(idx, tag)">
                  <X :size="10" />
                </button>
              </span>
            </div>

            <div class="add-tag-box">
              <input
                v-model="previewTagInputs[idx]"
                type="text"
                placeholder="+ 添加标签"
                class="tag-inline-field"
                @keydown.enter.prevent="addPreviewTag(idx)"
              />
              <button class="btn-add-tag-sm" @click="addPreviewTag(idx)">
                <Plus :size="12" />
              </button>
            </div>
          </div>

          <!-- Suggested tags -->
          <div v-if="getSuggestionsForProblem(item).length > 0" class="suggested-tags-row">
            <span class="sug-label">推荐标签:</span>
            <button
              v-for="sug in getSuggestionsForProblem(item).slice(0, 6)"
              :key="sug.name"
              class="sug-chip"
              @click="addSuggestedTag(idx, sug.name)"
            >
              +{{ sug.name }}
            </button>
          </div>

          <!-- Rendered stem with KaTeX & SVG -->
          <div
            class="rendered-stem selectable"
            v-html="formatProblemForExam(item.raw_html)"
          ></div>
        </div>
      </div>
    </div>

    <!-- Sticky Bottom Ingest Button Bar -->
    <div class="sticky-bottom-bar">
      <button
        class="btn-submit-mobile"
        :disabled="parsedProblems.length === 0 || isProcessing"
        @click="handleIngestAll"
      >
        <ArrowDownToLine :size="18" />
        <span>{{ isProcessing ? '正在处理并同步...' : `确认录入 (${parsedProblems.length}) 道错题` }}</span>
      </button>
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
import { ref, onMounted, onUnmounted } from 'vue';
import type { Notebook, Problem, ProblemInput, TagCount } from '../types/problem';
import { parseProblemHtml } from '../utils/parser';
import { formatProblemForExam } from '../utils/examFormatter';
import {
  apiGetNotebooks,
  apiCheckDuplicate,
  apiSaveProblem,
  apiIncrementImportance,
  apiGetTags,
  triggerSilentCloudSync,
} from '../utils/api';
import DuplicateDialog from '../components/DuplicateDialog.vue';
import {
  Clipboard,
  Trash2,
  ArrowDownToLine,
  X,
  Plus,
  Sparkles,
  Camera,
  Image as ImageIcon,
  ChevronRight,
} from 'lucide-vue-next';

const emit = defineEmits<{
  (e: 'nav', tab: string): void;
  (e: 'notify', msg: string): void;
}>();

const GEMINI_PROMPT_TEXT = `当我提示“把这道题整理为标准格式的错题”或“把今天问你的所有题整理为标准格式的错题”时，严禁输出任何废话/解释/前言/后缀/emoji，仅输出HTML代码，包裹在代码块中。纯题干：严禁包含答案、解析、易错反思、试卷页码。严禁包含任何emoji。属性限定：<div class="naosu-problem" subject="[数学|物理|化学|生物]" type="[单选|多选|填空|简答]" date="YYYYMMDD" summary="[20字内核心摘要]">每道题前必须加注释：<!--学科题型日期_摘要-->排版标签：题干容器：<div class="problem-body">...</div>公式：LaTeX行内 $...$ ，块级 $$...$$配图：<div class="img"><svg viewBox="0 0 W H">...</svg></div>（原生SVG纯黑白线条重绘，严禁色彩，不写死px宽高）填空：<span class="blank blank-[sm|md|lg|xl]"></span>选项：<div class="options"><span>A. xxx</span><span>B. xxx</span></div>引导与小问：<div class="sub-prompt">...</div>、<div class="sub-item">(1) ...</div>`;

const availableTypes = ['单选', '多选', '填空', '简答'];

const notebooks = ref<Notebook[]>([]);
const targetNotebookId = ref('auto');
const rawInput = ref('');
const parsedProblems = ref<ProblemInput[]>([]);
const previewTagInputs = ref<string[]>([]);
const existingTags = ref<Record<string, TagCount[]>>({});
const isProcessing = ref(false);

const cameraInputRef = ref<HTMLInputElement | null>(null);
const galleryInputRef = ref<HTMLInputElement | null>(null);

// 查重状态
const showDupDialog = ref(false);
const currentDupSim = ref(0);
const currentMatchedProb = ref<Problem | null>(null);
const pendingProblem = ref<ProblemInput | null>(null);
const pendingQueue = ref<ProblemInput[]>([]);

onMounted(async () => {
  window.addEventListener('naosu:back', handleMobileBack);
  await loadNotebooks();
});

onUnmounted(() => {
  window.removeEventListener('naosu:back', handleMobileBack);
});

function handleMobileBack(e: Event) {
  if (showDupDialog.value) {
    showDupDialog.value = false;
    e.preventDefault();
  }
}

async function loadNotebooks() {
  try {
    notebooks.value = await apiGetNotebooks();
  } catch (e) {
    console.error(e);
  }
}

async function copyGeminiPrompt() {
  try {
    await navigator.clipboard.writeText(GEMINI_PROMPT_TEXT);
    emit('notify', '已复制 Gemini 标准错题提示词！');
  } catch (e) {
    emit('notify', '复制失败，请手动长按复制');
  }
}

function triggerCamera() {
  cameraInputRef.value?.click();
}

function triggerGallery() {
  galleryInputRef.value?.click();
}

function onImageSelected(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  emit('notify', `已选取图片「${file.name}」，请配合 Gemini 生成对应格式 HTML 错题`);
  // 重置 input 允许重复选择同名文件
  target.value = '';
}

async function readFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      rawInput.value = text;
      onInputChanged();
      emit('notify', '已读取剪贴板并完成解析');
    }
  } catch (e) {
    emit('notify', '读取剪贴板受阻，请直接手动粘贴');
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

  const subjectsInBatch = new Set(parsedProblems.value.map((p) => p.subject));
  subjectsInBatch.forEach((sub) => loadExistingTagsForSubject(sub));
}

async function loadExistingTagsForSubject(subject: string) {
  if (existingTags.value[subject] && existingTags.value[subject].length > 0) return;
  try {
    const list = await apiGetTags(undefined, subject);
    existingTags.value[subject] = list;
  } catch (e) {
    console.error(e);
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

async function handleIngestAll() {
  if (parsedProblems.value.length === 0) return;
  isProcessing.value = true;
  pendingQueue.value = [...parsedProblems.value];
  processNextInQueue();
}

async function processNextInQueue() {
  if (pendingQueue.value.length === 0) {
    isProcessing.value = false;
    emit('notify', '全部错题已成功录入！');
    rawInput.value = '';
    parsedProblems.value = [];
    emit('nav', 'library');
    triggerSilentCloudSync();
    return;
  }

  const current = pendingQueue.value.shift()!;
  pendingProblem.value = current;

  try {
    const dupResult = await apiCheckDuplicate(current.stem_clean_text, current.subject);
    if (dupResult.is_duplicate && dupResult.matched_problem) {
      currentDupSim.value = dupResult.similarity;
      currentMatchedProb.value = dupResult.matched_problem;
      showDupDialog.value = true;
      return;
    }

    await saveProblemToTarget(current);
    processNextInQueue();
  } catch (err: any) {
    emit('notify', '录入出错: ' + (err?.message || err));
    isProcessing.value = false;
  }
}

async function saveProblemToTarget(item: ProblemInput) {
  let nbId = targetNotebookId.value;
  if (nbId === 'auto') {
    const matched = notebooks.value.find((n) => n.subject === item.subject);
    nbId = matched ? matched.id : notebooks.value[0]?.id || 'default';
  }
  await apiSaveProblem({
    ...item,
    notebook_id: nbId,
  });
}

async function onUpgradeImportance() {
  if (currentMatchedProb.value) {
    await apiIncrementImportance(currentMatchedProb.value.uuid);
    emit('notify', '已为您提升该道重现错题的重要性星级！');
  }
  showDupDialog.value = false;
  processNextInQueue();
}

async function onImportAnyway() {
  if (pendingProblem.value) {
    await saveProblemToTarget(pendingProblem.value);
    emit('notify', '已强制录入该题');
  }
  showDupDialog.value = false;
  processNextInQueue();
}

function onCancelDup() {
  showDupDialog.value = false;
  processNextInQueue();
}
</script>

<style scoped>
.ingest-phone-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--md-sys-color-background);
  position: relative;
  overflow: hidden;
}

.phone-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: var(--md-sys-color-surface);
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  z-index: 10;
}

.title {
  font-size: 16px;
  font-weight: 700;
  color: var(--md-sys-color-on-surface);
}

.subtitle {
  font-size: 11px;
  color: var(--md-sys-color-on-surface-variant);
}

.btn-prompt-copy {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 10px;
  border-radius: 16px;
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  border: none;
  cursor: pointer;
}

.ingest-scroll-body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 14px 14px 120px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-mobile {
  background-color: var(--md-sys-color-surface-container-lowest);
  border-radius: var(--md-shape-corner-lg);
  border: 1px solid var(--md-sys-color-outline-variant);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface-variant);
}

.select-mobile {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--md-sys-color-outline-variant);
  background: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-on-surface);
  font-size: 14px;
  outline: none;
}

.quick-input-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.quick-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 12px 4px;
  border-radius: 14px;
  background: var(--md-sys-color-surface-container-low);
  border: 1px solid var(--md-sys-color-outline-variant);
  color: var(--md-sys-color-on-surface);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.quick-btn:active {
  background: var(--md-sys-color-surface-container-high);
}

.camera-icon { color: #0284c7; }
.gallery-icon { color: #059669; }
.clip-icon { color: #7c3aed; }
.trash-icon { color: #dc2626; }

.textarea-card {
  padding: 10px 12px;
}

.card-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pill-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
}

.pill-success {
  background: #dcfce7;
  color: #15803d;
}

.pill-warning {
  background: #fef3c7;
  color: #b45309;
}

.mobile-textarea {
  width: 100%;
  border: none;
  background: transparent;
  outline: none;
  font-size: 13px;
  font-family: monospace;
  color: var(--md-sys-color-on-surface);
  line-height: 1.5;
  resize: none;
}

.preview-section-mobile {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 6px;
}

.preview-header {
  font-size: 14px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
}

.preview-card-mobile {
  background: var(--md-sys-color-surface-container-lowest);
  border-radius: var(--md-shape-corner-lg);
  border: 1px solid var(--md-sys-color-outline-variant);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.preview-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge-subject {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 8px;
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
}

.badge-type-btn {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 8px;
  background: var(--md-sys-color-surface-container);
  border: 1px solid var(--md-sys-color-outline-variant);
  color: var(--md-sys-color-on-surface-variant);
  cursor: pointer;
}

.preview-date {
  font-size: 11px;
  color: var(--md-sys-color-outline);
}

.preview-summary {
  font-size: 13px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
}

.tags-editor-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tag-chips-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.preview-tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 10px;
  background: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-on-surface);
  border: 1px solid var(--md-sys-color-outline-variant);
}

.del-tag-btn {
  display: flex;
  color: var(--md-sys-color-outline);
  cursor: pointer;
}

.add-tag-box {
  display: flex;
  gap: 4px;
  max-width: 140px;
}

.tag-inline-field {
  flex: 1;
  font-size: 11px;
  padding: 3px 6px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 8px;
  background: var(--md-sys-color-surface);
  color: var(--md-sys-color-on-surface);
}

.btn-add-tag-sm {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  display: flex;
  align-items: center;
  justify-content: center;
}

.suggested-tags-row {
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}

.sug-label {
  font-size: 11px;
  color: var(--md-sys-color-outline);
  flex-shrink: 0;
}

.sug-chip {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 8px;
  background: var(--md-sys-color-surface-container);
  border: 1px dashed var(--md-sys-color-outline-variant);
  color: var(--md-sys-color-on-surface-variant);
  flex-shrink: 0;
}

.rendered-stem {
  font-size: 13px;
  line-height: 1.6;
  border-top: 1px solid var(--md-sys-color-outline-variant);
  padding-top: 8px;
  word-break: break-word;
}

.rendered-stem :deep(img),
.rendered-stem :deep(svg) {
  max-width: 100%;
  height: auto;
}

.sticky-bottom-bar {
  position: fixed;
  bottom: 64px;
  left: 0;
  right: 0;
  padding: 10px 16px;
  background: var(--md-sys-color-surface);
  border-top: 1px solid var(--md-sys-color-outline-variant);
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
  z-index: 95;
  display: flex;
}

.btn-submit-mobile {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 0;
  border-radius: 24px;
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.btn-submit-mobile:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
