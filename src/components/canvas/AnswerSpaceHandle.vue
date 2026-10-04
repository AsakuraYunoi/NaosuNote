<template>
  <div
    class="m3-answer-space-handle-container no-print"
    :class="{ 'is-dragging': isDragging, 'is-flush-bottom': isSnappedToBottom }"
    :style="{ height: `${currentHeight}px` }"
  >
    <!-- Visual Gap Guide Fill (拖拽出的空白作答区域) -->
    <div class="space-placeholder-fill">
      <div v-if="currentHeight >= 32" class="lined-paper-preview"></div>
    </div>

    <!-- Interactive Drag Handle Bar (底缘可拖动手柄) -->
    <div
      class="drag-bar-trigger"
      title="上下拖动调整本题作答留白空间 (自动吸附信笺行与页底)"
      @mousedown.stop.prevent="startDrag"
    >
      <div class="drag-capsule-badge">
        <ArrowUpDown :size="11" />
        <span v-if="isSnappedToBottom" class="badge-label highlight">贴合页底</span>
        <span v-else class="badge-label">作答留白: {{ Math.round(currentHeight) }}px</span>
      </div>
      <div class="handle-line"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ArrowUpDown } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    space?: number; // 当前留白高度 px
    remainingPageHeight?: number; // 本页剩余可用空隙高度 px
    lineModulus?: number; // 信笺行模数，默认 24px
    minSpace?: number; // 最小留白 px，默认 12px
    maxSpace?: number; // 最大留白 px，默认 600px
  }>(),
  {
    space: 26,
    remainingPageHeight: 200,
    lineModulus: 24,
    minSpace: 12,
    maxSpace: 600,
  }
);

const emit = defineEmits<{
  (e: 'update:space', val: number): void;
  (e: 'dragEnd', val: number): void;
  (e: 'reset'): void;
}>();

const isDragging = ref(false);
const currentHeight = ref(props.space || 26);
let startMouseY = 0;
let startHeight = 0;

watch(
  () => props.space,
  (val) => {
    if (!isDragging.value && typeof val === 'number') {
      currentHeight.value = val;
    }
  }
);

const isSnappedToBottom = computed(() => {
  if (typeof props.remainingPageHeight !== 'number') return false;
  return Math.abs(currentHeight.value - props.remainingPageHeight) <= 3;
});

function startDrag(e: MouseEvent) {
  isDragging.value = true;
  startMouseY = e.clientY;
  startHeight = currentHeight.value;

  window.addEventListener('mousemove', onDragging);
  window.addEventListener('mouseup', endDrag);
}

function onDragging(e: MouseEvent) {
  if (!isDragging.value) return;

  const dy = e.clientY - startMouseY;
  const rawTargetH = Math.min(props.maxSpace, Math.max(props.minSpace, startHeight + dy));

  const L = props.lineModulus;
  const bottomThreshold = 20; // 20px 内触发页底贴合强磁吸

  // 1. 优先判定是否接近页底剩余空间
  if (
    typeof props.remainingPageHeight === 'number' &&
    props.remainingPageHeight > props.minSpace &&
    Math.abs(rawTargetH - props.remainingPageHeight) <= bottomThreshold
  ) {
    currentHeight.value = props.remainingPageHeight;
  } else {
    // 2. 否则吸附至信笺行模数刻度
    const snapped = Math.round(rawTargetH / L) * L;
    currentHeight.value = Math.max(props.minSpace, snapped);
  }

  emit('update:space', currentHeight.value);
}

function endDrag() {
  if (!isDragging.value) return;
  isDragging.value = false;
  window.removeEventListener('mousemove', onDragging);
  window.removeEventListener('mouseup', endDrag);
  emit('dragEnd', currentHeight.value);
}
</script>

<style scoped>
.m3-answer-space-handle-container {
  position: relative;
  width: 100%;
  margin: 0;
  box-sizing: border-box;
  transition: height 0.05s ease-out;
}

.space-placeholder-fill {
  width: 100%;
  height: 100%;
  position: relative;
  background: transparent;
  transition: background-color 0.15s ease;
}

.m3-answer-space-handle-container:hover .space-placeholder-fill,
.m3-answer-space-handle-container.is-dragging .space-placeholder-fill {
  background: rgba(0, 90, 193, 0.025);
}

/* Faint Lined Paper guide */
.lined-paper-preview {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(
    to bottom,
    transparent 23px,
    var(--md-sys-color-outline-variant, #e5e8ed) 24px
  );
  background-size: 100% 24px;
  opacity: 0.35;
  pointer-events: none;
}

/* Drag Bar Trigger */
.drag-bar-trigger {
  position: absolute;
  bottom: -4px;
  left: 0;
  width: 100%;
  height: 12px;
  cursor: row-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.handle-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 1.5px;
  background: transparent;
  transition: background-color 0.12s ease;
}

.m3-answer-space-handle-container:hover .handle-line,
.m3-answer-space-handle-container.is-dragging .handle-line {
  background: var(--md-sys-color-primary, #005ac1);
}

.drag-capsule-badge {
  position: relative;
  z-index: 2;
  background: var(--md-sys-color-surface, #ffffff);
  border: 1px solid var(--md-sys-color-outline-variant, #c2c7cf);
  color: var(--md-sys-color-on-surface-variant, #44474e);
  font-size: 10px;
  font-weight: 500;
  padding: 1px 8px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  opacity: 0;
  transform: scale(0.92);
  transition: all 0.12s ease;
  user-select: none;
}

.m3-answer-space-handle-container:hover .drag-capsule-badge,
.m3-answer-space-handle-container.is-dragging .drag-capsule-badge {
  opacity: 1;
  transform: scale(1);
  border-color: var(--md-sys-color-primary, #005ac1);
  color: var(--md-sys-color-primary, #005ac1);
}

.badge-label.highlight {
  color: #0b57d0;
  font-weight: bold;
}

[data-theme="dark"] .drag-capsule-badge,
.dark .drag-capsule-badge {
  background: rgba(39, 42, 49, 0.95) !important;
  border-color: #44474e !important;
  color: #e2e2e6 !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35) !important;
}

[data-theme="dark"] .m3-answer-space-handle-container:hover .drag-capsule-badge,
.dark .m3-answer-space-handle-container:hover .drag-capsule-badge,
[data-theme="dark"] .m3-answer-space-handle-container.is-dragging .drag-capsule-badge,
.dark .m3-answer-space-handle-container.is-dragging .drag-capsule-badge {
  border-color: var(--md-sys-color-primary, #a8c7fa) !important;
  color: var(--md-sys-color-primary, #a8c7fa) !important;
}

[data-theme="dark"] .badge-label.highlight,
.dark .badge-label.highlight {
  color: #a8c7fa !important;
}
</style>
