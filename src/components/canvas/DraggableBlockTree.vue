<template>
  <div class="m3-block-tree">
    <div
      v-for="(block, index) in blocks"
      :key="block.id"
      class="canvas-block-row"
      :class="{
        'is-dragging': draggedIndex === index,
        'drop-target-before': dropTargetIndex === index && dropPosition === 'before',
        'drop-target-after': dropTargetIndex === index && dropPosition === 'after',
        'drop-target-group': dropTargetIndex === index && dropPosition === 'group',
      }"
    >
      <!-- Block Controls & Drag Grip Handle -->
      <div class="block-grip-bar">
        <button
          type="button"
          class="grip-handle"
          title="按住拖拽调整前后顺序；拖至图片/表格旁可合并并排"
          draggable="true"
          @dragstart="onDragStart($event, index)"
          @dragend="onDragEnd"
        >
          <GripVertical :size="15" />
        </button>
        <span class="block-type-pill">{{ getBlockTypeLabel(block.type) }}</span>

        <div class="block-quick-actions">
          <button
            v-if="block.type === 'row_group'"
            type="button"
            class="action-mini-btn"
            title="拆解为独立多行"
            @click="splitRowGroup(index)"
          >
            <Split :size="13" />
            <span>拆分</span>
          </button>
          <button
            type="button"
            class="action-mini-btn btn-del"
            title="删除此块"
            @click="removeBlock(index)"
          >
            <Trash2 :size="13" />
          </button>
        </div>
      </div>

      <!-- Drop Insertion Indicator Line -->
      <div
        class="block-drop-zone"
        @dragover.prevent="onDragOver($event, index)"
        @dragleave="onDragLeave"
        @drop.prevent="onDrop($event, index)"
      >
        <!-- 1. Lead Text Block (主述与文字) -->
        <div
          v-if="block.type === 'lead_text'"
          class="block-body lead-text-body"
        >
          <div
            class="editable-text-field"
            contenteditable="true"
            @blur="onLeadTextBlur($event, block)"
            @click="checkFormulaClick($event, block)"
            v-html="renderLatexInHtml(block.contentHtml)"
          ></div>
        </div>

        <!-- 2. SVG Image Block (单张配图) -->
        <div
          v-else-if="block.type === 'svg_img'"
          class="block-body media-block-body"
        >
          <ResizableBlock
            :width="block.nominalWidth || 360"
            :aspect-ratio="block.aspectRatio || 1.33"
            @update:width="block.nominalWidth = $event; emitChange()"
            @update:height="block.nominalHeight = $event"
          >
            <div class="svg-render-box" v-html="block.svgContent"></div>
          </ResizableBlock>
        </div>

        <!-- 3. Table Block (三线表) -->
        <div
          v-else-if="block.type === 'table'"
          class="block-body table-block-body"
        >
          <ResizableBlock
            :width="block.nominalWidth || 480"
            :aspect-ratio="2.2"
            @update:width="block.nominalWidth = $event; emitChange()"
          >
            <div class="table-render-box" v-html="block.tableHtml"></div>
          </ResizableBlock>
        </div>

        <!-- 4. Row Group Block (并排组合行，如 图+表、图+图) -->
        <div
          v-else-if="block.type === 'row_group'"
          class="block-body row-group-body"
        >
          <div class="row-group-container">
            <div
              v-for="(child, cIdx) in block.children"
              :key="child.id"
              class="row-group-child"
            >
              <ResizableBlock
                :width="child.nominalWidth || 280"
                :aspect-ratio="child.type === 'svg_img' ? child.aspectRatio || 1.33 : 2.0"
                @update:width="child.nominalWidth = $event; emitChange()"
              >
                <div
                  v-if="child.type === 'svg_img'"
                  class="svg-render-box"
                  v-html="child.svgContent"
                ></div>
                <div
                  v-else
                  class="table-render-box"
                  v-html="child.tableHtml"
                ></div>
              </ResizableBlock>
            </div>
          </div>
        </div>

        <!-- 5. Sub Item Block (小问，如 (1), (2)) -->
        <div
          v-else-if="block.type === 'sub_item'"
          class="block-body sub-item-body"
        >
          <div class="sub-item-header">
            <input
              v-model="block.indexLabel"
              type="text"
              class="sub-index-input"
              maxlength="8"
              @change="emitChange"
            />
            <div
              class="editable-text-field sub-text"
              contenteditable="true"
              @blur="onSubTextBlur($event, block)"
              @click="checkFormulaClick($event, block)"
              v-html="renderLatexInHtml(block.contentHtml)"
            ></div>
          </div>

          <!-- 小问下嵌套的子块 (若有) -->
          <div v-if="block.subBlocks && block.subBlocks.length > 0" class="sub-blocks-nest">
            <div
              v-for="(subB, sIdx) in block.subBlocks"
              :key="subB.id"
              class="nested-sub-block"
            >
              <ResizableBlock
                v-if="subB.type === 'svg_img'"
                :width="subB.nominalWidth || 280"
                :aspect-ratio="subB.aspectRatio || 1.33"
                @update:width="subB.nominalWidth = $event; emitChange()"
              >
                <div class="svg-render-box" v-html="subB.svgContent"></div>
              </ResizableBlock>
            </div>
          </div>
        </div>

        <!-- 6. Options Block (单选/多选选项组) -->
        <div
          v-else-if="block.type === 'options'"
          class="block-body options-block-body"
        >
          <div class="options-layout-switcher">
            <span class="switcher-label">排版分列：</span>
            <button
              v-for="layout in ['auto', '4-col', '2-col', '1-col']"
              :key="layout"
              type="button"
              class="layout-pill-btn"
              :class="{ active: (block.columnLayout || 'auto') === layout }"
              @click="block.columnLayout = layout as any; emitChange()"
            >
              {{ layout === 'auto' ? '自动' : layout === '4-col' ? '四列' : layout === '2-col' ? '双列' : '单列' }}
            </button>
          </div>

          <div class="options-grid-editor" :class="block.columnLayout || 'auto'">
            <div
              v-for="(opt, oIdx) in block.options"
              :key="opt.label"
              class="option-item-row"
            >
              <span class="opt-label">{{ opt.label }}.</span>
              <input
                v-model="opt.textHtml"
                type="text"
                class="opt-input"
                placeholder="选项内容（可含 $公式$）"
                @change="emitChange"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type {
  CanvasBlock,
  LeadTextBlock,
  SubItemBlock,
  RowGroupBlock,
  SvgImgBlock,
  TableBlock,
} from '../../types/problem';
import { renderLatexInHtml } from '../../utils/katexRender';
import ResizableBlock from './ResizableBlock.vue';
import { GripVertical, Split, Trash2 } from 'lucide-vue-next';

