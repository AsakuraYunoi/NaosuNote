<template>
  <div
    :id="'problem-card-' + problem.uuid"
    class="m3-problem-card-phone"
    :class="{
      'in-print-cart': inCart,
      'is-selectable': selectable,
      'is-selected': selected,
      'long-pressing': isPressing,
    }"
    @click="onCardClick"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
    @touchcancel="handleTouchCancel"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseLeave"
  >
    <!-- Header -->
    <div class="card-header">
      <div class="header-left">
        <div
          v-if="selectable"
          class="card-checkbox"
          :class="{ checked: selected }"
          @click.stop="$emit('toggleSelect', problem.uuid)"
        >
          <Check v-if="selected" :size="14" stroke-width="3" />
        </div>

        <span class="subject-badge" :class="'sub-' + problem.subject">
          {{ problem.subject }}
        </span>

        <span v-if="problem.summary" class="summary-text">
          {{ problem.summary }}
        </span>
      </div>

      <div class="header-right">
        <!-- 加打印胶囊 -->
        <button
          class="btn-cart-phone"
          :class="{ active: inCart }"
          @click.stop="$emit('toggleCart', problem)"
          :title="inCart ? '从打印篮移出' : '加入打印篮'"
        >
          <component :is="inCart ? Check : Plus" :size="13" />
          <span>{{ inCart ? '已选' : '加打印' }}</span>
        </button>

        <!-- 更多操作与分级入口 (亦可直接长按卡片呼出) -->
        <button
          class="btn-more-phone"
          title="展开题目菜单与高级属性 (长按卡片亦可呼出)"
          @click.stop="openQuickMenu"
        >
          <MoreHorizontal :size="16" />
        </button>
      </div>
    </div>

    <!-- Stem & Formula Body (题干主体内容) -->
    <div class="card-content selectable" v-html="renderedContent"></div>

    <!-- 展开悬浮操作菜单 (长按卡片或点击更多按钮呼出 - 简约现代化设计) -->
    <Teleport to="body">
      <Transition name="quick-sheet">
        <div
          v-if="showQuickMenu"
          class="quick-menu-scrim"
          @click.stop="closeQuickMenu"
          @touchmove.prevent
        >
          <div
            class="quick-menu-sheet"
            @click.stop
          >
            <!-- 顶部拖拽手柄 -->
            <div class="sheet-drag-handle"></div>

            <!-- 头部：学科、题型与添加时间 -->
            <div class="quick-sheet-header">
              <div class="quick-header-top">
                <div class="header-badges">
                  <span class="sheet-badge subject-pill" :class="'sub-' + problem.subject">
                    {{ problem.subject }}
                  </span>
                  <span class="sheet-badge type-pill">
                    {{ problem.type }}
                  </span>
                </div>
                <button class="btn-close-sheet" title="关闭" @click="closeQuickMenu">
                  <X :size="17" />
                </button>
              </div>

              <!-- 题目摘要 (若有) -->
              <h4 v-if="problem.summary" class="quick-problem-title">
                {{ problem.summary }}
              </h4>

              <!-- 添加时间 -->
              <div class="quick-time-meta">
                <Clock :size="13" class="meta-clock-icon" />
                <span>录入添加时间：<strong>{{ formatDetailedTime(problem) }}</strong></span>
              </div>
            </div>

            <!-- 1. 题目所属知识点标签编辑 (行内增删) -->
            <div class="quick-tags-section">
              <div class="section-meta-row">
                <span class="section-label-text">知识点标签</span>
                <span class="section-hint-text">{{ currentTags.length }} 个</span>
              </div>

              <div class="quick-tags-wrap">
                <span
                  v-for="tag in currentTags"
                  :key="tag"
                  class="quick-tag-pill"
                >
                  <span class="tag-hash">#</span>
                  <span class="tag-name">{{ tag }}</span>
                  <button class="tag-remove-btn" title="移出标签" @click.stop="removeTag(tag)">
                    <X :size="12" />
                  </button>
                </span>

                <!-- 添加标签输入框或触发按钮 -->
                <div v-if="showQuickAddTag" class="quick-tag-input-box" @click.stop>
                  <span class="tag-hash">#</span>
                  <input
                    ref="quickTagInputRef"
                    v-model="quickTagText"
                    type="text"
                    placeholder="标签名..."
                    class="quick-tag-inline-input"
                    maxlength="16"
                    @keydown.enter.prevent="confirmQuickAddTag"
                    @keydown.esc="showQuickAddTag = false"
                    @blur="confirmQuickAddTag"
                  />
                </div>
                <button
                  v-else
                  class="btn-add-tag-trigger"
                  @click.stop="openQuickAddTag"
                >
                  <Plus :size="12" />
                  <span>添加标签</span>
                </button>
              </div>
            </div>

            <!-- 2. 难度与重点度分级调整 (紧凑轻量型 M3 星级控件) -->
            <div class="quick-rating-section">
              <!-- 难度分级 -->
              <div class="m3-rating-item">
                <div class="rating-meta-col">
                  <span class="rating-name">难度分级</span>
                  <span class="rating-pill-chip diff-chip">{{ getDifficultyText(currentDifficulty) }}</span>
                </div>
                <div class="m3-stars-track">
                  <button
                    v-for="s in 5"
                    :key="'diff-' + s"
                    class="m3-star-btn diff-star"
                    :class="{ active: s <= currentDifficulty }"
                    :title="`设置为 ${s} 星难度`"
                    @click.stop="setDifficulty(s)"
                  >
                    <Star
                      :size="16"
                      :fill="s <= currentDifficulty ? '#f59e0b' : 'none'"
                      :stroke="s <= currentDifficulty ? '#f59e0b' : 'currentColor'"
                      stroke-width="1.8"
                    />
                  </button>
                </div>
              </div>

              <!-- 重点程度 -->
              <div class="m3-rating-item">
                <div class="rating-meta-col">
                  <span class="rating-name">重点程度</span>
                  <span class="rating-pill-chip imp-chip">{{ getImportanceText(currentImportance) }}</span>
                </div>
                <div class="m3-stars-track">
                  <button
                    v-for="s in 5"
                    :key="'imp-' + s"
                    class="m3-star-btn imp-star"
                    :class="{ active: s <= currentImportance }"
                    :title="`设置为 ${s} 星重点`"
                    @click.stop="setImportance(s)"
                  >
                    <Star
                      :size="16"
                      :fill="s <= currentImportance ? '#ef4444' : 'none'"
                      :stroke="s <= currentImportance ? '#ef4444' : 'currentColor'"
                      stroke-width="1.8"
                    />
                  </button>
                </div>
              </div>
            </div>

            <!-- 3. 极简快捷操作列表 (M3 胶囊药丸风格) -->
            <div class="quick-actions-minimal-grid">
              <button class="action-btn-clean" @click="handleAction('edit')">
                <FileEdit :size="15" />
                <span>编辑题目</span>
              </button>

              <button class="action-btn-clean" @click="handleAction('transfer')">
                <FolderInput :size="15" />
                <span>转移错题本</span>
              </button>

              <button class="action-btn-clean" :class="{ 'in-cart': inCart }" @click="handleAction('cart')">
                <component :is="inCart ? Check : Printer" :size="15" />
                <span>{{ inCart ? '移出打印' : '加入打印' }}</span>
              </button>

              <button class="action-btn-clean" @click="handleAction('copy')">
                <Copy :size="15" />
                <span>复制 HTML</span>
              </button>

              <button class="action-btn-clean danger-btn" @click="handleAction('delete')">
                <Trash2 :size="15" />
                <span>删除错题</span>
              </button>
            </div>

            <!-- 底部完成关闭按钮 (M3 胶囊大按钮，充足底部安全呼吸区) -->
            <div class="quick-sheet-footer">
              <button class="btn-sheet-finish" @click="closeQuickMenu">
                完成
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import {
  Check,
  Plus,
  X,
  FileEdit,
  Trash2,
  Copy,
  MoreHorizontal,
  Clock,
  FolderInput,
  Printer,
  Star,
} from 'lucide-vue-next';
import type { Problem } from '../types/problem';
import { formatProblemForExam } from '../utils/examFormatter';
import { apiUpdateProblemTags } from '../utils/api';

