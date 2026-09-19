<template>
  <div class="library-view" @click="closeDropdowns">
    <!-- Layer 1: M3 Top App Bar (全局主栏：搜索与核心操作) -->
    <header class="top-bar">
      <!-- M3 Docked Search Box (圆角 28px, 居中自适应, 四字段模糊搜索) -->
      <div class="m3-search-box">
        <Search :size="17" class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="模糊搜索题干正文 / 考点摘要 / 知识点标签..."
          class="search-input"
          @input="onSearchInput"
        />
        <button v-if="searchQuery" class="clear-btn" title="清空搜索" @click="clearSearch">
          <X :size="15" />
        </button>
      </div>

      <!-- 全局核心操作 (已移除重复的新建错题本按钮) -->
      <div class="top-actions">
        <button class="btn-refresh" title="刷新错题列表" @click="loadData">
          <RotateCw :size="16" />
        </button>
        <button class="btn-primary" @click="$emit('nav', 'ingest')">
          <Plus :size="16" />
          <span>录入错题</span>
        </button>
      </div>
    </header>

    <!-- Layer 2: M3 Primary Navigation Tabs (学科主导航条，符合 Google M3 Tab 规范) -->
    <nav class="m3-primary-tabs-bar">
      <div class="tabs-track">
        <button
          v-for="sub in subjects"
          :key="sub"
          class="m3-tab-item"
          :class="{ active: selectedSubject === sub, [getSubjectTabClass(sub)]: true }"
          @click="selectSubject(sub)"
        >
          <span class="tab-subject-dot"></span>
          <span class="tab-title">{{ sub }}</span>
          <span class="tab-count-badge">{{ getSubjectProblemCount(sub) }}</span>
          <!-- M3 Tab 激活指示横条 (3px Active Indicator) -->
          <div v-if="selectedSubject === sub" class="tab-active-indicator"></div>
        </button>
      </div>
    </nav>

    <!-- Layer 3: Unified M3 Filter Toolbar (统一过滤工具条，移除全部老旧文字前缀) -->
    <div class="m3-filter-toolbar">
      <!-- 错题本 Filter Chips 行 (带上下文局部新建 Action Chip) -->
      <div class="toolbar-section notebooks-section">
        <div class="chips-scroll-container">
          <button
            class="m3-filter-chip nb-filter-chip"
            :class="{ active: selectedNotebookId === 'all' }"
            @click="selectNotebook('all')"
          >
            全部{{ selectedSubject }}错题
          </button>

          <button
            v-for="nb in currentSubjectNotebooks"
            :key="nb.id"
            class="m3-filter-chip nb-filter-chip"
            :class="{ active: selectedNotebookId === nb.id }"
            @click="selectNotebook(nb.id)"
          >
            {{ nb.name }}
          </button>

          <!-- M3 Action Chip: 局部归位的新建错题本操作 -->
          <button
            class="m3-action-chip"
            title="在当前学科下新建错题本"
            @click="openCreateNotebookDialog"
          >
            <Plus :size="13" />
            <span>新建错题本</span>
          </button>
        </div>
      </div>

      <!-- 知识点 Tag · 题型 · 排序 统一过滤控制行 -->
      <div class="toolbar-section secondary-filters-section">
        <!-- 知识点 Tag 胶囊组 (动态聚合，多选交集 AND) -->
        <div class="tags-filter-wrapper">
          <div v-if="tagList.length > 0" class="chips-scroll-container">
            <button
              v-for="t in tagList"
              :key="t.name"
              class="m3-filter-chip tag-filter-chip"
              :class="{ active: isTagSelected(t.name) }"
              @click="toggleTag(t.name)"
              :title="isTagSelected(t.name) ? '取消勾选该标签' : '交集筛选该标签'"
            >
              <span class="hash-symbol">#</span>
              <span class="tag-text">{{ t.name }}</span>
              <span class="tag-counter">{{ t.count }}</span>
            </button>
          </div>
          <span v-else class="empty-tag-note">当前暂无标签，可在卡片上点击“+标签”快速添加</span>

          <!-- 清除标签按钮 -->
          <button
            v-if="selectedTags.length > 0"
            class="btn-clear-tags-chip"
            title="清空已选标签"
            @click="clearAllTags"
          >
            <X :size="12" />
            <span>清除标签 ({{ selectedTags.length }})</span>
          </button>
        </div>

        <!-- 分割竖线 -->
        <div class="m3-vertical-divider"></div>

        <!-- 题型切换 Filter Chips -->
        <div class="type-chips-group">
          <button
            v-for="t in types"
            :key="t"
            class="m3-filter-chip type-filter-chip"
            :class="{ active: selectedType === t }"
            @click="selectType(t)"
          >
            {{ t }}
          </button>
        </div>

        <!-- 分割竖线 -->
        <div class="m3-vertical-divider"></div>

        <!-- M3 排序下拉菜单 (彻底替换原生 select) -->
        <div class="m3-menu-wrapper" ref="sortMenuRef">
          <button
            class="m3-menu-trigger-btn"
            :class="{ active: showSortMenu }"
            @click.stop="showSortMenu = !showSortMenu"
          >
            <ArrowUpDown :size="13" class="sort-icon" />
            <span class="sort-current-label">{{ currentSortLabel }}</span>
            <ChevronDown :size="12" class="chevron-arrow" :class="{ open: showSortMenu }" />
          </button>

          <!-- M3 Menu Popover -->
          <transition name="m3-menu-fade">
            <div v-if="showSortMenu" class="m3-dropdown-menu" @click.stop>
              <button
                v-for="opt in sortOptions"
                :key="opt.value"
                class="m3-menu-item"
                :class="{ active: selectedSort === opt.value }"
                @click="onSelectSortOption(opt.value)"
              >
                <Check v-if="selectedSort === opt.value" :size="13" class="menu-check-icon" />
                <span v-else class="menu-check-placeholder"></span>
                <span>{{ opt.label }}</span>
              </button>
            </div>
          </transition>
        </div>

        <!-- 结果计数 -->
        <div class="results-stats-chip">
          <span v-if="selectedTags.length > 0" class="and-tag-badge">交集</span>
          <span class="stats-text">共 {{ problems.length }} 题</span>
        </div>

        <!-- 批量管理 Action Chip -->
        <button
          class="m3-filter-chip batch-chip"
          :class="{ active: isBatchMode }"
          title="开启 / 退出批量操作模式"
          @click="toggleBatchMode"
        >
          <ListChecks :size="13" />
          <span>批量管理</span>
          <span v-if="selectedUuids.length > 0" class="batch-num-badge">{{ selectedUuids.length }}</span>
        </button>
      </div>
    </div>

    <!-- Problems Scroll Area (错题呈现流) -->
    <div class="problems-scroll-area">
      <div v-if="loading" class="state-container">
        <div class="spinner"></div>
        <p>正在检索错题...</p>
      </div>

      <div v-else-if="problems.length === 0" class="state-container">
        <div class="empty-icon">
          <FolderOpen :size="44" stroke-width="1.5" />
        </div>
        <h3>当前条件下暂无错题</h3>
        <p v-if="selectedTags.length > 0">
          已开启 {{ selectedTags.length }} 个标签交集过滤，可尝试减少选中标签。
        </p>
        <p v-else>
          该错题本暂无收录，或被题型/搜索词过滤。可点击右上角“录入错题”添加。
        </p>
        <div class="empty-actions">
          <button v-if="selectedTags.length > 0" class="btn-outlined btn-sm" @click="clearAllTags">
            清除所有标签
          </button>
          <button class="btn-primary btn-sm" @click="$emit('nav', 'ingest')">
            立即录入新题
          </button>
        </div>
      </div>

      <div v-else class="cards-grid">
        <ProblemCard
          v-for="prob in problems"
          :key="prob.uuid"
          :problem="prob"
          :in-cart="isInCart(prob.uuid)"
          :selectable="isBatchMode"
          :selected="selectedUuids.includes(prob.uuid)"
          @toggle-select="toggleSelectUuid"
          @transfer="openSingleTransfer(prob)"
          @update-rating="handleUpdateRating"
          @update-tags="handleUpdateTags"
          @toggle-cart="$emit('toggleCart', prob)"
          @delete="requestDeleteProblem(prob)"
          @notify="$emit('notify', $event)"
          @tag-click="onCardTagClick"
        />
      </div>
    </div>

    <!-- Create Notebook Dialog -->
    <div v-if="showCreateNbDialog" class="m3-dialog-scrim" @click.self="showCreateNbDialog = false">
      <div class="m3-dialog">
        <div class="dialog-icon-wrapper">
          <BookPlus :size="24" />
        </div>
        <h3 class="dialog-title">创建新错题本</h3>
        <div class="dialog-form">
          <div class="form-item">
            <label class="form-label">错题本名称</label>
            <input
              v-model="newNbName"
              type="text"
              class="m3-input"
              placeholder="如：高三物理综合大题 / 生物遗传专练"
              autofocus
            />
          </div>
          <div class="form-item">
            <label class="form-label">所属学科</label>
            <div class="subject-radio-group">
              <label
                v-for="s in subjects"
                :key="s"
                class="radio-label"
                :class="{ active: newNbSubject === s }"
              >
                <input
                  v-model="newNbSubject"
                  type="radio"
                  :value="s"
                  class="hidden-radio"
                />
                {{ s }}
              </label>
            </div>
          </div>
        </div>
        <div class="dialog-actions">
          <button class="btn-text" @click="showCreateNbDialog = false">取消</button>
          <button
            class="btn-primary"
            :disabled="!newNbName.trim()"
            @click="handleCreateNotebook"
          >
            立即创建
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Problem Confirmation Dialog -->
    <div v-if="problemToDelete" class="m3-dialog-scrim" @click.self="problemToDelete = null">
      <div class="m3-dialog">
        <div class="dialog-icon-wrapper danger-icon">
          <Trash2 :size="24" />
        </div>
        <h3 class="dialog-title">删除错题确认</h3>
        <div class="dialog-form">
          <p class="dialog-desc">
            确定要彻底删除该错题吗？此操作无法撤销。
          </p>
          <div class="delete-problem-preview">
            <span class="preview-badge">{{ problemToDelete.subject }} · {{ problemToDelete.type }}</span>
            <span class="preview-summary">{{ problemToDelete.summary }}</span>
          </div>
          <p class="dialog-hint">
            该题将从底层 SQLite 数据库以及对应错题本的本地 HTML 镜像中彻底删除。
          </p>
        </div>
        <div class="dialog-actions">
          <button class="btn-text" @click="problemToDelete = null">取消</button>
          <button class="btn-danger" @click="confirmDeleteProblem">
            确认删除
          </button>
        </div>
      </div>
    </div>

    <!-- M3 Floating Batch Dock (底部悬浮操作控制台) -->
    <transition name="m3-dock-slide">
      <div v-if="isBatchMode || selectedUuids.length > 0" class="m3-floating-dock-wrapper">
        <div class="m3-floating-dock">
          <!-- Left: Counters & Selection helpers -->
          <div class="dock-left">
            <div class="dock-pill-badge">
              <span>已选 <strong>{{ selectedUuids.length }}</strong> / {{ problems.length }} 项</span>
            </div>
            <button class="dock-btn-subtle" @click="toggleSelectAll">
              {{ isAllSelected ? '取消全选' : '全选' }}
            </button>
            <button v-if="selectedUuids.length > 0" class="dock-btn-subtle" @click="invertSelection">
              反选
            </button>
          </div>

          <!-- Divider -->
          <div class="dock-divider"></div>

          <!-- Right: Batch Action Buttons -->
          <div class="dock-right">
            <button
              class="dock-action-btn"
              :disabled="selectedUuids.length === 0"
              title="批量转移 / 复制到其他错题本"
              @click="openBatchTransfer"
            >
              <FolderInput :size="14" />
              <span>转移 / 复制</span>
            </button>

            <button
              class="dock-action-btn"
              :disabled="selectedUuids.length === 0"
              title="将已选题目批量加入组卷打印"
              @click="batchAddToCart"
            >
              <Printer :size="14" />
              <span>加入打印</span>
            </button>

            <button
              class="dock-action-btn"
              :disabled="selectedUuids.length === 0"
              title="为已选题批量追加知识点标签"
              @click="openBatchTagModal"
            >
              <Tag :size="14" />
              <span>打标签</span>
            </button>

            <button
              class="dock-action-btn dock-btn-danger"
              :disabled="selectedUuids.length === 0"
              title="批量删除已选题"
              @click="openBatchDeleteConfirm"
            >
              <Trash2 :size="14" />
              <span>删除</span>
            </button>

            <div class="dock-divider"></div>

            <button class="dock-btn-close" title="退出批量模式" @click="exitBatchMode">
              <X :size="15" />
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Transfer / Copy Dialog (单题与批量通用流转弹窗) -->
    <div v-if="showTransferDialog" class="m3-dialog-scrim" @click.self="showTransferDialog = false">
      <div class="m3-dialog">
        <div class="dialog-icon-wrapper primary-icon">
          <FolderInput :size="24" />
        </div>
        <h3 class="dialog-title">错题跨本流转</h3>
        <div class="dialog-form">
          <p class="dialog-desc">
            即将对当前选中的 <strong>{{ transferUuids.length }}</strong> 道错题执行流转：
          </p>

          <!-- 模式切换：移动 vs 复制 -->
          <div class="form-item">
            <label class="form-label">流转方式</label>
            <div class="m3-segmented-control">
              <button
                type="button"
                class="segmented-btn"
                :class="{ active: transferMode === 'move' }"
                @click="transferMode = 'move'"
              >
                <span>移动 (移出原错题本)</span>
              </button>
              <button
                type="button"
                class="segmented-btn"
                :class="{ active: transferMode === 'copy' }"
                @click="transferMode = 'copy'"
              >
                <span>复制 (生成独立新副本)</span>
              </button>
            </div>
          </div>

          <!-- 目标错题本选择器 -->
          <div class="form-item">
            <label class="form-label">目标错题本</label>
            <select v-model="transferTargetNotebookId" class="m3-select-box">
              <optgroup v-for="s in subjects" :key="s" :label="s">
                <option
                  v-for="nb in notebooks.filter(n => n.subject === s)"
                  :key="nb.id"
                  :value="nb.id"
                >
                  {{ nb.name }}
                </option>
              </optgroup>
            </select>
          </div>
        </div>
        <div class="dialog-actions">
          <button class="btn-text" @click="showTransferDialog = false">取消</button>
          <button
            class="btn-primary"
            :disabled="!transferTargetNotebookId"
            @click="confirmTransfer"
          >
            {{ transferMode === 'move' ? '确认移动' : '确认复制' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Batch Tag Dialog (批量打标签弹窗) -->
    <div v-if="showBatchTagDialog" class="m3-dialog-scrim" @click.self="showBatchTagDialog = false">
      <div class="m3-dialog">
        <div class="dialog-icon-wrapper primary-icon">
          <Tag :size="24" />
        </div>
        <h3 class="dialog-title">批量添加标签</h3>
        <div class="dialog-form">
          <p class="dialog-desc">
            为已选择的 <strong>{{ selectedUuids.length }}</strong> 道错题统一追加标签：
          </p>
          <div class="form-item">
            <label class="form-label">知识点标签名称</label>
            <input
              v-model="batchTagInput"
              type="text"
              class="m3-input"
              placeholder="如：高考压轴 / 动量守恒"
              maxlength="20"
              @keydown.enter.prevent="confirmBatchTag"
            />
          </div>

          <!-- 快速选取当前已有标签 -->
          <div v-if="tagList.length > 0" class="quick-tag-pick-area">
            <label class="form-label">常用标签快速填入</label>
            <div class="quick-tags-wrap">
              <button
                v-for="t in tagList.slice(0, 10)"
                :key="t.name"
                type="button"
                class="quick-tag-chip"
                @click="batchTagInput = t.name"
              >
                #{{ t.name }}
              </button>
            </div>
          </div>
        </div>
        <div class="dialog-actions">
          <button class="btn-text" @click="showBatchTagDialog = false">取消</button>
          <button
            class="btn-primary"
            :disabled="!batchTagInput.trim()"
            @click="confirmBatchTag"
          >
            确认添加
          </button>
        </div>
      </div>
    </div>

    <!-- Batch Delete Confirmation Dialog -->
    <div v-if="showBatchDeleteDialog" class="m3-dialog-scrim" @click.self="showBatchDeleteDialog = false">
      <div class="m3-dialog">
        <div class="dialog-icon-wrapper danger-icon">
          <Trash2 :size="24" />
        </div>
        <h3 class="dialog-title">批量删除确认</h3>
        <div class="dialog-form">
          <p class="dialog-desc">
            确定要彻底删除选中的 <strong>{{ selectedUuids.length }}</strong> 道错题吗？
          </p>
          <p class="dialog-hint">
            此操作将永久从 SQLite 数据库和本地 HTML 镜像中抹除这些题目，无法恢复。
          </p>
        </div>
        <div class="dialog-actions">
          <button class="btn-text" @click="showBatchDeleteDialog = false">取消</button>
          <button class="btn-danger" @click="confirmBatchDelete">
            确认删除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import type { Notebook, Problem, TagCount, SortOption } from '../types/problem';
import ProblemCard from '../components/ProblemCard.vue';
import {
  apiGetNotebooks,
  apiCreateNotebook,
  apiGetProblems,
  apiGetTags,
  apiUpdateRatings,
  apiDeleteProblem,
  apiMoveOrCopyProblems,
  apiBatchDeleteProblems,
  apiBatchAddTag,
} from '../utils/api';
import {
  Search,
  X,
  Plus,
  RotateCw,
  BookPlus,
  FolderOpen,
  Trash2,
  ArrowUpDown,
  ChevronDown,
  Check,
  FolderInput,
  Printer,
  Tag,
  ListChecks,
} from 'lucide-vue-next';

const props = defineProps<{
  printCart: Problem[];
}>();

const emit = defineEmits<{
  (e: 'nav', tab: string): void;
  (e: 'toggleCart', prob: Problem): void;
  (e: 'removeFromCart', uuid: string): void;
  (e: 'notify', msg: string): void;
}>();

const subjects = ['数学', '物理', '化学', '生物'];
const types = ['全部', '单选', '多选', '填空', '简答'];

const sortOptions: { label: string; value: SortOption }[] = [
  { label: '最新录入', value: 'date_desc' },
  { label: '最早录入', value: 'date_asc' },
  { label: '难度最高', value: 'difficulty_desc' },
  { label: '难度最低', value: 'difficulty_asc' },
  { label: '重要度最高', value: 'importance_desc' },
];

const selectedSubject = ref('物理');
const notebooks = ref<Notebook[]>([]);
const selectedNotebookId = ref('all');
const selectedType = ref('全部');
const selectedTags = ref<string[]>([]);
const selectedSort = ref<SortOption>('date_desc');
const showSortMenu = ref(false);
const searchQuery = ref('');
const problems = ref<Problem[]>([]);
const tagList = ref<TagCount[]>([]);
const loading = ref(false);

// 批量管理状态
const isBatchMode = ref(false);
const selectedUuids = ref<string[]>([]);

// 跨错题本流转弹窗状态
const showTransferDialog = ref(false);
const transferTargetNotebookId = ref('');
const transferMode = ref<'move' | 'copy'>('move');
const transferUuids = ref<string[]>([]);

// 批量打标签弹窗状态
const showBatchTagDialog = ref(false);
const batchTagInput = ref('');

// 批量删除确认弹窗状态
const showBatchDeleteDialog = ref(false);

// 学科错题数缓存统计
const subjectCounts = ref<Record<string, number>>({});

// 新建错题本弹窗状态
const showCreateNbDialog = ref(false);
const newNbName = ref('');
const newNbSubject = ref('物理');

// 删除错题确认弹窗状态
const problemToDelete = ref<Problem | null>(null);

const currentSubjectNotebooks = computed(() => {
  return notebooks.value.filter((nb) => nb.subject === selectedSubject.value);
});

const currentSortLabel = computed(() => {
  const found = sortOptions.find((o) => o.value === selectedSort.value);
  return found ? found.label : '排序';
});

function getSubjectTabClass(subject: string) {
  switch (subject) {
    case '数学': return 'tab-math';
    case '物理': return 'tab-physics';
    case '化学': return 'tab-chem';
    case '生物': return 'tab-bio';
    default: return '';
  }
}

function getSubjectProblemCount(sub: string): string {
  const count = subjectCounts.value[sub];
  return count !== undefined ? String(count) : '';
}

function isInCart(uuid: string): boolean {
  return props.printCart.some((p) => p.uuid === uuid);
}

function isTagSelected(tagName: string): boolean {
  return selectedTags.value.includes(tagName);
}

function closeDropdowns() {
  showSortMenu.value = false;
}

function onSelectSortOption(val: SortOption) {
  selectedSort.value = val;
  showSortMenu.value = false;
  loadData();
}

const isAllSelected = computed(() => {
  if (problems.value.length === 0) return false;
  return problems.value.every((p) => selectedUuids.value.includes(p.uuid));
});

function toggleBatchMode() {
  isBatchMode.value = !isBatchMode.value;
  if (!isBatchMode.value) {
    selectedUuids.value = [];
  }
}

function exitBatchMode() {
  isBatchMode.value = false;
  selectedUuids.value = [];
}

function toggleSelectUuid(uuid: string) {
  const idx = selectedUuids.value.indexOf(uuid);
  if (idx >= 0) {
    selectedUuids.value.splice(idx, 1);
  } else {
    selectedUuids.value.push(uuid);
  }
}

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedUuids.value = [];
  } else {
    selectedUuids.value = problems.value.map((p) => p.uuid);
  }
}

