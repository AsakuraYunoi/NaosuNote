<template>
  <div
    ref="canvasViewportRef"
    class="problem-document-canvas-viewport"
    :class="{ 'has-grid': showGrid, 'is-interacting': isResizing || isDraggingMedia }"
    @click="onViewportClick"
    @contextmenu.prevent
    @selectstart="onSelectStart"
  >
    <!-- Background Dot Matrix (M3 极简轻量微点阵) -->
    <div v-if="showGrid" class="grid-dot-matrix"></div>

    <!-- Virtual Artboard (自适应流式画板，随视口动态扩展，高度随题干自适应撑开) -->
    <div
      ref="artboardPaperRef"
      class="artboard-paper"
      :style="{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }"
    >
      <!-- Modern Minimalist Smart Magnetic Snap Guide (极简现代智能对齐参考线，无遮挡) -->
      <div
        v-if="isResizing && activeSnapLine"
        class="smart-magnetic-guide"
        :style="{ left: `${activeSnapLine.x}px` }"
      >
        <div class="smart-guide-tag">
          <Magnet :size="10" />
          <span>{{ activeSnapLine.ratio }}</span>
        </div>
        <div class="smart-guide-line"></div>
      </div>

      <!-- Real-time Editable Document Content Container (全保真流式可编辑文档) -->
      <div
        ref="editorDocRef"
        class="problem-document-content"
        contenteditable="true"
        spellcheck="false"
        @input="onDocInput"
        @click="onDocClick"
        @mousedown="onDocMouseDown"
        @keydown="onDocKeyDown"
      ></div>

      <!-- Live Drop Insertion Guide (水平/垂直实时高亮插入线与徽章) -->
      <div
        v-if="isDraggingMedia && activeDropGuide"
        class="canvas-drop-guide"
        :class="activeDropGuide.type"
        :style="activeDropGuide.style"
      >
        <span class="drop-guide-badge">{{ activeDropGuide.badge }}</span>
      </div>

      <!-- M3 Physical-Isolation Entity Selection Overlay (物理级独立挂载在画板层，彻底避免污染文档 DOM 与误伤图标) -->
      <div
        v-if="selectedShellEl && overlayRect"
        class="shell-interactive-overlay"
        contenteditable="false"
        :style="{
          left: `${overlayRect.left}px`,
          top: `${overlayRect.top}px`,
          width: `${overlayRect.width}px`,
          height: `${overlayRect.height}px`,
        }"
        @mousedown.stop
      >
        <!-- 实体自身高亮外边框 (紧贴图表自身外轮廓，M3 Primary Focus Ring 辉光) -->
        <div class="shell-selection-border"></div>

        <!-- M3 Unified Floating Action Capsule (单行整合式 M3 悬浮操作胶囊，距图顶14px) -->
        <div
          class="media-action-capsule"
          :class="{ 'is-flipped': isCapsuleFlipped }"
          @mousedown.stop
          @click.stop
        >
          <!-- 拖动移动手柄 (M3 Assist Chip 样式) -->
          <div
            class="capsule-drag-pill"
            title="按住拖拽在段落、小问或图表之间重新放置"
            @mousedown.stop.prevent="startMoveDrag($event)"
          >
            <GripHorizontal :size="13" />
            <span class="capsule-drag-text">拖动</span>
          </div>

          <span class="capsule-sep"></span>

          <!-- 靠左排版 -->
          <button
            type="button"
            class="capsule-btn"
            :class="{ active: currentMediaAlign === 'left' }"
            title="靠左排版"
            @click.stop="setMediaAlign('left')"
          >
            <AlignLeft :size="13" />
          </button>

          <!-- 居中排版 -->
          <button
            type="button"
            class="capsule-btn"
            :class="{ active: currentMediaAlign === 'center' }"
            title="居中排版"
            @click.stop="setMediaAlign('center')"
          >
            <AlignCenter :size="13" />
          </button>

          <!-- 靠右排版 -->
          <button
            type="button"
            class="capsule-btn"
            :class="{ active: currentMediaAlign === 'right' }"
            title="靠右排版"
            @click.stop="setMediaAlign('right')"
          >
            <AlignRight :size="13" />
          </button>

          <span class="capsule-sep"></span>

          <!-- 同行并排 / 拆分单行 -->
          <button
            type="button"
            class="capsule-btn btn-pill-action"
            :class="{ active: isInSideBySideRow }"
            :title="isInSideBySideRow ? '拆分为独立单行' : '与相邻图表同行并排'"
            @click.stop="toggleSideBySide"
          >
            <Columns2 v-if="!isInSideBySideRow" :size="13" />
            <Rows2 v-else :size="13" />
            <span>{{ isInSideBySideRow ? '拆分单行' : '同行并排' }}</span>
          </button>

          <span class="capsule-sep"></span>

          <!-- 删除元素 (M3 Error 反馈色) -->
          <button
            type="button"
            class="capsule-btn btn-danger"
            title="删除该元素"
            @click.stop="deleteSelectedMedia"
          >
            <Trash2 :size="13" />
          </button>
        </div>

        <!-- 4 Corner Circular Pin Handles (4个 M3 精密圆形销钉手柄) -->
        <div
          class="resize-pin tl"
          title="拖动手柄等比缩放"
          @mousedown.stop.prevent="startResize($event, 'tl')"
        ></div>
        <div
          class="resize-pin tr"
          title="拖动手柄等比缩放"
          @mousedown.stop.prevent="startResize($event, 'tr')"
        ></div>
        <div
          class="resize-pin bl"
          title="拖动手柄等比缩放"
          @mousedown.stop.prevent="startResize($event, 'bl')"
        ></div>
        <div
          class="resize-pin br"
          title="拖动手柄等比缩放"
          @mousedown.stop.prevent="startResize($event, 'br')"
        ></div>

        <!-- Resizing Magnet Badge (M3 动态磁吸栏位尺寸徽章) -->
        <div
          v-if="isResizing"
          class="resizing-magnet-badge"
          :class="{ 'is-magnet-locked': activeSnapColumn !== null }"
        >
          <Magnet v-if="activeSnapColumn !== null" :size="12" />
          <span>{{ snappedBadgeText || `${Math.round(currentShellWidth)} px` }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, toRef, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { renderLatexInHtml } from '../../utils/katexRender';
import { formatProblemOptions } from '../../utils/examFormatter';
import {
  normalizeDocumentTree,
  setupMediaShells,
  toggleSideBySideLayout,
  deleteMediaBlock,
  setMediaBlockAlignment,
  cleanAndSerializeHtml,
} from '../../utils/mediaLayoutEngine';
import { useCanvasMediaInteraction } from './useCanvasMediaInteraction';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Trash2,
  Magnet,
  GripHorizontal,
  Columns2,
  Rows2,
} from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    initialHtml: string;
    zoom?: number;
    showGrid?: boolean;
  }>(),
  {
    zoom: 100,
    showGrid: true,
  }
);