const props = defineProps<{
  problem: Problem;
  inCart: boolean;
  selectable?: boolean;
  selected?: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggleCart', problem: Problem): void;
  (e: 'toggleSelect', uuid: string): void;
  (e: 'tagClick', tag: string): void;
  (e: 'updateRating', uuid: string, diff?: number, imp?: number): void;
  (e: 'delete', problem: Problem): void;
  (e: 'edit', problem: Problem): void;
  (e: 'transfer', problem: Problem): void;
  (e: 'updateTags', uuid: string, tags: string[]): void;
  (e: 'notify', msg: string): void;
}>();

// ---------------------------------------------------------------------------
// 1. 长按手势检测逻辑 (Long Press Detection)
// ---------------------------------------------------------------------------
const showQuickMenu = ref(false);
const isPressing = ref(false);
let isLongPressed = false;
let longPressTimeout: ReturnType<typeof setTimeout> | null = null;
let touchStartX = 0;
let touchStartY = 0;

function startLongPress(clientX: number, clientY: number) {
  if (props.selectable) return; // 批量选择模式下不触发长按菜单
  touchStartX = clientX;
  touchStartY = clientY;
  isLongPressed = false;
  isPressing.value = true;

  if (longPressTimeout) clearTimeout(longPressTimeout);
  longPressTimeout = setTimeout(() => {
    isLongPressed = true;
    isPressing.value = false;
    try {
      if (navigator.vibrate) {
        navigator.vibrate(40);
      }
    } catch {}
    openQuickMenu();
  }, 450);
}

