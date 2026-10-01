<template>
  <div class="print-view">
    <!-- Left Configuration Sidebar -->
    <aside class="print-sidebar no-print">
      <div class="sidebar-header" data-tauri-drag-region="deep">
        <h3 class="sidebar-title">试卷排版与打印</h3>
        <span class="basket-count">已选 {{ printCart.length }} 题</span>
      </div>

      <div class="sidebar-content">
        <!-- Paper Info -->
        <div class="setting-group">
          <label class="setting-label">试卷主标题</label>
          <input
            v-model="config.title"
            type="text"
            class="m3-input"
            placeholder="可留空，如：高三错题重练专项卷"
          />
        </div>

        <div class="setting-group">
          <label class="setting-label">副标题</label>
          <input
            v-model="config.subtitle"
            type="text"
            class="m3-input"
            placeholder="可留空"
          />
        </div>

        <!-- Paper Size -->
        <div class="setting-group">
          <label class="setting-label">纸张规格</label>
          <div class="segmented-control">
            <button
              class="segment-btn"
              :class="{ active: config.paperSize === 'A4' }"
              @click="config.paperSize = 'A4'"
            >
              A4 纸 (210×297)
            </button>
            <button
              class="segment-btn"
              :class="{ active: config.paperSize === 'B5' }"
              @click="config.paperSize = 'B5'"
            >
              B5 纸 (176×250)
            </button>
          </div>
        </div>

        <!-- Margin -->
        <div class="setting-group">
          <label class="setting-label">页边距预设</label>
          <div class="segmented-control">
            <button
              class="segment-btn"
              :class="{ active: config.margin === 'compact' }"
              @click="config.margin = 'compact'"
            >
              紧凑 (10mm)
            </button>
            <button
              class="segment-btn"
              :class="{ active: config.margin === 'normal' }"
              @click="config.margin = 'normal'"
            >
              标准 (12mm)
            </button>
            <button
              class="segment-btn"
              :class="{ active: config.margin === 'spacious' }"
              @click="config.margin = 'spacious'"
            >
              宽松 (16mm)
            </button>
          </div>
        </div>

        <!-- Line Spacing (行间距) -->
        <div class="setting-group">
          <label class="setting-label">行间距</label>
          <div class="segmented-control">
            <button
              class="segment-btn"
              :class="{ active: config.lineSpacing === 'compact' }"
              @click="config.lineSpacing = 'compact'"
              title="紧凑考卷行距"
            >
              紧凑
            </button>
            <button
              class="segment-btn"
              :class="{ active: config.lineSpacing === 'standard' }"
              @click="config.lineSpacing = 'standard'"
              title="标准阅读行距"
            >
              标准
            </button>
            <button
              class="segment-btn"
              :class="{ active: config.lineSpacing === 'spacious' }"
              @click="config.lineSpacing = 'spacious'"
              title="宽松舒展行距"
            >
              宽松
            </button>
          </div>
        </div>

        <!-- Problem Spacing (题间距) -->
        <div class="setting-group">
          <label class="setting-label">题间距</label>
          <div class="segmented-control">
            <button
              class="segment-btn"
              :class="{ active: config.problemSpacing === 'compact' }"
              @click="config.problemSpacing = 'compact'"
              title="紧凑题距 (18px)"
            >
              紧凑
            </button>
            <button
              class="segment-btn"
              :class="{ active: config.problemSpacing === 'standard' }"
              @click="config.problemSpacing = 'standard'"
              title="标准题距 (26px)"
            >
              标准
            </button>
            <button
              class="segment-btn"
              :class="{ active: config.problemSpacing === 'spacious' }"
              @click="config.problemSpacing = 'spacious'"
              title="宽松题距 (38px)"
            >
              宽松
            </button>
          </div>
          <div v-if="hasCustomSpacings" class="custom-spacing-reset-row" style="margin-top: 6px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; color: var(--md-sys-color-primary);">已自定义单题留白</span>
            <button type="button" class="btn-text-reset" style="background: none; border: none; font-size: 11px; color: var(--md-sys-color-primary); cursor: pointer; text-decoration: underline;" @click="resetAllCustomSpacings">重置所有留白</button>
          </div>
        </div>


        <!-- Font Size Stepped Slider (7px to 15px, step 0.5px, default 10px) -->
        <div class="setting-group">
          <div class="setting-header-with-value">
            <label class="setting-label">题干字号</label>
            <span class="slider-val-badge">{{ config.fontSize.toFixed(1) }} px</span>
          </div>
          <input
            v-model.number="config.fontSize"
            type="range"
            min="7"
            max="15"
            step="0.5"
            class="m3-slider"
          />
        </div>

        <!-- Toggle Page Numbers (第 X 页 / 共 Y 页) -->
        <div class="setting-group">
          <div class="setting-header-with-toggle">
            <label class="setting-label">显示试卷页码</label>
            <label class="m3-switch" title="开启后在每页底端居中呈现“第 X 页 / 共 Y 页”">
              <input v-model="config.showPageNumber" type="checkbox" />
              <span class="m3-switch-track">
                <span class="m3-switch-thumb"></span>
              </span>
            </label>
          </div>
        </div>

        <!-- Print Basket Problem Order List: Stretches all the way to footer -->
        <div class="setting-group setting-group-basket">
          <div class="basket-header">
            <label class="setting-label">题目列表与次序</label>
            <button v-if="printCart.length > 0" class="btn-clear" @click="$emit('clearCart')">
              清空全部
            </button>
          </div>

          <div v-if="printCart.length === 0" class="empty-basket">
            打印篮为空，请在错题库中点击“加入打印”。
          </div>

          <div v-else class="basket-items-list">
            <div
              v-for="(p, index) in printCart"
              :key="p.uuid"
              class="basket-item-row"
            >
              <div class="item-leading">
                <span class="item-badge">{{ index + 1 }}</span>
                <span class="item-summary" :title="p.summary">{{ p.summary }}</span>
              </div>
              <div class="item-btns">
                <button
                  class="btn-icon"
                  title="上移"
                  :disabled="index === 0"
                  @click="$emit('moveUp', index)"
                >
                  <ArrowUp :size="14" />
                </button>
                <button
                  class="btn-icon"
                  title="下移"
                  :disabled="index === printCart.length - 1"
                  @click="$emit('moveDown', index)"
                >
                  <ArrowDown :size="14" />
                </button>
                <button
                  class="btn-icon btn-icon-remove"
                  title="从打印篮移除"
                  @click="$emit('removeFromCart', p.uuid)"
                >
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Print Action (PDF Only) -->
      <div class="sidebar-footer">
        <button
          class="btn-print-action"
          :disabled="printCart.length === 0 || isExportingPdf"
          @click="handleExportPdfDirect"
        >
          <FileDown :size="18" />
          <span>{{ isExportingPdf ? '正在导出矢量 PDF...' : '直接导出 PDF 试卷' }}</span>
        </button>
      </div>
    </aside>

    <!-- Right Paper Canvas Area -->
    <main
      ref="previewAreaRef"
      class="paper-preview-area"
      :class="{ 'is-grabbing': isPanning, 'can-grab': isSpacePressed }"
      @mousedown="handleMouseDown"
    >
      <!-- Hidden Measurement Sandbox to measure exact rendered problem heights -->
      <div
        ref="measureSandboxRef"
        class="measure-sandbox"
        :class="[
          `size-${config.paperSize.toLowerCase()}`,
          `margin-${config.margin}`,
        ]"
        :style="{
          '--paper-font-size': `${config.fontSize}px`,
          '--paper-line-height': currentLineHeight,
          '--problem-margin-bottom': `${currentProblemMarginBottom}px`,
          '--sub-item-margin-bottom': currentSubItemMargin,
        }"
        aria-hidden="true"
      >
        <div
          v-for="(prob, idx) in printCart"
          :key="prob.uuid"
          :data-uuid="prob.uuid"
          class="paper-problem-wrapper measure-item"
        >
          <div
            class="problem-render-body selectable"
            v-html="formatProblemForExam(prob.raw_html, idx + 1)"
          ></div>
        </div>
      </div>

      <div v-if="printCart.length === 0" class="canvas-empty no-print">
        <div class="empty-icon">
          <FileDown :size="52" stroke-width="1.5" />
        </div>
        <h3>打印篮暂无错题</h3>
        <p>请前往「错题库」勾选需要重新练习的错题，然后在此排版打印。</p>
        <button class="btn-primary" @click="$emit('nav', 'library')">
          去错题库挑选错题
        </button>
      </div>

      <!-- Paper Preview Container (Multi-Page Discrete Sheets) -->
      <div
        v-else
        class="paper-scroll-wrapper"
      >
        <div
          class="paper-zoom-container"
          :style="{
            width: `${scaledPaperWidth}px`,
            height: `${scaledContentHeight}px`,
          }"
        >
          <div
            class="paper-zoom-scaler"
            :style="{
              width: `${paperBaseWidthPx}px`,
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: 'top left',
            }"
          >
            <div class="paper-pages-column">
              <div
                v-for="page in paginatedPages"
                :key="page.pageNumber"
                class="paper-sheet"
                :class="[
                  `size-${config.paperSize.toLowerCase()}`,
                  `margin-${config.margin}`,
                  { 'auto-fit-page': config.autoFitSinglePage }
                ]"
                :style="{
                  '--paper-font-size': `${config.fontSize}px`,
                  '--paper-line-height': currentLineHeight,
                  '--problem-margin-bottom': `${currentProblemMarginBottom}px`,
                  '--sub-item-margin-bottom': currentSubItemMargin,
                }"
              >
                <div class="sheet-main-content">
                  <!-- Paper Header (Left-aligned with black divider line, only on Page 1) -->
                  <header
                    v-if="page.isFirstPage && (config.title.trim() || config.subtitle.trim())"
                    class="paper-header"
                  >
                    <h1 v-if="config.title.trim()" class="paper-main-title">{{ config.title.trim() }}</h1>
                    <div v-if="config.subtitle.trim()" class="paper-sub-title">{{ config.subtitle.trim() }}</div>
                  </header>

                  <!-- Questions List for this page -->
                  <div class="paper-problems-flow">
                    <div
                      v-for="item in page.items"
                      :key="item.problem.uuid"
                      class="paper-problem-wrapper"
                      :style="{ marginBottom: `${getProblemSpacing(item.problem.uuid)}px` }"
                    >
                      <!-- Problem Body with index number matching stem font size, KaTeX, SVG & Table -->
                      <div
                        class="problem-render-body selectable"
                        v-html="formatProblemForExam(item.problem.raw_html, item.index + 1)"
                      ></div>

                      <!-- Interactive Answer Space Resizer Handle -->
                      <AnswerSpaceHandle
                        :space="getProblemSpacing(item.problem.uuid)"
                        :remaining-page-height="getItemRemainingSpace(page, item.problem.uuid)"
                        @update:space="setProblemSpacing(item.problem.uuid, $event)"
                        @reset="resetProblemSpacing(item.problem.uuid)"
                      />
                    </div>
                  </div>

                </div>

                <!-- Page Footer (第 X 页 / 共 Y 页) -->
                <footer v-if="config.showPageNumber" class="paper-page-footer">
                  第 {{ page.pageNumber }} 页 / 共 {{ paginatedPages.length }} 页
                </footer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Floating Zoom Controls: Permanently Fixed in Bottom-Right -->
    <div class="zoom-floating-toolbar no-print">
      <button
        class="zoom-btn"
        title="缩小"
        :disabled="zoomLevel <= 30"
        @click="zoomLevel = Math.max(30, zoomLevel - 5)"
      >
        <Minus :size="15" />
      </button>
      <button
        class="zoom-reset-btn"
        title="点击自适应预览窗口宽度"
        @click="handleFitWidth"
      >
        {{ zoomLevel }}%
      </button>
      <button
        class="zoom-btn"
        title="放大"
        :disabled="zoomLevel >= 200"
        @click="zoomLevel = Math.min(200, zoomLevel + 5)"
      >
        <Plus :size="15" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import type { Problem, PaperConfig } from '../types/problem';