function invertSelection() {
  const currentSet = new Set(selectedUuids.value);
  selectedUuids.value = problems.value
    .map((p) => p.uuid)
    .filter((u) => !currentSet.has(u));
}

function openSingleTransfer(prob: Problem) {
  transferUuids.value = [prob.uuid];
  const candidates = notebooks.value.filter((nb) => nb.id !== prob.notebook_id);
  transferTargetNotebookId.value = candidates.length > 0 ? candidates[0].id : (notebooks.value[0]?.id || '');
  transferMode.value = 'move';
  showTransferDialog.value = true;
}

function openBatchTransfer() {
  if (selectedUuids.value.length === 0) return;
  transferUuids.value = [...selectedUuids.value];
  const candidates = notebooks.value.filter((nb) => nb.id !== selectedNotebookId.value);
  transferTargetNotebookId.value = candidates.length > 0 ? candidates[0].id : (notebooks.value[0]?.id || '');
  transferMode.value = 'move';
  showTransferDialog.value = true;
}

async function confirmTransfer() {
  if (!transferTargetNotebookId.value || transferUuids.value.length === 0) return;
  const isCopy = transferMode.value === 'copy';
  const targetNb = notebooks.value.find((n) => n.id === transferTargetNotebookId.value);
  const targetName = targetNb ? targetNb.name : '目标错题本';
  try {
    const count = await apiMoveOrCopyProblems(
      transferUuids.value,
      transferTargetNotebookId.value,
      isCopy
    );
    emit('notify', `成功${isCopy ? '复制' : '移动'} ${count} 道题目至「${targetName}」`);
    showTransferDialog.value = false;
    selectedUuids.value = [];
    await loadData();
    refreshSubjectStats();
  } catch (e: any) {
    emit('notify', '流转操作失败: ' + (e?.message || e));
  }
}

