<template>
  <div
    class="answer-photo-pane"
    @dragover.prevent="isDragging = true"
    @dragleave.prevent="isDragging = false"
    @drop.prevent="handleDrop"
  >
    <!-- Hidden file input for uploading -->
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      class="hidden-file-input"
      @change="onFileInputChange"
    />

    <!-- Main Photo Display Area -->
    <div v-if="images.length > 0" class="photo-viewer-container">
      <div
        class="photo-canvas-area"
        @wheel="handleWheelSwipe"
        @touchstart="handleTouchStart"
        @touchend="handleTouchEnd"
      >
        <!-- Click Zone: Left 25% (Previous) -->
        <div
          v-if="currentIndex > 0"
          class="nav-edge-zone edge-zone-left"
          title="上一张"
          @click.stop="prevPhoto"
        ></div>

        <!-- Center Image Display (Borderless, Clickable to open Lightbox) -->
        <div class="photo-borderless-wrapper" @click="openLightbox">
          <img
            v-if="currentImageUrl"
            :src="currentImageUrl"
            :alt="`答案图片 P${currentIndex + 1}`"
            class="main-answer-photo"
          />
          <div v-else class="photo-loading-spinner">
            <Loader2 :size="24" class="spin-icon" />
            <span>加载中...</span>
          </div>
        </div>

        <!-- Click Zone: Right 25% (Next) -->
        <div
          v-if="currentIndex < images.length - 1"
          class="nav-edge-zone edge-zone-right"
          title="下一张"
          @click.stop="nextPhoto"
        ></div>
      </div>

      <!-- Bottom Center: Minimalist Carousel Indicator (Pure Dots) -->
      <div v-if="images.length > 1" class="minimal-dots-capsule">
        <span
          v-for="(_, idx) in images"
          :key="idx"
          class="indicator-dot"
          :class="{ active: idx === currentIndex }"
          :title="`P${idx + 1}`"
          @click.stop="emit('selectPhoto', idx)"
        ></span>
      </div>

      <!-- Bottom Right: Floating Action Cluster -->
      <div class="floating-action-cluster">
        <!-- Main FAB: Upload Add Button -->
        <button
          type="button"
          class="fab-add-photo-btn"
          title="添加图片"
          @click="triggerFileInput"
        >
          <Plus :size="22" />
        </button>

        <!-- Vertical Capsule Toolbar -->
        <div class="vertical-tool-capsule">
          <!-- Download Photo -->
          <button
            type="button"
            class="capsule-icon-btn"
            title="下载图片"
            @click="emit('download', currentIndex)"
          >
            <Download :size="16" />
          </button>

          <!-- More Options / Reorder Drawer Button -->
          <button
            type="button"
            class="capsule-icon-btn"
            title="排序"
            @click="isReorderDrawerOpen = true"
          >
            <MoreHorizontal :size="16" />
          </button>

          <!-- Bin Red Action Button -->
          <button
            type="button"
            class="capsule-icon-btn btn-bin-red"
            title="删除"
            @click="emit('delete', currentIndex)"
          >
            <Trash2 :size="15" />
          </button>
        </div>
      </div>

      <!-- Reorder Drawer Popup (Anchored at Bottom-Right) -->
      <PhotoReorderDrawer
        v-model:visible="isReorderDrawerOpen"
        :images="images"
        :image-url-map="imageUrlMap"
        :current-index="currentIndex"
        @reorder="emit('reorder', $event)"
        @select="emit('selectPhoto', $event)"
        @delete="emit('delete', $event)"
      />

      <!-- Photo Lightbox Modal (Click to open full zoom/pan) -->
      <PhotoLightboxModal
        v-if="isLightboxOpen && currentImageUrl"
        :image-url="currentImageUrl"
        :image-alt="`答案图片 P${currentIndex + 1}`"
        @close="isLightboxOpen = false"
      />
    </div>

    <!-- Empty State / Dropzone -->
    <div v-else class="photo-empty-dropzone" :class="{ 'is-drag-over': isDragging }">
      <div class="dropzone-content" @click="triggerFileInput">
        <div class="dropzone-icon-ring">
          <UploadCloud :size="32" />
        </div>
        <h4 class="dropzone-title">添加解答图片</h4>
        <p class="dropzone-desc">
          支持粘贴截图 (Ctrl+V) 或拖拽图片至此
        </p>
        <button type="button" class="btn-select-file">
          <Plus :size="15" />
          <span>选择图片</span>
        </button>
      </div>
    </div>

    <!-- Dragging Overlay Indicator -->
    <div v-if="isDragging" class="drag-active-overlay">
      <UploadCloud :size="44" />
      <span>松开添加图片</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Plus,
  Download,
  MoreHorizontal,
  Trash2,
  UploadCloud,
  Loader2,
} from 'lucide-vue-next';
import PhotoReorderDrawer from './PhotoReorderDrawer.vue';
import PhotoLightboxModal from './PhotoLightboxModal.vue';