import { formatProblemForExam } from '../utils/examFormatter';
import { apiExportPdfDirect } from '../utils/api';
import { FileDown, Plus, Minus, ArrowUp, ArrowDown, Trash2 } from 'lucide-vue-next';
import katexCss from 'katex/dist/katex.min.css?raw';
import AnswerSpaceHandle from '../components/canvas/AnswerSpaceHandle.vue';
import { applyAdaptiveRowScaling, getAvailableContentWidthPx } from '../utils/printAdaptiveFitter';

const props = defineProps<{
  printCart: Problem[];
}>();

const emit = defineEmits<{
  (e: 'nav', tab: string): void;
  (e: 'clearCart'): void;
  (e: 'removeFromCart', uuid: string): void;
  (e: 'moveUp', index: number): void;
  (e: 'moveDown', index: number): void;
  (e: 'notify', msg: string): void;
}>();

const zoomLevel = ref(85);
const isExportingPdf = ref(false);

const config = reactive<PaperConfig>({
  title: '',
  subtitle: '',
  paperSize: 'A4',
  margin: 'compact', // 10mm 12mm 最佳印刷视口
  fontSize: 10, // 默认 10px，支持 7px-15px 有级滑块调节
  lineSpacing: 'compact', // 紧凑 (1.32), 标准 (1.50), 宽松 (1.68)
  problemSpacing: 'standard', // 紧凑 (18px), 标准 (26px), 宽松 (38px)
  autoFitSinglePage: true, // 默认开启智能吸附
  showDate: false,
  showSubjectHeader: false,
  showPageNumber: true, // 默认开启页码
  customProblemSpacings: {},
});