function cancelLongPress() {
  isPressing.value = false;
  if (longPressTimeout) {
    clearTimeout(longPressTimeout);
    longPressTimeout = null;
  }
}

function handleTouchStart(e: TouchEvent) {
  if (e.touches.length === 1) {
    const touch = e.touches[0];
    startLongPress(touch.clientX, touch.clientY);
  }
}

function handleTouchMove(e: TouchEvent) {
  if (longPressTimeout && e.touches.length === 1) {
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartX);
    const dy = Math.abs(touch.clientY - touchStartY);
    if (dx > 10 || dy > 10) {
      cancelLongPress();
    }
  }
}

function handleTouchEnd(e: TouchEvent) {
  cancelLongPress();
  if (isLongPressed) {
    e.preventDefault();
    setTimeout(() => {
      isLongPressed = false;
    }, 200);
  }
}

function handleTouchCancel() {
  cancelLongPress();
  isLongPressed = false;
}

function handleMouseDown(e: MouseEvent) {
  if (e.button === 0) {
    startLongPress(e.clientX, e.clientY);
  }
}

function handleMouseMove(e: MouseEvent) {
  if (longPressTimeout) {
    const dx = Math.abs(e.clientX - touchStartX);
    const dy = Math.abs(e.clientY - touchStartY);
    if (dx > 10 || dy > 10) {
      cancelLongPress();
    }
  }
}

function handleMouseUp() {
  cancelLongPress();
  if (isLongPressed) {
    setTimeout(() => {
      isLongPressed = false;
    }, 200);
  }
}

function handleMouseLeave() {
  cancelLongPress();
}

function onCardClick() {
  if (isLongPressed) {
    isLongPressed = false;
    return;
  }
  if (props.selectable) {
    emit('toggleSelect', props.problem.uuid);
  } else {
    emit('edit', props.problem);
  }
}

function openQuickMenu() {
  currentDifficulty.value = props.problem.difficulty || 1;
  currentImportance.value = props.problem.importance || 1;
  showQuickMenu.value = true;
}

function closeQuickMenu() {
  showQuickMenu.value = false;
  showQuickAddTag.value = false;
}

// ---------------------------------------------------------------------------
// 2. 难度与重点度分级调整
// ---------------------------------------------------------------------------
const currentDifficulty = ref(props.problem.difficulty || 1);
const currentImportance = ref(props.problem.importance || 1);

watch(() => props.problem.difficulty, (val) => {
  currentDifficulty.value = val || 1;
});
watch(() => props.problem.importance, (val) => {
  currentImportance.value = val || 1;
});

function getDifficultyText(val: number): string {
  switch (val) {
    case 1: return '1星 · 基础';
    case 2: return '2星 · 巩固';
    case 3: return '3星 · 中等';
    case 4: return '4星 · 较难';
    case 5: return '5星 · 拔高';
    default: return `${val}星`;
  }
}

