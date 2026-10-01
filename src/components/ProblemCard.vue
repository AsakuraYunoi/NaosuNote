<template>
  <div
    :id="'problem-card-' + problem.uuid"
    class="m3-problem-card"
    :class="{
      'in-print-cart': inCart,
      'is-selectable': selectable,
      'is-selected': selected
    }"
    @click="onCardClick"
    @mouseleave="showAddTagInput = false"
  >
    <!-- Card Top Header (常驻展示核心元信息与高频操作) -->
    <div class="card-header">
      <div class="header-left">
        <!-- M3 勾选框 (批量模式) -->
        <div
          v-if="selectable"
          class="card-checkbox"
          :class="{ checked: selected }"
          title="选择此题"
          @click.stop="$emit('toggleSelect', problem.uuid)"
        >
          <Check v-if="selected" :size="12" stroke-width="3" />
        </div>

        <!-- 考点摘要 (若有) -->
        <span v-if="problem.summary" class="summary-text" :title="problem.summary">
          {{ problem.summary }}
        </span>

        <!-- 标签胶囊列表 (常驻展示与就地增删) -->
        <div class="tags-container">
          <span
            v-for="tag in currentTags"
            :key="tag"
            class="tag-chip"
            @click.stop="$emit('tagClick', tag)"
            :title="`点击筛选 #${tag}`"
          >
            <span class="tag-hash">#</span>
            <span class="tag-name">{{ tag }}</span>
            <button
              class="tag-del-btn"
              title="移除该标签"
              @click.stop="removeTag(tag)"
            >
              <X :size="11" />
            </button>
          </span>

          <!-- 原地添加 Tag 输入框或按钮 -->
          <div v-if="showAddTagInput" class="tag-input-wrapper">
            <input
              ref="tagInputRef"
              v-model="newTagText"
              type="text"
              class="tag-inline-input"
              placeholder="标签名..."
              maxlength="16"
              @keydown.enter.prevent="confirmAddTag"
              @keydown.esc="cancelAddTag"
              @blur="confirmAddTag"
            />
          </div>
          <button
            v-else
            class="tag-add-btn"
            title="为此题添加新标签"
            @click.stop="openAddTag"
          >
            <Plus :size="12" />
            <span>标签</span>
          </button>
        </div>
      </div>

      <!-- 右侧：常驻加入打印按钮 -->
      <div class="header-right">
        <button
          class="btn-cart"
          :class="{ active: inCart }"
          @click.stop="$emit('toggleCart', problem)"
        >
          <component :is="inCart ? Check : Plus" :size="13" />
          <span>{{ inCart ? '已在打印篮' : '加入打印' }}</span>
        </button>
      </div>
    </div>

    <!-- Stem & Formula & SVG Content (主体题干区域) -->
    <div class="card-content selectable" v-html="renderedContent"></div>

    <!-- Hover Capsule (悬浮胶囊标签：鼠标悬停时平滑弹出，收纳次级属性与管理操作) -->
    <div class="hover-capsule">
      <!-- 题型属性 -->
      <span class="capsule-pill type-pill">{{ problem.type }}</span>

      <!-- 录入日期 -->
      <span class="capsule-date">{{ formatDate(problem.date) }}</span>

      <span class="capsule-divider"></span>

      <!-- 难度微星级 -->
      <div class="capsule-rating" title="难度评级">
        <span class="rating-label">难</span>
        <div class="stars-row">
          <span
            v-for="s in 5"
            :key="'diff-' + s"
            class="star-dot diff-star"
            :class="{ active: s <= (problem.difficulty || 1) }"
            @click.stop="onDifficultyChange(s)"
          >★</span>
        </div>
      </div>

      <!-- 重要度微星级 -->
      <div class="capsule-rating" title="重要程度">
        <span class="rating-label">重</span>
        <div class="stars-row">
          <span
            v-for="s in 5"
            :key="'imp-' + s"
            class="star-dot imp-star"
            :class="{ active: s <= (problem.importance || 1) }"
            @click.stop="onImportanceChange(s)"
          >★</span>
        </div>
      </div>

      <span class="capsule-divider"></span>

      <!-- 快捷工具按钮 -->
      <div class="capsule-actions">
        <button class="capsule-btn btn-edit" title="可视化画布编辑" @click.stop="$emit('edit', problem)">
          <Edit3 :size="13" />
        </button>
        <button class="capsule-btn" title="转移 / 复制到其他错题本" @click.stop="$emit('transfer', problem)">
          <FolderInput :size="13" />
        </button>
        <button class="capsule-btn" title="复制题目 HTML 代码" @click.stop="copyHtml">
          <Copy :size="13" />
        </button>
        <button class="capsule-btn btn-del" title="删除此题" @click.stop="confirmDelete">
          <Trash2 :size="13" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import type { Problem } from '../types/problem';