const props = defineProps<{
  blocks: CanvasBlock[];
}>();

const emit = defineEmits<{
  (e: 'update:blocks', val: CanvasBlock[]): void;
  (e: 'change'): void;
  (e: 'editFormula', payload: { latex: string; targetRect: DOMRect; onConfirm: (s: string) => void }): void;
}>();

const draggedIndex = ref<number | null>(null);
const dropTargetIndex = ref<number | null>(null);
const dropPosition = ref<'before' | 'after' | 'group' | null>(null);

function getBlockTypeLabel(type: string): string {
  switch (type) {
    case 'lead_text': return '题干正文';
    case 'svg_img': return '矢量图';
    case 'table': return '表格';
    case 'row_group': return '并排组合行';
    case 'sub_item': return '小问分题';
    case 'options': return '选项组';
    default: return '构件';
  }
}

function emitChange() {
  emit('change');
}

function removeBlock(index: number) {
  props.blocks.splice(index, 1);
  emitChange();
}

function splitRowGroup(index: number) {
  const block = props.blocks[index];
  if (block.type !== 'row_group') return;
  const children = block.children;
  props.blocks.splice(index, 1, ...children);
  emitChange();
}

function onLeadTextBlur(e: Event, block: LeadTextBlock) {
  const el = e.target as HTMLElement;
  const newHtml = el.innerHTML.trim();
  if (newHtml !== block.contentHtml) {
    block.contentHtml = newHtml;
    emitChange();
  }
}

function onSubTextBlur(e: Event, block: SubItemBlock) {
  const el = e.target as HTMLElement;
  const newHtml = el.innerHTML.trim();
  if (newHtml !== block.contentHtml) {
    block.contentHtml = newHtml;
    emitChange();
  }
}

