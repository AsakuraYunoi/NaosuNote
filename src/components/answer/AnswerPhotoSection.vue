<template>
  <div
    class="answer-photo-section"
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
      <div class="photo-canvas-scroll">
        <div class="photo-display-card">
          <img
            v-if="currentImageUrl"
            :src="currentImageUrl"
            :alt="`答案照片 P${currentIndex + 1}`"
            class="main-answer-photo"
          />
          <div v-else class="photo-loading-spinner">
            <Loader2 :size="24" class="spin-icon" />
            <span>加载照片数据...</span>
          </div>
        </div>
      </div>

      <!-- Bottom Center: Carousel Mode / Page Indicator Capsule -->
      <div v-if="images.length > 0" class="carousel-control-pill">
        <button
          type="button"
          class="carousel-nav-btn"
          title="上一张"
          :disabled="currentIndex <= 0"
          @click="emit('selectPhoto', currentIndex - 1)"
        >
          <ChevronLeft :size="14" />
        </button>

        <div class="carousel-center-info">
          <span class="carousel-label">轮播式</span>
          <span class="carousel-dots">
            <span
              v-for="(_, idx) in images"
              :key="idx"
              class="dot"
              :class="{ active: idx === currentIndex }"
              @click="emit('selectPhoto', idx)"
            ></span>
          </span>
          <span class="carousel-page-text">{{ currentIndex + 1 }}/{{ images.length }}</span>
        </div>

        <button
          type="button"
          class="carousel-nav-btn"
          title="下一张"
          :disabled="currentIndex >= images.length - 1"
          @click="emit('selectPhoto', currentIndex + 1)"
        >
          <ChevronRight :size="14" />
        </button>
      </div>

      <!-- Bottom Right: Floating Action Set (UI Mockup) -->
      <div class="floating-action-cluster">
        <!-- Main FAB: Upload Add Button (Purple rounded square) -->
        <button
          type="button"
          class="fab-add-photo-btn"
          title="上传或追加新照片"
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
            title="下载当前照片到本地"
            @click="emit('download', currentIndex)"
          >
            <Download :size="16" />
          </button>

          <!-- More Options / Edit -->
          <button
            type="button"
            class="capsule-icon-btn"
            title="顺时针旋转 90 度"
            @click="emit('rotate', currentIndex)"
          >
            <RotateCw :size="16" />
          </button>

          <!-- Bin Red Action Button -->
          <button
            type="button"
            class="capsule-icon-btn btn-bin-red"
            title="删除当前照片"
            @click="emit('delete', currentIndex)"
          >
            <Trash2 :size="15" />
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State / Dropzone -->
    <div v-else class="photo-empty-dropzone" :class="{ 'is-drag-over': isDragging }">
      <div class="dropzone-content" @click="triggerFileInput">
        <div class="dropzone-icon-ring">
          <UploadCloud :size="34" />
        </div>
        <h4 class="dropzone-title">上传或粘贴解答照片</h4>
        <p class="dropzone-desc">
          在此直接按 <strong>Ctrl+V / Cmd+V</strong> 粘贴屏幕截图，或拖拽手机照片至此
        </p>
        <button type="button" class="btn-select-file">
          <Plus :size="15" />
          <span>选择解答图片</span>
        </button>
      </div>
    </div>

    <!-- Dragging Overlay Indicator -->
    <div v-if="isDragging" class="drag-active-overlay">
      <UploadCloud :size="48" />
      <span>松开鼠标添加为答案照片</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Plus,
  Download,
  RotateCw,
  Trash2,
  UploadCloud,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-vue-next';

const props = defineProps<{
  images: string[];
  currentIndex: number;
  imageUrlMap: Record<string, string>;
}>();

const emit = defineEmits<{
  (e: 'upload', file: Blob): void;
  (e: 'delete', index: number): void;
  (e: 'download', index: number): void;
  (e: 'rotate', index: number): void;
  (e: 'selectPhoto', index: number): void;
}>();

const isDragging = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

const currentImageUrl = computed(() => {
  const filename = props.images[props.currentIndex];
  if (!filename) return '';
  return props.imageUrlMap[filename] || '';
});

function triggerFileInput() {
  fileInputRef.value?.click();
}

