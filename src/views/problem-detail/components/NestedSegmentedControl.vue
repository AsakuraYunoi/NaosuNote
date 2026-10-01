<template>
  <div class="m3-nested-segmented-control" role="group" aria-label="答案模式切换">
    <!-- Left Slot: Strictly locked 104px width. Merges to "解析" in Photo mode; Morphs to [预览 | 编辑] in AI mode -->
    <div
      class="nested-seg-group"
      :class="{ 'is-group-active': currentMode === 'ai' }"
    >
      <!-- Merged Single Option: "解析" (Active when Photo mode is chosen) -->
      <button
        type="button"
        class="seg-merged-btn"
        :class="{ 'is-visible': currentMode !== 'ai' }"
        title="切换至解析"
        @click.stop="onGroupClick"
      >
        <span class="seg-pill-text">解析</span>
      </button>

      <!-- Split Dual Options: [预览 | 编辑] with sliding indicator (Active in AI mode) -->
      <div
        class="seg-slider-track"
        :class="{ 'is-visible': currentMode === 'ai' }"
      >
        <!-- Floating M3 Indicator Pill -->
        <div
          class="seg-slider-indicator"
          :class="{
            'pos-preview': currentSubMode === 'preview',
            'pos-edit': currentSubMode === 'edit',
          }"
        ></div>

        <button
          type="button"
          class="seg-pill-btn"
          :class="{ active: currentSubMode === 'preview' }"
          title="预览"
          @mousedown.prevent
          @click.stop="selectAiSub('preview')"
        >
          <span class="seg-pill-text">预览</span>
        </button>

        <button
          type="button"
          class="seg-pill-btn"
          :class="{ active: currentSubMode === 'edit' }"
          title="编辑"
          @mousedown.prevent
          @click.stop="selectAiSub('edit')"
        >
          <span class="seg-pill-text">编辑</span>
        </button>
      </div>
    </div>

    <!-- Right Slot: Strictly locked 52px width. "图片" Option -->
    <button
      type="button"
      class="seg-pill-btn single-photo-btn"
      :class="{ active: currentMode === 'photo' }"
      title="图片"
      @mousedown.prevent
      @click="selectPhoto"
    >
      <span class="seg-pill-text">图片</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export type AnswerPrimaryMode = 'photo' | 'ai';
export type AnswerSubMode = 'preview' | 'edit';

const props = defineProps<{
  mode: AnswerPrimaryMode;
  subMode: AnswerSubMode;
}>();

const emit = defineEmits<{
  (e: 'update:mode', val: AnswerPrimaryMode): void;
  (e: 'update:subMode', val: AnswerSubMode): void;
  (e: 'update:sub-mode', val: AnswerSubMode): void;
  (e: 'change', payload: { mode: AnswerPrimaryMode; subMode: AnswerSubMode }): void;
}>();

const currentMode = computed(() => props.mode);
const currentSubMode = computed(() => props.subMode || 'preview');

function selectPhoto() {
  if (props.mode === 'photo') return;
  emit('update:mode', 'photo');
  emit('change', { mode: 'photo', subMode: currentSubMode.value });
}

function onGroupClick() {
  if (props.mode === 'ai') return;
  emit('update:mode', 'ai');
  emit('change', { mode: 'ai', subMode: currentSubMode.value });
}

function selectAiSub(sub: AnswerSubMode) {
  if (props.mode === 'ai' && props.subMode === sub) {
    return;
  }
  if (props.mode !== 'ai') {
    emit('update:mode', 'ai');
  }
  emit('update:subMode', sub);
  emit('update:sub-mode', sub);
  emit('change', { mode: 'ai', subMode: sub });
}
</script>

<style scoped>
/* =========================================================
 * M3 Nested Segmented Control
 * Total Width: Invariant 165px across all states (Zero resizing)
 * ========================================================= */
