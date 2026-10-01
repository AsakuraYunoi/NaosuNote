<template>
  <div class="problem-editor-card">
    <!-- Card Header (52px matching Answer Card) -->
    <header class="card-header">
      <div class="card-header-left">
        <!-- Mode Switcher: 题目 vs 代码 (Identical Sliding Pill Motion) -->
        <div class="pill-segmented-control" role="tablist" aria-label="题目模式切换">
          <!-- Floating Sliding Pill (Unified 0.22s M3 easing) -->
          <div
            class="pill-slider-indicator"
            :class="{
              'pos-preview': problemViewMode === 'preview',
              'pos-code': problemViewMode === 'code',
            }"
          ></div>

          <button
            type="button"
            role="tab"
            class="pill-seg-btn"
            :class="{ active: problemViewMode === 'preview' }"
            :aria-selected="problemViewMode === 'preview'"
            title="题目排版"
            @click="switchProblemViewMode('preview')"
          >
            <span class="pill-seg-text">题目</span>
          </button>
          <button
            type="button"
            role="tab"
            class="pill-seg-btn"
            :class="{ active: problemViewMode === 'code' }"
            :aria-selected="problemViewMode === 'code'"
            title="源码查看"
            @click="switchProblemViewMode('code')"
          >
            <span class="pill-seg-text">代码</span>
          </button>
        </div>
      </div>

      <div class="card-header-right">
        <!-- History: Undo / Redo -->
        <button
          type="button"
          class="icon-action-btn"
          title="撤销"
          :disabled="!canUndo || problemViewMode === 'code'"
          @click="handleUndo"
        >
          <Undo2 :size="16" />
        </button>
        <button
          type="button"
          class="icon-action-btn"
          title="重做"
          :disabled="!canRedo || problemViewMode === 'code'"
          @click="handleRedo"
        >
          <Redo2 :size="16" />
        </button>

        <span class="card-header-divider"></span>

        <!-- Export Problem Dropdown -->
        <div ref="exportDropdownRef" class="export-dropdown-wrapper">
          <button
            type="button"
            class="btn-export-pill"
            title="导出题目"
            @click="showExportMenu = !showExportMenu"
          >
            <span>导出</span>
            <ChevronDown
              :size="13"
              class="chevron-icon"
              :class="{ 'is-open': showExportMenu }"
            />
          </button>

          <!-- Dropdown Menu -->
          <transition name="dropdown-fade">
            <div v-if="showExportMenu" class="export-dropdown-menu">
              <button type="button" class="export-menu-item" @click="handleExportImage">
                <ImageIcon :size="15" />
                <span>导出图片 (PNG)</span>
              </button>
              <button type="button" class="export-menu-item" @click="handleCopyHtml">
                <Code2 :size="15" />
                <span>复制 HTML 源码</span>
              </button>
            </div>
          </transition>
        </div>
      </div>
    </header>

    <!-- Card Body -->
    <div class="card-body">
      <ProblemDocumentCanvas
        v-show="problemViewMode === 'preview'"
        ref="documentCanvasRef"
        :initial-html="currentHtml"
        :zoom="100"
        :show-grid="false"
        @change="recordHistory"
        @edit-formula="openFormulaEditor"
      />

      <div v-show="problemViewMode === 'code'" class="raw-code-container">
        <textarea
          v-model="rawCodeText"
          class="raw-code-textarea"
          spellcheck="false"
          placeholder="在此编辑 HTML 与 LaTeX 源码..."
          @input="recordHistory"
        ></textarea>
      </div>
    </div>

    <!-- Floating Formula Editor Bubble -->
    <FormulaBubbleEditor
      v-if="formulaEditorState.visible"
      :initial-latex="formulaEditorState.latex"
      :position="formulaEditorState.position"
      @confirm="onFormulaConfirm"
      @delete="onFormulaDelete"
      @close="formulaEditorState.visible = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { Problem } from '../../types/problem';
import ProblemDocumentCanvas from '../../components/canvas/ProblemDocumentCanvas.vue';
import FormulaBubbleEditor from '../../components/canvas/FormulaBubbleEditor.vue';
import {
  apiExportProblemImage,
} from '../../utils/api';
import katexCss from 'katex/dist/katex.min.css?raw';
import { formatProblemForExam } from '../../utils/examFormatter';
import {
  Undo2,
  Redo2,
  ChevronDown,
  Image as ImageIcon,
  Code2,
} from 'lucide-vue-next';