import { formatProblemForExam } from '../utils/examFormatter';
import { apiUpdateProblemTags } from '../utils/api';
import { Plus, Check, Copy, Trash2, X, FolderInput, Edit3 } from 'lucide-vue-next';

const props = defineProps<{
  problem: Problem;
  inCart: boolean;
  selectable?: boolean;
  selected?: boolean;
}>();

const emit = defineEmits<{
  (e: 'updateRating', uuid: string, difficulty?: number, importance?: number): void;
  (e: 'updateTags', uuid: string, tags: string[]): void;
  (e: 'toggleCart', problem: Problem): void;
  (e: 'delete', problem: Problem): void;
  (e: 'notify', msg: string): void;
  (e: 'tagClick', tag: string): void;
  (e: 'toggleSelect', uuid: string): void;
  (e: 'transfer', problem: Problem): void;
  (e: 'edit', problem: Problem): void;
}>();

function onCardClick() {
  if (props.selectable) {
    emit('toggleSelect', props.problem.uuid);
  } else {
    emit('edit', props.problem);
  }
}


const showAddTagInput = ref(false);
const newTagText = ref('');
const tagInputRef = ref<HTMLInputElement | null>(null);

const currentTags = computed(() => {
  return props.problem.tags || [];
});

const renderedContent = computed(() => {
  return formatProblemForExam(props.problem.raw_html);
});

function formatDate(dateStr: string): string {
  if (dateStr && dateStr.length === 8) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  return dateStr || '';
}

function onDifficultyChange(val: number) {
  emit('updateRating', props.problem.uuid, val, undefined);
}

function onImportanceChange(val: number) {
  emit('updateRating', props.problem.uuid, undefined, val);
}

function openAddTag() {
  showAddTagInput.value = true;
  newTagText.value = '';
  nextTick(() => {
    tagInputRef.value?.focus();
  });
}

function cancelAddTag() {
  showAddTagInput.value = false;
  newTagText.value = '';
}