function batchAddToCart() {
  if (selectedUuids.value.length === 0) return;
  let addedCount = 0;
  for (const uuid of selectedUuids.value) {
    const p = problems.value.find((prob) => prob.uuid === uuid);
    if (p && !isInCart(uuid)) {
      emit('toggleCart', p);
      addedCount++;
    }
  }
  emit('notify', `已将 ${addedCount} 道错题加入组卷打印篮`);
}

function openBatchTagModal() {
  if (selectedUuids.value.length === 0) return;
  batchTagInput.value = '';
  showBatchTagDialog.value = true;
}

async function confirmBatchTag() {
  const tag = batchTagInput.value.trim();
  if (!tag || selectedUuids.value.length === 0) return;
  try {
    const count = await apiBatchAddTag(selectedUuids.value, tag);
    emit('notify', `已为 ${count} 道错题添加标签 #${tag}`);
    showBatchTagDialog.value = false;
    await loadData();
  } catch (e: any) {
    emit('notify', '添加标签失败: ' + (e?.message || e));
  }
}

function openBatchDeleteConfirm() {
  if (selectedUuids.value.length === 0) return;
  showBatchDeleteDialog.value = true;
}

async function confirmBatchDelete() {
  if (selectedUuids.value.length === 0) return;
  const count = selectedUuids.value.length;
  try {
    await apiBatchDeleteProblems(selectedUuids.value);
    for (const u of selectedUuids.value) {
      emit('removeFromCart', u);
    }
    emit('notify', `已成功删除 ${count} 道错题`);
    showBatchDeleteDialog.value = false;
    selectedUuids.value = [];
    await loadData();
    refreshSubjectStats();
  } catch (e: any) {
    emit('notify', '批量删除失败: ' + (e?.message || e));
  }
}