const props = defineProps<{
  problem: Problem;
}>();

const emit = defineEmits<{
  (e: 'change'): void;
  (e: 'notify', msg: string): void;
}>();

const documentCanvasRef = ref<InstanceType<typeof ProblemDocumentCanvas> | null>(null);
const exportDropdownRef = ref<HTMLElement | null>(null);
const showExportMenu = ref(false);

const problemViewMode = ref<'preview' | 'code'>('preview');
const rawCodeText = ref(props.problem.raw_html || '');
const currentHtml = ref(props.problem.raw_html || '');

// History Stack
const historyStack = ref<string[]>([]);
const historyIndex = ref(-1);

function recordHistory() {
  const currentContent = problemViewMode.value === 'code'
    ? rawCodeText.value
    : (documentCanvasRef.value?.getSerializedHtml() || currentHtml.value);

  if (historyIndex.value < historyStack.value.length - 1) {
    historyStack.value = historyStack.value.slice(0, historyIndex.value + 1);
  }
  historyStack.value.push(currentContent);
  historyIndex.value = historyStack.value.length - 1;
  emit('change');
}

const canUndo = computed(() => historyIndex.value > 0);
const canRedo = computed(() => historyIndex.value < historyStack.value.length - 1);

function handleUndo() {
  if (!canUndo.value) return;
  historyIndex.value -= 1;
  const targetHtml = historyStack.value[historyIndex.value];
  currentHtml.value = targetHtml;
  rawCodeText.value = targetHtml;
  emit('change');
}

function handleRedo() {
  if (!canRedo.value) return;
  historyIndex.value += 1;
  const targetHtml = historyStack.value[historyIndex.value];
  currentHtml.value = targetHtml;
  rawCodeText.value = targetHtml;
  emit('change');
}

function switchProblemViewMode(mode: 'preview' | 'code') {
  if (problemViewMode.value === mode) return;
  if (mode === 'code') {
    if (documentCanvasRef.value) {
      rawCodeText.value = documentCanvasRef.value.getSerializedHtml();
    } else {
      rawCodeText.value = currentHtml.value;
    }
  } else {
    currentHtml.value = rawCodeText.value;
  }
  problemViewMode.value = mode;
}

// Export actions
function handleCopyHtml() {
  showExportMenu.value = false;
  const raw = problemViewMode.value === 'code'
    ? rawCodeText.value
    : (documentCanvasRef.value?.getSerializedHtml() || currentHtml.value);

  navigator.clipboard.writeText(raw).then(() => {
    emit('notify', '已复制 HTML');
  }).catch(() => {
    emit('notify', '复制失败');
  });
}

