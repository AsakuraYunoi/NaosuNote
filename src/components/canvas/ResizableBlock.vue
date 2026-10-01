<template>
  <div
    ref="containerRef"
    class="m3-resizable-block"
    :class="{ 'is-resizing': isResizing, 'is-active': active }"
    :style="containerStyle"
    @click.stop="$emit('select')"
  >
    <!-- Content Slot -->
    <div class="block-content">
      <slot></slot>
    </div>

    <!-- M3 Floating Dimension Badge (正在缩放时显示规格胶囊) -->
    <div v-if="isResizing" class="dimension-badge">
      <span class="badge-text">{{ displayWidth }} × {{ displayHeight }} px</span>
      <span v-if="columnRatioText" class="badge-ratio">{{ columnRatioText }}</span>
    </div>

    <!-- Resize Handles (右下角主手柄, 右边缘手柄) -->
    <div
      class="resize-handle corner-br"
      title="按住拖拽以调整尺寸 (保持比例 & 阻力吸附)"
      @mousedown.stop.prevent="startResize($event, 'corner')"
    >
      <div class="handle-dot"></div>
    </div>

    <div
      class="resize-handle edge-r"
      title="水平调整尺寸 (阻力吸附)"
      @mousedown.stop.prevent="startResize($event, 'edge-r')"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

const props = withDefaults(
  defineProps<{
    width?: number; // 名义宽度 px
    height?: number; // 名义高度 px
    aspectRatio?: number; // 默认锁定原始比例 W / H
    gridStep?: number; // 网格模数，默认 16px
    resistanceThreshold?: number; // 阻力死区阈值，默认 12px
    artboardWidth?: number; // 标称版心总宽，默认 640px
    active?: boolean;
  }>(),
  {
    width: 320,
    gridStep: 16,
    resistanceThreshold: 12,
    artboardWidth: 640,
    active: false,
  }
);

const emit = defineEmits<{
  (e: 'update:width', val: number): void;
  (e: 'update:height', val: number): void;
  (e: 'select'): void;
  (e: 'resizeEnd', w: number, h: number): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const isResizing = ref(false);
const currentWidth = ref(props.width || 320);
const currentHeight = ref(props.height || (props.aspectRatio ? Math.round(320 / props.aspectRatio) : 200));

let startX = 0;
let startY = 0;
let startW = 0;
let startH = 0;
let ratio = props.aspectRatio || 1.333;
let resizeMode: 'corner' | 'edge-r' = 'corner';

const containerStyle = computed(() => {
  return {
    maxWidth: `${currentWidth.value}px`,
    width: '100%',
  };
});

const displayWidth = computed(() => Math.round(currentWidth.value));
const displayHeight = computed(() => Math.round(currentHeight.value));

const columnRatioText = computed(() => {
  const percent = Math.round((currentWidth.value / props.artboardWidth) * 100);
  if (percent >= 90) return '100% 栏宽';
  if (percent >= 60 && percent <= 72) return '66% 栏宽';
  if (percent >= 45 && percent <= 55) return '50% 栏宽';
  if (percent >= 28 && percent <= 38) return '33% 栏宽';
  if (percent <= 28) return '25% 栏宽';
  return `${percent}% 栏宽`;
});

function startResize(e: MouseEvent, mode: 'corner' | 'edge-r') {
  isResizing.value = true;
  resizeMode = mode;
  startX = e.clientX;
  startY = e.clientY;
  startW = currentWidth.value;
  startH = currentHeight.value;

  if (props.aspectRatio) {
    ratio = props.aspectRatio;
  } else if (startH > 0) {
    ratio = startW / startH;
  }

  window.addEventListener('mousemove', onResizing);
  window.addEventListener('mouseup', endResize);
}

function onResizing(e: MouseEvent) {
  if (!isResizing.value) return;

  const dx = e.clientX - startX;
  const G = props.gridStep;
  const T = props.resistanceThreshold;

  // 1. 有阻力吸附计算 (Deadzone Hysteresis)
  const absDx = Math.abs(dx);
  const stepCount = Math.floor(absDx / G);
  const remainder = absDx - stepCount * G;

  let effectiveDx = 0;
  if (remainder < T) {
    // 处于阻力死区，保持当前步长
    effectiveDx = Math.sign(dx) * (stepCount * G);
  } else {
    // 突破阈值，弹跳到下一刻度
    effectiveDx = Math.sign(dx) * ((stepCount + 1) * G);
  }

  // 2. 计算目标宽度（最小 120px，最大版心总宽）
  const minW = 120;
  const maxW = props.artboardWidth;
  const rawTargetW = Math.min(maxW, Math.max(minW, startW + effectiveDx));

  currentWidth.value = rawTargetW;
  emit('update:width', currentWidth.value);

  // 3. 严格等比锁定高度
  if (ratio > 0) {
    currentHeight.value = Math.round(rawTargetW / ratio);
    emit('update:height', currentHeight.value);
  }
}

function endResize() {
  if (!isResizing.value) return;
  isResizing.value = false;
  window.removeEventListener('mousemove', onResizing);
  window.removeEventListener('mouseup', endResize);
  emit('resizeEnd', currentWidth.value, currentHeight.value);
}

onMounted(() => {
  if (props.width) currentWidth.value = props.width;
  if (props.height) currentHeight.value = props.height;
});
</script>

<style scoped>
.m3-resizable-block {
  position: relative;
  display: inline-block;
  box-sizing: border-box;
  margin: 8px 0;
  border: 1.5px solid transparent;
  border-radius: 8px;
  transition: border-color 0.15s ease;
}

.m3-resizable-block:hover,
.m3-resizable-block.is-active,
.m3-resizable-block.is-resizing {
  border-color: var(--md-sys-color-primary, #005ac1);
}

.block-content {
  width: 100%;
  display: flex;
  justify-content: center;
}

.block-content :deep(svg) {
  max-width: 100%;
  height: auto;
  display: block;
}

.block-content :deep(table) {
  width: 100%;
}

/* Floating Dimension Badge */
.dimension-badge {
  position: absolute;
  top: -32px;
  right: 0;
  background: var(--md-sys-color-inverse-surface, #2f3033);
  color: var(--md-sys-color-inverse-on-surface, #f1f0f4);
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  pointer-events: none;
  z-index: 10;
  animation: fadeIn 0.12s ease-out;
}

.badge-ratio {
  opacity: 0.8;
  border-left: 1px solid rgba(255, 255, 255, 0.3);
  padding-left: 6px;
}

/* Resize Handles */
.resize-handle {
  position: absolute;
  z-index: 5;
  user-select: none;
}

.resize-handle.corner-br {
  right: -6px;
  bottom: -6px;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  display: flex;
  align-items: center;
  justify-content: center;
}

.handle-dot {
  width: 10px;
  height: 10px;
  background: var(--md-sys-color-primary, #005ac1);
  border: 2px solid #ffffff;
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  transition: transform 0.15s ease;
}

.resize-handle.corner-br:hover .handle-dot {
  transform: scale(1.25);
}

.resize-handle.edge-r {
  right: -4px;
  top: 15%;
  width: 8px;
  height: 70%;
  cursor: ew-resize;
  opacity: 0;
}

.m3-resizable-block:hover .resize-handle.edge-r {
  opacity: 1;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
