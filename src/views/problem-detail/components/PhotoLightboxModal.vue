<template>
  <div
    class="photo-lightbox-backdrop"
    @click.self="emit('close')"
    @wheel.prevent="onWheel"
  >
    <!-- Zoomable & Pannable Image Viewport -->
    <div
      ref="stageRef"
      class="lightbox-image-stage"
      :class="{ 'is-grabbing': isDragging }"
      @mousedown="startPan"
      @dblclick="handleDoubleClick"
      @touchstart.passive="onTouchStart"
      @touchmove.passive="onTouchMove"
      @touchend.passive="onTouchEnd"
    >
      <img
        :src="imageUrl"
        :alt="title || '大图预览'"
        class="lightbox-image"
        :class="{ 'is-interacting': isInteracting }"
        :style="{
          transform: `translate3d(${panX}px, ${panY}px, 0) scale(${zoomScale})`,
        }"
        draggable="false"
      />
    </div>

    <!-- Floating Bottom Control Capsule -->
    <div class="lightbox-control-capsule">
      <button
        type="button"
        class="capsule-tool-btn"
        title="缩小"
        :disabled="zoomScale <= 0.2"
        @click="zoomStep(-0.25)"
      >
        <Minus :size="15" />
      </button>

      <span
        class="zoom-display-text"
        title="重置"
        @click="resetZoom"
      >
        {{ Math.round(zoomScale * 100) }}%
      </span>

      <button
        type="button"
        class="capsule-tool-btn"
        title="放大"
        :disabled="zoomScale >= 8.0"
        @click="zoomStep(0.25)"
      >
        <Plus :size="15" />
      </button>

      <span class="capsule-divider"></span>

      <button
        type="button"
        class="capsule-tool-btn"
        title="还原"
        @click="resetZoom"
      >
        <RotateCcw :size="14" />
      </button>

      <span class="capsule-divider"></span>

      <button
        type="button"
        class="capsule-tool-btn btn-close"
        title="关闭"
        @click="emit('close')"
      >
        <X :size="16" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Minus, Plus, RotateCcw, X } from 'lucide-vue-next';

