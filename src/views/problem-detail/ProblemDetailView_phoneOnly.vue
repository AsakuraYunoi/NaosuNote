<template>
  <div class="m3-problem-detail-phone-view">
    <!-- Top Mobile Action Toolbar -->
    <header class="detail-phone-header">
      <div class="bar-left">
        <button
          type="button"
          class="btn-back-icon"
          title="返回"
          @click="handleBack"
        >
          <ArrowLeft :size="20" />
        </button>

        <span class="subject-chip" :class="subjectBadgeClass">{{ currentSubject }}</span>

        <div class="type-selector-wrapper">
          <select v-model="currentType" class="type-select">
            <option value="单选">单选</option>
            <option value="多选">多选</option>
            <option value="填空">填空</option>
            <option value="简答">简答</option>
          </select>
        </div>
      </div>

      <div class="bar-right">
        <button
          type="button"
          class="btn-save-mobile"
          :disabled="isSaving"
          @click="handleSave"
        >
          <Save :size="16" />
          <span>{{ isSaving ? '保存中' : '保存' }}</span>
        </button>
      </div>
    </header>

    <!-- Summary Input Bar -->
    <div class="summary-bar-mobile">
      <input
        v-model="currentSummary"
        type="text"
        class="summary-input-mobile"
        placeholder="输入考点摘要 (如: 连分数导数突破)..."
        maxlength="32"
      />
    </div>

    <!-- Mobile Segmented Tabs: 题干编辑 vs 答案解析 -->
    <div class="mobile-segmented-tabs">
      <button
        class="mobile-tab-btn"
        :class="{ active: activeTab === 'problem' }"
        @click="activeTab = 'problem'"
      >
        <span>题目与题干</span>
      </button>
      <button
        class="mobile-tab-btn"
        :class="{ active: activeTab === 'answer' }"
        @click="activeTab = 'answer'"
      >
        <span>答案与手写解析</span>
      </button>
    </div>

    <!-- Main Workspace (Tab-based for mobile screen) -->
    <main class="mobile-workspace-container">
      <div v-show="activeTab === 'problem'" class="tab-pane-mobile">
        <ProblemEditorCard
          ref="editorCardRef"
          :problem="props.problem"
          @notify="$emit('notify', $event)"
        />
      </div>

      <div v-show="activeTab === 'answer'" class="tab-pane-mobile">
        <ProblemAnswerCard
          ref="answerCardRef"
          :problem-uuid="props.problem.uuid"
          :initial-markdown="currentAnswerMarkdown"
          :initial-images="currentAnswerImages"
          @change="onAnswerChanged"
          @notify="$emit('notify', $event)"
        />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Problem } from '../../types/problem';
import { apiUpdateProblemContent, apiUpdateProblemAnswer } from '../../utils/api';
import ProblemEditorCard from './ProblemEditorCard.vue';
import ProblemAnswerCard from './ProblemAnswerCard.vue';
import { ArrowLeft, Save } from 'lucide-vue-next';

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

const activeTab = ref<'problem' | 'answer'>('problem');
const isSaving = ref(false);

const currentSubject = ref(props.problem.subject || '数学');
const currentType = ref(props.problem.type || '单选');
const currentSummary = ref(props.problem.summary || '');
const currentAnswerMarkdown = ref(props.problem.answer_markdown || '');
const currentAnswerImages = ref<string[]>([...(props.problem.answer_images || [])]);

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

    emit('notify', '已成功保存修改');
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
</script>

<style scoped>
.m3-problem-detail-phone-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--md-sys-color-background);
  position: relative;
  overflow: hidden;
}

.detail-phone-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background-color: var(--md-sys-color-surface);
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  z-index: 10;
}

.bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-back-icon {
  width: 36px;
  height: 36px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--md-sys-color-on-surface);
  border: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.subject-chip {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 10px;
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
}

.subject-chip.math { background: #e0f2fe; color: #0369a1; }
.subject-chip.physics { background: #fef3c7; color: #b45309; }
.subject-chip.chem { background: #dcfce7; color: #15803d; }
.subject-chip.bio { background: #f3e8ff; color: #7e22ce; }

.type-select {
  padding: 4px 8px;
  border-radius: 10px;
  border: 1px solid var(--md-sys-color-outline-variant);
  background: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-on-surface);
  font-size: 12px;
  outline: none;
}

.btn-save-mobile {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 7px 14px;
  border-radius: 16px;
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  font-size: 13px;
  font-weight: 600;
  border: none;
  cursor: pointer;
}

.summary-bar-mobile {
  padding: 8px 14px;
  background: var(--md-sys-color-surface);
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.summary-input-mobile {
  width: 100%;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--md-sys-color-outline-variant);
  background: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-on-surface);
  font-size: 13px;
  outline: none;
}

.summary-input-mobile:focus {
  border-color: var(--md-sys-color-primary);
}

.mobile-segmented-tabs {
  display: flex;
  background: var(--md-sys-color-surface);
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.mobile-tab-btn {
  flex: 1;
  padding: 10px 0;
  text-align: center;
  font-size: 13px;
  font-weight: 500;
  color: var(--md-sys-color-on-surface-variant);
  background: none;
  border: none;
  position: relative;
  cursor: pointer;
}

.mobile-tab-btn.active {
  color: var(--md-sys-color-primary);
  font-weight: 600;
}

.mobile-tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 20%;
  right: 20%;
  height: 3px;
  background: var(--md-sys-color-primary);
  border-radius: 3px 3px 0 0;
}

.mobile-workspace-container {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.tab-pane-mobile {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
</style>