function checkFormulaClick(e: MouseEvent, block: LeadTextBlock | SubItemBlock) {
  const target = (e.target as HTMLElement).closest('.katex, .katex-display');
  if (!target) return;

  const annotation = target.querySelector('annotation');
  const latex = annotation ? annotation.textContent || '' : '';
  const rect = target.getBoundingClientRect();

  emit('editFormula', {
    latex: latex.trim(),
    targetRect: rect,
    onConfirm: (newLatex: string) => {
      // 简单字符串替换或公式包裹
      if (latex) {
        block.contentHtml = block.contentHtml.replace(latex, newLatex);
      } else {
        block.contentHtml += ` $${newLatex}$`;
      }
      emitChange();
    },
  });
}

// --- 拖拽与并排重组逻辑 ---

function onDragStart(e: DragEvent, index: number) {
  draggedIndex.value = index;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }
}

function onDragOver(e: DragEvent, index: number) {
  if (draggedIndex.value === null || draggedIndex.value === index) return;
  dropTargetIndex.value = index;

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const y = e.clientY - rect.top;
  const height = rect.height;

  const srcBlock = props.blocks[draggedIndex.value];
  const targetBlock = props.blocks[index];

  // 若均为图片/表格，且悬停在中间区域，判定为并排组合 (RowGroup)
  const isMediaSource = srcBlock.type === 'svg_img' || srcBlock.type === 'table';
  const isMediaTarget = targetBlock.type === 'svg_img' || targetBlock.type === 'table' || targetBlock.type === 'row_group';

  if (isMediaSource && isMediaTarget && y > height * 0.25 && y < height * 0.75) {
    dropPosition.value = 'group';
  } else if (y < height / 2) {
    dropPosition.value = 'before';
  } else {
    dropPosition.value = 'after';
  }
}

function onDragLeave() {
  dropTargetIndex.value = null;
  dropPosition.value = null;
}

function onDrop(e: DragEvent, index: number) {
  if (draggedIndex.value === null || draggedIndex.value === index) {
    onDragEnd();
    return;
  }

  const srcIdx = draggedIndex.value;
  const srcBlock = props.blocks[srcIdx];
  const targetBlock = props.blocks[index];

  if (dropPosition.value === 'group') {
    // 合并为 RowGroup
    const mediaToMerge: (SvgImgBlock | TableBlock)[] = [];
    if (srcBlock.type === 'row_group') {
      mediaToMerge.push(...srcBlock.children);
    } else if (srcBlock.type === 'svg_img' || srcBlock.type === 'table') {
      mediaToMerge.push(srcBlock);
    }

    if (targetBlock.type === 'row_group') {
      targetBlock.children.push(...mediaToMerge);
      props.blocks.splice(srcIdx, 1);
    } else if (targetBlock.type === 'svg_img' || targetBlock.type === 'table') {
      const newGroup: RowGroupBlock = {
        id: `row-${Date.now().toString(36)}`,
        type: 'row_group',
        children: [targetBlock, ...mediaToMerge],
      };
      props.blocks.splice(index, 1, newGroup);
      const actualSrcIdx = srcIdx > index ? srcIdx : srcIdx;
      props.blocks.splice(actualSrcIdx, 1);
    }
  } else {
    // 正常上下调整位置
    props.blocks.splice(srcIdx, 1);
    let targetInsert = index;
    if (srcIdx < index && dropPosition.value === 'before') {
      targetInsert -= 1;
    } else if (srcIdx > index && dropPosition.value === 'after') {
      targetInsert += 1;
    }
    props.blocks.splice(targetInsert, 0, srcBlock);
  }

  onDragEnd();
  emitChange();
}

function onDragEnd() {
  draggedIndex.value = null;
  dropTargetIndex.value = null;
  dropPosition.value = null;
}
</script>

<style scoped>
.m3-block-tree {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
}

.canvas-block-row {
  position: relative;
  border-radius: 8px;
  padding: 6px 8px;
  transition: all 0.15s ease;
}

.canvas-block-row:hover {
  background: rgba(0, 90, 193, 0.03);
}

.canvas-block-row.is-dragging {
  opacity: 0.35;
}