async function loadData() {
  loading.value = true;
  try {
    const nbIdParam = selectedNotebookId.value === 'all' ? undefined : selectedNotebookId.value;

    const [nbList, probList, tagsData] = await Promise.all([
      apiGetNotebooks(),
      apiGetProblems(
        nbIdParam,
        selectedSubject.value,
        selectedType.value === '全部' ? undefined : selectedType.value,
        searchQuery.value || undefined,
        selectedTags.value.length > 0 ? selectedTags.value : undefined,
        selectedSort.value
      ),
      apiGetTags(nbIdParam, selectedSubject.value),
    ]);

    notebooks.value = nbList;
    problems.value = probList;
    tagList.value = tagsData;

    // 清理已勾选但已不存在的题目
    selectedUuids.value = selectedUuids.value.filter((u) => probList.some((p) => p.uuid === u));

    // 统计当前学科题目数量
    if (selectedNotebookId.value === 'all' && !searchQuery.value && selectedType.value === '全部' && selectedTags.value.length === 0) {
      subjectCounts.value[selectedSubject.value] = probList.length;
    }
  } catch (e: any) {
    emit('notify', '读取数据失败: ' + (e?.message || e));
  } finally {
    loading.value = false;
  }
}

async function refreshSubjectStats() {
  for (const s of subjects) {
    try {
      const list = await apiGetProblems(undefined, s);
      subjectCounts.value[s] = list.length;
    } catch (_) {}
  }
}