const customSpacings = ref<Record<string, number>>({});

function getProblemSpacing(uuid: string): number {
  if (customSpacings.value[uuid] !== undefined) {
    return customSpacings.value[uuid];
  }
  return currentProblemMarginBottom.value;
}

function setProblemSpacing(uuid: string, val: number) {
  customSpacings.value[uuid] = Math.round(val);
  config.customProblemSpacings = { ...customSpacings.value };
  updateMeasuredHeights();
}

function resetProblemSpacing(uuid: string) {
  delete customSpacings.value[uuid];
  config.customProblemSpacings = { ...customSpacings.value };
  updateMeasuredHeights();
}

const hasCustomSpacings = computed(() => Object.keys(customSpacings.value).length > 0);

function resetAllCustomSpacings() {
  customSpacings.value = {};
  config.customProblemSpacings = {};
  updateMeasuredHeights();
}

const currentLineHeight = computed(() => {
  switch (config.lineSpacing) {
    case 'compact': return '1.32';
    case 'standard': return '1.50';
    case 'spacious': return '1.68';
    default: return '1.50';
  }
});

const currentProblemMarginBottom = computed(() => {
  switch (config.problemSpacing) {
    case 'compact': return 18;
    case 'standard': return 26;
    case 'spacious': return 38;
    default: return 26;
  }
});

const currentSubItemMargin = computed(() => {
  switch (config.lineSpacing) {
    case 'compact': return '2px';
    case 'standard': return '4px';
    case 'spacious': return '6px';
    default: return '4px';
  }
});

const paperBaseWidthPx = computed(() => (config.paperSize === 'B5' ? 176 * 3.7795 : 210 * 3.7795));
const paperBaseHeightPx = computed(() => (config.paperSize === 'B5' ? 250 * 3.7795 : 297 * 3.7795));

const scaledPaperWidth = computed(() => {
  return Math.round(paperBaseWidthPx.value * (zoomLevel.value / 100));
});

const totalContentHeightPx = computed(() => {
  const count = paginatedPages.value.length || 1;
  const gap = 28;
  return count * paperBaseHeightPx.value + (count - 1) * gap + 60;
});

const scaledContentHeight = computed(() => {
  return Math.round(totalContentHeightPx.value * (zoomLevel.value / 100));
});

interface PageItem {
  problem: Problem;
  index: number; // 0-based global index in printCart
}

interface PageData {
  pageNumber: number;
  items: PageItem[];
  isFirstPage: boolean;
  remainingHeight: number;
}

function getItemRemainingSpace(page: PageData, uuid: string): number {
  const currentSp = getProblemSpacing(uuid);
  return Math.round(currentSp + (page.remainingHeight || 0));
}

const problemHeights = ref<Record<string, number>>({});
const measureSandboxRef = ref<HTMLElement | null>(null);
const previewAreaRef = ref<HTMLElement | null>(null);