const emit = defineEmits<{
  (e: 'update:html', val: string): void;
  (e: 'change'): void;
  (e: 'editFormula', payload: { latex: string; targetRect: DOMRect; onConfirm: (s: string) => void }): void;
}>();

const canvasViewportRef = ref<HTMLElement | null>(null);
const artboardPaperRef = ref<HTMLElement | null>(null);
const editorDocRef = ref<HTMLElement | null>(null);

// 动态版心内容宽度（自适应视口）
const artboardInnerWidth = ref(700);

function updateArtboardDimensions() {
  if (!artboardPaperRef.value) return;
  const style = window.getComputedStyle(artboardPaperRef.value);
  const pl = parseFloat(style.paddingLeft) || 40;
  const pr = parseFloat(style.paddingRight) || 40;
  const clientW = artboardPaperRef.value.clientWidth;
  artboardInnerWidth.value = Math.max(480, clientW - pl - pr);
}

function emitChange() {
  emit('change');
  if (editorDocRef.value) {
    emit('update:html', cleanAndSerializeHtml(editorDocRef.value, props.initialHtml));
  }
}

// 引入解耦后的交互控制 Composable（传入动态 innerWidth）
const {
  selectedShellEl,
  currentMediaAlign,
  currentShellWidth,
  isCapsuleFlipped,
  isInSideBySideRow,
  overlayRect,
  isResizing,
  activeSnapColumn,
  activeSnapLine,
  snappedBadgeText,
  isDraggingMedia,
  activeDropGuide,
  selectShell,
  clearSelection,
  updateOverlayRect,
  startResize,
  startMoveDrag,
  handlePotentialDragStart,
} = useCanvasMediaInteraction(
  artboardPaperRef,
  editorDocRef,
  toRef(props, 'zoom'),
  artboardInnerWidth,
  emitChange
);

let paperObserver: ResizeObserver | null = null;