const props = defineProps<{
  images: string[];
  currentIndex: number;
  imageUrlMap: Record<string, string>;
}>();

const emit = defineEmits<{
  (e: 'upload', file: Blob): void;
  (e: 'delete', index: number): void;
  (e: 'download', index: number): void;
  (e: 'reorder', newImages: string[]): void;
  (e: 'selectPhoto', index: number): void;
}>();

const isDragging = ref(false);
const isReorderDrawerOpen = ref(false);
const isLightboxOpen = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

const currentImageUrl = computed(() => {
  const filename = props.images[props.currentIndex];
  if (!filename) return '';
  return props.imageUrlMap[filename] || '';
});

function prevPhoto() {
  if (props.currentIndex > 0) {
    emit('selectPhoto', props.currentIndex - 1);
  }
}

function nextPhoto() {
  if (props.currentIndex < props.images.length - 1) {
    emit('selectPhoto', props.currentIndex + 1);
  }
}

function openLightbox() {
  if (currentImageUrl.value) {
    isLightboxOpen.value = true;
  }
}

// Trackpad horizontal swipe logic
let lastWheelSwipeTime = 0;
function handleWheelSwipe(e: WheelEvent) {
  const now = Date.now();
  if (now - lastWheelSwipeTime < 350) return;

  if (Math.abs(e.deltaX) > 35 && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
    if (e.deltaX > 35) {
      nextPhoto();
      lastWheelSwipeTime = now;
    } else if (e.deltaX < -35) {
      prevPhoto();
      lastWheelSwipeTime = now;
    }
  }
}

// Touch swipe logic
let touchStartX = 0;
let touchStartY = 0;
function handleTouchStart(e: TouchEvent) {
  if (e.touches && e.touches[0]) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }
}

function handleTouchEnd(e: TouchEvent) {
  if (e.changedTouches && e.changedTouches[0]) {
    const diffX = e.changedTouches[0].clientX - touchStartX;
    const diffY = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX < 0) {
        nextPhoto();
      } else {
        prevPhoto();
      }
    }
  }
}

function triggerFileInput() {
  fileInputRef.value?.click();
}

function onFileInputChange(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    for (let i = 0; i < target.files.length; i++) {
      emit('upload', target.files[i]);
    }
    target.value = '';
  }
}

function handleDrop(e: DragEvent) {
  isDragging.value = false;
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      const file = e.dataTransfer.files[i];
      if (file.type.startsWith('image/')) {
        emit('upload', file);
      }
    }
  }
}
</script>

