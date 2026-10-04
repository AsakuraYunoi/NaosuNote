<template>
  <div
    class="problem-answer-card"
    @paste="handleGlobalPaste"
  >
    <!-- Header with Centered Segmented Control & Conditional Right Action -->
    <header class="answer-card-header">
      <div class="header-left">
        <!-- Balanced spacer -->
      </div>

      <div class="header-center">
        <NestedSegmentedControl
          v-model:mode="primaryMode"
          v-model:sub-mode="subMode"
          @change="onModeChange"
        />
      </div>

      <div class="header-right">
        <!-- Trash icon ONLY appears when in AI Markdown mode -->
        <button
          v-if="primaryMode === 'ai'"
          type="button"
          class="header-icon-btn"
          title="清空解析"
          :disabled="!markdownText"
          @click="handleClearMarkdown"
        >
          <Trash2 :size="16" />
        </button>
      </div>
    </header>

    <!-- Main Body Area: Decoupled Panes -->
    <div class="answer-card-body">
      <!-- 1. AI Markdown & KaTeX Pane -->
      <AnswerAiPane
        v-show="primaryMode === 'ai'"
        v-model:markdown-text="markdownText"
        v-model:sub-mode="subMode"
        @change="notifyChange"
      />

      <!-- 2. Photo / Image Answers Pane -->
      <AnswerPhotoPane
        v-show="primaryMode === 'photo'"
        :images="imageFiles"
        :current-index="currentPhotoIndex"
        :image-url-map="imageUrlMap"
        @upload="handleUpload"
        @delete="removeCurrentImage"
        @download="downloadCurrentImage"
        @reorder="handleReorderImages"
        @select-photo="currentPhotoIndex = $event"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import NestedSegmentedControl, {
  type AnswerPrimaryMode,
  type AnswerSubMode,
} from './components/NestedSegmentedControl.vue';
import AnswerAiPane from './components/AnswerAiPane.vue';
import AnswerPhotoPane from './components/AnswerPhotoPane.vue';
import {
  apiSaveAnswerImage,
  apiSaveAnswerImageByFilename,
  apiDeleteAnswerImage,
  apiReadAnswerImage,
  apiExportAnswerImage,
} from '../../utils/api';
import { Trash2 } from 'lucide-vue-next';

const props = defineProps<{
  problemUuid: string;
  initialMarkdown?: string;
  initialImages?: string[];
}>();

const emit = defineEmits<{
  (e: 'change', payload: { answerMarkdown: string; answerImages: string[] }): void;
  (e: 'notify', msg: string): void;
}>();

const primaryMode = ref<AnswerPrimaryMode>('ai');
const subMode = ref<AnswerSubMode>('preview');

const markdownText = ref(props.initialMarkdown || '');
const imageFiles = ref<string[]>([...(props.initialImages || [])]);
const currentPhotoIndex = ref(0);
const imageUrlMap = ref<Record<string, string>>({});

// Watch initial props
watch(
  () => props.initialMarkdown,
  (val) => {
    if (val !== undefined && val !== markdownText.value) {
      markdownText.value = val || '';
    }
  }
);

watch(
  () => props.initialImages,
  (val) => {
    if (val) {
      imageFiles.value = [...val];
      loadAllImages();
    }
  },
  { deep: true }
);

function onModeChange(payload: { mode: AnswerPrimaryMode; subMode: AnswerSubMode }) {
  primaryMode.value = payload.mode;
  subMode.value = payload.subMode;
}

function notifyChange() {
  emit('change', {
    answerMarkdown: markdownText.value,
    answerImages: [...imageFiles.value],
  });
}

function handleClearMarkdown() {
  markdownText.value = '';
  subMode.value = 'edit';
  notifyChange();
  emit('notify', '已清空解析');
}

function handleReorderImages(newImages: string[]) {
  imageFiles.value = [...newImages];
  notifyChange();
  emit('notify', '已更新顺序');
}

// ==========================================
// IMAGE PROCESSING & COMPRESSION
// ==========================================