function onFileInputChange(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    emit('upload', target.files[0]);
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
.answer-photo-section {
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

.photo-canvas-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px 80px 20px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.photo-display-card {
  max-width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--md-sys-color-surface-container-lowest, #ffffff);
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--md-sys-color-outline-variant, #e8eaee);
  padding: 12px;
}

[data-theme="dark"] .photo-display-card {
  background: #1e2128;
  border-color: #2e323b;
}

.main-answer-photo {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  object-fit: contain;
}

.photo-loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 60px 30px;
  color: var(--md-sys-color-on-surface-variant, #667085);
  font-size: 13px;
}

.spin-icon {
  animation: spin 1s linear infinite;
  color: var(--md-sys-color-primary, #00639b);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* =========================================================
 * Bottom Center: Carousel Indicator Pill
 * ========================================================= */
.carousel-control-pill {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  height: 32px;
  background: rgba(228, 231, 236, 0.88);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 9999px;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.6);
  z-index: 10;
  user-select: none;
}

[data-theme="dark"] .carousel-control-pill {
  background: rgba(40, 44, 52, 0.88);
  border-color: rgba(255, 255, 255, 0.1);
}

.carousel-nav-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: #475467;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.carousel-nav-btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.08);
  color: #101828;
}

.carousel-nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

[data-theme="dark"] .carousel-nav-btn {
  color: #98a2b3;
}

[data-theme="dark"] .carousel-nav-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  color: #f2f4f7;
}

.carousel-center-info {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 4px;
}

.carousel-label {
  font-size: 11.5px;
  font-weight: 600;
  color: #344054;
}

[data-theme="dark"] .carousel-label {
  color: #d0d5dd;
}

.carousel-dots {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.carousel-dots .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #98a2b3;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.carousel-dots .dot.active {
  width: 14px;
  border-radius: 3px;
  background: var(--md-sys-color-primary, #00639b);
}

.carousel-page-text {
  font-size: 11px;
  color: #667085;
  font-variant-numeric: tabular-nums;
}

[data-theme="dark"] .carousel-page-text {
  color: #98a2b3;
}

/* =========================================================
 * Bottom Right: Floating Action Cluster (UI Mockup)
 * ========================================================= */
.floating-action-cluster {
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  z-index: 15;
}

/* Main FAB + Button */
.fab-add-photo-btn {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  border: none;
  background: #e0e7ff;
  color: #4338ca;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 3px 10px rgba(67, 56, 202, 0.16);
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.fab-add-photo-btn:hover {
  transform: translateY(-2px);
  background: #c7d2fe;
  box-shadow: 0 5px 14px rgba(67, 56, 202, 0.24);
}

.fab-add-photo-btn:active {
  transform: translateY(0);
}

[data-theme="dark"] .fab-add-photo-btn {
  background: #312e81;
  color: #c7d2fe;
}

/* Vertical Capsule Toolbar */
.vertical-tool-capsule {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #ffffff;
  border: 1px solid #d0d5dd;
  border-radius: 9999px;
  padding: 6px 4px;
  gap: 6px;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.08);
}

[data-theme="dark"] .vertical-tool-capsule {
  background: #252830;
  border-color: #3a3f4d;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.35);
}

.capsule-icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: #475467;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.capsule-icon-btn:hover {
  background: #f2f4f7;
  color: #101828;
}

[data-theme="dark"] .capsule-icon-btn {
  color: #98a2b3;
}

[data-theme="dark"] .capsule-icon-btn:hover {
  background: #323742;
  color: #ffffff;
}

/* Bin Red Button */
.btn-bin-red {
  background: #ef4444 !important;
  color: #ffffff !important;
  box-shadow: 0 1px 4px rgba(239, 68, 68, 0.3);
}

.btn-bin-red:hover {
  background: #dc2626 !important;
  transform: scale(1.05);
}

/* Empty State / Dropzone */
.photo-empty-dropzone {
  flex: 1;
  margin: 20px;
  border: 2px dashed var(--md-sys-color-outline-variant, #d0d5dd);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--md-sys-color-surface-container-low, #fcfcfd);
  cursor: pointer;
  transition: all 0.2s ease;
}

.photo-empty-dropzone:hover,
.photo-empty-dropzone.is-drag-over {
  border-color: var(--md-sys-color-primary, #00639b);
  background: var(--md-sys-color-primary-container, #f0f7ff);
}

[data-theme="dark"] .photo-empty-dropzone {
  background: #17191e;
  border-color: #2e323b;
}

.dropzone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 30px 20px;
  gap: 10px;
}

.dropzone-icon-ring {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--md-sys-color-surface-container-highest, #f2f4f7);
  color: var(--md-sys-color-primary, #00639b);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dropzone-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface, #1d1b20);
}

.dropzone-desc {
  font-size: 13px;
  color: var(--md-sys-color-on-surface-variant, #667085);
  max-width: 320px;
  line-height: 1.5;
}

.btn-select-file {
  margin-top: 8px;
  height: 36px;
  padding: 0 18px;
  border-radius: 9999px;
  border: none;
  background: var(--md-sys-color-primary, #00639b);
  color: #ffffff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
}

.btn-select-file:hover {
  filter: brightness(1.08);
}

/* Drag overlay */
.drag-active-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 99, 155, 0.88);
  color: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 16px;
  font-weight: 600;
  z-index: 50;
  pointer-events: none;
}
</style>