function selectSubject(sub: string) {
  if (selectedSubject.value === sub) return;
  selectedSubject.value = sub;
  selectedNotebookId.value = 'all';
  selectedTags.value = [];
  selectedUuids.value = [];
  loadData();
}

function selectNotebook(id: string) {
  selectedNotebookId.value = id;
  selectedTags.value = [];
  selectedUuids.value = [];
  loadData();
}

function toggleTag(tagName: string) {
  const idx = selectedTags.value.indexOf(tagName);
  if (idx >= 0) {
    selectedTags.value.splice(idx, 1);
  } else {
    selectedTags.value.push(tagName);
  }
  loadData();
}

function clearAllTags() {
  selectedTags.value = [];
  loadData();
}

function onCardTagClick(tagName: string) {
  if (!selectedTags.value.includes(tagName)) {
    selectedTags.value.push(tagName);
    loadData();
  }
}

function selectType(t: string) {
  selectedType.value = t;
  loadData();
}

let searchTimer: any = null;
function onSearchInput() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    loadData();
  }, 300);
}

function clearSearch() {
  searchQuery.value = '';
  loadData();
}

function openCreateNotebookDialog() {
  newNbSubject.value = selectedSubject.value;
  newNbName.value = '';
  showCreateNbDialog.value = true;
}

async function handleCreateNotebook() {
  if (!newNbName.value.trim()) return;
  try {
    const created = await apiCreateNotebook(newNbName.value.trim(), newNbSubject.value);
    showCreateNbDialog.value = false;
    newNbName.value = '';
    emit('notify', `错题本「${created.name}」已创建，并生成本地 HTML 镜像`);

    if (created.subject !== selectedSubject.value) {
      selectedSubject.value = created.subject;
    }
    selectedNotebookId.value = created.id;
    await loadData();
    refreshSubjectStats();
  } catch (e: any) {
    emit('notify', '创建失败: ' + (e?.message || e));
  }
}