async function compressImageToWebp(fileOrBlob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const tempUrl = URL.createObjectURL(fileOrBlob);

    img.onload = () => {
      URL.revokeObjectURL(tempUrl);
      let { width, height } = img;
      const maxDim = 1600;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Canvas context initialization failed'));
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        async (blob) => {
          if (!blob) return reject(new Error('Canvas compression failed'));
          const buffer = await blob.arrayBuffer();
          resolve(new Uint8Array(buffer));
        },
        'image/webp',
        0.85
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(tempUrl);
      reject(new Error('图片加载解析失败'));
    };

    img.src = tempUrl;
  });
}

async function calculateSha256(data: ArrayBuffer | Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data as ArrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

const imageHashMap = ref<Record<string, string>>({});
const imageRawHashMap = ref<Record<string, string>>({});
let imageProcessingQueue: Promise<void> = Promise.resolve();

async function handleUpload(file: Blob) {
  imageProcessingQueue = imageProcessingQueue
    .then(async () => {
      await processAndSaveImage(file);
    })
    .catch((err) => {
      console.error('Image upload processing failed:', err);
    });
  await imageProcessingQueue;
}

async function ensureImageHashesLoaded() {
  for (const filename of imageFiles.value) {
    if (!imageHashMap.value[filename]) {
      try {
        const bytes = await apiReadAnswerImage(filename);
        if (bytes) {
          imageHashMap.value[filename] = await calculateSha256(bytes);
        }
      } catch (err) {
        console.warn('Failed to calculate hash for', filename, err);
      }
    }
  }
}

async function processAndSaveImage(blob: Blob) {
  try {
    emit('notify', '正在处理并校验图片...');

    // 1. 计算原始文件/图片二进制 SHA-256 哈希
    const rawBuffer = await blob.arrayBuffer();
    const rawHash = await calculateSha256(rawBuffer);

    // 2. 预先确保当前题目的所有既有图片哈希已完全就绪
    await ensureImageHashesLoaded();

    // 检查是否存在原始文件二进制完全相同的图片
    for (const [fn, h] of Object.entries(imageRawHashMap.value)) {
      if (h === rawHash && imageFiles.value.includes(fn)) {
        const dupIdx = imageFiles.value.indexOf(fn);
        currentPhotoIndex.value = Math.max(0, dupIdx);
        primaryMode.value = 'photo';
        emit('notify', `检测到已存在相同的解答图片 (P${dupIdx + 1})，已自动跳过重复添加`);
        return;
      }
    }

    // 3. 压缩为 WebP 标准字节
    const compressedBytes = await compressImageToWebp(blob);
    const webpHash = await calculateSha256(compressedBytes);

    // 4. 对比压缩后 WebP 的 SHA-256 哈希
    for (const [fn, h] of Object.entries(imageHashMap.value)) {
      if (h === webpHash && imageFiles.value.includes(fn)) {
        const dupIdx = imageFiles.value.indexOf(fn);
        currentPhotoIndex.value = Math.max(0, dupIdx);
        primaryMode.value = 'photo';
        emit('notify', `检测到已存在相同的解答图片 (P${dupIdx + 1})，已自动跳过重复添加`);
        return;
      }
    }

    // 5. 保存到本地存储：基于题目 UUID + 哈希前 16 位命名，彻底规避按序号命名覆盖冲突与服务端判定已存在漏同步问题
    const filename = `${props.problemUuid}_${webpHash.slice(0, 16)}.webp`;
    await apiSaveAnswerImageByFilename(filename, compressedBytes);

    imageFiles.value.push(filename);
    imageHashMap.value[filename] = webpHash;
    imageRawHashMap.value[filename] = rawHash;
    currentPhotoIndex.value = imageFiles.value.length - 1;

    // Cache local blob url
    const displayBlob = new Blob([compressedBytes], { type: 'image/webp' });
    imageUrlMap.value[filename] = URL.createObjectURL(displayBlob);

    primaryMode.value = 'photo';
    notifyChange();
    emit('notify', `已添加解答图片 P${imageFiles.value.length}`);
  } catch (e: any) {
    emit('notify', '保存失败: ' + (e?.message || e));
  }
}

async function loadAllImages() {
  for (const filename of imageFiles.value) {
    if (!imageUrlMap.value[filename]) {
      try {
        const bytes = await apiReadAnswerImage(filename);
        if (bytes) {
          const blob = new Blob([bytes], { type: 'image/webp' });
          imageUrlMap.value[filename] = URL.createObjectURL(blob);
          if (!imageHashMap.value[filename]) {
            imageHashMap.value[filename] = await calculateSha256(bytes);
          }
        }
      } catch (err) {
        console.warn('Failed to load image', filename, err);
      }
    }
  }
}

async function removeCurrentImage(idx: number) {
  const filename = imageFiles.value[idx];
  if (!filename) return;

  try {
    await apiDeleteAnswerImage(filename);
    imageFiles.value.splice(idx, 1);
    if (imageUrlMap.value[filename]) {
      URL.revokeObjectURL(imageUrlMap.value[filename]);
      delete imageUrlMap.value[filename];
    }
    delete imageHashMap.value[filename];
    delete imageRawHashMap.value[filename];

    if (currentPhotoIndex.value >= imageFiles.value.length) {
      currentPhotoIndex.value = Math.max(0, imageFiles.value.length - 1);
    }
    notifyChange();
    emit('notify', '已删除图片');
  } catch (e: any) {
    emit('notify', '删除失败: ' + e);
  }
}

async function downloadCurrentImage(idx: number) {
  const filename = imageFiles.value[idx];
  if (!filename) return;

  try {
    const ext = filename.split('.').pop() || 'webp';
    const suggestedName = `答案_${props.problemUuid.slice(0, 8)}_第${idx + 1}张.${ext}`;
    const savedPath = await apiExportAnswerImage(filename, suggestedName);
    if (savedPath) {
      emit('notify', `图片已保存至: ${savedPath}`);
    }
  } catch (err: any) {
    emit('notify', '下载失败: ' + (err?.message || err));
  }
}

function handleGlobalPaste(e: ClipboardEvent) {
  if (e.clipboardData && e.clipboardData.items) {
    for (let i = 0; i < e.clipboardData.items.length; i++) {
      const item = e.clipboardData.items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          handleUpload(blob);
          return;
        }
      }
    }
  }
}

