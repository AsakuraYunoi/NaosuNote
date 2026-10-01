<template>
  <div class="m3-problem-detail-view">
    <!-- Top Action Toolbar (Clean & Minimal M3, 52px) -->
    <header class="detail-top-bar" data-tauri-drag-region="deep">
      <div class="bar-left">
        <button
          type="button"
          class="btn-back-icon"
          title="返回"
          aria-label="返回"
          @click="handleBack"
        >
          <ArrowLeft :size="18" />
        </button>

        <span class="bar-divider"></span>

        <!-- Subject Badge Pill -->
        <span class="subject-chip" :class="subjectBadgeClass">{{ currentSubject }}</span>

        <!-- Type Selector Pill -->
        <div class="type-selector-wrapper">
          <select v-model="currentType" class="type-select">
            <option value="单选">单选</option>
            <option value="多选">多选</option>
            <option value="填空">填空</option>
            <option value="简答">简答</option>
          </select>
        </div>

        <!-- Summary Input Capsule -->
        <div class="summary-input-wrapper">
          <input
            v-model="currentSummary"
            type="text"
            class="summary-input"
            placeholder="考点摘要..."
            maxlength="24"
          />
        </div>
      </div>

      <!-- Right: Primary Save Action -->
      <div class="bar-right">
        <button
          type="button"
          class="btn-save-primary"
          :disabled="isSaving"
          @click="handleSave"
        >
          <Save :size="15" />
          <span>{{ isSaving ? '保存中' : '保存' }}</span>
        </button>
      </div>
    </header>

    <!-- Main Dual-Card Workspace with Resizable Splitter -->
    <main ref="workspaceContainerRef" class="workspace-dual-cards">
      <!-- Left Card: Problem Card (题目编辑) -->
      <section
        class="card-shell problem-card"
        :style="{ flex: `0 0 calc(${leftWidthPercent}% - 6px)` }"
      >
        <ProblemEditorCard
          ref="editorCardRef"
          :problem="props.problem"
          @notify="$emit('notify', $event)"
        />
      </section>

      <!-- Center Splitter Gutter (Draggable, Double-click to Reset 50%) -->
      <div
        class="cards-splitter-gutter"
        :class="{ 'is-dragging': isDraggingSplitter }"
        title="双击重置分栏"
        @mousedown="startSplitterDrag"
        @dblclick="resetSplitter"
      >
        <div class="splitter-handle-bar"></div>
      </div>

      <!-- Right Card: Answer Card (答案展示) -->
      <section
        class="card-shell answer-card"
        :style="{ flex: `0 0 calc(${100 - leftWidthPercent}% - 6px)` }"
      >
        <ProblemAnswerCard
          ref="answerCardRef"
          :problem-uuid="props.problem.uuid"
          :initial-markdown="currentAnswerMarkdown"
          :initial-images="currentAnswerImages"
          @change="onAnswerChanged"
          @notify="$emit('notify', $event)"
        />
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { Problem } from '../../types/problem';
import { apiUpdateProblemContent, apiUpdateProblemAnswer } from '../../utils/api';
import ProblemEditorCard from './ProblemEditorCard.vue';
import ProblemAnswerCard from './ProblemAnswerCard.vue';
import {
  ArrowLeft,
  Save,
} from 'lucide-vue-next';

const props = defineProps<{
  problem: Problem;
}>();

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'saved', updatedProblem: Problem): void;
  (e: 'notify', msg: string): void;
}>();

const editorCardRef = ref<InstanceType<typeof ProblemEditorCard> | null>(null);
const answerCardRef = ref<InstanceType<typeof ProblemAnswerCard> | null>(null);
const workspaceContainerRef = ref<HTMLElement | null>(null);

const isSaving = ref(false);

const currentSubject = ref(props.problem.subject || '数学');
const currentType = ref(props.problem.type || '单选');
const currentSummary = ref(props.problem.summary || '');
const currentAnswerMarkdown = ref(props.problem.answer_markdown || '');
const currentAnswerImages = ref<string[]>([...(props.problem.answer_images || [])]);

// Splitter Drag State (25% ~ 75%, default 50%)
const leftWidthPercent = ref(50);
const isDraggingSplitter = ref(false);

function startSplitterDrag(e: MouseEvent) {
  e.preventDefault();
  isDraggingSplitter.value = true;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';

  window.addEventListener('mousemove', onSplitterMouseMove);
  window.addEventListener('mouseup', stopSplitterDrag);
}

function onSplitterMouseMove(e: MouseEvent) {
  if (!isDraggingSplitter.value || !workspaceContainerRef.value) return;
  const rect = workspaceContainerRef.value.getBoundingClientRect();
  const offsetX = e.clientX - rect.left;
  const newPercent = (offsetX / rect.width) * 100;
  leftWidthPercent.value = Math.max(25, Math.min(75, Number(newPercent.toFixed(1))));
}

