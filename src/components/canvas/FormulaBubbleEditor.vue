<template>
  <div
    class="m3-formula-bubble"
    :style="bubbleStyle"
    @click.stop
    @mousedown.stop
  >
    <!-- Header: Live Rendered Preview -->
    <div class="bubble-preview-area">
      <span class="preview-label">实时预览</span>
      <div class="katex-preview-render" v-html="renderedPreview"></div>
    </div>

    <!-- Quick Math Insert Palette -->
    <div class="quick-symbols-bar">
      <button
        v-for="sym in symbols"
        :key="sym.label"
        type="button"
        class="symbol-btn"
        :title="sym.title"
        @click="insertSymbol(sym.snippet)"
      >
        {{ sym.label }}
      </button>
    </div>

    <!-- LaTeX Input Area -->
    <div class="input-wrapper">
      <input
        ref="inputRef"
        v-model="latexInput"
        type="text"
        class="latex-input"
        placeholder="输入 LaTeX 源码，如：f'(x) = 3x^2"
        @keydown.enter.prevent="handleConfirm"
        @keydown.esc.prevent="$emit('close')"
      />
    </div>

    <!-- Footer Actions -->
    <div class="bubble-actions">
      <button type="button" class="btn-bubble-del" @click="$emit('delete')">
        删除公式
      </button>
      <div class="action-right">
        <button type="button" class="btn-bubble-cancel" @click="$emit('close')">
          取消
        </button>
        <button type="button" class="btn-bubble-confirm" @click="handleConfirm">
          应用更改
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import katex from 'katex';

const props = withDefaults(
  defineProps<{
    initialLatex?: string;
    isBlock?: boolean;
    position?: { top: number; left: number };
  }>(),
  {
    initialLatex: '',
    isBlock: false,
    position: () => ({ top: 100, left: 100 }),
  }
);

const emit = defineEmits<{
  (e: 'confirm', newLatex: string): void;
  (e: 'delete'): void;
  (e: 'close'): void;
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const latexInput = ref(props.initialLatex || '');

const bubbleStyle = computed(() => {
  return {
    top: `${props.position.top}px`,
    left: `${Math.max(16, props.position.left)}px`,
  };
});

const renderedPreview = computed(() => {
  if (!latexInput.value.trim()) {
    return '<span style="color: #999; font-style: italic;">(空公式)</span>';
  }
  try {
    return katex.renderToString(latexInput.value, {
      displayMode: props.isBlock,
      throwOnError: false,
    });
  } catch (err) {
    return `<span style="color: #b3261e;">公式语法错误</span>`;
  }
});

const symbols = [
  { label: 'x²', snippet: '^{2}', title: '平方上标' },
  { label: 'x₁', snippet: '_{1}', title: '下标' },
  { label: 'a/b', snippet: '\\frac{a}{b}', title: '分式' },
  { label: '√x', snippet: '\\sqrt{x}', title: '根号' },
  { label: 'α', snippet: '\\alpha', title: 'alpha' },
  { label: 'β', snippet: '\\beta', title: 'beta' },
  { label: 'θ', snippet: '\\theta', title: 'theta' },
  { label: 'λ', snippet: '\\lambda', title: 'lambda' },
  { label: 'Δ', snippet: '\\Delta', title: 'Delta' },
  { label: 'π', snippet: '\\pi', title: 'pi' },
  { label: '≈', snippet: '\\approx', title: '约等于' },
  { label: '≤', snippet: '\\le', title: '小于等于' },
  { label: '≥', snippet: '\\ge', title: '大于等于' },
  { label: '·', snippet: '\\cdot', title: '点乘' },
  { label: '×', snippet: '\\times', title: '叉乘' },
  { label: 'v⃗', snippet: '\\vec{v}', title: '矢量' },
];

function insertSymbol(snippet: string) {
  if (!inputRef.value) return;
  const el = inputRef.value;
  const start = el.selectionStart || 0;
  const end = el.selectionEnd || 0;
  const text = latexInput.value;
  latexInput.value = text.slice(0, start) + snippet + text.slice(end);
  nextTick(() => {
    el.focus();
    el.setSelectionRange(start + snippet.length, start + snippet.length);
  });
}

function handleConfirm() {
  emit('confirm', latexInput.value.trim());
}

onMounted(() => {
  nextTick(() => {
    inputRef.value?.focus();
    inputRef.value?.select();
  });
});
</script>

<style scoped>
.m3-formula-bubble {
  position: absolute;
  z-index: 999;
  width: 360px;
  background: var(--md-sys-color-surface-container-high, #ffffff);
  border: 1px solid var(--md-sys-color-outline-variant, #c2c7cf);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.08);
  padding: 12px 14px;
  box-sizing: border-box;
  animation: bubblePop 0.14s ease-out;
}

@keyframes bubblePop {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.bubble-preview-area {
  background: var(--md-sys-color-surface-container, #f4f5f8);
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 8px;
  min-height: 38px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.preview-label {
  font-size: 10px;
  color: var(--md-sys-color-on-surface-variant, #74777f);
  margin-bottom: 2px;
}

.katex-preview-render {
  font-size: 15px;
  color: var(--md-sys-color-on-surface, #1d1b20);
  overflow-x: auto;
}

.quick-symbols-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.symbol-btn {
  background: var(--md-sys-color-surface-container-low, #f0f2f5);
  border: 1px solid var(--md-sys-color-outline-variant, #e0e3e8);
  color: var(--md-sys-color-on-surface, #1d1b20);
  padding: 3px 6px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.12s ease;
}

.symbol-btn:hover {
  background: var(--md-sys-color-secondary-container, #dbe4f9);
  color: var(--md-sys-color-on-secondary-container, #131c2b);
}

.input-wrapper {
  margin-bottom: 10px;
}

.latex-input {
  width: 100%;
  padding: 8px 10px;
  border: 1.5px solid var(--md-sys-color-outline, #74777f);
  border-radius: 8px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 13px;
  box-sizing: border-box;
  background: var(--md-sys-color-surface-container, #ffffff);
  color: var(--md-sys-color-on-surface, #1d1b20);
  outline: none;
}

.latex-input:focus {
  border-color: var(--md-sys-color-primary, #005ac1);
  box-shadow: 0 0 0 2px rgba(0, 90, 193, 0.2);
}

.bubble-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-bubble-del {
  background: transparent;
  border: none;
  color: var(--md-sys-color-error, #ba1a1a);
  font-size: 12px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
}

.btn-bubble-del:hover {
  background: rgba(186, 26, 26, 0.08);
}

.action-right {
  display: flex;
  gap: 6px;
}

.btn-bubble-cancel {
  background: transparent;
  border: 1px solid var(--md-sys-color-outline-variant, #c2c7cf);
  color: var(--md-sys-color-on-surface-variant, #44474e);
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}

.btn-bubble-confirm {
  background: var(--md-sys-color-primary, #005ac1);
  border: none;
  color: #ffffff;
  padding: 5px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.btn-bubble-confirm:hover {
  background: #004ba3;
}
</style>
