<template>
  <div class="print-phone-view">
    <!-- Top Mobile Header -->
    <header class="phone-header">
      <div class="header-titles">
        <h2 class="title">组卷与打印</h2>
        <span class="count-badge">已选 {{ printCart.length }} 题</span>
      </div>

      <div class="header-actions">
        <button
          v-if="printCart.length > 0"
          class="btn-text-danger"
          title="清空打印篮"
          @click="confirmClearCart"
        >
          <Trash2 :size="15" />
          <span>清空</span>
        </button>
      </div>
    </header>

    <!-- Tab Bar: Switch between Problem Queue and Paper Config -->
    <div class="mobile-tabs-row">
      <button
        class="tab-btn"
        :class="{ active: activeMobileTab === 'queue' }"
        @click="activeMobileTab = 'queue'"
      >
        <span>已选题单 ({{ printCart.length }})</span>
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeMobileTab === 'config' }"
        @click="activeMobileTab = 'config'"
      >
        <span>试卷排版与打印</span>
      </button>
    </div>

    <!-- Tab 1: Queue of selected problems -->
    <div v-if="activeMobileTab === 'queue'" class="tab-content-scroll">
      <div v-if="printCart.length === 0" class="empty-cart-state">
        <div class="empty-icon-box">
          <Printer :size="36" />
        </div>
        <p class="empty-title">打印篮空空如也</p>
        <p class="empty-desc">在错题库中点击“加打印”按钮，即可把错题添加到组卷篮中。</p>
        <button class="btn-primary-mobile" @click="$emit('nav', 'library')">
          <ArrowLeft :size="16" />
          <span>前往错题库选题</span>
        </button>
      </div>

      <div v-else class="queue-list">
        <div
          v-for="(prob, idx) in printCart"
          :key="prob.uuid"
          class="queue-item-card"
        >
          <div class="queue-item-index">{{ idx + 1 }}</div>

          <div class="queue-item-body">
            <div class="queue-item-meta">
              <span class="badge-sub" :class="'sub-' + prob.subject">{{ prob.subject }}</span>
              <span class="badge-type">{{ prob.type }}</span>
              <span class="queue-item-summary">{{ prob.summary || '未命名错题' }}</span>
            </div>
            <div class="queue-item-snippet" v-html="formatProblemForExam(prob.raw_html)"></div>
          </div>

          <div class="queue-item-actions">
            <button
              class="queue-action-btn"
              :disabled="idx === 0"
              title="上移"
              @click="$emit('move-up', idx)"
            >
              <ChevronUp :size="16" />
            </button>
            <button
              class="queue-action-btn"
              :disabled="idx === printCart.length - 1"
              title="下移"
              @click="$emit('move-down', idx)"
            >
              <ChevronDown :size="16" />
            </button>
            <button
              class="queue-action-btn btn-del"
              title="从题单移除"
              @click="$emit('remove-from-cart', prob.uuid)"
            >
              <X :size="16" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab 2: Paper Settings & Print Trigger -->
    <div v-else class="tab-content-scroll">
      <div class="config-container">
        <!-- Paper Title -->
        <div class="config-card">
          <label class="config-label">试卷大标题</label>
          <input
            v-model="paperConfig.title"
            type="text"
            class="config-input"
            placeholder="例如：高三数学错题重练专项卷"
          />
        </div>

        <!-- Paper Subtitle -->
        <div class="config-card">
          <label class="config-label">副标题 / 备注</label>
          <input
            v-model="paperConfig.subtitle"
            type="text"
            class="config-input"
            placeholder="例如：考试时间：45分钟  姓名：____"
          />
        </div>

        <!-- Paper Spec -->
        <div class="config-card">
          <label class="config-label">纸张尺寸</label>
          <div class="segmented-box">
            <button
              class="seg-btn"
              :class="{ active: paperConfig.paperSize === 'A4' }"
              @click="paperConfig.paperSize = 'A4'"
            >
              A4 纸 (210×297)
            </button>
            <button
              class="seg-btn"
              :class="{ active: paperConfig.paperSize === 'B5' }"
              @click="paperConfig.paperSize = 'B5'"
            >
              B5 纸 (176×250)
            </button>
          </div>
        </div>

        <!-- Margin -->
        <div class="config-card">
          <label class="config-label">页边距设置</label>
          <div class="segmented-box">
            <button
              class="seg-btn"
              :class="{ active: paperConfig.margin === 'compact' }"
              @click="paperConfig.margin = 'compact'"
            >
              紧凑 (10mm)
            </button>
            <button
              class="seg-btn"
              :class="{ active: paperConfig.margin === 'normal' }"
              @click="paperConfig.margin = 'normal'"
            >
              标准 (12mm)
            </button>
            <button
              class="seg-btn"
              :class="{ active: paperConfig.margin === 'spacious' }"
              @click="paperConfig.margin = 'spacious'"
            >
              宽松 (16mm)
            </button>
          </div>
        </div>

        <!-- Line Spacing -->
        <div class="config-card">
          <label class="config-label">答题空行与间距</label>
          <div class="segmented-box">
            <button
              class="seg-btn"
              :class="{ active: paperConfig.lineSpacing === 'compact' }"
              @click="paperConfig.lineSpacing = 'compact'"
            >
              紧凑排版
            </button>
            <button
              class="seg-btn"
              :class="{ active: paperConfig.lineSpacing === 'standard' }"
              @click="paperConfig.lineSpacing = 'standard'"
            >
              留空答题
            </button>
          </div>
        </div>

        <!-- Answer inclusion -->
        <div class="config-card">
          <label class="config-label">答案与解析附录</label>
          <div class="segmented-box">
            <button
              class="seg-btn"
              :class="{ active: paperConfig.answerMode === 'none' }"
              @click="paperConfig.answerMode = 'none'"
            >
              仅生成纯试卷
            </button>
            <button
              class="seg-btn"
              :class="{ active: paperConfig.answerMode === 'end' }"
              @click="paperConfig.answerMode = 'end'"
            >
              卷末附参考答案
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Sticky Bottom Print Button Bar -->
    <div class="sticky-print-bar">
      <button
        class="btn-print-mobile"
        :disabled="printCart.length === 0"
        @click="handleMobilePrint"
      >
        <Printer :size="18" />
        <span>生成试卷并打印 / 导出 PDF</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import type { Problem } from '../types/problem';