function stopSplitterDrag() {
  if (!isDraggingSplitter.value) return;
  isDraggingSplitter.value = false;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  window.removeEventListener('mousemove', onSplitterMouseMove);
  window.removeEventListener('mouseup', stopSplitterDrag);
}

function resetSplitter() {
  leftWidthPercent.value = 50;
  emit('notify', '已重置分栏');
}

const subjectBadgeClass = computed(() => {
  const s = currentSubject.value;
  if (!s) return 'default';
  if (s.includes('物') || s === '物理') return 'physics';
  if (s.includes('数') || s === '数学') return 'math';
  if (s.includes('化') || s === '化学') return 'chem';
  if (s.includes('生') || s === '生物') return 'bio';
  return 'default';
});

function onAnswerChanged(payload: { answerMarkdown: string; answerImages: string[] }) {
  currentAnswerMarkdown.value = payload.answerMarkdown;
  currentAnswerImages.value = [...payload.answerImages];
}

// Save logic
async function handleSave() {
  if (isSaving.value) return;
  isSaving.value = true;

  try {
    const rawContentHtml = editorCardRef.value?.getRawHtmlContent() || props.problem.raw_html || '';

    let bodyContent = rawContentHtml;
    if (bodyContent.includes('problem-body') || bodyContent.includes('naosu-problem')) {
      const parser = new DOMParser();
      const parsed = parser.parseFromString(bodyContent, 'text/html');
      const nestedBody = parsed.querySelector('.problem-body');
      if (nestedBody) {
        bodyContent = nestedBody.innerHTML.trim();
      } else {
        const nestedProblem = parsed.querySelector('.naosu-problem');
        if (nestedProblem) {
          bodyContent = nestedProblem.innerHTML.trim();
        }
      }
    }

    const tagsAttr = props.problem.tags && props.problem.tags.length > 0
      ? ` tags="${props.problem.tags.join(',')}"`
      : '';

    const fullRawHtml = `<div class="naosu-problem" subject="${currentSubject.value}" type="${currentType.value}" date="${props.problem.date}" summary="${currentSummary.value}" uuid="${props.problem.uuid}"${tagsAttr}>
  <div class="problem-body">
    ${bodyContent}
  </div>
</div>`;

    const cleanText = bodyContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    await apiUpdateProblemContent(
      props.problem.uuid,
      fullRawHtml,
      cleanText,
      currentSummary.value,
      currentType.value
    );

    await apiUpdateProblemAnswer(
      props.problem.uuid,
      currentAnswerMarkdown.value,
      currentAnswerImages.value
    );

    const updated: Problem = {
      ...props.problem,
      summary: currentSummary.value,
      type: currentType.value,
      raw_html: fullRawHtml,
      stem_clean_text: cleanText,
      answer_markdown: currentAnswerMarkdown.value,
      answer_images: [...currentAnswerImages.value],
      updated_at: new Date().toISOString(),
    };

    emit('notify', '已保存');
    emit('saved', updated);
  } catch (err: any) {
    console.error('Failed to save problem:', err);
    emit('notify', `保存失败: ${err?.message || err}`);
  } finally {
    isSaving.value = false;
  }
}

function handleBack() {
  emit('back');
}

function handleGlobalKeyDown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    handleSave();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault();
    editorCardRef.value?.handleUndo();
  }
  if (
    ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') ||
    ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')
  ) {
    e.preventDefault();
    editorCardRef.value?.handleRedo();
  }
}

function preventContextMenu(e: MouseEvent) {
  e.preventDefault();
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeyDown);
  window.addEventListener('contextmenu', preventContextMenu);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeyDown);
  window.removeEventListener('contextmenu', preventContextMenu);
  stopSplitterDrag();
});
</script>

<style scoped>
.m3-problem-detail-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--md-sys-color-background, #f8f9fa);
  color: var(--md-sys-color-on-background, #191c1e);
  overflow: hidden;
}

/* =========================================================
 * M3 Top App Bar (高度 52px)
 * ========================================================= */