async function handleExportImage() {
  showExportMenu.value = false;
  try {
    const serialized = problemViewMode.value === 'code'
      ? rawCodeText.value
      : (documentCanvasRef.value?.getSerializedHtml() || currentHtml.value);

    const formatted = formatProblemForExam(serialized);
    const safeSubject = props.problem.subject || '错题';
    const safeSummary = (props.problem.summary || '').trim().slice(0, 12) || props.problem.uuid.slice(0, 8);
    const title = `题目_${safeSubject}_${safeSummary}`.replace(/[\\/:*?"<>|]/g, '_');

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    ${katexCss}
    *, *::before, *::after {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      width: 880px;
      -webkit-font-smoothing: antialiased;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      font-size: 15px;
      line-height: 1.7;
    }
    .problem-paper-sheet {
      box-sizing: border-box;
      width: 880px;
      margin: 0;
      padding: 24px 28px;
      background: #ffffff;
      color: #000000;
    }
    .paper-problem-wrapper,
    .problem-body,
    .problem-render-body {
      font-size: 15px !important;
      line-height: 1.7 !important;
      color: #000000;
      word-break: break-word;
    }
    .index-num {
      font-size: 15px !important;
      font-weight: 700 !important;
      margin-right: 3px;
    }
    .problem-lead-index {
      margin-bottom: 4px;
    }
    .sub-prompt {
      font-weight: bold;
      margin: 4px 0 2px 0;
    }
    .sub-item {
      margin-bottom: 6px;
      line-height: 1.7;
      text-indent: -1.2em;
      padding-left: 1.2em;
    }
    .blank {
      border-bottom: 1.3px solid #000;
      display: inline-block;
      vertical-align: baseline;
      margin: 0 3px;
      height: 0.85em;
    }
    .blank-sm { width: 45px; }
    .blank-md { width: 85px; }
    .blank-lg { width: 140px; }
    .blank-xl { width: 210px; }
    .options {
      margin: 6px 0;
      padding-left: 4px;
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 4px 16px !important;
      align-items: baseline;
    }
    .options-grid.options-4-col,
    .options.options-4-col {
      display: flex !important;
      flex-direction: row !important;
      flex-wrap: nowrap !important;
      align-items: baseline !important;
      column-gap: 28px !important;
      row-gap: 4px !important;
    }
    .options-grid.options-2-col,
    .options.options-2-col {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 4px 16px !important;
      align-items: baseline;
    }
    .options-grid.options-1-col,
    .options.options-1-col {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 4px !important;
      align-items: baseline;
    }
    .options-4-col > span {
      white-space: nowrap !important;
      flex: 0 0 auto !important;
    }
    .options > span {
      display: block;
      box-sizing: border-box;
      min-width: 0;
      word-break: break-word;
    }
    .katex, .katex * {
      box-sizing: content-box !important;
    }
    .katex {
      line-height: 1.2 !important;
      text-indent: 0 !important;
    }
    .sub-item .katex, p .katex, div .katex {
      font-size: 1.12em;
    }
    .img {
      text-align: center;
      margin: 8px auto;
      display: flex;
      justify-content: center;
      align-items: center;
      flex-wrap: wrap;
      gap: 14px;
    }
    .img svg, .img img {
      max-width: min(100%, 500px);
      max-height: 220px;
      width: auto;
      height: auto;
      display: inline-block;
      object-fit: contain;
    }
    .exam-images-row {
      display: flex !important;
      flex-direction: row !important;
      justify-content: center !important;
      align-items: center !important;
      flex-wrap: nowrap !important;
      gap: 16px !important;
      margin: 10px auto !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }
    .exam-images-row > .img,
    .exam-images-row > table,
    .exam-images-row > .table-wrap {
      margin: 0 !important;
      min-width: 120px !important;
      max-width: calc(100% - 136px) !important;
      box-sizing: border-box !important;
      flex: 1 1 0;
    }
    .exam-images-row > table,
    .exam-images-row > .table-wrap table {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 auto !important;
      font-size: 11px !important;
    }
    .exam-images-row .img svg,
    .exam-images-row .img img {
      max-width: 100% !important;
      max-height: 180px !important;
      width: auto !important;
      height: auto !important;
      display: inline-block !important;
      object-fit: contain !important;
    }
    .exam-atomic-phrase {
      display: inline-block !important;
      white-space: nowrap !important;
      word-break: keep-all !important;
    }
    table {
      width: 96%;
      margin: 6px auto;
      border-collapse: collapse;
      font-size: 11px;
      line-height: 1.35;
      border-top: 1.8px solid #000;
      border-bottom: 1.8px solid #000;
      text-align: center;
    }
    thead tr { border-bottom: 1.2px solid #000; background-color: #f8f9fa; }
    th { padding: 3px 6px; font-weight: bold; }
    td { padding: 3px 6px; border-bottom: 0.5px solid #ccc; }
    tbody tr:last-child td { border-bottom: none; }
  </style>
</head>
<body>
  <div class="problem-paper-sheet">
    <div class="paper-problem-wrapper">
      ${formatted}
    </div>
  </div>
</body>
</html>`;

    const savedPath = await apiExportProblemImage(html, title);
    if (savedPath) {
      emit('notify', '图片已保存至: ' + savedPath);
    }
  } catch (err: any) {
    emit('notify', '导出图片失败: ' + (err?.message || err));
  }
}

// Formula Bubble Editor
const formulaEditorState = ref<{
  visible: boolean;
  latex: string;
  position: { top: number; left: number };
  onConfirmCallback: ((val: string) => void) | null;
}>({
  visible: false,
  latex: '',
  position: { top: 100, left: 100 },
  onConfirmCallback: null,
});

function openFormulaEditor(payload: {
  latex: string;
  targetRect: DOMRect;
  onConfirm: (s: string) => void;
}) {
  const top = payload.targetRect.bottom + window.scrollY + 6;
  const left = payload.targetRect.left + window.scrollX;

  formulaEditorState.value = {
    visible: true,
    latex: payload.latex,
    position: { top, left },
    onConfirmCallback: payload.onConfirm,
  };
}

function onFormulaConfirm(newLatex: string) {
  if (formulaEditorState.value.onConfirmCallback) {
    formulaEditorState.value.onConfirmCallback(newLatex);
  }
  formulaEditorState.value.visible = false;
  recordHistory();
}

function onFormulaDelete() {
  if (formulaEditorState.value.onConfirmCallback) {
    formulaEditorState.value.onConfirmCallback('');
  }
  formulaEditorState.value.visible = false;
  recordHistory();
}

// Click outside dropdown
function onDocumentClick(e: MouseEvent) {
  if (exportDropdownRef.value && !exportDropdownRef.value.contains(e.target as Node)) {
    showExportMenu.value = false;
  }
}

// Expose methods for parent component
function getRawHtmlContent(): string {
  if (problemViewMode.value === 'code') {
    return rawCodeText.value;
  } else if (documentCanvasRef.value) {
    return documentCanvasRef.value.getSerializedHtml();
  }
  return currentHtml.value || rawCodeText.value;
}

defineExpose({
  getRawHtmlContent,
  handleUndo,
  handleRedo,
  recordHistory,
});

onMounted(() => {
  historyStack.value = [props.problem.raw_html || ''];
  historyIndex.value = 0;
  window.addEventListener('click', onDocumentClick);
});

onUnmounted(() => {
  window.removeEventListener('click', onDocumentClick);
});
</script>

<style scoped>
.problem-editor-card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--md-sys-color-surface-container-lowest, #ffffff);
  color: var(--md-sys-color-on-surface, #1d1b20);
  overflow: hidden;
  position: relative;
}

[data-theme="dark"] .problem-editor-card {
  background: var(--md-sys-color-surface-container-low, #191c22) !important;
}

/* Header (52px) */
.card-header {
  height: 52px;
  background: var(--md-sys-color-surface, #ffffff);
  border-bottom: 1px solid var(--md-sys-color-outline-variant, #e0e2ec);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
  z-index: 15;
  user-select: none;
}

[data-theme="dark"] .card-header {
  background: var(--md-sys-color-surface-container, #1d2026) !important;
  border-bottom-color: var(--md-sys-color-outline-variant, #3a3d45) !important;
}

.card-header-left,
.card-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* Segmented Pill Switcher (题目 | 代码) - Unified with Right Card */
.pill-segmented-control {
  display: inline-flex;
  align-items: center;
  position: relative;
  background-color: var(--md-sys-color-surface-container-high, #ece6f0);
  border: 1px solid var(--md-sys-color-outline-variant, #cac4d0);
  border-radius: var(--md-shape-corner-full, 9999px);
  padding: 3px;
  height: 32px;
  box-sizing: border-box;
  user-select: none;
}

[data-theme="dark"] .pill-segmented-control {
  background-color: var(--md-sys-color-surface-container-high, #272a31) !important;
  border-color: var(--md-sys-color-outline-variant, #3a3d45) !important;
}

/* Sliding Indicator Pill - Unified 0.22s M3 Easing with Right Card */
.pill-slider-indicator {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 52px;
  height: 24px;
  border-radius: var(--md-shape-corner-full, 9999px);
  background: var(--md-sys-color-surface-container-lowest, #ffffff);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1;
  pointer-events: none;
  box-sizing: border-box;
}

[data-theme="dark"] .pill-slider-indicator {
  background: var(--md-sys-color-surface-container-lowest, #14171c) !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35) !important;
}

.pill-slider-indicator.pos-preview {
  transform: translateX(0);
}

.pill-slider-indicator.pos-code {
  transform: translateX(52px);
}

.pill-seg-btn {
  position: relative;
  z-index: 2;
  width: 52px;
  height: 24px;
  border: none;
  border-radius: var(--md-shape-corner-full, 9999px);
  background: transparent;
  color: var(--md-sys-color-on-surface-variant, #49454f);
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  line-height: 1;
  box-sizing: border-box;
  transition: color 0.15s ease;
  -webkit-appearance: none;
}

.pill-seg-btn.active {
  color: var(--md-sys-color-primary, #00639b);
  font-weight: 700;
}

[data-theme="dark"] .pill-seg-btn {
  color: var(--md-sys-color-on-surface-variant, #c3c7cf) !important;
}

[data-theme="dark"] .pill-seg-btn.active {
  color: var(--md-sys-color-primary, #9ecaff) !important;
}

.pill-seg-text {
  display: inline-block;
  width: 100%;
  text-align: center;
  line-height: 1;
  transform: translateY(-0.5px);
}

/* History Icon Buttons */
.icon-action-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: #667085;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.icon-action-btn:hover:not(:disabled) {
  background: #f2f4f7;
  color: #101828;
}

.icon-action-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

[data-theme="dark"] .icon-action-btn {
  color: #98a2b3;
}

[data-theme="dark"] .icon-action-btn:hover:not(:disabled) {
  background: #272a31;
  color: #f2f4f7;
}

.card-header-divider {
  width: 1px;
  height: 16px;
  background: #d0d5dd;
  margin: 0 2px;
}

[data-theme="dark"] .card-header-divider {
  background: #383c46;
}

/* Export Dropdown Button */
.export-dropdown-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.btn-export-pill {
  height: 28px;
  padding: 0 12px;
  border-radius: 9999px;
  border: 1px solid #1a1a1a;
  background: transparent;
  color: #1a1a1a;
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-export-pill:hover {
  background: rgba(0, 0, 0, 0.05);
}

[data-theme="dark"] .btn-export-pill {
  border-color: #e4e4e7;
  color: #e4e4e7;
}

[data-theme="dark"] .btn-export-pill:hover {
  background: rgba(255, 255, 255, 0.08);
}

.chevron-icon {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.chevron-icon.is-open {
  transform: rotate(180deg);
}

/* Dropdown Menu */
.export-dropdown-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: #ffffff;
  border: 1px solid #e4e7ec;
  border-radius: 12px;
  padding: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  min-width: 150px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

[data-theme="dark"] .export-dropdown-menu {
  background: #252830;
  border-color: #383c46;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.export-menu-item {
  height: 32px;
  padding: 0 10px;
  border: none;
  background: transparent;
  color: #344054;
  border-radius: 8px;
  font-size: 12.5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.12s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
}

.export-menu-item:hover {
  background: #f2f4f7;
  color: #101828;
}

[data-theme="dark"] .export-menu-item {
  color: #d0d5dd;
}

[data-theme="dark"] .export-menu-item:hover {
  background: #323742;
  color: #ffffff;
}

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Card Body */
.card-body {
  flex: 1;
  height: calc(100% - 52px);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Raw Code Editor */
.raw-code-container {
  width: 100%;
  height: 100%;
  padding: 14px 18px 20px 18px;
  box-sizing: border-box;
  background-color: var(--md-sys-color-surface-container-low, #fcfcfd);
  overflow: hidden;
}

.raw-code-textarea {
  width: 100%;
  height: 100%;
  resize: none;
  border: 1px solid var(--md-sys-color-outline-variant, #d0d5dd);
  border-radius: 12px;
  background: var(--md-sys-color-surface-container-lowest, #ffffff);
  color: var(--md-sys-color-on-surface, #1d1b20);
  font-family: 'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace;
  font-size: 13.5px;
  line-height: 1.65;
  padding: 16px 18px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.raw-code-textarea:focus {
  border-color: var(--md-sys-color-primary, #00639b);
  box-shadow: 0 0 0 2px rgba(0, 99, 155, 0.15);
}

[data-theme="dark"] .raw-code-container {
  background-color: #17191e !important;
}

[data-theme="dark"] .raw-code-textarea {
  background-color: #1e2128 !important;
  border-color: #383c46 !important;
  color: var(--md-sys-color-on-surface, #e2e2e6) !important;
}

[data-theme="dark"] .raw-code-textarea:focus {
  border-color: var(--md-sys-color-primary, #9ecaff) !important;
  box-shadow: 0 0 0 2px rgba(158, 202, 255, 0.25) !important;
}
</style>
