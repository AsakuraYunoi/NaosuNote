<template>
  <div class="answer-ai-pane">
    <!-- Edit Mode: Monospace Textarea -->
    <div v-if="subMode === 'edit'" class="markdown-editor-wrapper">
      <div class="editor-sub-bar">
        <span class="editor-hint">支持 Markdown 与 LaTeX 公式 ($...$)</span>
        <span class="char-count">{{ markdownText.length }} 字</span>
      </div>

      <textarea
        ref="textareaRef"
        v-model="internalMarkdown"
        class="markdown-textarea"
        placeholder="在此输入或粘贴 Markdown 解析与 LaTeX 公式...&#10;&#10;示例：&#10;### 答案&#10;B&#10;### 解析&#10;根据牛顿第二定律：&#10;$$F = ma = mg - kv^2$$"
        @input="onInput"
      ></textarea>
    </div>

    <!-- Preview Mode: Formatted Render (Only switches mode via buttons) -->
    <div
      v-else
      class="markdown-preview-wrapper"
    >
      <div
        v-if="renderedMarkdownHtml"
        class="markdown-rendered-content"
        v-html="renderedMarkdownHtml"
      ></div>

      <div v-else class="markdown-empty-state">
        <Sparkles :size="32" class="empty-icon-sparkle" />
        <p class="empty-title">暂无解析</p>
        <p class="empty-desc">
          点击上方「编辑」按钮输入，或按 Ctrl+V 粘贴解析内容
        </p>
        <button
          type="button"
          class="btn-start-input"
          @click.stop="emit('update:subMode', 'edit')"
        >
          输入解析
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { renderMarkdownWithKatex } from '../../../utils/markdownKatexParser';
import { Sparkles } from 'lucide-vue-next';

const props = defineProps<{
  markdownText: string;
  subMode: 'preview' | 'edit';
}>();

const emit = defineEmits<{
  (e: 'update:markdownText', val: string): void;
  (e: 'update:subMode', val: 'preview' | 'edit'): void;
  (e: 'change'): void;
}>();

const internalMarkdown = ref(props.markdownText);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

watch(
  () => props.markdownText,
  (val) => {
    if (val !== internalMarkdown.value) {
      internalMarkdown.value = val;
    }
  }
);

watch(
  () => props.subMode,
  (mode) => {
    if (mode === 'edit') {
      nextTick(() => {
        textareaRef.value?.focus();
      });
    }
  }
);

const renderedMarkdownHtml = computed(() => {
  return renderMarkdownWithKatex(internalMarkdown.value);
});

function onInput() {
  emit('update:markdownText', internalMarkdown.value);
  emit('change');
}

onMounted(() => {
  if (props.subMode === 'edit') {
    nextTick(() => {
      textareaRef.value?.focus();
    });
  }
});
</script>

<style scoped>
.answer-ai-pane {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  position: relative;
}

.markdown-editor-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 14px 18px 20px 18px;
  gap: 8px;
  height: 100%;
  box-sizing: border-box;
}

.editor-sub-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
}

.editor-hint {
  font-size: 11.5px;
  color: var(--md-sys-color-on-surface-variant, #49454f);
}

.char-count {
  font-size: 11.5px;
  color: var(--md-sys-color-on-surface-variant, #49454f);
  font-variant-numeric: tabular-nums;
}

.markdown-textarea {
  flex: 1;
  width: 100%;
  resize: none;
  border: 1px solid var(--md-sys-color-outline-variant, #cac4d0);
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

.markdown-textarea:focus {
  border-color: var(--md-sys-color-primary, #00639b);
  box-shadow: 0 0 0 2px var(--md-sys-color-primary-container, #cee5ff);
}

[data-theme="dark"] .markdown-textarea {
  background: var(--md-sys-color-surface-container, #1d2026) !important;
  border-color: var(--md-sys-color-outline-variant, #3a3d45) !important;
  color: var(--md-sys-color-on-surface, #e2e2e6) !important;
}

[data-theme="dark"] .markdown-textarea:focus {
  border-color: var(--md-sys-color-primary, #9ecaff) !important;
  box-shadow: 0 0 0 2px rgba(158, 202, 255, 0.25) !important;
}

/* Preview Wrapper */
.markdown-preview-wrapper {
  flex: 1;
  padding: 20px 24px 60px 24px;
  cursor: auto;
  user-select: text;
  min-height: 200px;
}

.markdown-rendered-content {
  font-size: 14px;
  line-height: 1.8;
  color: var(--md-sys-color-on-surface, #1d1b20);
}

[data-theme="dark"] .markdown-rendered-content {
  color: #e2e4ea;
}

:deep(.md-heading) {
  margin-top: 18px;
  margin-bottom: 8px;
  font-weight: 700;
  color: var(--md-sys-color-primary, #00639b);
}

[data-theme="dark"] :deep(.md-heading) {
  color: #9ecaff;
}

:deep(.md-h1) { font-size: 18px; }
:deep(.md-h2) { font-size: 16px; }
:deep(.md-h3) { font-size: 14.5px; }

:deep(.md-p) {
  margin-bottom: 10px;
}

:deep(.md-ul),
:deep(.md-ol) {
  padding-left: 22px;
  margin-bottom: 12px;
}

:deep(li) {
  margin-bottom: 5px;
}

:deep(.md-blockquote) {
  margin: 12px 0;
  padding: 8px 14px;
  border-left: 3px solid var(--md-sys-color-primary, #00639b);
  background: var(--md-sys-color-surface-container, #f2f4f7);
  border-radius: 0 8px 8px 0;
  color: var(--md-sys-color-on-surface-variant, #475467);
}

:deep(.md-divider) {
  border: none;
  border-top: 1px solid var(--md-sys-color-outline-variant, #e4e7ec);
  margin: 16px 0;
}

:deep(.katex-inline-wrapper) {
  display: inline-block;
  vertical-align: -0.1em;
  margin: 0 2px;
}

:deep(.katex-block-wrapper) {
  margin: 12px 0;
  overflow-x: auto;
  text-align: center;
  padding: 6px 0;
}

.markdown-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
  text-align: center;
  color: var(--md-sys-color-on-surface-variant, #64748b);
}

.empty-icon-sparkle {
  color: #4f46e5;
  margin-bottom: 12px;
  opacity: 0.8;
}

.empty-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface, #1d1b20);
  margin: 0 0 6px 0;
}

[data-theme="dark"] .empty-title {
  color: #f1f3f8;
}

.empty-desc {
  font-size: 12.5px;
  color: var(--md-sys-color-on-surface-variant, #64748b);
  margin: 0 0 16px 0;
  max-width: 320px;
}

.btn-start-input {
  height: 32px;
  padding: 0 16px;
  border-radius: 9999px;
  border: none;
  background: var(--md-sys-color-primary, #00639b);
  color: #ffffff;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-start-input:hover {
  filter: brightness(1.08);
}
</style>