function getImportanceText(val: number): string {
  switch (val) {
    case 1: return '1星 · 了解';
    case 2: return '2星 · 常考';
    case 3: return '3星 · 重点';
    case 4: return '4星 · 易错';
    case 5: return '5星 · 必考';
    default: return `${val}星`;
  }
}

function setDifficulty(star: number) {
  currentDifficulty.value = star;
  emit('updateRating', props.problem.uuid, star, currentImportance.value);
  emit('notify', `难度设为: ${getDifficultyText(star)}`);
}

function setImportance(star: number) {
  currentImportance.value = star;
  emit('updateRating', props.problem.uuid, currentDifficulty.value, star);
  emit('notify', `重点设为: ${getImportanceText(star)}`);
}

// ---------------------------------------------------------------------------
// 3. 快捷操作处理
// ---------------------------------------------------------------------------
function handleAction(type: 'edit' | 'transfer' | 'copy' | 'cart' | 'delete') {
  closeQuickMenu();
  switch (type) {
    case 'edit':
      emit('edit', props.problem);
      break;
    case 'transfer':
      emit('transfer', props.problem);
      break;
    case 'copy':
      copyHtml();
      break;
    case 'cart':
      emit('toggleCart', props.problem);
      break;
    case 'delete':
      confirmDelete();
      break;
  }
}

// ---------------------------------------------------------------------------
// 4. 标签管理逻辑 (仅在展开菜单中进行)
// ---------------------------------------------------------------------------
const showQuickAddTag = ref(false);
const quickTagText = ref('');
const quickTagInputRef = ref<HTMLInputElement | null>(null);

const currentTags = computed(() => {
  return props.problem.tags || [];
});

const renderedContent = computed(() => {
  return formatProblemForExam(props.problem.raw_html);
});

function formatDetailedTime(prob: Problem): string {
  if (prob.created_at) {
    try {
      const d = new Date(prob.created_at);
      if (!isNaN(d.getTime())) {
        const Y = d.getFullYear();
        const M = String(d.getMonth() + 1).padStart(2, '0');
        const D = String(d.getDate()).padStart(2, '0');
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        return `${Y}-${M}-${D} ${h}:${m}`;
      }
    } catch {}
  }
  if (prob.date) {
    if (prob.date.length === 8) {
      return `${prob.date.slice(0, 4)}-${prob.date.slice(4, 6)}-${prob.date.slice(6, 8)}`;
    }
    return prob.date;
  }
  return '未记录时间';
}

function openQuickAddTag() {
  showQuickAddTag.value = true;
  quickTagText.value = '';
  nextTick(() => {
    quickTagInputRef.value?.focus();
  });
}