function updateMeasuredHeights() {
  if (!measureSandboxRef.value) return;
  const items = measureSandboxRef.value.querySelectorAll<HTMLElement>('.measure-item');
  const heights: Record<string, number> = {};
  items.forEach((el) => {
    const uuid = el.getAttribute('data-uuid');
    if (uuid) {
      const mb = customSpacings.value[uuid] !== undefined
        ? customSpacings.value[uuid]
        : currentProblemMarginBottom.value;
      heights[uuid] = el.offsetHeight + mb;
    }
  });
  problemHeights.value = heights;

  nextTick(() => {
    if (previewAreaRef.value) {
      const metrics = {
        paperWidthMm: config.paperSize === 'B5' ? 176 : 210,
        paddingMm: config.margin === 'compact' ? 12 : config.margin === 'spacious' ? 18 : 15,
      };
      const availPx = getAvailableContentWidthPx(metrics);
      applyAdaptiveRowScaling(previewAreaRef.value, availPx);
    }
  });
}


watch(
  () => [
    props.printCart,
    config.paperSize,
    config.margin,
    config.fontSize,
    config.lineSpacing,
    config.problemSpacing,
    config.autoFitSinglePage,
  ],
  () => {
    nextTick(() => {
      updateMeasuredHeights();
    });
  },
  { deep: true, immediate: true }
);

function handleFitWidth() {
  if (!previewAreaRef.value) return;
  const availableWidth = previewAreaRef.value.clientWidth - 48;
  if (availableWidth <= 0) return;
  const targetScale = availableWidth / paperBaseWidthPx.value;
  const newZoom = Math.min(200, Math.max(30, Math.round(targetScale * 100)));
  zoomLevel.value = newZoom;
}

const isPanning = ref(false);
const isSpacePressed = ref(false);
let startX = 0;
let startY = 0;
let scrollStartLeft = 0;
let scrollStartTop = 0;

function handleMouseDown(e: MouseEvent) {
  if ((isSpacePressed.value && e.button === 0) || e.button === 1) {
    e.preventDefault();
    if (!previewAreaRef.value) return;
    isPanning.value = true;
    startX = e.clientX;
    startY = e.clientY;
    scrollStartLeft = previewAreaRef.value.scrollLeft;
    scrollStartTop = previewAreaRef.value.scrollTop;
  }
}

function handleMouseMove(e: MouseEvent) {
  if (!isPanning.value || !previewAreaRef.value) return;
  e.preventDefault();
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  previewAreaRef.value.scrollLeft = scrollStartLeft - dx;
  previewAreaRef.value.scrollTop = scrollStartTop - dy;
}

function handleMouseUp() {
  isPanning.value = false;
}

function handleKeyDown(e: KeyboardEvent) {
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
    return;
  }
  if (e.code === 'Space' && !e.repeat) {
    isSpacePressed.value = true;
  }
}

function handleKeyUp(e: KeyboardEvent) {
  if (e.code === 'Space') {
    isSpacePressed.value = false;
    isPanning.value = false;
  }
}

let gestureStartZoom = 85;

function handleGestureStart(e: any) {
  e.preventDefault();
  gestureStartZoom = zoomLevel.value;
}

function handleGestureChange(e: any) {
  e.preventDefault();
  if (typeof e.scale === 'number') {
    const nextZoom = Math.round(gestureStartZoom * e.scale);
    zoomLevel.value = Math.min(200, Math.max(30, nextZoom));
  }
}

function handleGestureEnd(e: any) {
  e.preventDefault();
}

function handleWheel(e: WheelEvent) {
  if (e.ctrlKey) {
    e.preventDefault();
    const factor = 1 - e.deltaY * 0.01;
    const nextZoom = Math.round(zoomLevel.value * factor);
    zoomLevel.value = Math.min(200, Math.max(30, nextZoom));
  }
}

onMounted(() => {
  nextTick(() => {
    updateMeasuredHeights();
  });

  const el = previewAreaRef.value;
  if (el) {
    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('gesturestart', handleGestureStart as any, { passive: false });
    el.addEventListener('gesturechange', handleGestureChange as any, { passive: false });
    el.addEventListener('gestureend', handleGestureEnd as any, { passive: false });
  }

  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
});

onUnmounted(() => {
  const el = previewAreaRef.value;
  if (el) {
    el.removeEventListener('wheel', handleWheel);
    el.removeEventListener('gesturestart', handleGestureStart as any);
    el.removeEventListener('gesturechange', handleGestureChange as any);
    el.removeEventListener('gestureend', handleGestureEnd as any);
  }

  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', handleMouseUp);
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
});

const paginatedPages = computed<PageData[]>(() => {
  if (props.printCart.length === 0) return [];

  // Determine physical page height in px at 96 DPI: 1mm = 96 / 25.4 = 3.7795px
  const isB5 = config.paperSize === 'B5';
  const totalPageHeightPx = isB5 ? 250 * 3.7795 : 297 * 3.7795;

  // Vertical padding in px
  const paddingMm = config.margin === 'compact' ? 20 : config.margin === 'spacious' ? 32 : 24;
  const paddingYPx = paddingMm * 3.7795;

  const footerHeightPx = config.showPageNumber ? 32 : 0;

  // Header height on Page 1 if title or subtitle is non-empty
  const hasHeader = !!(config.title.trim() || config.subtitle.trim());
  let headerHeightPx = 0;
  if (hasHeader) {
    headerHeightPx = 28; // border + margin + padding
    if (config.title.trim()) headerHeightPx += 26;
    if (config.subtitle.trim()) headerHeightPx += 18;
  }

  // Usable height
  const maxH_first = totalPageHeightPx - paddingYPx - headerHeightPx - footerHeightPx;
  const maxH_other = totalPageHeightPx - paddingYPx - footerHeightPx;

  const pages: PageData[] = [];
  let currentItems: PageItem[] = [];
  let currentHeight = 0;

  for (let i = 0; i < props.printCart.length; i++) {
    const prob = props.printCart[i];
    const h = problemHeights.value[prob.uuid] || 150;
    const maxAllowed = pages.length === 0 ? maxH_first : maxH_other;

    if (currentItems.length > 0 && currentHeight + h > maxAllowed) {
      pages.push({
        pageNumber: pages.length + 1,
        items: currentItems,
        isFirstPage: pages.length === 0,
        remainingHeight: Math.max(0, maxAllowed - currentHeight),
      });
      currentItems = [];
      currentHeight = 0;
    }

    currentItems.push({ problem: prob, index: i });
    currentHeight += h;
  }

  if (currentItems.length > 0) {
    const maxAllowed = pages.length === 0 ? maxH_first : maxH_other;
    pages.push({
      pageNumber: pages.length + 1,
      items: currentItems,
      isFirstPage: pages.length === 0,
      remainingHeight: Math.max(0, maxAllowed - currentHeight),
    });
  }

  return pages;
});