async function confirmAddTag() {
  if (!showAddTagInput.value) return;
  const tag = newTagText.value.trim().replace(/^#/, '');
  showAddTagInput.value = false;
  newTagText.value = '';

  if (!tag) return;
  const tags = [...currentTags.value];
  if (tags.includes(tag)) {
    emit('notify', `标签 #${tag} 已存在`);
    return;
  }

  tags.push(tag);
  try {
    await apiUpdateProblemTags(props.problem.uuid, tags);
    emit('updateTags', props.problem.uuid, tags);
    emit('notify', `已添加标签 #${tag}`);
  } catch (e: any) {
    emit('notify', '更新标签失败: ' + (e?.message || e));
  }
}

async function removeTag(tagToRemove: string) {
  const tags = currentTags.value.filter((t) => t !== tagToRemove);
  try {
    await apiUpdateProblemTags(props.problem.uuid, tags);
    emit('updateTags', props.problem.uuid, tags);
    emit('notify', `已移除标签 #${tagToRemove}`);
  } catch (e: any) {
    emit('notify', '移除标签失败: ' + (e?.message || e));
  }
}

async function copyHtml() {
  try {
    await navigator.clipboard.writeText(props.problem.raw_html);
    emit('notify', '已成功复制原题 HTML 代码到剪贴板');
  } catch (e) {
    emit('notify', '复制失败，请手动选择复制');
  }
}

function confirmDelete() {
  emit('delete', props.problem);
}
</script>

<style scoped>
.m3-problem-card {
  position: relative;
  background-color: var(--md-sys-color-surface-container-lowest);
  border-radius: var(--md-shape-corner-lg);
  border: 1px solid var(--md-sys-color-outline-variant);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  padding: 12px 18px 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.m3-problem-card:hover {
  border-color: var(--md-sys-color-primary);
  box-shadow: var(--md-elevation-1);
}

.m3-problem-card.in-print-cart {
  border: 1.5px solid var(--md-sys-color-primary);
  background: var(--md-sys-color-surface-container);
  box-shadow: 0 0 0 1px var(--md-sys-color-primary-container);
}

.m3-problem-card.is-selectable {
  cursor: pointer;
  user-select: none;
}

.m3-problem-card.is-selected {
  border: 1.5px solid var(--md-sys-color-primary) !important;
  background-color: var(--md-sys-color-surface-container) !important;
  box-shadow: 0 0 0 1px var(--md-sys-color-primary-container) !important;
}

[data-theme="light"] .m3-problem-card.is-selected {
  background: #f0f7ff !important;
}

[data-theme="dark"] .m3-problem-card.is-selected {
  background: #141f2d !important;
}

/* M3 Locate & Pulse Highlight (从编辑页返回时精准定位高亮动效) */
@keyframes m3-locate-pulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 var(--md-sys-color-primary, #00639b);
  }
  20% {
    transform: scale(1.012);
    border-color: var(--md-sys-color-primary, #00639b);
    box-shadow: 0 0 0 3px var(--md-sys-color-primary-container, #cee5ff), 0 8px 20px rgba(0, 99, 155, 0.16);
  }
  45% {
    transform: scale(1);
    border-color: var(--md-sys-color-primary, #00639b);
    box-shadow: 0 0 0 2px var(--md-sys-color-primary, #00639b), 0 4px 12px rgba(0, 99, 155, 0.1);
  }
  70% {
    transform: scale(1.008);
    border-color: var(--md-sys-color-primary, #00639b);
    box-shadow: 0 0 0 3px var(--md-sys-color-primary-container, #cee5ff), 0 6px 16px rgba(0, 99, 155, 0.14);
  }
  100% {
    transform: scale(1);
    border-color: var(--md-sys-color-outline-variant);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  }
}

@keyframes m3-locate-pulse-dark {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 var(--md-sys-color-primary, #9ecaff);
  }
  20% {
    transform: scale(1.012);
    border-color: var(--md-sys-color-primary, #9ecaff);
    box-shadow: 0 0 0 3px rgba(158, 202, 255, 0.35), 0 8px 24px rgba(0, 0, 0, 0.4);
  }
  45% {
    transform: scale(1);
    border-color: var(--md-sys-color-primary, #9ecaff);
    box-shadow: 0 0 0 2px var(--md-sys-color-primary, #9ecaff), 0 4px 14px rgba(0, 0, 0, 0.3);
  }
  70% {
    transform: scale(1.008);
    border-color: var(--md-sys-color-primary, #9ecaff);
    box-shadow: 0 0 0 3px rgba(158, 202, 255, 0.35), 0 6px 18px rgba(0, 0, 0, 0.35);
  }
  100% {
    transform: scale(1);
    border-color: var(--md-sys-color-outline-variant);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  }
}

.m3-problem-card.locate-pulse-highlight {
  animation: m3-locate-pulse 2.2s cubic-bezier(0.2, 0, 0, 1) forwards;
  z-index: 5;
}

[data-theme="dark"] .m3-problem-card.locate-pulse-highlight {
  animation-name: m3-locate-pulse-dark;
}

/* Card Checkbox */
.card-checkbox {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  border: 1.5px solid var(--md-sys-color-outline);
  background-color: var(--md-sys-color-surface-container-lowest);
  display: flex;
  align-items: center;
  justify-content: center;
  color: transparent;
  flex-shrink: 0;
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
  cursor: pointer;
}

.card-checkbox:hover {
  border-color: var(--md-sys-color-primary);
  background-color: var(--md-sys-color-surface-container-high);
}

.card-checkbox.checked {
  background-color: var(--md-sys-color-primary);
  border-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  transform: scale(1.05);
}

/* Card Header (极简紧凑单行) */
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 28px;
}

.header-left {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.summary-text {
  font-size: 13px;
  font-weight: 700;
  color: var(--md-sys-color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
  padding-right: 4px;
}

/* 标签列表与就地编辑 */
.tags-container {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 24px;
  padding: 0 8px 0 6px;
  border-radius: var(--md-shape-corner-full);
  background-color: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface-variant);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.tag-chip:hover {
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}

.tag-hash {
  opacity: 0.6;
  font-weight: 700;
}

.tag-del-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  margin-left: 2px;
  color: var(--md-sys-color-outline);
  transition: all 0.15s ease;
}

.tag-del-btn:hover {
  background-color: var(--md-sys-color-error-container);
  color: var(--md-sys-color-error);
}

.tag-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 24px;
  padding: 0 8px 0 6px;
  border-radius: var(--md-shape-corner-full);
  border: 1px dashed var(--md-sys-color-outline-variant);
  background: transparent;
  color: var(--md-sys-color-outline);
  font-size: 11px;
  transition: all 0.15s ease;
  cursor: pointer;
}

.tag-add-btn:hover {
  border-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-primary);
  background-color: var(--md-sys-color-surface-container);
}

.tag-input-wrapper {
  display: inline-flex;
  align-items: center;
}

.tag-inline-input {
  height: 24px;
  width: 90px;
  padding: 0 8px;
  border-radius: var(--md-shape-corner-full);
  border: 1.5px solid var(--md-sys-color-primary);
  background: var(--md-sys-color-surface-container-lowest);
  font-size: 11px;
  color: var(--md-sys-color-on-surface);
  outline: none;
}

/* 常驻加入打印按钮 */
.header-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.btn-cart {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  height: 28px;
  padding: 0 12px;
  border-radius: var(--md-shape-corner-full);
  background-color: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface);
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.btn-cart:hover {
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  border-color: var(--md-sys-color-primary);
}

.btn-cart.active {
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
}

/* 题干内容 */
.card-content {
  color: var(--md-sys-color-on-surface);
  min-height: 40px;
  container-type: inline-size;
}

:deep(.naosu-problem) {
  padding: 0;
  margin: 0;
}

/* Hover Capsule (悬浮胶囊标签) */
.hover-capsule {
  position: absolute;
  bottom: 8px;
  right: 14px;
  height: 30px;
  background-color: var(--md-sys-color-surface-container-highest);
  backdrop-filter: blur(12px);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-shape-corner-full);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  opacity: 0;
  pointer-events: none;
  transform: translateY(4px);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 10;
}

.m3-problem-card:hover .hover-capsule {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.capsule-pill {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: var(--md-shape-corner-xs);
  background-color: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-on-surface-variant);
}

.capsule-date {
  font-size: 11px;
  color: var(--md-sys-color-outline);
}

.capsule-divider {
  width: 1px;
  height: 14px;
  background-color: var(--md-sys-color-outline-variant);
}

/* 微星级打分 */
.capsule-rating {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  user-select: none;
}

.rating-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface-variant);
}

.stars-row {
  display: flex;
  align-items: center;
  gap: 1px;
}

.star-dot {
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  color: var(--md-sys-color-outline-variant);
  transition: transform 0.1s, color 0.1s;
}

.star-dot:hover {
  transform: scale(1.3);
}

.diff-star.active {
  color: #f59e0b;
}

.imp-star.active {
  color: #e11d48;
}

/* 胶囊按钮 */
.capsule-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.capsule-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--md-sys-color-on-surface-variant);
  transition: all 0.15s ease;
}

.capsule-btn:hover {
  background-color: var(--md-sys-color-surface-container-low);
  color: var(--md-sys-color-primary);
}

.capsule-btn.btn-del:hover {
  background-color: var(--md-sys-color-error-container);
  color: var(--md-sys-color-error);
}
</style>
