<template>
  <div
    ref="viewportRef"
    class="m3-grid-viewport"
    :class="{ 'is-panning': isPanning, 'has-grid': showGrid }"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseUp"
  >
    <!-- Background Dot Matrix -->
    <div
      v-if="showGrid"
      class="grid-dot-matrix"
      :style="dotMatrixStyle"
    ></div>

    <!-- Scaled & Translated Canvas Content Wrapper -->
    <div
      class="canvas-transform-wrapper"
      :style="transformStyle"
    >
      <!-- Virtual Artboard (模拟试卷真实版心纸面) -->
      <div class="virtual-artboard">
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

const props = withDefaults(
  defineProps<{
    zoom?: number; // 50 ~ 200
    showGrid?: boolean;
  }>(),
  {
    zoom: 100,
    showGrid: true,
  }
);

const emit = defineEmits<{
  (e: 'update:zoom', val: number): void;
}>();

const viewportRef = ref<HTMLElement | null>(null);

// Pan state
const panX = ref(0);
const panY = ref(0);
const isPanning = ref(false);
const isSpacePressed = ref(false);
let startMouseX = 0;
let startMouseY = 0;
let startPanX = 0;
let startPanY = 0;

const transformStyle = computed(() => {
  const scale = (props.zoom || 100) / 100;
  return {
    transform: `translate(${panX.value}px, ${panY.value}px) scale(${scale})`,
    transformOrigin: 'top center',
  };
});

const dotMatrixStyle = computed(() => {
  const scale = (props.zoom || 100) / 100;
  const step = 20 * scale;
  return {
    backgroundSize: `${step}px ${step}px`,
    backgroundPosition: `${panX.value}px ${panY.value}px`,
  };
});

function handleMouseDown(e: MouseEvent) {
  // 中键拖拽，或空格键按下时的左键拖拽
  if (e.button === 1 || (e.button === 0 && isSpacePressed.value)) {
    e.preventDefault();
    isPanning.value = true;
    startMouseX = e.clientX;
    startMouseY = e.clientY;
    startPanX = panX.value;
    startPanY = panY.value;
  }
}

function handleMouseMove(e: MouseEvent) {
  if (!isPanning.value) return;
  e.preventDefault();
  panX.value = startPanX + (e.clientX - startMouseX);
  panY.value = startPanY + (e.clientY - startMouseY);
}

function handleMouseUp() {
  isPanning.value = false;
}

function handleWheel(e: WheelEvent) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    const nextZoom = Math.min(200, Math.max(50, Math.round((props.zoom || 100) * factor)));
    emit('update:zoom', nextZoom);
  }
}

function handleKeyDown(e: KeyboardEvent) {
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable') === 'true')) {
    return;
  }
  if (e.code === 'Space' && !e.repeat) {
    isSpacePressed.value = true;
  }
}

function handleKeyUp(e: KeyboardEvent) {
  if (e.code === 'Space') {
    isSpacePressed.value = false;
    isPanning.value = false;
  }
}

function resetView() {
  panX.value = 0;
  panY.value = 0;
  emit('update:zoom', 100);
}


defineExpose({
  resetView,
});

onMounted(() => {
  const el = viewportRef.value;
  if (el) {
    el.addEventListener('wheel', handleWheel, { passive: false });
  }
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
});

onUnmounted(() => {
  const el = viewportRef.value;
  if (el) {
    el.removeEventListener('wheel', handleWheel);
  }
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
});
</script>

<style scoped>
.m3-grid-viewport {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: var(--md-sys-color-surface-container-low, #f2f4f7);
  cursor: default;
  user-select: none;
  display: flex;
  justify-content: center;
}

.m3-grid-viewport.is-panning {
  cursor: grab;
}

.grid-dot-matrix {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: radial-gradient(var(--md-sys-color-outline-variant, #c2c7cf) 1.2px, transparent 1.2px);
  opacity: 0.7;
}

.canvas-transform-wrapper {
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 48px 0 120px 0;
  transition: transform 0.05s ease-out;
}

.virtual-artboard {
  width: 720px;
  min-height: 480px;
  background: var(--md-sys-color-surface, #ffffff);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--md-sys-color-outline-variant, #e0e3e8);
  padding: 36px 40px;
  box-sizing: border-box;
  user-select: text;
}
</style>