function generateFullPrintHtml(): string {
  const paperSizeRule = config.paperSize === 'B5' ? '176mm 250mm' : 'A4';
  const paperWidthCss = config.paperSize === 'B5' ? '176mm' : '210mm';
  const paperHeightCss = config.paperSize === 'B5' ? '250mm' : '297mm';
  const marginPadding = config.margin === 'compact'
    ? '10mm 12mm'
    : config.margin === 'spacious'
      ? '16mm 18mm'
      : '12mm 15mm';
  const fontSize = `${config.fontSize}px`;
  const lineHeight = currentLineHeight.value;
  const problemMarginBottom = `${currentProblemMarginBottom.value}px`;
  const subItemMarginBottom = currentSubItemMargin.value;
  const totalPages = paginatedPages.value.length || 1;

  const pagesHtml = paginatedPages.value.map((page) => {
    const headerHtml = (page.isFirstPage && (config.title.trim() || config.subtitle.trim())) ? `
      <div class="paper-header">
        ${config.title.trim() ? `<div class="paper-main-title">${config.title.trim()}</div>` : ''}
        ${config.subtitle.trim() ? `<div class="paper-sub-title">${config.subtitle.trim()}</div>` : ''}
      </div>
    ` : '';

    const problemsHtml = page.items.map((item) => {
      const mb = customSpacings.value[item.problem.uuid] !== undefined
        ? `${customSpacings.value[item.problem.uuid]}px`
        : problemMarginBottom;
      return `
      <div class="paper-problem-wrapper" style="margin-bottom: ${mb};">
        ${formatProblemForExam(item.problem.raw_html, item.index + 1)}
      </div>
    `;
    }).join('\n');

    const footerHtml = config.showPageNumber ? `
      <div class="paper-page-footer">
        第 ${page.pageNumber} 页 / 共 ${totalPages} 页
      </div>
    ` : '';

    return `
      <div class="exam-page">
        <div class="sheet-main-content">
          ${headerHtml}
          <div class="paper-problems-flow">
            ${problemsHtml}
          </div>
        </div>
        ${footerHtml}
      </div>
    `;
  }).join('\n');


  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${config.title.trim() || '错题重练专项卷'}</title>
  <style>
    @page {
      size: ${paperSizeRule};
      margin: 0;
    }
    ${katexCss}
    *, *::before, *::after {
      box-sizing: border-box;
    }
    .katex, .katex * {
      box-sizing: content-box !important;
    }
    .katex {
      line-height: 1.2 !important;
      text-indent: 0 !important;
    }
    .sub-item .katex, p .katex, div .katex {
      font-size: 1.12em;
    }
    :root {
      --paper-font-size: ${fontSize};
    }
    html {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      box-sizing: border-box;
      margin: 0 auto;
      padding: 0;
      width: ${paperWidthCss};
      min-height: ${paperHeightCss};
      background: #ffffff;
      color: #000000;
      font-size: ${fontSize};
      --paper-font-size: ${fontSize};
      line-height: ${lineHeight};
      ${config.autoFitSinglePage ? 'letter-spacing: -0.15px;' : ''}
    }
    .exam-page {
      box-sizing: border-box;
      width: ${paperWidthCss};
      height: ${paperHeightCss};
      max-height: ${paperHeightCss};
      padding: ${marginPadding};
      overflow: hidden;
      page-break-after: always;
      break-after: page;
      background: #ffffff;
      color: #000000;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
    }
    .sheet-main-content {
      flex: 1;
    }
    .paper-sheet,
    .problem-body,
    .problem-render-body,
    .sub-item {
      font-size: ${fontSize} !important;
      line-height: ${lineHeight} !important;
    }
    .paper-header {
      text-align: left;
      padding-bottom: 8px;
      border-bottom: 2px solid #000000;
      margin-bottom: 14px;
    }
    .paper-main-title {
      font-size: 18px;
      font-weight: 700;
      margin: 0 0 4px 0;
      letter-spacing: 1px;
      text-align: left;
    }
    .paper-sub-title {
      font-size: 12px;
      margin: 0;
      color: #333;
      text-align: left;
    }
    .paper-problem-wrapper {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      margin-bottom: ${problemMarginBottom};
    }
    .index-num {
      font-size: ${fontSize} !important;
      font-weight: 700 !important;
      margin-right: 3px;
    }
    .problem-lead-index {
      margin-bottom: 4px;
    }
    .sub-prompt { font-weight: bold; margin: 4px 0 2px 0; }
    .sub-item {
      margin-bottom: ${subItemMarginBottom};
      line-height: ${lineHeight};
      text-indent: -1.2em;
      padding-left: 1.2em;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .blank {
      border-bottom: 1.3px solid #000;
      display: inline-block;
      vertical-align: baseline;
      margin: 0 3px;
      height: 0.85em;
    }
    .blank-sm { width: 45px; }
    .blank-md { width: 85px; }
    .blank-lg { width: 140px; }
    .blank-xl { width: 210px; }
    .options {
      margin: 6px 0;
      padding-left: 4px;
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 4px 16px !important;
      align-items: baseline;
    }
    .options-grid.options-4-col,
    .options.options-4-col {
      display: flex !important;
      flex-direction: row !important;
      flex-wrap: nowrap !important;
      align-items: baseline !important;
      column-gap: 28px !important;
      row-gap: 4px !important;
    }
    .options-grid.options-2-col,
    .options.options-2-col {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 4px 16px !important;
      align-items: baseline;
    }
    .options-grid.options-1-col,
    .options.options-1-col {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 4px !important;
      align-items: baseline;
    }
    .options-4-col > span {
      white-space: nowrap !important;
      flex: 0 0 auto !important;
    }
    .options > span {
      display: block;
      box-sizing: border-box;
      min-width: 0;
      word-break: break-word;
    }
    table {
      width: 96%;
      margin: 6px auto;
      border-collapse: collapse;
      font-size: 11px;
      line-height: 1.35;
      border-top: 1.8px solid #000;
      border-bottom: 1.8px solid #000;
      text-align: center;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    thead tr { border-bottom: 1.2px solid #000; background-color: #f8f9fa; }
    th { padding: 3px 6px; font-weight: bold; }
    td { padding: 3px 6px; border-bottom: 0.5px solid #ccc; }
    tbody tr:last-child td { border-bottom: none; }
    /* 一题多图 / 表格与图片同行并排容器 */
    .exam-images-row {
      display: flex !important;
      flex-direction: row !important;
      justify-content: center !important;
      align-items: center !important;
      flex-wrap: nowrap !important;
      gap: 16px !important;
      margin: 10px auto !important;
      width: 100% !important;
      box-sizing: border-box !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .exam-images-row > .img,
    .exam-images-row > table,
    .exam-images-row > .table-wrap {
      margin: 0 !important;
      min-width: 120px !important;
      max-width: calc(100% - 136px) !important;
      box-sizing: border-box !important;
      flex: 1 1 0;
    }
    .exam-images-row > table,
    .exam-images-row > .table-wrap table {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 auto !important;
      font-size: 11px !important;
    }
    .exam-images-row .img svg,
    .exam-images-row .img img {
      max-width: 100% !important;
      max-height: 180px !important;
      width: auto !important;
      height: auto !important;
      display: inline-block !important;
      object-fit: contain !important;
    }
    .exam-atomic-phrase {
      display: inline-block !important;
      white-space: nowrap !important;
      word-break: keep-all !important;
    }
    .exam-row-group {
      display: flex !important;
      flex-direction: row !important;
      justify-content: center !important;
      align-items: center !important;
      flex-wrap: nowrap !important;
      gap: 16px !important;
      margin: 8px auto !important;
      width: 100% !important;
      box-sizing: border-box !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .exam-row-group > * {
      flex: 1 1 0% !important;
      max-width: 100% !important;
    }
    .exam-row-group svg {
      width: 100% !important;
      height: auto !important;
    }
    .img {

      text-align: center;
      margin: 8px auto;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      display: flex;
      justify-content: center;
      align-items: center;
      flex-wrap: wrap;
      gap: 14px;
    }
    .img svg {
      max-width: min(100%, 460px);
      max-height: 150px;
      width: auto;
      height: auto;
      display: inline-block;
      ${config.autoFitSinglePage ? 'transform: scale(0.92); transform-origin: center;' : ''}
    }
    .paper-page-footer {
      text-align: center;
      font-size: 11px;
      color: #555;
      padding-top: 10px;
      margin-top: auto;
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`;
}

async function handleExportPdfDirect() {
  if (props.printCart.length === 0 || isExportingPdf.value) return;
  isExportingPdf.value = true;
  try {
    const html = generateFullPrintHtml();
    const title = config.title.trim() || '错题重练专项卷';
    const savedPath = await apiExportPdfDirect(html, title);
    if (savedPath) {
      emit('notify', `已成功导出矢量 PDF 试卷至：${savedPath}`);
    }
  } catch (err: any) {
    console.error('Direct PDF export error:', err);
    emit('notify', `导出 PDF 失败: ${err?.message || err}`);
  } finally {
    isExportingPdf.value = false;
  }
}
</script>

<style scoped>
.print-view {
  height: 100%;
  display: flex;
  overflow: hidden;
  background-color: var(--md-sys-color-surface-dim, #ded8e1);
}

[data-theme="dark"] .print-view {
  background-color: var(--md-sys-color-surface-container-low, #181c21);
}

.print-sidebar {
  width: 320px;
  background-color: var(--md-sys-color-surface-container-low);
  border-right: 1px solid var(--md-sys-color-outline-variant);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  z-index: 5;
  height: 100%;
}

.sidebar-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--md-sys-color-surface-container-low);
  -webkit-app-region: drag;
  user-select: none;
}

.sidebar-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--md-sys-color-on-surface);
  letter-spacing: -0.2px;
}

.basket-count {
  font-size: 11px;
  font-weight: 700;
  background-color: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
  padding: 3px 10px;
  border-radius: var(--md-shape-corner-full);
  letter-spacing: 0.2px;
}

.sidebar-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.setting-group-basket {
  flex: 1;
  min-height: 180px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 1;
  margin-top: 4px;
}

.setting-label {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--md-sys-color-on-surface-variant);
  letter-spacing: 0.25px;
  margin: 0;
}

.setting-header-with-value {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
}

.slider-val-badge {
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  padding: 2px 8px;
  border-radius: var(--md-shape-corner-full);
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}

.m3-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--md-sys-color-surface-container-highest);
  outline: none;
  margin: 8px 0;
  cursor: pointer;
}

.m3-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--md-sys-color-primary);
  cursor: pointer;
  box-shadow: var(--md-elevation-1);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.m3-slider::-webkit-slider-thumb:hover {
  transform: scale(1.18);
  box-shadow: var(--md-elevation-2);
}

.m3-input {
  width: 100%;
  height: 38px;
  border: 1px solid var(--md-sys-color-outline);
  border-radius: var(--md-shape-corner-sm);
  background-color: var(--md-sys-color-surface-container-lowest);
  padding: 0 12px;
  font-size: 13px;
  color: var(--md-sys-color-on-surface);
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.m3-input:hover {
  border-color: var(--md-sys-color-on-surface);
}

.m3-input:focus {
  border-color: var(--md-sys-color-primary);
  box-shadow: 0 0 0 2px var(--md-sys-color-primary-container);
}

.m3-input::placeholder {
  color: var(--md-sys-color-outline);
}

.segmented-control {
  display: flex;
  border: 1px solid var(--md-sys-color-outline);
  border-radius: var(--md-shape-corner-full);
  overflow: hidden;
  background: transparent;
  height: 34px;
  box-sizing: border-box;
}

.segment-btn {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 12px;
  font-weight: 500;
  color: var(--md-sys-color-on-surface-variant);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-right: 1px solid var(--md-sys-color-outline);
  white-space: nowrap;
}

.segment-btn:last-child {
  border-right: none;
}

.segment-btn:hover:not(.active) {
  background-color: rgba(var(--md-sys-color-on-surface), 0.06);
  color: var(--md-sys-color-on-surface);
}

.segment-btn.active {
  background-color: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
  font-weight: 700;
}

.basket-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
}

.btn-clear {
  font-size: 11px;
  color: var(--md-sys-color-error);
  font-weight: 600;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: var(--md-shape-corner-xs);
  transition: background-color 0.15s;
}

.btn-clear:hover {
  background-color: var(--md-sys-color-error-container);
}

.empty-basket {
  font-size: 12px;
  color: var(--md-sys-color-outline);
  padding: 24px 16px;
  text-align: center;
  background: var(--md-sys-color-surface-container);
  border-radius: var(--md-shape-corner-md);
  border: 1px dashed var(--md-sys-color-outline-variant);
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.basket-items-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
}

.basket-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: var(--md-sys-color-surface-container-lowest);
  border-radius: var(--md-shape-corner-md);
  border: 1px solid var(--md-sys-color-outline-variant);
  gap: 8px;
  transition: all 0.2s ease;
}

.basket-item-row:hover {
  background: var(--md-sys-color-surface-container);
  border-color: var(--md-sys-color-outline);
  box-shadow: var(--md-elevation-1);
}

.item-leading {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.item-badge {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.item-summary {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--md-sys-color-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-btns {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.btn-icon {
  width: 26px;
  height: 26px;
  border-radius: var(--md-shape-corner-full);
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--md-sys-color-on-surface-variant);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-icon:hover:not(:disabled) {
  background: var(--md-sys-color-surface-container-highest);
  color: var(--md-sys-color-on-surface);
}

.btn-icon:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

.btn-icon-remove:hover:not(:disabled) {
  background: var(--md-sys-color-error-container);
  color: var(--md-sys-color-error);
}

.sidebar-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--md-sys-color-outline-variant);
  background-color: var(--md-sys-color-surface-container-low);
}

.btn-print-action {
  width: 100%;
  height: 44px;
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border-radius: var(--md-shape-corner-full);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13.5px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  box-shadow: var(--md-elevation-1);
  transition: all 0.2s ease;
}

.btn-print-action:hover:not(:disabled) {
  box-shadow: var(--md-elevation-2);
  filter: brightness(1.08);
}

.btn-print-action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Paper Preview Scroll Area */
.paper-preview-area {
  flex: 1;
  overflow: auto;
  padding: 30px 20px 60px 20px;
  display: block;
  position: relative;
}

.paper-preview-area.can-grab {
  cursor: grab !important;
  user-select: none;
}

.paper-preview-area.is-grabbing {
  cursor: grabbing !important;
  user-select: none;
}

.zoom-floating-toolbar {
  position: absolute;
  bottom: 24px;
  right: 28px;
  display: flex;
  align-items: center;
  background-color: var(--md-sys-color-surface-container-highest);
  border: 1px solid var(--md-sys-color-outline-variant);
  box-shadow: var(--md-elevation-3);
  border-radius: var(--md-shape-corner-full);
  padding: 4px 6px;
  gap: 4px;
  z-index: 50;
  backdrop-filter: blur(16px);
}

.zoom-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--md-sys-color-on-surface);
  cursor: pointer;
  transition: background-color 0.15s;
}

.zoom-btn:hover:not(:disabled) {
  background-color: var(--md-sys-color-surface-container-high);
}

.zoom-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.zoom-reset-btn {
  font-size: 11px;
  font-weight: 700;
  color: var(--md-sys-color-primary);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 12px;
  font-variant-numeric: tabular-nums;
  min-width: 44px;
  text-align: center;
  transition: background-color 0.15s;
}

.zoom-reset-btn:hover {
  background-color: var(--md-sys-color-surface-container-high);
}

.canvas-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
  gap: 16px;
  text-align: center;
  max-width: 400px;
  margin: 100px auto 0 auto;
}

.canvas-empty .empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--md-sys-color-primary);
  opacity: 0.8;
}

.btn-primary {
  padding: 10px 20px;
  border-radius: var(--md-shape-corner-full);
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  font-size: 14px;
  font-weight: 700;
  border: none;
  cursor: pointer;
}

.paper-scroll-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 100%;
}

.paper-zoom-container {
  margin: 0 auto;
  flex-shrink: 0;
  position: relative;
}

.paper-zoom-scaler {
  flex-shrink: 0;
  transform-origin: top left;
}

/* 隐藏的实测沙盒容器（用于在离屏高保真度计算各题真实物理高度） */
.measure-sandbox {
  position: absolute;
  top: -99999px;
  left: -99999px;
  visibility: hidden;
  pointer-events: none;
  box-sizing: border-box;
}
.measure-sandbox.size-a4 { width: 210mm; }
.measure-sandbox.size-b5 { width: 176mm; }
.measure-sandbox.margin-compact { padding: 10mm 12mm; }
.measure-sandbox.margin-normal { padding: 12mm 15mm; }
.measure-sandbox.margin-spacious { padding: 16mm 18mm; }

.paper-pages-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  padding-bottom: 60px;
}

/* 核心物理纸张容器：保证每一页独立呈现，完全规避跨页切断与上边距丢失 */
.paper-sheet {
  position: relative;
  background-color: #ffffff !important;
  color: #000000 !important;
  box-shadow: 0 4px 20px 2px rgba(0, 0, 0, 0.22);
  box-sizing: border-box;
  width: 210mm;
  height: 297mm;
  border-radius: 3px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  font-size: var(--paper-font-size, 10px);
  line-height: var(--paper-line-height, 1.5);
}

.paper-sheet.size-a4 {
  width: 210mm;
  height: 297mm;
}
.paper-sheet.size-b5 {
  width: 176mm;
  height: 250mm;
}

.paper-sheet.margin-compact { padding: 10mm 12mm; }
.paper-sheet.margin-normal { padding: 12mm 15mm; }
.paper-sheet.margin-spacious { padding: 16mm 18mm; }

.sheet-main-content {
  flex: 1;
}

/* 主副标题靠左对齐，保留 2px 纯黑分割线 */
.paper-header {
  text-align: left;
  padding-bottom: 8px;
  border-bottom: 2px solid #000000;
  margin-bottom: 14px;
}

.paper-main-title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 1px;
  margin: 0 0 4px 0;
  text-align: left;
}

.paper-sub-title {
  font-size: 12px;
  margin: 0;
  color: #333;
  text-align: left;
}

.paper-problems-flow {
  display: flex;
  flex-direction: column;
  flex: 1;
}

/* 题目间留白支持动态题间距 */
.paper-problem-wrapper {
  break-inside: avoid;
  page-break-inside: avoid;
  margin-bottom: var(--problem-margin-bottom, 26px);
}

.sub-item {
  margin-bottom: var(--sub-item-margin-bottom, 4px) !important;
  line-height: var(--paper-line-height, 1.5) !important;
}

/* 题号样式与题干字号 100% 严格一致并加粗 */
.index-num {
  font-size: var(--paper-font-size, 10px) !important;
  font-weight: 700 !important;
  margin-right: 3px;
}

.problem-lead-index {
  margin-bottom: 4px;
}

/* 试卷底端页码：第 X 页 / 共 Y 页 */
.paper-page-footer {
  text-align: center;
  font-size: 11px;
  color: #555;
  padding-top: 10px;
  margin-top: auto;
  letter-spacing: 1px;
}

/* M3 开关控件样式 */
.setting-header-with-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.m3-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 26px;
  cursor: pointer;
}

.m3-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.m3-switch-track {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--md-sys-color-surface-container-highest);
  border: 1.5px solid var(--md-sys-color-outline);
  border-radius: 26px;
  transition: all 0.2s ease;
}

.m3-switch-thumb {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 3px;
  top: 3.5px;
  background-color: var(--md-sys-color-outline);
  border-radius: 50%;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.m3-switch input:checked + .m3-switch-track {
  background-color: var(--md-sys-color-primary);
  border-color: var(--md-sys-color-primary);
}

.m3-switch input:checked + .m3-switch-track .m3-switch-thumb {
  transform: translateX(18px);
  background-color: var(--md-sys-color-on-primary);
}

/* 一题多图 / 表格与图片同行并排样式穿透 */
:deep(.exam-images-row) {
  display: flex !important;
  flex-direction: row !important;
  justify-content: center !important;
  align-items: center !important;
  flex-wrap: nowrap !important;
  gap: 16px !important;
  margin: 10px auto !important;
  width: 100% !important;
  box-sizing: border-box !important;
  break-inside: avoid !important;
  page-break-inside: avoid !important;
}

:deep(.exam-images-row > .img),
:deep(.exam-images-row > table),
:deep(.exam-images-row > .table-wrap) {
  margin: 0 !important;
  min-width: 120px !important;
  max-width: calc(100% - 136px) !important;
  box-sizing: border-box !important;
  flex: 1 1 0;
}

:deep(.exam-images-row > table),
:deep(.exam-images-row > .table-wrap table) {
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 auto !important;
  font-size: 11px !important;
}

:deep(.exam-images-row .img svg),
:deep(.exam-images-row .img img) {
  max-width: 100% !important;
  max-height: 180px !important;
  width: auto !important;
  height: auto !important;
  display: inline-block !important;
  object-fit: contain !important;
}

:deep(.exam-atomic-phrase) {
  display: inline-block !important;
  white-space: nowrap !important;
  word-break: keep-all !important;
}

:deep(.exam-row-group) {
  display: flex !important;
  flex-direction: row !important;
  justify-content: center !important;
  align-items: center !important;
  flex-wrap: nowrap !important;
  gap: 16px !important;
  margin: 8px auto !important;
  width: 100% !important;
  box-sizing: border-box !important;
}

:deep(.exam-row-group > *) {
  flex: 1 1 0% !important;
  max-width: 100% !important;
}

:deep(.exam-row-group svg) {
  width: 100% !important;
  height: auto !important;
}
</style>

