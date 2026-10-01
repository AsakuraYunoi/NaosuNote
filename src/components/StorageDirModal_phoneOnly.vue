<template>
  <Teleport to="body">
    <Transition name="m3-modal-fade">
      <div v-if="open" class="m3-dialog-scrim" @click="handleBackdropClick">
        <div class="m3-storage-modal" @click.stop>
          <!-- Modal Header -->
          <div class="modal-header">
            <div class="icon-circle" :class="isInitialSetup ? 'setup-icon' : 'primary-icon'">
              <FolderCog v-if="!isInitialSetup" :size="22" />
              <HardDrive v-else :size="22" />
            </div>
            <div class="header-titles">
              <h3 class="modal-title">
                {{ isInitialSetup ? '初始化持久化存储目录' : '更改数据持久化目录' }}
              </h3>
              <p class="modal-subtitle">
                {{ isInitialSetup ? '请为您的设备选定错题本与离线镜像存储目录' : '更换本地 SQLite 数据库与 HTML 镜像存放位置' }}
              </p>
            </div>
            <button v-if="!isInitialSetup" class="btn-close-header" @click="$emit('close')">
              <X :size="18" />
            </button>
          </div>

          <!-- Device Recognition Badge -->
          <div class="device-hint-bar">
            <component :is="deviceIcon" :size="15" class="device-icon" />
            <span>{{ deviceTagText }}</span>
          </div>

          <!-- Options List -->
          <div class="options-scroll-list">
            <div
              v-for="opt in options"
              :key="opt.id"
              class="storage-option-card"
              :class="{
                active: selectedOptionId === opt.id,
                recommended: opt.is_recommended,
              }"
              @click="selectOption(opt)"
            >
              <div class="option-radio-col">
                <div class="radio-circle" :class="{ checked: selectedOptionId === opt.id }">
                  <div v-if="selectedOptionId === opt.id" class="radio-inner"></div>
                </div>
              </div>

              <div class="option-content-col">
                <div class="option-title-row">
                  <span class="option-name">{{ opt.name }}</span>
                  <span v-if="opt.is_recommended" class="badge-recommended">推荐</span>
                  <span v-if="isCurrentPath(opt.path)" class="badge-current">当前使用</span>
                </div>

                <p class="option-desc">{{ opt.description }}</p>

                <!-- Non-custom path display -->
                <div v-if="opt.id !== 'custom'" class="path-display-box">
                  <code>{{ opt.path }}</code>
                </div>

                <!-- Custom path input field -->
                <div v-else-if="selectedOptionId === 'custom'" class="custom-input-box" @click.stop>
                  <input
                    v-model="customPathInput"
                    class="custom-path-input"
                    placeholder="输入设备上的有效绝对路径，如 /storage/emulated/0/..."
                    maxlength="200"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="modal-footer">
            <button
              v-if="!isInitialSetup"
              class="btn-text-dialog"
              :disabled="saving"
              @click="$emit('close')"
            >
              取消
            </button>
            <button
              v-else
              class="btn-text-dialog"
              :disabled="saving"
              @click="useDefaultDirectly"
            >
              使用默认推荐
            </button>

            <button
              class="btn-primary-dialog"
              :disabled="saving || (selectedOptionId === 'custom' && !customPathInput.trim())"
              @click="confirmSelection"
            >
              <RefreshCw v-if="saving" :size="14" class="spin-anim" />
              <span>{{ saving ? '正在配置...' : isInitialSetup ? '确定并开始使用' : '保存并切换目录' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import {
  FolderCog,
  HardDrive,
  X,
  Smartphone,
  Tablet,
  Laptop,
  RefreshCw,
} from 'lucide-vue-next';
import {
  apiGetStorageOptions,
  apiGetDataDir,
  apiSetDataDir,
  apiGetDeviceInfo,
  type StorageOption,
} from '../utils/api';

const props = withDefaults(
  defineProps<{
    open: boolean;
    isInitialSetup?: boolean;
    currentDir?: string;
  }>(),
  {
    open: false,
    isInitialSetup: false,
    currentDir: '',
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved', path: string): void;
  (e: 'notify', msg: string): void;
}>();

const options = ref<StorageOption[]>([]);
const selectedOptionId = ref('android_docs');
const customPathInput = ref('');
const saving = ref(false);
const activeDataDir = ref('');
const detectedDevice = ref<{ os: string; form_factor: string }>({ os: '', form_factor: 'phone' });

const deviceIcon = computed(() => {
  if (detectedDevice.value.form_factor === 'pad') return Tablet;
  if (detectedDevice.value.os === 'android' || detectedDevice.value.os === 'ios') return Smartphone;
  return Laptop;
});

const deviceTagText = computed(() => {
  const os = detectedDevice.value.os;
  if (os === 'android') return '已检测到 Android 设备，推荐使用公共文档目录以方便文件管理';
  if (os === 'ios') return '已检测到 iOS 设备，推荐使用应用文稿目录以支持「文件」App 访问';
  return '移动端设备环境，已自适应配置安全持久化存储';
});

function isCurrentPath(path: string): boolean {
  if (!path) return false;
  return activeDataDir.value.replace(/\/+$/, '') === path.replace(/\/+$/, '');
}

onMounted(() => {
  if (props.open) {
    loadOptions();
  }
});

watch(
  () => props.open,
  (val) => {
    if (val) {
      loadOptions();
    }
  }
);

async function loadOptions() {
  try {
    const [opts, current, dev] = await Promise.all([
      apiGetStorageOptions(),
      apiGetDataDir(),
      apiGetDeviceInfo().catch(() => ({ os: '', form_factor: 'phone' })),
    ]);

    options.value = opts;
    activeDataDir.value = props.currentDir || current;
    detectedDevice.value = dev as any;

    // 默认高亮推荐项或当前匹配项
    const currentMatch = opts.find((o) => o.path && isCurrentPath(o.path));
    if (currentMatch) {
      selectedOptionId.value = currentMatch.id;
    } else {
      const rec = opts.find((o) => o.is_recommended);
      if (rec) {
        selectedOptionId.value = rec.id;
      } else if (opts.length > 0) {
        selectedOptionId.value = opts[0].id;
      }
    }
  } catch (e) {
    console.warn('Failed to load storage options:', e);
  }
}

function selectOption(opt: StorageOption) {
  selectedOptionId.value = opt.id;
  if (opt.id === 'custom' && !customPathInput.value && activeDataDir.value) {
    customPathInput.value = activeDataDir.value;
  }
}

function handleBackdropClick() {
  if (!props.isInitialSetup) {
    emit('close');
  }
}

async function useDefaultDirectly() {
  const rec = options.value.find((o) => o.is_recommended) || options.value[0];
  if (rec && rec.path) {
    await applyPath(rec.path);
  } else {
    emit('close');
  }
}

async function confirmSelection() {
  const selected = options.value.find((o) => o.id === selectedOptionId.value);
  if (!selected) return;

  let targetPath = selected.path;
  if (selected.id === 'custom') {
    targetPath = customPathInput.value.trim();
    if (!targetPath) {
      emit('notify', '请输入有效的绝对路径');
      return;
    }
  }

  await applyPath(targetPath);
}

async function applyPath(targetPath: string) {
  saving.value = true;
  try {
    const finalPath = await apiSetDataDir(targetPath);
    localStorage.setItem('naosu_storage_dir_selected', 'true');
    activeDataDir.value = finalPath;
    emit('saved', finalPath);
    emit('notify', `数据保存目录已成功配置为：${finalPath}`);
    emit('close');
  } catch (err: any) {
    emit('notify', '设置存储目录失败: ' + (err?.message || err));
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.m3-dialog-scrim {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background-color: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.m3-storage-modal {
  width: 100%;
  max-width: 440px;
  max-height: 90vh;
  background-color: var(--md-sys-color-surface);
  border-radius: 28px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--md-sys-color-outline-variant);
  animation: modalScaleIn 0.22s cubic-bezier(0.2, 0, 0, 1);
}

@keyframes modalScaleIn {
  from {
    opacity: 0;
    transform: scale(0.94);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.modal-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 20px 20px 14px;
}

.icon-circle {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.setup-icon {
  background-color: var(--md-sys-color-secondary-container, #e8def8);
  color: var(--md-sys-color-on-secondary-container, #1d192b);
}

.primary-icon {
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}

.header-titles {
  flex: 1;
}

.modal-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--md-sys-color-on-surface);
  line-height: 1.3;
}

.modal-subtitle {
  font-size: 12.5px;
  color: var(--md-sys-color-on-surface-variant);
  margin-top: 3px;
  line-height: 1.4;
}

.btn-close-header {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--md-sys-color-on-surface-variant);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
}

.device-hint-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--md-sys-color-surface-container-high);
  margin: 0 20px 12px;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 11.5px;
  color: var(--md-sys-color-primary);
  font-weight: 500;
}

.device-icon {
  flex-shrink: 0;
}

.options-scroll-list {
  padding: 0 20px;
  overflow-y: auto;
  max-height: 52vh;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.storage-option-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 16px;
  background-color: var(--md-sys-color-surface-container);
  border: 1.5px solid transparent;
  cursor: pointer;
  transition: all 0.18s ease;
  -webkit-tap-highlight-color: transparent;
}

.storage-option-card:hover {
  background-color: var(--md-sys-color-surface-container-high);
}

.storage-option-card.active {
  background-color: var(--md-sys-color-primary-container);
  border-color: var(--md-sys-color-primary);
}

.option-radio-col {
  padding-top: 2px;
}

.radio-circle {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--md-sys-color-outline);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.18s ease;
}

.radio-circle.checked {
  border-color: var(--md-sys-color-primary);
}

.radio-inner {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: var(--md-sys-color-primary);
}

.option-content-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
}

.option-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.option-name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
}

.storage-option-card.active .option-name {
  color: var(--md-sys-color-on-primary-container);
}

.badge-recommended {
  font-size: 10px;
  font-weight: 700;
  padding: 1.5px 6px;
  border-radius: 6px;
  background-color: #e8f5e9;
  color: #2e7d32;
}

.badge-current {
  font-size: 10px;
  font-weight: 600;
  padding: 1.5px 6px;
  border-radius: 6px;
  background-color: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
}

.option-desc {
  font-size: 11.5px;
  color: var(--md-sys-color-on-surface-variant);
  line-height: 1.35;
}

.path-display-box {
  margin-top: 4px;
  padding: 5px 8px;
  border-radius: 8px;
  background-color: rgba(0, 0, 0, 0.04);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: var(--md-sys-color-outline);
  word-break: break-all;
}

.storage-option-card.active .path-display-box {
  background-color: rgba(255, 255, 255, 0.4);
  color: var(--md-sys-color-on-primary-container);
}

.custom-input-box {
  margin-top: 6px;
}

.custom-path-input {
  width: 100%;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1.5px solid var(--md-sys-color-primary);
  background-color: var(--md-sys-color-surface);
  color: var(--md-sys-color-on-surface);
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  outline: none;
  box-sizing: border-box;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  background-color: var(--md-sys-color-surface);
  border-top: 1px solid var(--md-sys-color-outline-variant);
}

.btn-text-dialog {
  padding: 9px 14px;
  border: none;
  background: transparent;
  color: var(--md-sys-color-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 12px;
}

.btn-primary-dialog {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  border-radius: 18px;
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border: none;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.btn-primary-dialog:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spin-anim {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.m3-modal-fade-enter-active,
.m3-modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.m3-modal-fade-enter-from,
.m3-modal-fade-leave-to {
  opacity: 0;
}
</style>
