<template>
  <transition name="drawer-popup">
    <div v-if="visible" class="photo-reorder-drawer-overlay" @click.self="emit('update:visible', false)">
      <div class="photo-reorder-card">
        <!-- Header -->
        <header class="drawer-header">
          <div class="drawer-title-group">
            <span class="drawer-title">图片排序</span>
            <span class="drawer-badge">共 {{ images.length }} 张</span>
          </div>
          <button
            type="button"
            class="drawer-close-btn"
            title="关闭"
            aria-label="关闭"
            @click="emit('update:visible', false)"
          >
            <X :size="16" />
          </button>
        </header>

        <!-- Image List -->
        <div class="drawer-list-body">
          <div
            v-for="(filename, idx) in images"
            :key="filename"
            class="drawer-item"
            :class="{ active: idx === currentIndex }"
            @click="emit('select', idx)"
          >
            <!-- Index Pill -->
            <span class="item-index-badge">P{{ idx + 1 }}</span>

            <!-- Thumbnail -->
            <div class="item-thumb-box">
              <img
                v-if="imageUrlMap[filename]"
                :src="imageUrlMap[filename]"
                :alt="`第 ${idx + 1} 页图片`"
                class="item-thumb-img"
              />
              <div v-else class="item-thumb-placeholder">
                <ImageIcon :size="18" />
              </div>
            </div>

            <!-- Page Title -->
            <div class="item-info">
              <span class="item-page-name">第 {{ idx + 1 }} 页</span>
              <span class="item-filename">{{ filename.slice(0, 16) }}...</span>
            </div>

            <!-- Reorder Actions -->
            <div class="item-actions" @click.stop>
              <button
                type="button"
                class="action-btn"
                title="上移"
                :disabled="idx === 0"
                @click="moveUp(idx)"
              >
                <ChevronUp :size="15" />
              </button>
              <button
                type="button"
                class="action-btn"
                title="下移"
                :disabled="idx === images.length - 1"
                @click="moveDown(idx)"
              >
                <ChevronDown :size="15" />
              </button>
              <button
                type="button"
                class="action-btn btn-delete"
                title="删除"
                @click="emit('delete', idx)"
              >
                <Trash2 :size="14" />
              </button>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <footer class="drawer-footer">
          <span class="footer-tip">点击条目可预览</span>
          <button
            type="button"
            class="btn-done"
            @click="emit('update:visible', false)"
          >
            完成
          </button>
        </footer>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import {
  X,
  ChevronUp,
  ChevronDown,
  Trash2,
  Image as ImageIcon,
} from 'lucide-vue-next';

const props = defineProps<{
  visible: boolean;
  images: string[];
  imageUrlMap: Record<string, string>;
  currentIndex: number;
}>();

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void;
  (e: 'reorder', newImages: string[]): void;
  (e: 'select', index: number): void;
  (e: 'delete', index: number): void;
}>();

function moveUp(idx: number) {
  if (idx <= 0) return;
  const list = [...props.images];
  const item = list.splice(idx, 1)[0];
  list.splice(idx - 1, 0, item);
  emit('reorder', list);
  emit('select', idx - 1);
}

function moveDown(idx: number) {
  if (idx >= props.images.length - 1) return;
  const list = [...props.images];
  const item = list.splice(idx, 1)[0];
  list.splice(idx + 1, 0, item);
  emit('reorder', list);
  emit('select', idx + 1);
}
</script>

<style scoped>
.photo-reorder-drawer-overlay {
  position: absolute;
  inset: 0;
  z-index: 40;
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(2px);
  display: flex;
  justify-content: flex-end;
  align-items: flex-end;
  padding: 18px;
  box-sizing: border-box;
}