// 初始化渲染完整原始 HTML
function initContent() {
  if (!editorDocRef.value) return;

  let raw = props.initialHtml || '';
  if (!raw.trim()) {
    raw = '<div class="problem-body"><p>在此输入题目文字...</p></div>';
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, 'text/html');

  const bodyEl = doc.querySelector('.problem-body');
  let contentHtml = '';
  if (bodyEl) {
    contentHtml = bodyEl.innerHTML.trim();
  } else {
    const problemContainer = doc.querySelector('.naosu-problem') || doc.body;
    contentHtml = problemContainer.innerHTML.trim();
  }

  editorDocRef.value.innerHTML = renderLatexInHtml(formatProblemOptions(contentHtml));

  normalizeDocumentTree(editorDocRef.value);
  setupMediaShells(editorDocRef.value, artboardInnerWidth.value);
}

// 监听外界 HTML 更新
watch(
  () => props.initialHtml,
  () => {
    if (!editorDocRef.value || document.activeElement === editorDocRef.value) return;
    initContent();
  }
);

// 监听缩放比例变化，动态同步浮层几何坐标
watch(
  () => props.zoom,
  () => {
    nextTick(() => {
      updateOverlayRect();
    });
  }
);

function onSelectStart(e: Event) {
  if (selectedShellEl.value || isResizing.value || isDraggingMedia.value) {
    e.preventDefault();
  }
}

function onViewportClick() {
  clearSelection();
}

function onDocClick(e: MouseEvent) {
  const target = e.target as HTMLElement;

  // 1. 检查是否点击了 KaTeX 数学公式
  const katexTarget = target.closest('.katex, .katex-display');
  if (katexTarget) {
    e.stopPropagation();
    clearSelection();
    const annotation = katexTarget.querySelector('annotation');
    const latex = annotation ? annotation.textContent || '' : '';
    const rect = katexTarget.getBoundingClientRect();

    emit('editFormula', {
      latex: latex.trim(),
      targetRect: rect,
      onConfirm: (newLatex: string) => {
        const spanNode = document.createElement('span');
        spanNode.className = 'formula-inline';
        spanNode.innerHTML = renderLatexInHtml(`$${newLatex}$`);
        katexTarget.replaceWith(spanNode);
        emitChange();
      },
    });
    return;
  }

  // 2. 检查是否点击了实体外壳 (.canvas-media-shell)
  const shellTarget = target.closest('.canvas-media-shell') as HTMLElement | null;
  if (shellTarget && editorDocRef.value?.contains(shellTarget)) {
    e.stopPropagation();
    selectShell(shellTarget);
    return;
  }

  // 3. 点击普通文本区域，恢复文字编辑
  clearSelection();
}

function onDocMouseDown(e: MouseEvent) {
  const target = e.target as HTMLElement;
  const shell = target.closest('.canvas-media-shell') as HTMLElement | null;
  if (shell && shell === selectedShellEl.value) {
    handlePotentialDragStart(e, shell);
  }
}

function onDocInput() {
  if (editorDocRef.value) {
    normalizeDocumentTree(editorDocRef.value);
    setupMediaShells(editorDocRef.value, artboardInnerWidth.value);
  }
  updateOverlayRect();
  emitChange();
}

function onDocKeyDown(e: KeyboardEvent) {
  if (selectedShellEl.value && (e.key === 'Backspace' || e.key === 'Delete')) {
    e.preventDefault();
    deleteSelectedMedia();
    return;
  }
  emitChange();
}

// --- 对齐控制 ---
function setMediaAlign(align: 'left' | 'center' | 'right') {
  if (!selectedShellEl.value) return;
  currentMediaAlign.value = align;
  setMediaBlockAlignment(selectedShellEl.value, align);

  nextTick(() => {
    updateOverlayRect();
    emitChange();
  });
}

// --- 同行并排与拆分单行 ---
function toggleSideBySide() {
  if (!selectedShellEl.value || !editorDocRef.value) return;

  const changed = toggleSideBySideLayout(selectedShellEl.value, editorDocRef.value);
  if (changed) {
    nextTick(() => {
      setupMediaShells(editorDocRef.value!, artboardInnerWidth.value);
      updateOverlayRect();
      emitChange();
    });
  }
}

// --- 删除选中元素 ---
function deleteSelectedMedia() {
  if (!selectedShellEl.value) return;
  const targetShell = selectedShellEl.value;
  clearSelection();
  deleteMediaBlock(targetShell);
  emitChange();
}