<style scoped>
.answer-photo-pane {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.hidden-file-input {
  display: none;
}

.photo-viewer-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

/* Photo Canvas Area with Edge Detection */
.photo-canvas-area {
  flex: 1;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  padding: 16px 20px 70px 20px;
  box-sizing: border-box;
}

/* Edge Click Zones (Left / Right 25%) */
.nav-edge-zone {
  position: absolute;
  top: 0;
  bottom: 70px;
  width: 25%;
  z-index: 10;
  cursor: pointer;
  transition: background 0.15s ease;
}

.edge-zone-left {
  left: 0;
}

.edge-zone-right {
  right: 0;
}

.nav-edge-zone:hover {
  background: rgba(0, 0, 0, 0.015);
}

[data-theme="dark"] .nav-edge-zone:hover {
  background: rgba(255, 255, 255, 0.02);
}

/* Borderless Photo Display */
.photo-borderless-wrapper {
  max-width: 100%;
  max-height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: zoom-in;
  z-index: 5;
  transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.photo-borderless-wrapper:hover {
  transform: scale(1.005);
}

.main-answer-photo {
  max-width: 100%;
  max-height: calc(100vh - 200px);
  object-fit: contain;
  border-radius: 8px;
  user-select: none;
  -webkit-user-drag: none;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

[data-theme="dark"] .main-answer-photo {
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.45);
}

.photo-loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--md-sys-color-on-surface-variant, #64748b);
  font-size: 13px;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Minimalist Dots Capsule */
.minimal-dots-capsule {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 9999px;
  z-index: 20;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.indicator-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.indicator-dot:hover {
  background: rgba(255, 255, 255, 0.75);
  transform: scale(1.2);
}

.indicator-dot.active {
  width: 16px;
  border-radius: 9999px;
  background: #ffffff;
}

/* Floating Action Cluster */
.floating-action-cluster {
  position: absolute;
  right: 18px;
  bottom: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  z-index: 25;
}

.fab-add-photo-btn {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: none;
  background: #4f46e5;
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.fab-add-photo-btn:hover {
  transform: translateY(-2px);
  filter: brightness(1.1);
  box-shadow: 0 6px 16px rgba(79, 70, 229, 0.45);
}

.fab-add-photo-btn:active {
  transform: translateY(0);
}

/* Vertical Tool Capsule */
.vertical-tool-capsule {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px;
  background: var(--md-sys-color-surface, #ffffff);
  border: 1px solid var(--md-sys-color-outline-variant, #e0e2ec);
  border-radius: 20px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
  gap: 2px;
}

[data-theme="dark"] .vertical-tool-capsule {
  background: var(--md-sys-color-surface-container, #1e2128) !important;
  border-color: var(--md-sys-color-outline-variant, #363b46) !important;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
}

.capsule-icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--md-sys-color-on-surface-variant, #49454f);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.capsule-icon-btn:hover {
  background: var(--md-sys-color-surface-container-high, #f1f3f7);
  color: var(--md-sys-color-on-surface, #1d1b20);
}

[data-theme="dark"] .capsule-icon-btn {
  color: #c3c7cf;
}

[data-theme="dark"] .capsule-icon-btn:hover {
  background: #2c313d;
  color: #ffffff;
}

.capsule-icon-btn.btn-bin-red:hover {
  background: #fee2e2;
  color: #dc2626;
}

[data-theme="dark"] .capsule-icon-btn.btn-bin-red:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

/* Empty Dropzone State */
.photo-empty-dropzone {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px;
  box-sizing: border-box;
}

.dropzone-content {
  max-width: 340px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 32px 24px;
  border: 2px dashed var(--md-sys-color-outline-variant, #d0d5dd);
  border-radius: 16px;
  background: var(--md-sys-color-surface-container-lowest, #ffffff);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

[data-theme="dark"] .dropzone-content {
  background: #17191e;
  border-color: #383c46;
}

.dropzone-content:hover {
  border-color: var(--md-sys-color-primary, #00639b);
  background: var(--md-sys-color-surface-container-low, #f8faff);
}

[data-theme="dark"] .dropzone-content:hover {
  border-color: #3b82f6;
  background: #1f232c;
}

.dropzone-icon-ring {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--md-sys-color-surface-container-high, #f0f4f8);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--md-sys-color-primary, #00639b);
  margin-bottom: 12px;
}

[data-theme="dark"] .dropzone-icon-ring {
  background: #252b36;
  color: #60a5fa;
}

.dropzone-title {
  margin: 0 0 6px 0;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface, #1d1b20);
}

[data-theme="dark"] .dropzone-title {
  color: #f1f3f8;
}

.dropzone-desc {
  margin: 0 0 16px 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--md-sys-color-on-surface-variant, #64748b);
}

.btn-select-file {
  height: 32px;
  padding: 0 16px;
  border-radius: 9999px;
  border: none;
  background: var(--md-sys-color-primary, #00639b);
  color: #ffffff;
  font-size: 12.5px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  transition: all 0.15s ease;
}

.btn-select-file:hover {
  filter: brightness(1.08);
}

/* Drag Over Overlay */
.drag-active-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 99, 155, 0.12);
  border: 2px dashed var(--md-sys-color-primary, #00639b);
  backdrop-filter: blur(2px);
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--md-sys-color-primary, #00639b);
  font-size: 14.5px;
  font-weight: 600;
  pointer-events: none;
}
</style>