function handleImagesSynced() {
  loadAllImages();
}

onMounted(() => {
  loadAllImages();
  if (imageFiles.value.length > 0 && !markdownText.value.trim()) {
    primaryMode.value = 'photo';
  }
  window.addEventListener('naosu:images-synced', handleImagesSynced);
});

onUnmounted(() => {
  window.removeEventListener('naosu:images-synced', handleImagesSynced);
});
</script>

<style scoped>
.problem-answer-card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--md-sys-color-surface-container-lowest, #ffffff);
  color: var(--md-sys-color-on-surface, #1d1b20);
  overflow: hidden;
  position: relative;
}

[data-theme="dark"] .problem-answer-card {
  background: var(--md-sys-color-surface-container-low, #191c22) !important;
}

/* Card Internal Header (52px) */
.answer-card-header {
  height: 52px;
  background: var(--md-sys-color-surface, #ffffff);
  border-bottom: 1px solid var(--md-sys-color-outline-variant, #e0e2ec);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
  z-index: 10;
  user-select: none;
}

[data-theme="dark"] .answer-card-header {
  background: var(--md-sys-color-surface-container, #1d2026) !important;
  border-bottom-color: var(--md-sys-color-outline-variant, #3a3d45) !important;
}

.header-left {
  width: 36px;
  flex-shrink: 0;
}

.header-center {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.header-right {
  width: 36px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
}

.header-icon-btn {
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
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.header-icon-btn:hover:not(:disabled) {
  background: var(--md-sys-color-surface-container-high, #ece6f0);
  color: #dc2626;
}

.header-icon-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

[data-theme="dark"] .header-icon-btn {
  color: var(--md-sys-color-on-surface-variant, #c3c7cf) !important;
}

[data-theme="dark"] .header-icon-btn:hover:not(:disabled) {
  background: var(--md-sys-color-surface-container-high, #272a31) !important;
  color: #f87171 !important;
}

/* Body Area */
.answer-card-body {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