// --- 对外公开方法 ---
function getSerializedHtml(): string {
  if (!editorDocRef.value) return props.initialHtml || '';
  return cleanAndSerializeHtml(editorDocRef.value, props.initialHtml);
}

function insertBlank(sizeClass: string = 'blank-md') {
  if (!editorDocRef.value) return;
  const blankHtml = `&nbsp;<span class="blank ${sizeClass}"></span>&nbsp;`;
  document.execCommand('insertHTML', false, blankHtml);
  emitChange();
}

function insertFormula(formula: string = 'f(x) = 0') {
  if (!editorDocRef.value) return;
  const fHtml = `&nbsp;<span class="formula-inline">${renderLatexInHtml(`$${formula}$`)}</span>&nbsp;`;
  document.execCommand('insertHTML', false, fHtml);
  emitChange();
}

function insertTable() {
  if (!editorDocRef.value) return;
  const tableHtml = `
<table style="width: 85%; margin: 12px auto;" contenteditable="false">
  <thead>
    <tr>
      <th>实验组别</th>
      <th>反应物浓度 / (mol·L⁻¹)</th>
      <th>反应速率 / (mol·L⁻¹·s⁻¹)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td contenteditable="true">甲</td>
      <td contenteditable="true">0.10</td>
      <td contenteditable="true">1.2 × 10⁻³</td>
    </tr>
    <tr>
      <td contenteditable="true">乙</td>
      <td contenteditable="true">0.20</td>
      <td contenteditable="true">2.4 × 10⁻³</td>
    </tr>
  </tbody>
</table>
`;
  document.execCommand('insertHTML', false, tableHtml);
  setupMediaShells(editorDocRef.value, artboardInnerWidth.value);
  emitChange();
}

defineExpose({
  getSerializedHtml,
  insertBlank,
  insertFormula,
  insertTable,
});

onMounted(() => {
  initContent();

  if (artboardPaperRef.value && window.ResizeObserver) {
    paperObserver = new ResizeObserver(() => {
      updateArtboardDimensions();
      updateOverlayRect();
    });
    paperObserver.observe(artboardPaperRef.value);
  }
  updateArtboardDimensions();
});

onUnmounted(() => {
  if (paperObserver) paperObserver.disconnect();
});
</script>

<style scoped>
/* 整个视口背景：M3 Surface Container Low */
.problem-document-canvas-viewport {
  position: relative;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  background-color: transparent;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 12px 16px 40px 16px;
  box-sizing: border-box;
}

[data-theme="dark"] .problem-document-canvas-viewport {
  background-color: transparent !important;
}