.detail-top-bar {
  height: 52px;
  background: var(--md-sys-color-surface, #ffffff);
  border-bottom: 1px solid var(--md-sys-color-outline-variant, #e0e2ec);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  z-index: 30;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  gap: 10px;
  flex-shrink: 0;
  -webkit-app-region: drag;
  user-select: none;
}

.bar-left button,
.bar-left select,
.bar-right button {
  -webkit-app-region: no-drag;
}

[data-theme="dark"] .detail-top-bar {
  background: var(--md-sys-color-surface-container, #1d2026) !important;
  border-bottom-color: var(--md-sys-color-outline-variant, #3a3d45) !important;
}

.bar-left,
.bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  white-space: nowrap;
}

/* Back Button */
.btn-back-icon {
  background: transparent;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  color: var(--md-sys-color-on-surface, #1d1b20);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-back-icon:hover {
  background: var(--md-sys-color-surface-container-high, #ece6f0);
  color: var(--md-sys-color-primary, #00639b);
}

.btn-back-icon:active {
  transform: scale(0.95);
}

[data-theme="dark"] .btn-back-icon {
  color: var(--md-sys-color-on-surface, #e2e2e6) !important;
}

[data-theme="dark"] .btn-back-icon:hover {
  background: var(--md-sys-color-surface-container-high, #272a31) !important;
  color: var(--md-sys-color-primary, #9ecaff) !important;
}

.bar-divider {
  width: 1px;
  height: 18px;
  background: var(--md-sys-color-outline-variant, #d0d5dd);
  margin: 0 4px;
  flex-shrink: 0;
}

[data-theme="dark"] .bar-divider {
  background: var(--md-sys-color-outline-variant, #3a3d45) !important;
}

/* Subject Badge Chip */
.subject-chip {
  height: 28px;
  padding: 0 12px;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.2px;
  white-space: nowrap;
  flex-shrink: 0;
}

.subject-chip.math {
  background: #e0f2fe;
  color: #0369a1;
}

.subject-chip.physics {
  background: #f3e8ff;
  color: #7e22ce;
}

.subject-chip.chem {
  background: #e0f2f1;
  color: #00796b;
}

.subject-chip.bio {
  background: #e8f5e9;
  color: #2e7d32;
}

.subject-chip.default {
  background: #e2e8f0;
  color: #334155;
}

/* Type Select Pill */
.type-selector-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.type-select {
  height: 30px;
  padding: 0 24px 0 12px;
  border-radius: 9999px;
  border: 1px solid var(--md-sys-color-outline-variant, #d0d5dd);
  background-color: var(--md-sys-color-surface-container-lowest, #ffffff);
  color: var(--md-sys-color-on-surface, #1d1b20);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23475467' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  outline: none;
  transition: all 0.15s ease;
}

.type-select:hover {
  border-color: #98a2b3;
}

/* Summary Input Pill */
.summary-input-wrapper {
  display: inline-flex;
  align-items: center;
  flex: 0 1 200px;
  min-width: 120px;
}

.summary-input {
  height: 30px;
  width: 100%;
  border: 1px solid var(--md-sys-color-outline-variant, #d0d5dd);
  background: var(--md-sys-color-surface-container-lowest, #ffffff);
  color: var(--md-sys-color-on-surface, #1d1b20);
  border-radius: 9999px;
  padding: 0 14px;
  font-size: 12.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  outline: none;
  transition: all 0.15s ease;
}

.summary-input:hover {
  border-color: #98a2b3;
}

.summary-input:focus {
  border-color: var(--md-sys-color-primary, #00639b);
  box-shadow: 0 0 0 2px rgba(0, 99, 155, 0.15);
}

/* Save Primary Button */
.btn-save-primary {
  height: 32px;
  background: var(--md-sys-color-primary, #00639b);
  color: #ffffff;
  border: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 500;
  padding: 0 16px;
  border-radius: 9999px;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0, 99, 155, 0.2);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-save-primary:hover:not(:disabled) {
  filter: brightness(1.08);
  box-shadow: 0 2px 6px rgba(0, 99, 155, 0.3);
}

.btn-save-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* =========================================================
 * Dual-Card Workspace (双实体圆角大卡片布局 + 分栏调节)
 * ========================================================= */
.workspace-dual-cards {
  flex: 1;
  display: flex;
  padding: 10px 14px 14px 14px;
  overflow: hidden;
  box-sizing: border-box;
  align-items: stretch;
}

.card-shell {
  height: 100%;
  border-radius: 18px;
  background: var(--md-sys-color-surface-container-lowest, #ffffff);
  border: 1px solid var(--md-sys-color-outline-variant, #e0e2ec);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  transition: box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

[data-theme="dark"] .card-shell {
  background: var(--md-sys-color-surface-container-low, #191c22) !important;
  border-color: var(--md-sys-color-outline-variant, #2a2e37) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

/* Splitter Gutter (拖拽调节分栏) */
.cards-splitter-gutter {
  width: 12px;
  flex-shrink: 0;
  cursor: col-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  z-index: 20;
}

.splitter-handle-bar {
  width: 2px;
  height: 48px;
  border-radius: 9999px;
  background: var(--md-sys-color-outline-variant, #d0d5dd);
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.cards-splitter-gutter:hover .splitter-handle-bar,
.cards-splitter-gutter.is-dragging .splitter-handle-bar {
  width: 4px;
  height: 80px;
  background: var(--md-sys-color-primary, #00639b);
}

[data-theme="dark"] .splitter-handle-bar {
  background: #383c46;
}

[data-theme="dark"] .cards-splitter-gutter:hover .splitter-handle-bar,
[data-theme="dark"] .cards-splitter-gutter.is-dragging .splitter-handle-bar {
  background: #60a5fa;
}
</style>