.photo-reorder-card {
  width: 320px;
  max-width: calc(100% - 24px);
  max-height: 460px;
  background: var(--md-sys-color-surface, #ffffff);
  border-radius: 16px;
  border: 1px solid var(--md-sys-color-outline-variant, #e0e2ec);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.16);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform-origin: bottom right;
}

[data-theme="dark"] .photo-reorder-card {
  background: var(--md-sys-color-surface-container, #1e2128) !important;
  border-color: var(--md-sys-color-outline-variant, #363b46) !important;
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.45);
}

/* Header */
.drawer-header {
  height: 46px;
  padding: 0 14px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant, #e8eaee);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

[data-theme="dark"] .drawer-header {
  border-bottom-color: var(--md-sys-color-outline-variant, #323742);
}

.drawer-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.drawer-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface, #1d1b20);
}

[data-theme="dark"] .drawer-title {
  color: #f1f3f8;
}

.drawer-badge {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 9999px;
  background: var(--md-sys-color-surface-container-high, #f0f2f5);
  color: var(--md-sys-color-on-surface-variant, #64748b);
  font-weight: 500;
}

[data-theme="dark"] .drawer-badge {
  background: #2a2f3a;
  color: #94a3b8;
}

.drawer-close-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--md-sys-color-on-surface-variant, #64748b);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.drawer-close-btn:hover {
  background: var(--md-sys-color-surface-container-high, #f1f3f7);
  color: var(--md-sys-color-on-surface, #1d1b20);
}

[data-theme="dark"] .drawer-close-btn:hover {
  background: #2c313d;
  color: #ffffff;
}

/* List Body */
.drawer-list-body {
  flex: 1;
  overflow-y: auto;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.drawer-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--md-sys-color-outline-variant, #edf0f5);
  background: var(--md-sys-color-surface-container-lowest, #ffffff);
  cursor: pointer;
  transition: all 0.15s ease;
}

[data-theme="dark"] .drawer-item {
  background: #17191e;
  border-color: #2b303b;
}

.drawer-item:hover {
  border-color: var(--md-sys-color-primary, #00639b);
  background: var(--md-sys-color-surface-container-low, #f8faff);
}

[data-theme="dark"] .drawer-item:hover {
  border-color: #3b82f6;
  background: #20242d;
}

.drawer-item.active {
  border-color: var(--md-sys-color-primary, #00639b);
  background: rgba(0, 99, 155, 0.05);
}

[data-theme="dark"] .drawer-item.active {
  border-color: #60a5fa;
  background: rgba(96, 165, 250, 0.1);
}

.item-index-badge {
  font-size: 11px;
  font-weight: 700;
  color: var(--md-sys-color-primary, #00639b);
  width: 24px;
  flex-shrink: 0;
  text-align: center;
}

[data-theme="dark"] .item-index-badge {
  color: #93c5fd;
}

.item-thumb-box {
  width: 44px;
  height: 44px;
  border-radius: 6px;
  overflow: hidden;
  background: #f1f3f7;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

[data-theme="dark"] .item-thumb-box {
  background: #252a35;
}

.item-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item-thumb-placeholder {
  color: #94a3b8;
}

.item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-page-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface, #1d1b20);
}

[data-theme="dark"] .item-page-name {
  color: #e2e8f0;
}

.item-filename {
  font-size: 11px;
  color: var(--md-sys-color-on-surface-variant, #94a3b8);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.action-btn {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--md-sys-color-on-surface-variant, #64748b);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s ease;
}

.action-btn:hover:not(:disabled) {
  background: var(--md-sys-color-surface-container-high, #e8edf4);
  color: var(--md-sys-color-on-surface, #0f172a);
}

[data-theme="dark"] .action-btn:hover:not(:disabled) {
  background: #2e3442;
  color: #f8fafc;
}

.action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.action-btn.btn-delete:hover {
  background: #fee2e2;
  color: #dc2626;
}

[data-theme="dark"] .action-btn.btn-delete:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

/* Footer */
.drawer-footer {
  height: 44px;
  padding: 0 14px;
  border-top: 1px solid var(--md-sys-color-outline-variant, #e8eaee);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  background: var(--md-sys-color-surface-container-lowest, #fafbfd);
}

[data-theme="dark"] .drawer-footer {
  border-top-color: var(--md-sys-color-outline-variant, #323742);
  background: #17191e;
}

.footer-tip {
  font-size: 11.5px;
  color: var(--md-sys-color-on-surface-variant, #94a3b8);
}

.btn-done {
  height: 28px;
  padding: 0 14px;
  border-radius: 9999px;
  border: none;
  background: var(--md-sys-color-primary, #00639b);
  color: #ffffff;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.btn-done:hover {
  opacity: 0.9;
}

/* Transitions */
.drawer-popup-enter-active,
.drawer-popup-leave-active {
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.drawer-popup-enter-active .photo-reorder-card,
.drawer-popup-leave-active .photo-reorder-card {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.drawer-popup-enter-from,
.drawer-popup-leave-to {
  opacity: 0;
}

.drawer-popup-enter-from .photo-reorder-card,
.drawer-popup-leave-to .photo-reorder-card {
  transform: scale(0.85) translate(20px, 20px);
  opacity: 0;
}
</style>