async function handleUpdateRating(uuid: string, difficulty?: number, importance?: number) {
  try {
    await apiUpdateRatings(uuid, difficulty, importance);
    const target = problems.value.find((p) => p.uuid === uuid);
    if (target) {
      if (difficulty !== undefined) target.difficulty = difficulty;
      if (importance !== undefined) target.importance = importance;
    }
  } catch (e: any) {
    emit('notify', '修改评级失败: ' + e);
  }
}

async function handleUpdateTags(uuid: string, newTags: string[]) {
  const target = problems.value.find((p) => p.uuid === uuid);
  if (target) {
    target.tags = [...newTags];
  }
  const nbIdParam = selectedNotebookId.value === 'all' ? undefined : selectedNotebookId.value;
  try {
    tagList.value = await apiGetTags(nbIdParam, selectedSubject.value);
  } catch (_) {}
}

function requestDeleteProblem(prob: Problem) {
  problemToDelete.value = prob;
}

async function confirmDeleteProblem() {
  if (!problemToDelete.value) return;
  const target = problemToDelete.value;
  try {
    await apiDeleteProblem(target.uuid);
    problems.value = problems.value.filter((p) => p.uuid !== target.uuid);
    emit('removeFromCart', target.uuid);
    emit('notify', `已删除错题「${target.summary}」`);

    const nbIdParam = selectedNotebookId.value === 'all' ? undefined : selectedNotebookId.value;
    tagList.value = await apiGetTags(nbIdParam, selectedSubject.value);
    refreshSubjectStats();
  } catch (e: any) {
    emit('notify', '删除失败: ' + (e?.message || e));
  } finally {
    problemToDelete.value = null;
  }
}

onMounted(() => {
  loadData();
  refreshSubjectStats();
});
</script>

<style scoped>
.library-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--md-sys-color-background);
  overflow: hidden;
}

/* ==========================================================================
   Layer 1: M3 Top App Bar (顶部主栏)
   ========================================================================== */
.top-bar {
  padding: 14px 28px 10px 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
}

.m3-search-box {
  flex: 1;
  max-width: 560px;
  height: 42px;
  background-color: var(--md-sys-color-surface-container-high);
  border-radius: var(--md-shape-corner-full);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 10px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.m3-search-box:focus-within {
  background-color: var(--md-sys-color-surface-container-lowest);
  box-shadow: var(--md-elevation-1);
  border: 1.5px solid var(--md-sys-color-primary);
}

.search-icon {
  color: var(--md-sys-color-on-surface-variant);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 13px;
  color: var(--md-sys-color-on-surface);
  outline: none;
}

.clear-btn {
  color: var(--md-sys-color-on-surface-variant);
  display: flex;
  align-items: center;
  padding: 2px;
  border-radius: 50%;
  cursor: pointer;
}
.clear-btn:hover {
  background-color: var(--md-sys-color-surface-container);
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.btn-refresh {
  width: 38px;
  height: 38px;
  border-radius: var(--md-shape-corner-full);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--md-sys-color-on-surface-variant);
  background: var(--md-sys-color-surface-container);
  transition: background-color 0.2s;
  cursor: pointer;
}
.btn-refresh:hover {
  background: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface);
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 18px;
  border-radius: var(--md-shape-corner-full);
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  font-size: 13px;
  font-weight: 600;
  box-shadow: var(--md-elevation-1);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}
.btn-primary:hover:not(:disabled) {
  box-shadow: var(--md-elevation-2);
  filter: brightness(1.05);
}

/* ==========================================================================
   Layer 2: M3 Primary Navigation Tabs (学科主导航条，规范 M3 Tab)
   ========================================================================== */
.m3-primary-tabs-bar {
  padding: 0 28px;
  background-color: var(--md-sys-color-background);
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  flex-shrink: 0;
}

.tabs-track {
  display: flex;
  align-items: stretch;
  gap: 4px;
}

.m3-tab-item {
  position: relative;
  height: 44px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: none;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.m3-tab-item:hover {
  background-color: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface);
}

.m3-tab-item.active {
  color: var(--md-sys-color-primary);
  font-weight: 700;
}

.tab-subject-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.tab-math .tab-subject-dot { background-color: var(--subject-math); }
.tab-physics .tab-subject-dot { background-color: var(--subject-physics); }
.tab-chem .tab-subject-dot { background-color: var(--subject-chem); }
.tab-bio .tab-subject-dot { background-color: var(--subject-bio); }

.tab-count-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 1px 7px;
  border-radius: var(--md-shape-corner-full);
  background-color: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-outline);
}

.m3-tab-item.active .tab-count-badge {
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  font-weight: 600;
}

/* 3px M3 Active Indicator Bar */
.tab-active-indicator {
  position: absolute;
  bottom: 0;
  left: 12px;
  right: 12px;
  height: 3px;
  border-radius: 3px 3px 0 0;
  background-color: var(--md-sys-color-primary);
}

/* ==========================================================================
   Layer 3: Unified M3 Filter Toolbar (统一过滤工具条)
   ========================================================================== */
.m3-filter-toolbar {
  padding: 10px 28px 12px 28px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background-color: var(--md-sys-color-surface-container-lowest);
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  flex-shrink: 0;
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 10px;
}

.chips-scroll-container {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}

/* 标准统一 M3 Filter Chip (高度 30px, 圆角 8px sm) */
.m3-filter-chip {
  height: 30px;
  padding: 0 12px;
  border-radius: var(--md-shape-corner-sm);
  border: 1px solid var(--md-sys-color-outline-variant);
  background-color: var(--md-sys-color-surface-container-low);
  color: var(--md-sys-color-on-surface-variant);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
}

.m3-filter-chip:hover {
  background-color: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface);
}

.m3-filter-chip.active {
  background-color: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
  border-color: transparent;
  font-weight: 600;
}