import { formatProblemForExam } from '../utils/examFormatter';
import {
  Printer,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
  ArrowLeft,
} from 'lucide-vue-next';

const props = defineProps<{
  printCart: Problem[];
}>();

const emit = defineEmits<{
  (e: 'nav', tab: string): void;
  (e: 'clear-cart'): void;
  (e: 'remove-from-cart', uuid: string): void;
  (e: 'move-up', index: number): void;
  (e: 'move-down', index: number): void;
  (e: 'notify', msg: string): void;
}>();

const activeMobileTab = ref<'queue' | 'config'>('queue');

const paperConfig = reactive({
  title: '',
  subtitle: '',
  paperSize: 'A4',
  margin: 'normal',
  lineSpacing: 'standard',
  answerMode: 'none',
});

function confirmClearCart() {
  if (confirm('确认清空当前打印题单中的所有题目？')) {
    emit('clear-cart');
    emit('notify', '打印题单已清空');
  }
}

function handleMobilePrint() {
  if (props.printCart.length === 0) {
    emit('notify', '打印篮中暂无试题，请先添加错题');
    return;
  }
  emit('notify', '正在调用系统打印服务，支持导出为 PDF 或无线隔空打印...');
  setTimeout(() => {
    window.print();
  }, 300);
}
</script>

<style scoped>
.print-phone-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--md-sys-color-background);
  position: relative;
  overflow: hidden;
}

.phone-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: var(--md-sys-color-surface);
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  z-index: 10;
}

.header-titles {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title {
  font-size: 16px;
  font-weight: 700;
  color: var(--md-sys-color-on-surface);
}

.count-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 12px;
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}

.btn-text-danger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--md-sys-color-error);
  background: none;
  border: none;
  cursor: pointer;
}

.mobile-tabs-row {
  display: flex;
  background: var(--md-sys-color-surface);
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.tab-btn {
  flex: 1;
  padding: 10px 0;
  text-align: center;
  font-size: 13px;
  font-weight: 500;
  color: var(--md-sys-color-on-surface-variant);
  background: none;
  border: none;
  position: relative;
  cursor: pointer;
}

.tab-btn.active {
  color: var(--md-sys-color-primary);
  font-weight: 600;
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 20%;
  right: 20%;
  height: 3px;
  background: var(--md-sys-color-primary);
  border-radius: 3px 3px 0 0;
}

.tab-content-scroll {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 14px 14px 120px 14px;
}

.empty-cart-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  gap: 12px;
}

.empty-icon-box {
  width: 64px;
  height: 64px;
  border-radius: 32px;
  background: var(--md-sys-color-surface-container);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--md-sys-color-outline);
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
}

.empty-desc {
  font-size: 13px;
  color: var(--md-sys-color-on-surface-variant);
  max-width: 260px;
}

.btn-primary-mobile {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  padding: 10px 20px;
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border-radius: 20px;
  font-weight: 600;
  font-size: 14px;
}

.queue-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.queue-item-card {
  display: flex;
  align-items: stretch;
  background: var(--md-sys-color-surface-container-lowest);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-shape-corner-lg);
  padding: 10px;
  gap: 10px;
}

.queue-item-index {
  font-size: 14px;
  font-weight: 700;
  color: var(--md-sys-color-primary);
  width: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.queue-item-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.queue-item-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.badge-sub {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
}

.badge-type {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-on-surface-variant);
}

.queue-item-summary {
  font-size: 12px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.queue-item-snippet {
  font-size: 12px;
  line-height: 1.4;
  color: var(--md-sys-color-on-surface-variant);
  max-height: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.queue-item-snippet :deep(img),
.queue-item-snippet :deep(svg) {
  max-height: 50px;
  width: auto;
}

.queue-item-actions {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 4px;
  flex-shrink: 0;
}

.queue-action-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-on-surface-variant);
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
}

.queue-action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.btn-del {
  color: var(--md-sys-color-error);
}

/* Config Container */
.config-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.config-card {
  background: var(--md-sys-color-surface-container-lowest);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-shape-corner-lg);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface-variant);
}

.config-input {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--md-sys-color-outline-variant);
  background: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-on-surface);
  font-size: 14px;
  outline: none;
}

.segmented-box {
  display: flex;
  background: var(--md-sys-color-surface-container);
  border-radius: 12px;
  padding: 3px;
  gap: 3px;
}

.seg-btn {
  flex: 1;
  padding: 8px 4px;
  text-align: center;
  font-size: 12px;
  border-radius: 10px;
  background: transparent;
  color: var(--md-sys-color-on-surface-variant);
  border: none;
  cursor: pointer;
}

.seg-btn.active {
  background: var(--md-sys-color-surface);
  color: var(--md-sys-color-primary);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.sticky-print-bar {
  position: fixed;
  bottom: 64px;
  left: 0;
  right: 0;
  padding: 10px 16px;
  background: var(--md-sys-color-surface);
  border-top: 1px solid var(--md-sys-color-outline-variant);
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
  z-index: 95;
  display: flex;
}

.btn-print-mobile {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 0;
  border-radius: 24px;
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.btn-print-mobile:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