.m3-nested-segmented-control {
  display: inline-flex;
  align-items: center;
  position: relative;
  background-color: var(--md-sys-color-surface-container-high, #ece6f0);
  border: 1px solid var(--md-sys-color-outline-variant, #cac4d0);
  border-radius: var(--md-shape-corner-full, 9999px);
  padding: 3px;
  user-select: none;
  gap: 3px;
  height: 32px;
  box-sizing: border-box;
}

[data-theme="dark"] .m3-nested-segmented-control {
  background-color: var(--md-sys-color-surface-container-high, #272a31) !important;
  border-color: var(--md-sys-color-outline-variant, #3a3d45) !important;
}

/* --- Left Slot: Constant 104px Width Container --- */
.nested-seg-group {
  width: 104px;
  height: 24px;
  border-radius: var(--md-shape-corner-full, 9999px);
  position: relative;
  box-sizing: border-box;
  flex-shrink: 0;
  overflow: hidden;
  transition: background-color 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Active Group State: Soft capsule when AI mode is active */
.nested-seg-group.is-group-active {
  background: var(--md-sys-color-secondary-container, #d4e4f6);
}

[data-theme="dark"] .nested-seg-group.is-group-active {
  background: var(--md-sys-color-secondary-container, #36424e) !important;
}

/* Merged Single Button: "解析" (104px) */
.seg-merged-btn {
  position: absolute;
  top: 0;
  left: 0;
  width: 104px !important;
  height: 24px;
  border: none;
  border-radius: var(--md-shape-corner-full, 9999px);
  background: transparent;
  color: var(--md-sys-color-on-surface-variant, #49454f);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  margin: 0 !important;
  padding: 0 !important;
  text-indent: 0 !important;
  box-sizing: border-box;
  -webkit-appearance: none;
  flex-shrink: 0;
  opacity: 0;
  pointer-events: none;
  transform: scale(0.96);
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s ease;
  z-index: 2;
}

.seg-merged-btn.is-visible {
  opacity: 1;
  pointer-events: auto;
  transform: scale(1);
}

.seg-merged-btn:hover {
  color: var(--md-sys-color-on-surface, #1d1b20);
}

[data-theme="dark"] .seg-merged-btn {
  color: var(--md-sys-color-on-surface-variant, #c3c7cf) !important;
}

[data-theme="dark"] .seg-merged-btn:hover {
  color: #ffffff !important;
}

/* Split Track: [预览 | 编辑] (104px) */
.seg-slider-track {
  position: absolute;
  top: 0;
  left: 0;
  width: 104px;
  height: 24px;
  display: flex;
  align-items: center;
  padding: 0 !important;
  margin: 0 !important;
  box-sizing: border-box;
  opacity: 0;
  pointer-events: none;
  transform: scale(0.96);
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 2;
}

.seg-slider-track.is-visible {
  opacity: 1;
  pointer-events: auto;
  transform: scale(1);
}

/* Floating Inner Indicator Pill (52px) */
.seg-slider-indicator {
  position: absolute;
  top: 0;
  left: 0;
  width: 52px;
  height: 24px;
  background: var(--md-sys-color-surface-container-lowest, #ffffff);
  border-radius: var(--md-shape-corner-full, 9999px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1;
  pointer-events: none;
  box-sizing: border-box;
}

[data-theme="dark"] .seg-slider-indicator {
  background: var(--md-sys-color-surface-container-lowest, #14171c) !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35) !important;
}

.seg-slider-indicator.pos-preview {
  transform: translateX(0);
}

.seg-slider-indicator.pos-edit {
  transform: translateX(52px);
}

/* Base Pill Button (52px) */
.seg-pill-btn {
  position: relative;
  z-index: 2;
  width: 52px;
  height: 24px;
  background: transparent;
  border: none;
  padding: 0 !important;
  margin: 0 !important;
  text-indent: 0 !important;
  color: var(--md-sys-color-on-secondary-container, #0e1d2a);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  line-height: 1;
  transition: color 0.15s ease;
  border-radius: var(--md-shape-corner-full, 9999px);
  box-sizing: border-box;
  -webkit-appearance: none;
  flex-shrink: 0;
}

[data-theme="dark"] .seg-pill-btn {
  color: var(--md-sys-color-on-secondary-container, #d4e4f6) !important;
}

.seg-pill-btn.active {
  color: var(--md-sys-color-primary, #00639b);
  font-weight: 700;
}

[data-theme="dark"] .seg-pill-btn.active {
  color: var(--md-sys-color-primary, #9ecaff) !important;
}

/* Strictly Centered Text */
.seg-pill-text {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  text-align: center;
  line-height: 1;
  margin: 0 !important;
  padding: 0 !important;
  text-indent: 0 !important;
}

/* --- Right Slot: Constant 52px Width "图片" Button --- */
.single-photo-btn {
  width: 52px !important;
  height: 24px;
  padding: 0 !important;
  border-radius: var(--md-shape-corner-full, 9999px);
  border: none;
  background: transparent;
  color: var(--md-sys-color-on-surface-variant, #49454f);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  box-sizing: border-box;
  -webkit-appearance: none;
  flex-shrink: 0;
}

.single-photo-btn:hover:not(.active) {
  color: var(--md-sys-color-on-surface, #1d1b20);
}

[data-theme="dark"] .single-photo-btn:hover:not(.active) {
  color: var(--md-sys-color-on-surface, #e2e2e6) !important;
}

.single-photo-btn.active {
  background: var(--md-sys-color-secondary-container, #d4e4f6);
  color: var(--md-sys-color-on-secondary-container, #0e1d2a);
  font-weight: 700;
}

[data-theme="dark"] .single-photo-btn.active {
  background: var(--md-sys-color-secondary-container, #36424e) !important;
  color: #ffffff !important;
}
</style>