defineProps<{
  imageUrl: string;
  title?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const stageRef = ref<HTMLElement | null>(null);

const zoomScale = ref(1.0);
const panX = ref(0);
const panY = ref(0);

// Interaction state: when true, transition is disabled for 60fps jitter-free response
const isInteracting = ref(false);
const isDragging = ref(false);

let interactionEndTimer: ReturnType<typeof setTimeout> | null = null;

function markInteraction() {
  isInteracting.value = true;
  if (interactionEndTimer) clearTimeout(interactionEndTimer);
  interactionEndTimer = setTimeout(() => {
    isInteracting.value = false;
  }, 120);
}

// Zoom with smooth step (for capsule buttons)
function zoomStep(delta: number) {
  isInteracting.value = false; // Keep smooth transition for button clicks
  const next = Math.max(0.2, Math.min(8.0, zoomScale.value + delta));
  zoomScale.value = Math.round(next * 100) / 100;
}

// Reset zoom and pan
function resetZoom() {
  isInteracting.value = false; // Keep smooth transition for reset
  zoomScale.value = 1.0;
  panX.value = 0;
  panY.value = 0;
}

// Double click to zoom in or reset
function handleDoubleClick(e: MouseEvent) {
  isInteracting.value = false;
  if (zoomScale.value > 1.25) {
    resetZoom();
  } else {
    zoomScale.value = 2.5;
    if (stageRef.value) {
      const rect = stageRef.value.getBoundingClientRect();
      const offsetX = e.clientX - (rect.left + rect.width / 2);
      const offsetY = e.clientY - (rect.top + rect.height / 2);
      panX.value = -offsetX * 1.5;
      panY.value = -offsetY * 1.5;
    }
  }
}

// Wheel & Trackpad gesture handling
function onWheel(e: WheelEvent) {
  markInteraction();

  // Mac Trackpad Pinch-To-Zoom (e.ctrlKey === true)
  if (e.ctrlKey) {
    // Proportional, smooth zoom
    const zoomFactor = 1 - e.deltaY * 0.01;
    const prevScale = zoomScale.value;
    const nextScale = Math.max(0.2, Math.min(8.0, prevScale * zoomFactor));

    // Zoom centered around mouse cursor
    if (stageRef.value) {
      const rect = stageRef.value.getBoundingClientRect();
      const cursorX = e.clientX - (rect.left + rect.width / 2);
      const cursorY = e.clientY - (rect.top + rect.height / 2);
      const scaleRatio = nextScale / prevScale;
      panX.value = cursorX - (cursorX - panX.value) * scaleRatio;
      panY.value = cursorY - (cursorY - panY.value) * scaleRatio;
    }

    zoomScale.value = nextScale;
  } else if (Math.abs(e.deltaX) === 0 && Math.abs(e.deltaY) >= 80) {
    // Discrete mouse wheel click (traditional mouse wheel)
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    const nextScale = Math.max(0.2, Math.min(8.0, zoomScale.value * factor));
    zoomScale.value = Math.round(nextScale * 100) / 100;
  } else {
    // Mac Trackpad Two-Finger Pan or continuous wheel scroll
    panX.value -= e.deltaX;
    panY.value -= e.deltaY;
  }
}

// Mouse dragging (小手抓取平移)
function startPan(e: MouseEvent) {
  if (e.button !== 0) return; // Only primary mouse button
  isDragging.value = true;
  isInteracting.value = true;

  const startClientX = e.clientX;
  const startClientY = e.clientY;
  const startPanX = panX.value;
  const startPanY = panY.value;

  function onMouseMove(moveEvent: MouseEvent) {
    panX.value = startPanX + (moveEvent.clientX - startClientX);
    panY.value = startPanY + (moveEvent.clientY - startClientY);
  }

  function onMouseUp() {
    isDragging.value = false;
    isInteracting.value = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

// Touch support (Mobile / Trackpad touch events)
let initialTouchDist = 0;
let initialTouchScale = 1.0;
let touchStartPanX = 0;
let touchStartPanY = 0;
let touchStartX = 0;
let touchStartY = 0;

function onTouchStart(e: TouchEvent) {
  markInteraction();
  if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    initialTouchDist = Math.hypot(dx, dy);
    initialTouchScale = zoomScale.value;
  } else if (e.touches.length === 1) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartPanX = panX.value;
    touchStartPanY = panY.value;
  }
}

function onTouchMove(e: TouchEvent) {
  markInteraction();
  if (e.touches.length === 2 && initialTouchDist > 0) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const currentDist = Math.hypot(dx, dy);
    const factor = currentDist / initialTouchDist;
    zoomScale.value = Math.max(0.2, Math.min(8.0, initialTouchScale * factor));
  } else if (e.touches.length === 1) {
    panX.value = touchStartPanX + (e.touches[0].clientX - touchStartX);
    panY.value = touchStartPanY + (e.touches[0].clientY - touchStartY);
  }
}

function onTouchEnd() {
  initialTouchDist = 0;
  isInteracting.value = false;
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close');
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  if (interactionEndTimer) clearTimeout(interactionEndTimer);
});
</script>

<style scoped>
.photo-lightbox-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  user-select: none;
  touch-action: none;
}

.lightbox-image-stage {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  position: relative;
  overflow: hidden;
}

.lightbox-image-stage.is-grabbing {
  cursor: grabbing;
}

.lightbox-image {
  max-width: 90vw;
  max-height: 85vh;
  object-fit: contain;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
  border-radius: 6px;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
  will-change: transform;
  transform-origin: center center;
  /* Smooth transition for discrete button clicks and double-clicks */
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

/* While actively dragging or gesturing, disable transition to ensure instant 60/120fps response */
.lightbox-image.is-interacting {
  transition: none !important;
}

/* Floating Bottom Control Capsule */
.lightbox-control-capsule {
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  height: 38px;
  background: rgba(30, 34, 42, 0.9);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 9999px;
  padding: 0 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 100;
  user-select: none;
}

.capsule-tool-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: #e2e8f0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.capsule-tool-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
}

.capsule-tool-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.capsule-tool-btn.btn-close:hover {
  background: #ef4444;
  color: #ffffff;
}

.zoom-display-text {
  font-size: 12px;
  font-weight: 600;
  color: #e2e8f0;
  min-width: 44px;
  text-align: center;
  cursor: pointer;
  font-variant-numeric: tabular-nums;
  padding: 2px 4px;
  border-radius: 4px;
  transition: background 0.15s ease;
}

.zoom-display-text:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.capsule-divider {
  width: 1px;
  height: 16px;
  background: rgba(255, 255, 255, 0.2);
  margin: 0 2px;
}
</style>