async function confirmQuickAddTag() {
  if (!showQuickAddTag.value) return;
  const tag = quickTagText.value.trim().replace(/^#/, '');
  showQuickAddTag.value = false;
  quickTagText.value = '';

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
.m3-problem-card-phone {
  background-color: var(--md-sys-color-surface-container-lowest);
  border-radius: var(--md-shape-corner-lg);
  border: 1px solid var(--md-sys-color-outline-variant);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  padding: 12px 14px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: transform 0.15s ease, background-color 0.2s ease, border-color 0.2s ease;
  margin-bottom: 10px;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.m3-problem-card-phone:active {
  background-color: var(--md-sys-color-surface-container-low);
}

.m3-problem-card-phone.long-pressing {
  transform: scale(0.985);
  background-color: var(--md-sys-color-surface-container);
}

.m3-problem-card-phone.in-print-cart {
  border: 1.5px solid var(--md-sys-color-primary);
  background-color: var(--md-sys-color-surface-container);
}

.m3-problem-card-phone.is-selected {
  border: 1.5px solid var(--md-sys-color-primary) !important;
  background-color: var(--md-sys-color-surface-container) !important;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.card-checkbox {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1.5px solid var(--md-sys-color-outline);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
}

.card-checkbox.checked {
  background-color: var(--md-sys-color-primary);
  border-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
}

.subject-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2.5px 8px;
  border-radius: 9999px; /* M3 Pill */
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
  flex-shrink: 0;
}

.sub-数学 { background: #e0f2fe; color: #0369a1; }
.sub-物理 { background: #fef3c7; color: #b45309; }
.sub-化学 { background: #dcfce7; color: #15803d; }
.sub-生物 { background: #f3e8ff; color: #7e22ce; }

[data-theme="dark"] .sub-数学 { background: #082f49; color: #7dd3fc; }
[data-theme="dark"] .sub-物理 { background: #451a03; color: #fde68a; }
[data-theme="dark"] .sub-化学 { background: #052e16; color: #86efac; }
[data-theme="dark"] .sub-生物 { background: #3b0764; color: #d8b4fe; }

.summary-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.btn-cart-phone {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 9999px; /* M3 Pill */
  border: 1px solid var(--md-sys-color-outline-variant);
  color: var(--md-sys-color-on-surface-variant);
  background: transparent;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
}

.btn-cart-phone.active {
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border-color: var(--md-sys-color-primary);
}

.btn-more-phone {
  width: 30px;
  height: 30px;
  border-radius: 9999px; /* M3 Circular */
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--md-sys-color-outline);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.btn-more-phone:active {
  background: var(--md-sys-color-surface-container-high);
}

.card-content {
  font-size: 14px;
  line-height: 1.6;
  color: var(--md-sys-color-on-surface);
  word-break: break-word;
  overflow-x: auto;
  user-select: text;
}

.card-content :deep(img),
.card-content :deep(svg) {
  max-width: 100%;
  height: auto;
}

/* ==========================================================================
   展开悬浮菜单 (Material Design 3 现代规范 - 消除粗糙 AI 感)
   ========================================================================== */
.quick-menu-scrim {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.48);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  animation: fadeInQuick 0.18s ease-out;
}

@keyframes fadeInQuick {
  from { opacity: 0; }
  to { opacity: 1; }
}

.quick-menu-sheet {
  background: var(--md-sys-color-surface);
  border-top-left-radius: 28px; /* M3 Extra Large Corner */
  border-top-right-radius: 28px;
  width: 100%;
  max-width: 480px;
  max-height: 84vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 12px 20px 0 20px;
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 14px;
  animation: slideUpQuick 0.22s cubic-bezier(0.2, 0, 0, 1);
}

@keyframes slideUpQuick {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.sheet-drag-handle {
  width: 36px;
  height: 4px;
  border-radius: 9999px;
  background: var(--md-sys-color-outline-variant);
  margin: 2px auto 4px auto;
  flex-shrink: 0;
}

/* 头部信息 */
.quick-sheet-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.quick-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-badges {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sheet-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 9999px; /* M3 Pill */
}

.type-pill {
  background: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface-variant);
}

.btn-close-sheet {
  width: 28px;
  height: 28px;
  border-radius: 9999px; /* M3 Pill */
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-outline);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.btn-close-sheet:active {
  background: var(--md-sys-color-surface-container-highest);
}

.quick-problem-title {
  font-size: 14.5px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
  line-height: 1.4;
  margin: 0;
}

.quick-time-meta {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  color: var(--md-sys-color-on-surface-variant);
}

.meta-clock-icon {
  color: var(--md-sys-color-outline);
}

.quick-time-meta strong {
  color: var(--md-sys-color-on-surface);
  font-weight: 500;
}

/* 1. 题目所属知识点标签编辑区 */
.quick-tags-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-label-text {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
}

.section-hint-text {
  font-size: 11px;
  color: var(--md-sys-color-outline);
}

.quick-tags-wrap {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.quick-tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11.5px;
  background: var(--md-sys-color-surface-container);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 9999px; /* M3 Pill */
  padding: 3px 10px;
  color: var(--md-sys-color-on-surface);
}

.tag-remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--md-sys-color-outline);
  padding: 0;
  margin-left: 2px;
  cursor: pointer;
}

.quick-tag-input-box {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: var(--md-sys-color-surface);
  border: 1px solid var(--md-sys-color-primary);
  border-radius: 9999px; /* M3 Pill */
  padding: 2px 8px;
}

.quick-tag-inline-input {
  width: 76px;
  border: none;
  background: transparent;
  font-size: 11.5px;
  color: var(--md-sys-color-on-surface);
  outline: none;
}

.btn-add-tag-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  background: transparent;
  border: 1px dashed var(--md-sys-color-outline-variant);
  border-radius: 9999px; /* M3 Pill */
  padding: 3px 10px;
  color: var(--md-sys-color-outline);
  cursor: pointer;
}

/* 2. 难度分级与重点分级 (紧凑精致 M3 单行条，杜绝粗大笨重) */
.quick-rating-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--md-sys-color-surface-container-low);
  border-radius: 16px; /* M3 Medium Shape */
  padding: 10px 14px;
}

.m3-rating-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 32px;
}

.rating-meta-col {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rating-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
}

.rating-pill-chip {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 9999px; /* M3 Pill */
}

.diff-chip {
  background: #fef3c7;
  color: #b45309;
}

[data-theme="dark"] .diff-chip {
  background: #451a03;
  color: #fde68a;
}

.imp-chip {
  background: #fee2e2;
  color: #dc2626;
}

[data-theme="dark"] .imp-chip {
  background: #450a0a;
  color: #fca5a5;
}

.m3-stars-track {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--md-sys-color-surface);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 9999px; /* M3 Pill */
  padding: 2px 6px;
}

.m3-star-btn {
  width: 26px;
  height: 26px;
  border-radius: 9999px;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: var(--md-sys-color-outline-variant);
  transition: transform 0.12s ease;
  -webkit-tap-highlight-color: transparent;
}

.m3-star-btn:active {
  transform: scale(1.2);
}

.diff-star.active {
  color: #f59e0b;
}

.imp-star.active {
  color: #ef4444;
}

/* 3. 极简快捷操作区 (M3 胶囊 Pill 按钮组) */
.quick-actions-minimal-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.action-btn-clean {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 9px 12px;
  background: var(--md-sys-color-surface-container);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 9999px; /* M3 Full Pill */
  color: var(--md-sys-color-on-surface);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease, transform 0.1s ease;
  -webkit-tap-highlight-color: transparent;
}

.action-btn-clean:active {
  background: var(--md-sys-color-surface-container-high);
  transform: scale(0.98);
}

.action-btn-clean.in-cart {
  color: var(--md-sys-color-primary);
  border-color: var(--md-sys-color-primary);
  background: var(--md-sys-color-primary-container);
  font-weight: 600;
}

.action-btn-clean.danger-btn {
  grid-column: span 2;
  color: #dc2626;
  border-color: rgba(220, 38, 38, 0.25);
  background: rgba(220, 38, 38, 0.04);
}

.action-btn-clean.danger-btn:active {
  background: #fee2e2;
}

[data-theme="dark"] .action-btn-clean.danger-btn:active {
  background: #450a0a;
}

/* 底部完成大按钮与吸底安全呼吸容器 (彻底解决离下端太近问题) */
.quick-sheet-footer {
  position: sticky;
  bottom: 0;
  background: linear-gradient(to top, var(--md-sys-color-surface) 85%, rgba(255, 255, 255, 0) 100%);
  padding: 8px 0 max(calc(env(safe-area-inset-bottom, 0px) + 22px), 28px) 0;
  margin-top: 4px;
  display: flex;
  justify-content: center;
  z-index: 10;
}

[data-theme="dark"] .quick-sheet-footer {
  background: linear-gradient(to top, var(--md-sys-color-surface) 85%, rgba(0, 0, 0, 0) 100%);
}

.btn-sheet-finish {
  width: 100%;
  height: 46px;
  border-radius: 9999px; /* M3 Full Pill */
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  font-size: 14.5px;
  font-weight: 600;
  letter-spacing: 0.5px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
  transition: transform 0.12s ease, opacity 0.15s ease, box-shadow 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.btn-sheet-finish:active {
  transform: scale(0.985);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  opacity: 0.92;
}

/* 抽屉进出动效 */
.quick-sheet-enter-active,
.quick-sheet-leave-active {
  transition: opacity 0.18s ease;
}

.quick-sheet-enter-active .quick-menu-sheet,
.quick-sheet-leave-active .quick-menu-sheet {
  transition: transform 0.22s cubic-bezier(0.2, 0, 0, 1);
}

.quick-sheet-enter-from,
.quick-sheet-leave-to {
  opacity: 0;
}

.quick-sheet-enter-from .quick-menu-sheet,
.quick-sheet-leave-to .quick-menu-sheet {
  transform: translateY(100%);
}
</style>