/* M3 Action Chip (用于局部的 +新建错题本) */
.m3-action-chip {
  height: 30px;
  padding: 0 12px;
  border-radius: var(--md-shape-corner-sm);
  border: 1px dashed var(--md-sys-color-outline-variant);
  background-color: transparent;
  color: var(--md-sys-color-primary);
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s ease;
}

.m3-action-chip:hover {
  background-color: var(--md-sys-color-surface-container);
  border-color: var(--md-sys-color-primary);
}

/* Secondary Filters (Tag + Type + Sort + Stats) */
.secondary-filters-section {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: nowrap;
}

.tags-filter-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.tag-filter-chip.active {
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border-color: var(--md-sys-color-primary);
}

.hash-symbol {
  opacity: 0.5;
  font-weight: 700;
}

.tag-counter {
  font-size: 10px;
  opacity: 0.8;
  padding: 0 4px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.08);
}
.tag-filter-chip.active .tag-counter {
  background: rgba(255, 255, 255, 0.25);
  color: var(--md-sys-color-on-primary);
}

.btn-clear-tags-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  border-radius: var(--md-shape-corner-full);
  background-color: var(--md-sys-color-error-container);
  color: var(--md-sys-color-error);
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-clear-tags-chip:hover {
  filter: brightness(0.95);
}

.empty-tag-note {
  font-size: 11px;
  color: var(--md-sys-color-outline);
  font-style: italic;
  white-space: nowrap;
}

.m3-vertical-divider {
  width: 1px;
  height: 18px;
  background-color: var(--md-sys-color-outline-variant);
  flex-shrink: 0;
}

.type-chips-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.type-filter-chip {
  padding: 0 10px;
}

/* ==========================================================================
   M3 Dropdown Menu (替代原生 select)
   ========================================================================== */
.m3-menu-wrapper {
  position: relative;
  flex-shrink: 0;
}

.m3-menu-trigger-btn {
  height: 30px;
  padding: 0 10px;
  border-radius: var(--md-shape-corner-sm);
  border: 1px solid var(--md-sys-color-outline-variant);
  background-color: var(--md-sys-color-surface-container-low);
  color: var(--md-sys-color-on-surface);
  font-size: 12px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.m3-menu-trigger-btn:hover {
  background-color: var(--md-sys-color-surface-container-high);
}

.m3-menu-trigger-btn.active {
  border-color: var(--md-sys-color-primary);
  background-color: var(--md-sys-color-surface-container);
}

.sort-icon {
  color: var(--md-sys-color-on-surface-variant);
}

.sort-current-label {
  font-weight: 600;
}

.chevron-arrow {
  color: var(--md-sys-color-outline);
  transition: transform 0.2s ease;
}

.chevron-arrow.open {
  transform: rotate(180deg);
}

.m3-dropdown-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 150px;
  background-color: var(--md-sys-color-surface-container-high);
  border-radius: var(--md-shape-corner-md);
  border: 1px solid var(--md-sys-color-outline-variant);
  box-shadow: var(--md-elevation-2);
  padding: 4px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.m3-menu-item {
  height: 32px;
  padding: 0 10px;
  border-radius: var(--md-shape-corner-xs);
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: var(--md-sys-color-on-surface);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.1s ease;
  text-align: left;
}

.m3-menu-item:hover {
  background-color: var(--md-sys-color-surface-container-highest);
}

.m3-menu-item.active {
  color: var(--md-sys-color-primary);
  font-weight: 700;
  background-color: var(--md-sys-color-primary-container);
}

.menu-check-icon {
  color: var(--md-sys-color-primary);
  flex-shrink: 0;
}

.menu-check-placeholder {
  width: 13px;
  flex-shrink: 0;
}

.m3-menu-fade-enter-active,
.m3-menu-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.m3-menu-fade-enter-from,
.m3-menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* 结果计数芯片 */
.results-stats-chip {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--md-sys-color-outline);
  flex-shrink: 0;
}

.and-tag-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: var(--md-shape-corner-xs);
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}

.stats-text {
  font-weight: 600;
  color: var(--md-sys-color-on-surface-variant);
}

/* ==========================================================================
   Problems Scroll Area
   ========================================================================== */
.problems-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px 28px 40px 28px;
}

.cards-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 960px;
  margin: 0 auto;
}

.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
  color: var(--md-sys-color-on-surface-variant);
  gap: 12px;
}

.empty-icon {
  color: var(--md-sys-color-outline);
}

.empty-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}

.btn-sm {
  height: 32px;
  padding: 0 14px;
  font-size: 12px;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--md-sys-color-surface-container-high);
  border-top-color: var(--md-sys-color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* Dialog */
.m3-dialog-scrim {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.m3-dialog {
  background: var(--md-sys-color-surface-container-high);
  border-radius: var(--md-shape-corner-xl);
  width: 440px;
  max-width: 90vw;
  padding: 24px;
  box-shadow: var(--md-elevation-3);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dialog-icon-wrapper {
  width: 42px;
  height: 42px;
  border-radius: var(--md-shape-corner-full);
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dialog-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}

.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface-variant);
}

.m3-input {
  height: 38px;
  border-radius: var(--md-shape-corner-sm);
  border: 1px solid var(--md-sys-color-outline-variant);
  background: var(--md-sys-color-surface-container-lowest);
  padding: 0 12px;
  font-size: 13px;
  outline: none;
}
.m3-input:focus {
  border-color: var(--md-sys-color-primary);
}

.subject-radio-group {
  display: flex;
  gap: 8px;
}

.radio-label {
  flex: 1;
  height: 32px;
  border: 1px solid var(--md-sys-color-outline-variant);
  background: var(--md-sys-color-surface-container-lowest);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.radio-label.active {
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  border-color: transparent;
  font-weight: 700;
}

.hidden-radio {
  display: none;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 6px;
}

.btn-text {
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface-variant);
  border-radius: var(--md-shape-corner-full);
}

.danger-icon {
  background-color: var(--md-sys-color-error-container);
  color: var(--md-sys-color-error);
}

.delete-problem-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--md-sys-color-surface-container);
  border: 1px solid var(--md-sys-color-outline-variant);
  padding: 10px 14px;
  border-radius: var(--md-shape-corner-sm);
  margin: 10px 0;
}