.canvas-block-row.drop-target-before {
  border-top: 2.5px solid var(--md-sys-color-primary, #005ac1);
}

.canvas-block-row.drop-target-after {
  border-bottom: 2.5px solid var(--md-sys-color-primary, #005ac1);
}

.canvas-block-row.drop-target-group {
  outline: 2px dashed var(--md-sys-color-primary, #005ac1);
  background: rgba(0, 90, 193, 0.08);
}

/* Grip Bar */
.block-grip-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  opacity: 0.15;
  transition: opacity 0.15s ease;
}

.canvas-block-row:hover .block-grip-bar {
  opacity: 1;
}

.grip-handle {
  background: transparent;
  border: none;
  color: var(--md-sys-color-on-surface-variant, #74777f);
  cursor: grab;
  padding: 2px 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
}

.grip-handle:active {
  cursor: grabbing;
}

.block-type-pill {
  font-size: 10px;
  color: var(--md-sys-color-primary, #005ac1);
  background: var(--md-sys-color-primary-container, #d3e4ff);
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.block-quick-actions {
  margin-left: auto;
  display: flex;
  gap: 4px;
}

.action-mini-btn {
  background: transparent;
  border: none;
  font-size: 11px;
  color: var(--md-sys-color-on-surface-variant, #44474e);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 3px;
}

.action-mini-btn:hover {
  background: var(--md-sys-color-surface-container-high, #e0e3e8);
}

.action-mini-btn.btn-del:hover {
  color: var(--md-sys-color-error, #ba1a1a);
  background: rgba(186, 26, 26, 0.08);
}

/* Editable Text Area */
.editable-text-field {
  min-height: 24px;
  outline: none;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 14.5px;
  line-height: 1.6;
  color: var(--md-sys-color-on-surface, #1d1b20);
  border: 1px dashed transparent;
  transition: border-color 0.12s ease;
}

.editable-text-field:focus {
  border-color: var(--md-sys-color-primary, #005ac1);
  background: #ffffff;
}

.editable-text-field :deep(.katex) {
  cursor: pointer;
  border-radius: 3px;
  padding: 0 2px;
  transition: background-color 0.12s ease;
}

.editable-text-field :deep(.katex:hover) {
  background-color: rgba(0, 90, 193, 0.12);
}

/* Sub Items */
.sub-item-header {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.sub-index-input {
  width: 36px;
  font-weight: bold;
  font-size: 14.5px;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 2px 4px;
  color: var(--md-sys-color-primary, #005ac1);
  outline: none;
}

.sub-index-input:focus {
  border-color: var(--md-sys-color-outline, #74777f);
  background: #ffffff;
}

.sub-text {
  flex: 1;
}

.sub-blocks-nest {
  margin-left: 36px;
  margin-top: 8px;
}

/* Row Group */
.row-group-container {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  justify-content: center;
}

/* Options */
.options-layout-switcher {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 11px;
  color: var(--md-sys-color-on-surface-variant, #74777f);
}

.layout-pill-btn {
  background: var(--md-sys-color-surface-container-low, #f0f2f5);
  border: 1px solid var(--md-sys-color-outline-variant, #e0e3e8);
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  cursor: pointer;
  color: var(--md-sys-color-on-surface, #1d1b20);
}

.layout-pill-btn.active {
  background: var(--md-sys-color-primary, #005ac1);
  color: #ffffff;
  border-color: transparent;
}

.options-grid-editor {
  display: grid;
  gap: 8px;
}

.options-grid-editor.auto,
.options-grid-editor.\32-col {
  grid-template-columns: repeat(2, 1fr);
}

.options-grid-editor.\34-col {
  grid-template-columns: repeat(4, 1fr);
}

.options-grid-editor.\31-col {
  grid-template-columns: 1fr;
}

.option-item-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.opt-label {
  font-weight: 600;
  font-size: 14px;
  color: var(--md-sys-color-primary, #005ac1);
}

.opt-input {
  flex: 1;
  border: 1px solid var(--md-sys-color-outline-variant, #c2c7cf);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 13px;
  outline: none;
  background: #ffffff;
}

.opt-input:focus {
  border-color: var(--md-sys-color-primary, #005ac1);
}
</style>