/* 点阵网格背景 (M3 极简细密点阵) */
.grid-dot-matrix {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: radial-gradient(var(--md-sys-color-outline-variant, #cac4d0) 1.2px, transparent 1.2px);
  background-size: 24px 24px;
  opacity: 0.45;
}

[data-theme="dark"] .grid-dot-matrix {
  background-image: radial-gradient(var(--md-sys-color-outline-variant, #3a3d45) 1.4px, transparent 1.4px) !important;
  opacity: 0.55;
}

/* 试卷纸面：无缝贴合卡片视口，消除双层边框与外凸阴影 */
.artboard-paper {
  position: relative;
  width: 100%;
  max-width: 860px;
  min-width: 0;
  min-height: 100%;
  background: transparent;
  box-shadow: none;
  border: none;
  border-radius: 0;
  padding: 12px 16px 48px 16px;
  box-sizing: border-box;
  transition: transform 0.15s cubic-bezier(0.2, 0, 0, 1);
}

[data-theme="dark"] .artboard-paper {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  color: var(--md-sys-color-on-surface, #e2e2e6) !important;
}

/* =========================================================
 * 现代化极简智能磁吸对齐参考线 (Smart Magnetic Snap Guide)
 * 摒弃传统粗暴的12列全屏栅格遮挡，呈现 Figma/Apple 式轻盈参考线
 * ========================================================= */
.smart-magnetic-guide {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
  pointer-events: none;
  z-index: 25;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.smart-guide-tag {
  position: absolute;
  top: 14px;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--md-sys-color-primary, #00639b);
  color: var(--md-sys-color-on-primary, #ffffff);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2px;
  padding: 2px 8px;
  border-radius: var(--md-shape-corner-full, 9999px);
  box-shadow: var(--md-elevation-2);
  white-space: nowrap;
  animation: guideTagPop 0.15s cubic-bezier(0.2, 0, 0, 1);
  z-index: 26;
}

[data-theme="dark"] .smart-guide-tag {
  background: var(--md-sys-color-primary, #9ecaff) !important;
  color: var(--md-sys-color-on-primary, #003258) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4) !important;
}

.smart-guide-line {
  position: absolute;
  top: 36px;
  bottom: 16px;
  width: 1.5px;
  transform: translateX(-50%);
  background: linear-gradient(
    180deg,
    var(--md-sys-color-primary, #00639b) 0%,
    var(--md-sys-color-primary, #00639b) 85%,
    rgba(0, 99, 155, 0.1) 100%
  );
  box-shadow: 0 0 6px rgba(0, 99, 155, 0.35);
  animation: guideLineFadeIn 0.12s ease-out;
}

[data-theme="dark"] .smart-guide-line {
  background: linear-gradient(
    180deg,
    var(--md-sys-color-primary, #9ecaff) 0%,
    var(--md-sys-color-primary, #9ecaff) 85%,
    rgba(158, 202, 255, 0.1) 100%
  ) !important;
  box-shadow: 0 0 8px rgba(158, 202, 255, 0.4) !important;
}

@keyframes guideTagPop {
  from {
    opacity: 0;
    transform: translate(-50%, -4px) scale(0.92);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0) scale(1);
  }
}

@keyframes guideLineFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* 流式题目正文排版容器 */
.problem-document-content {
  position: relative;
  z-index: 5;
  width: 100%;
  min-height: 600px;
  outline: none;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 14.5px;
  line-height: 1.85;
  color: var(--md-sys-color-on-surface, #1d1b20);
  word-break: break-word;
}

[data-theme="dark"] .problem-document-content {
  color: var(--md-sys-color-on-surface, #e2e2e6) !important;
}

.problem-document-content :deep(p) {
  margin: 10px 0;
}

.problem-document-content :deep(.stem-paragraph) {
  margin: 12px 0;
  text-indent: 0;
}

.problem-document-content :deep(.blank) {
  display: inline-block;
  border-bottom: 1.5px solid currentColor;
  vertical-align: baseline;
  margin: 0 3px;
  height: 0.9em;
}

.problem-document-content :deep(.blank-sm) { width: 45px; }
.problem-document-content :deep(.blank-md) { width: 85px; }
.problem-document-content :deep(.blank-lg) { width: 140px; }
.problem-document-content :deep(.blank-xl) { width: 210px; }

.problem-document-content :deep(table) {
  border-collapse: collapse;
  margin: 12px auto;
  border-top: 1.8px solid currentColor;
  border-bottom: 1.8px solid currentColor;
  text-align: center;
  font-size: 13px;
}

.problem-document-content :deep(th),
.problem-document-content :deep(td) {
  padding: 5px 10px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant, #cac4d0);
}

[data-theme="dark"] .problem-document-content :deep(.img svg),
[data-theme="dark"] .problem-document-content :deep(.canvas-media-shell svg),
[data-theme="dark"] .problem-document-content :deep(.exam-images-row svg) {
  filter: invert(0.88) hue-rotate(180deg);
}

[data-theme="dark"] .problem-document-content :deep(.katex svg) {
  filter: none !important;
}

[data-theme="dark"] .problem-document-content :deep(table) {
  border-top-color: #e2e2e6 !important;
  border-bottom-color: #e2e2e6 !important;
}

[data-theme="dark"] .problem-document-content :deep(thead tr) {
  border-bottom-color: #e2e2e6 !important;
  background-color: rgba(255, 255, 255, 0.08) !important;
}

[data-theme="dark"] .problem-document-content :deep(th) {
  color: #e2e2e6 !important;
}

[data-theme="dark"] .problem-document-content :deep(td) {
  border-bottom-color: rgba(255, 255, 255, 0.15) !important;
  color: #c3c7cf !important;
}

.problem-document-content :deep(.img) {
  margin: 24px auto !important;
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  clear: both !important;
  width: 100% !important;
  min-height: 40px !important;
  overflow: visible !important;
}

.problem-document-content :deep(.img.align-left) { justify-content: flex-start !important; }
.problem-document-content :deep(.img.align-center) { justify-content: center !important; }
.problem-document-content :deep(.img.align-right) { justify-content: flex-end !important; }

.problem-document-content :deep(.katex) {
  cursor: pointer;
  border-radius: 4px;
  padding: 1px 3px;
  transition: background-color 0.12s ease;
}

.problem-document-content :deep(.katex:hover) {
  background-color: var(--md-sys-color-primary-container, rgba(0, 99, 155, 0.15));
}

/* =========================================================
 * 实体内嵌外壳系统 (.canvas-media-shell)
 * ========================================================= */
.problem-document-content :deep(.canvas-media-shell) {
  position: relative !important;
  display: inline-flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  box-sizing: border-box !important;
  max-width: 100% !important;
  cursor: pointer !important;
  user-select: none !important;
  overflow: visible !important;
  transition: box-shadow 0.1s ease;
}

.problem-document-content :deep(.canvas-media-shell.table-shell) {
  display: block !important;
  margin: 8px auto !important;
}

/* 内部真实 SVG 紧贴外壳轮廓 */
.problem-document-content :deep(.canvas-media-shell > svg),
.problem-document-content :deep(.img > svg),
.problem-document-content :deep(.canvas-media-shell > .image-shell > svg) {
  width: 100% !important;
  max-width: 100% !important;
  height: auto !important;
  display: block !important;
  margin: 0 auto !important;
}

/* =========================================================
 * 一题多图 / 表格与图片同行并排 Flex 布局规范 (.exam-images-row)
 * 解除强行均分锁死，支持用户自由缩放调整非对称比例
 * ========================================================= */
.problem-document-content :deep(.exam-images-row) {
  display: flex !important;
  flex-direction: row !important;
  justify-content: center !important;
  align-items: center !important;
  flex-wrap: nowrap !important; /* 同行并排严格不折行 */
  gap: 16px !important;
  margin: 18px auto !important;
  width: 100% !important;
  box-sizing: border-box !important;
}

.problem-document-content :deep(.exam-images-row > .img),
.problem-document-content :deep(.exam-images-row > .canvas-media-shell),
.problem-document-content :deep(.exam-images-row > table),
.problem-document-content :deep(.exam-images-row > .table-wrap) {
  min-width: 120px !important;
  max-width: calc(100% - 136px) !important;
  margin: 0 !important;
  clear: none !important;
  box-sizing: border-box !important;
  flex: 1 1 0; /* 默认均分，但允许内联指定的具体 flex/width 覆盖生效 */
}

.problem-document-content :deep(.exam-images-row > .img .canvas-media-shell) {
  max-width: 100% !important;
  margin: 0 auto !important;
}

.problem-document-content :deep(.exam-images-row .canvas-media-shell.table-shell) {
  display: block !important;
  margin: 0 !important;
}

.problem-document-content :deep(.exam-images-row table) {
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 auto !important;
  font-size: 12px !important;
}

.problem-document-content :deep(.exam-images-row svg) {
  max-width: 100% !important;
  max-height: 220px !important;
  width: auto !important;
  height: auto !important;
  object-fit: contain !important;
}

/* =========================================================
 * M3 独立物理级交互浮层系统 (挂载于 Artboard，物理隔绝文档)
 * ========================================================= */
.shell-interactive-overlay {
  position: absolute;
  pointer-events: none;
  z-index: 40;
  box-sizing: border-box;
}

/* M3 Primary Focus Ring 选框 */
.shell-selection-border {
  position: absolute;
  inset: -2px;
  border: 1.8px solid var(--md-sys-color-primary, #00639b);
  border-radius: var(--md-shape-corner-xs, 4px);
  box-shadow: 0 0 0 1px rgba(0, 99, 155, 0.15), 0 2px 8px rgba(0, 99, 155, 0.2);
  pointer-events: none;
}

[data-theme="dark"] .shell-selection-border {
  border-color: var(--md-sys-color-primary, #9ecaff) !important;
  box-shadow: 0 0 0 1px rgba(158, 202, 255, 0.2), 0 2px 10px rgba(158, 202, 255, 0.25) !important;
}

/* 4 角 M3 Floating Handle 销钉手柄 */
.resize-pin {
  position: absolute;
  width: 10px;
  height: 10px;
  background: var(--md-sys-color-surface-container-lowest, #ffffff);
  border: 2px solid var(--md-sys-color-primary, #00639b);
  border-radius: var(--md-shape-corner-full, 9999px);
  pointer-events: auto;
  box-sizing: border-box;
  box-shadow: var(--md-elevation-1, 0px 1px 3px 1px rgba(0, 0, 0, 0.15));
  z-index: 45;
  transition: transform 0.14s cubic-bezier(0.2, 0, 0, 1), background-color 0.14s ease;
}

[data-theme="dark"] .resize-pin {
  background: var(--md-sys-color-surface-container-highest, #32353d) !important;
  border-color: var(--md-sys-color-primary, #9ecaff) !important;
}

.resize-pin:hover {
  transform: scale(1.38);
  background: var(--md-sys-color-primary-container, #cee5ff);
}

[data-theme="dark"] .resize-pin:hover {
  background: var(--md-sys-color-primary-container, #00497d) !important;
}

.resize-pin.tl { top: -6px; left: -6px; cursor: nwse-resize; }
.resize-pin.tr { top: -6px; right: -6px; cursor: nesw-resize; }
.resize-pin.bl { bottom: -6px; left: -6px; cursor: nesw-resize; }
.resize-pin.br { bottom: -6px; right: -6px; cursor: nwse-resize; }

/* M3 单行悬浮操作胶囊 (Floating Action Bar) */
.media-action-capsule {
  position: absolute;
  bottom: calc(100% + 14px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--md-sys-color-surface-container-high, #ece6f0);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--md-sys-color-outline-variant, #cac4d0);
  border-radius: var(--md-shape-corner-full, 9999px);
  box-shadow: var(--md-elevation-3, 0px 4px 8px 3px rgba(0, 0, 0, 0.15));
  display: flex;
  align-items: center;
  padding: 4px 8px;
  gap: 4px;
  pointer-events: auto;
  white-space: nowrap;
  user-select: none;
  z-index: 50;
  animation: capsuleFade 0.14s cubic-bezier(0.2, 0, 0, 1);
}

.media-action-capsule.is-flipped {
  bottom: auto;
  top: calc(100% + 14px);
}

[data-theme="dark"] .media-action-capsule {
  background: rgba(39, 42, 49, 0.94) !important;
  border-color: var(--md-sys-color-outline-variant, #3a3d45) !important;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55) !important;
  color: var(--md-sys-color-on-surface, #e2e2e6) !important;
}

@keyframes capsuleFade {
  from { opacity: 0; transform: translate(-50%, 6px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}

/* 胶囊内图标尺寸锁定 */
.media-action-capsule :deep(svg),
.capsule-btn :deep(svg),
.capsule-drag-pill :deep(svg) {
  width: 13px !important;
  height: 13px !important;
  max-width: 13px !important;
  max-height: 13px !important;
  min-width: 13px !important;
  min-height: 13px !important;
  display: inline-block !important;
  margin: 0 !important;
  flex-shrink: 0 !important;
}

/* M3 Assist Chip 风格拖拽手柄 */
.capsule-drag-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 10px;
  border-radius: var(--md-shape-corner-full, 9999px);
  cursor: grab;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.1px;
  background: var(--md-sys-color-surface-container-highest, #e6e0e9);
  color: var(--md-sys-color-on-surface-variant, #49454f);
  transition: all 0.14s cubic-bezier(0.2, 0, 0, 1);
  height: 28px;
  box-sizing: border-box;
}

[data-theme="dark"] .capsule-drag-pill {
  background: var(--md-sys-color-surface-container-highest, #32353d) !important;
  color: var(--md-sys-color-on-surface-variant, #c3c7cf) !important;
}

.capsule-drag-pill:hover {
  background: var(--md-sys-color-primary-container, #cee5ff);
  color: var(--md-sys-color-on-primary-container, #001d33);
}

[data-theme="dark"] .capsule-drag-pill:hover {
  background: var(--md-sys-color-primary-container, #00497d) !important;
  color: var(--md-sys-color-on-primary-container, #d1e4ff) !important;
}

.capsule-drag-pill:active { cursor: grabbing; }

.capsule-drag-text { font-size: 10.5px; }

.capsule-sep {
  width: 1px;
  height: 16px;
  background: var(--md-sys-color-outline-variant, #cac4d0);
  margin: 0 3px;
}

[data-theme="dark"] .capsule-sep {
  background: var(--md-sys-color-outline-variant, #3a3d45) !important;
}

/* M3 Tonal Segmented Button 按钮风格 */
.capsule-btn {
  background: transparent;
  border: 1px solid transparent;
  padding: 0 9px;
  border-radius: var(--md-shape-corner-full, 9999px);
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  color: var(--md-sys-color-on-surface-variant, #49454f);
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: center;
  transition: all 0.14s cubic-bezier(0.2, 0, 0, 1);
  height: 28px;
  box-sizing: border-box;
  line-height: 1;
}

[data-theme="dark"] .capsule-btn {
  color: var(--md-sys-color-on-surface-variant, #c3c7cf) !important;
}

.capsule-btn:hover {
  background: var(--md-sys-color-surface-container-highest, #e6e0e9);
  color: var(--md-sys-color-on-surface, #1d1b20);
}

[data-theme="dark"] .capsule-btn:hover {
  background: var(--md-sys-color-surface-container-highest, #32353d) !important;
  color: var(--md-sys-color-on-surface, #e2e2e6) !important;
}

.capsule-btn.active {
  background: var(--md-sys-color-secondary-container, #d4e4f6) !important;
  color: var(--md-sys-color-on-secondary-container, #0e1d2a) !important;
  font-weight: 600;
}

[data-theme="dark"] .capsule-btn.active {
  background: var(--md-sys-color-secondary-container, #3a4857) !important;
  color: var(--md-sys-color-on-secondary-container, #d4e4f6) !important;
}

.capsule-btn.btn-danger:hover {
  background: var(--md-sys-color-error-container, #ffdad6) !important;
  color: var(--md-sys-color-error, #ba1a1a) !important;
}

[data-theme="dark"] .capsule-btn.btn-danger:hover {
  background: var(--md-sys-color-error-container, #93000a) !important;
  color: var(--md-sys-color-on-error-container, #ffdad6) !important;
}

/* M3 尺寸微章 (Tonal Tooltip / Floating Chip) */
.resizing-magnet-badge {
  position: absolute;
  top: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(29, 27, 32, 0.9);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: #ffffff;
  font-size: 11.5px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.2px;
  padding: 4px 12px;
  border-radius: var(--md-shape-corner-full, 9999px);
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: var(--md-elevation-2);
  z-index: 50;
  animation: badgeFadeIn 0.12s cubic-bezier(0.2, 0, 0, 1);
  transition: background-color 0.15s ease, transform 0.1s ease;
}

[data-theme="dark"] .resizing-magnet-badge {
  background: rgba(50, 53, 61, 0.92) !important;
  color: var(--md-sys-color-on-surface, #e2e2e6) !important;
  border: 1px solid var(--md-sys-color-outline-variant, #3a3d45);
}

.resizing-magnet-badge :deep(svg) {
  width: 12px !important;
  height: 12px !important;
  max-width: 12px !important;
  max-height: 12px !important;
  display: inline-block !important;
  margin: 0 !important;
}

.resizing-magnet-badge.is-magnet-locked {
  background: var(--md-sys-color-primary, #00639b) !important;
  color: var(--md-sys-color-on-primary, #ffffff) !important;
  box-shadow: 0 3px 12px rgba(0, 99, 155, 0.4);
}

[data-theme="dark"] .resizing-magnet-badge.is-magnet-locked {
  background: var(--md-sys-color-primary, #9ecaff) !important;
  color: var(--md-sys-color-on-primary, #003258) !important;
  box-shadow: 0 3px 12px rgba(158, 202, 255, 0.35);
}

@keyframes badgeFadeIn {
  from { opacity: 0; transform: translate(-50%, 4px) scale(0.96); }
  to { opacity: 1; transform: translate(-50%, 0) scale(1); }
}

/* 拖拽插入引导高亮指示线 */
.canvas-drop-guide {
  position: absolute;
  pointer-events: none;
  z-index: 45;
  transition: all 0.08s ease-out;
}

.canvas-drop-guide.horizontal {
  left: min(5vw, 48px);
  right: min(5vw, 48px);
  height: 2.5px;
  background: var(--md-sys-color-primary, #00639b);
  box-shadow: 0 0 10px rgba(0, 99, 155, 0.5);
  border-radius: 2px;
}

.canvas-drop-guide.vertical {
  width: 2.5px;
  background: var(--md-sys-color-primary, #00639b);
  box-shadow: 0 0 10px rgba(0, 99, 155, 0.6);
  border-radius: 2px;
}

.drop-guide-badge {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--md-sys-color-primary, #00639b);
  color: var(--md-sys-color-on-primary, #ffffff);
  font-size: 10.5px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: var(--md-shape-corner-full, 9999px);
  box-shadow: var(--md-elevation-2);
  white-space: nowrap;
}
</style>