.preview-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--md-shape-corner-xs);
  background-color: var(--md-sys-color-surface-container-highest);
  color: var(--md-sys-color-on-surface);
  white-space: nowrap;
}

.preview-summary {
  font-size: 13px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dialog-desc {
  font-size: 14px;
  color: var(--md-sys-color-on-surface);
  margin: 0;
}

.dialog-hint {
  font-size: 12px;
  color: var(--md-sys-color-outline);
  margin: 4px 0 0 0;
  line-height: 1.4;
}

.btn-danger {
  height: 38px;
  padding: 0 18px;
  border-radius: var(--md-shape-corner-full);
  background-color: var(--md-sys-color-error);
  color: var(--md-sys-color-on-error);
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
}
.btn-danger:hover {
  filter: brightness(1.1);
  box-shadow: var(--md-elevation-1);
}

/* ==========================================================================
   Batch Toggle Chip & M3 Floating Dock
   ========================================================================== */
.batch-chip {
  gap: 6px;
  font-weight: 600;
}
.batch-chip.active {
  background-color: var(--md-sys-color-primary) !important;
  color: var(--md-sys-color-on-primary) !important;
  border-color: var(--md-sys-color-primary) !important;
}
.batch-num-badge {
  padding: 0 6px;
  border-radius: var(--md-shape-corner-full);
  font-size: 11px;
  font-weight: 700;
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}
.batch-chip.active .batch-num-badge {
  background-color: var(--md-sys-color-on-primary);
  color: var(--md-sys-color-primary);
}

.m3-floating-dock-wrapper {
  position: fixed;
  bottom: 24px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  z-index: 100;
  pointer-events: none;
}

.m3-floating-dock {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  background-color: var(--md-sys-color-surface-container-high);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-shape-corner-full);
  box-shadow: var(--md-elevation-3);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
}

[data-theme="light"] .m3-floating-dock {
  background-color: rgba(255, 255, 255, 0.92);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
}

[data-theme="dark"] .m3-floating-dock {
  background-color: rgba(30, 36, 45, 0.9);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2);
}

.dock-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dock-pill-badge {
  font-size: 13px;
  color: var(--md-sys-color-on-surface);
  padding: 4px 12px;
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  border-radius: var(--md-shape-corner-full);
  font-weight: 500;
}

.dock-pill-badge strong {
  font-weight: 700;
}

.dock-btn-subtle {
  font-size: 12px;
  font-weight: 600;
  color: var(--md-sys-color-primary);
  background: transparent;
  border: none;
  padding: 4px 8px;
  border-radius: var(--md-shape-corner-xs);
  cursor: pointer;
  transition: background-color 0.15s;
}
.dock-btn-subtle:hover {
  background-color: var(--md-sys-color-surface-container-highest);
}

.dock-divider {
  width: 1px;
  height: 22px;
  background-color: var(--md-sys-color-outline-variant);
}

.dock-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dock-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border-radius: var(--md-shape-corner-full);
  background-color: var(--md-sys-color-surface-container-lowest);
  border: 1px solid var(--md-sys-color-outline-variant);
  color: var(--md-sys-color-on-surface);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.dock-action-btn:hover:not(:disabled) {
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  border-color: var(--md-sys-color-primary);
  transform: translateY(-1px);
}

.dock-action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.dock-btn-danger:hover:not(:disabled) {
  background-color: var(--md-sys-color-error-container);
  color: var(--md-sys-color-error);
  border-color: var(--md-sys-color-error);
}

.dock-btn-close {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--md-sys-color-on-surface-variant);
  cursor: pointer;
  transition: all 0.15s;
}
.dock-btn-close:hover {
  background-color: var(--md-sys-color-surface-container-highest);
  color: var(--md-sys-color-on-surface);
}

/* Dock Transitions */
.m3-dock-slide-enter-active,
.m3-dock-slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.2, 0, 0, 1), opacity 0.2s ease;
}
.m3-dock-slide-enter-from,
.m3-dock-slide-leave-to {
  opacity: 0;
  transform: translateY(30px) scale(0.95);
}

/* Segmented control in transfer dialog */
.m3-segmented-control {
  display: flex;
  background-color: var(--md-sys-color-surface-container-high);
  border-radius: var(--md-shape-corner-sm);
  padding: 3px;
  gap: 4px;
}

.segmented-btn {
  flex: 1;
  height: 36px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--md-sys-color-on-surface-variant);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.segmented-btn.active {
  background-color: var(--md-sys-color-surface-container-lowest);
  color: var(--md-sys-color-on-surface);
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.m3-select-box {
  width: 100%;
  height: 42px;
  padding: 0 12px;
  border-radius: var(--md-shape-corner-sm);
  border: 1px solid var(--md-sys-color-outline-variant);
  background-color: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface);
  font-size: 14px;
  font-family: inherit;
  outline: none;
}
.m3-select-box:focus {
  border-color: var(--md-sys-color-primary);
  box-shadow: 0 0 0 2px var(--md-sys-color-primary-container);
}

/* Quick Tag Pick Area */
.quick-tag-pick-area {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}
.quick-tags-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.quick-tag-chip {
  font-size: 12px;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: var(--md-shape-corner-full);
  background-color: var(--md-sys-color-surface-container-high);
  border: 1px solid var(--md-sys-color-outline-variant);
  color: var(--md-sys-color-on-surface-variant);
  cursor: pointer;
  transition: all 0.15s;
}
.quick-tag-chip:hover {
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  border-color: var(--md-sys-color-primary);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
