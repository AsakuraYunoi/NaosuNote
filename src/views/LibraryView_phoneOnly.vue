<template>
  <div class="library-phone-view" @click="handlePageClick">
    <!-- Top Mobile Header Bar -->
    <header class="phone-top-bar">
      <!-- Search Input Box -->
      <div class="search-box-phone">
        <Search :size="16" class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="`搜索${selectedSubject}错题、考点、标签...`"
          class="search-input-phone"
        />
        <button v-if="searchQuery" class="clear-search-btn" @click="searchQuery = ''">
          <X :size="14" />
        </button>
      </div>

      <!-- Top Bar Actions: 独立标签管理页入口、筛选入口与个人头像入口 -->
      <div class="top-bar-actions">
        <!-- 知识点标签管理与编辑入口 -->
        <button
          class="icon-btn-phone"
          :class="{ active: selectedTags.length > 0 }"
          title="知识点标签管理与编辑"
          @click.stop="openTagSheet"
        >
          <Tag :size="17" />
          <span v-if="selectedTags.length > 0" class="filter-active-dot"></span>
        </button>

        <!-- 综合筛选与排序入口 -->
        <button
          class="icon-btn-phone"
          :class="{ active: hasActiveFiltersNoTags }"
          title="综合筛选与排序"
          @click.stop="openFilterSheet"
        >
          <SlidersHorizontal :size="17" />
          <span v-if="hasActiveFiltersNoTags" class="filter-active-dot"></span>
        </button>

        <!-- Profile Avatar Entry Button (打开个人信息全屏页面) -->
        <button
          class="profile-avatar-btn"
          title="账号与个人中心"
          @click.stop="$emit('open-profile')"
        >
          <img :src="userAvatarUrl" alt="用户头像" class="top-avatar-img" />
          <span v-if="isAutoSyncing || isSyncing" class="avatar-sync-dot"></span>
        </button>
      </div>
    </header>

    <!-- 学科主导航条 (与桌面端完全一致：仅数学/物理/化学/生物，无混杂的“全部”集合) -->
    <nav class="subject-tabs-scroll">
      <button
        v-for="sub in subjects"
        :key="sub"
        class="subject-tab-btn"
        :class="{ active: selectedSubject === sub, [getSubjectClass(sub)]: true }"
        @click="selectSubject(sub)"
      >
        <span class="tab-dot"></span>
        <span class="tab-text">{{ sub }}</span>
        <span class="count-pill">{{ getSubjectProblemCount(sub) }}</span>
      </button>
    </nav>

    <!-- 错题本 Filter Chips 横滑行 (与桌面端逻辑一致) -->
    <div class="notebooks-chips-row">
      <!-- 1. 全部该学科错题 -->
      <button
        class="filter-chip-phone"
        :class="{ active: selectedNotebookId === 'all' }"
        @click="selectedNotebookId = 'all'"
      >
        全部{{ selectedSubject }}错题
      </button>

      <!-- 2. 当前学科下的独立错题本 -->
      <button
        v-for="nb in currentSubjectNotebooks"
        :key="nb.id"
        class="filter-chip-phone"
        :class="{ active: selectedNotebookId === nb.id }"
        @click="selectedNotebookId = nb.id"
      >
        {{ nb.name }}
      </button>

      <!-- 3. 新建错题本操作 Chip -->
      <button class="filter-chip-phone add-nb-chip" @click="openCreateNotebookDialog">
        <Plus :size="13" />
        <span>新建本</span>
      </button>
    </div>

    <!-- 筛选激活提示条 (如果在抽屉中设置了题型/星级/标签) -->
    <div v-if="hasActiveFilters" class="active-filter-banner">
      <span class="banner-text">
        已筛选:
        <span v-if="selectedType !== 'all'">{{ selectedType }} · </span>
        <span v-if="selectedTags.length > 0">#{{ selectedTags.join(' #') }} · </span>
        <span v-if="selectedDifficulty > 0">{{ selectedDifficulty }}星 · </span>
        共 {{ filteredProblems.length }} 题
      </span>
      <button class="clear-filters-link" @click="resetFilters">重置</button>
    </div>

    <!-- 错题卡片流 (进去就能直接看题，与桌面端完全一致) -->
    <main class="problems-feed">
      <div v-if="isLoading && problems.length === 0" class="feed-state-box">
        <Loader2 :size="24" class="spin-anim" />
        <span>正在加载错题...</span>
      </div>

      <div v-else-if="filteredProblems.length === 0" class="feed-state-box empty-state">
        <div class="empty-icon-circle">
          <BookOpen :size="32" />
        </div>
        <p class="empty-title">当前无匹配错题</p>
        <p class="empty-desc">点击右下方操作菜单“+”录入错题，或尝试切换错题本及调整筛选条件</p>
        <button class="btn-primary-mobile" @click="$emit('nav', 'ingest')">
          <Plus :size="16" />
          <span>立即录入错题</span>
        </button>
      </div>

      <div v-else class="problems-list-phone">
        <ProblemCard_phoneOnly
          v-for="item in filteredProblems"
          :key="item.uuid"
          :problem="item"
          :in-cart="isInCart(item.uuid)"
          :selectable="isBatchMode"
          :selected="selectedUuids.includes(item.uuid)"
          @toggle-cart="$emit('toggle-cart', $event)"
          @toggle-select="onToggleSelect"
          @tag-click="onTagClick"
          @update-rating="onUpdateRating"
          @delete="onDeleteProblem"
          @edit="onEditProblem"
          @update-tags="onUpdateTags"
          @transfer="openSingleTransfer"
          @notify="$emit('notify', $event)"
        />
      </div>
    </main>

    <!-- M3 Floating Batch Dock (桌面端同款底部悬浮批量编辑胶囊控件) -->
    <transition name="m3-dock-slide">
      <div v-if="isBatchMode || selectedUuids.length > 0" class="m3-floating-dock-wrapper">
        <div class="m3-floating-dock">
          <!-- Left: Counters & Selection helpers -->
          <div class="dock-left">
            <div class="dock-pill-badge">
              <span>已选 <strong>{{ selectedUuids.length }}</strong> 项</span>
            </div>
            <button class="dock-btn-subtle" @click="batchSelectAll">
              {{ selectedUuids.length === filteredProblems.length ? '取消全选' : '全选' }}
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
              title="将已选题目批量加入组卷打印"
              @click="batchAddToCart"
            >
              <Printer :size="14" />
              <span>加打印</span>
            </button>

            <button
              class="dock-action-btn dock-btn-danger"
              :disabled="selectedUuids.length === 0"
              title="批量删除已选题"
              @click="batchDelete"
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

    <!-- M3 Floating Action Speed Dial (屏幕右下角悬浮工具栏：复用桌面端规范) -->
    <transition name="m3-fab-pop">
      <div v-if="!isBatchMode && selectedUuids.length === 0" class="m3-speed-dial-wrapper">
        <!-- 半透明点击外部收回蒙层 -->
        <div v-if="isFabExpanded" class="fab-scrim" @click.stop="isFabExpanded = false"></div>

        <!-- 浮动展开子菜单胶囊 (Speed Dial Action Pills) -->
        <transition name="m3-speed-dial-pills">
          <div v-if="isFabExpanded" class="speed-dial-menu" @click.stop>
            <!-- 1. 添加题目 / 录入错题 -->
            <button
              class="speed-dial-action-pill"
              title="录入新错题"
              @click="handleFabAction('ingest')"
            >
              <div class="pill-icon-circle">
                <Plus :size="16" />
              </div>
              <span class="pill-text">录入错题</span>
            </button>

            <!-- 2. 拍照识题 (只保留入口，提示开发中) -->
            <button
              class="speed-dial-action-pill"
              title="拍照识题"
              @click="handleFabAction('camera')"
            >
              <div class="pill-icon-circle">
                <Camera :size="16" />
              </div>
              <span class="pill-text">拍照识题</span>
            </button>

            <!-- 3. 批量编辑 (桌面端移植) -->
            <button
              class="speed-dial-action-pill"
              title="进入批量编辑模式"
              @click="handleFabAction('batch')"
            >
              <div class="pill-icon-circle">
                <ListChecks :size="16" />
              </div>
              <span class="pill-text">批量编辑</span>
            </button>

            <!-- 4. 同步功能 (桌面端移植) -->
            <button
              class="speed-dial-action-pill"
              :class="{ 'is-syncing': isSyncing }"
              :disabled="isSyncing"
              title="同步数据与云端"
              @click="handleFabAction('sync')"
            >
              <div class="pill-icon-circle">
                <RotateCw :size="16" :class="{ 'spin-anim': isSyncing }" />
              </div>
              <span class="pill-text">{{ isSyncing ? '同步中...' : '同步数据' }}</span>
            </button>
          </div>
        </transition>

        <!-- 主 FAB 触发按钮 (折叠显示铅笔，展开显示 X) -->
        <button
          class="m3-main-fab"
          :class="{ expanded: isFabExpanded }"
          :title="isFabExpanded ? '收起浮动菜单' : '展开操作菜单'"
          @click.stop="toggleFabExpand"
        >
          <transition name="fab-icon-spin" mode="out-in">
            <X v-if="isFabExpanded" key="close" :size="22" class="fab-icon" />
            <Pencil v-else key="pencil" :size="20" class="fab-icon" />
          </transition>
        </button>
      </div>
    </transition>

    <!-- 1. 独立知识点标签管理与编辑抽屉 (Dedicated Tag Manager Sheet) -->
    <Transition name="sheet">
      <div v-if="showTagSheet" class="bottom-sheet-backdrop" @click.self="showTagSheet = false">
        <div class="bottom-sheet-panel tag-editor-sheet">
          <div class="sheet-drag-handle"></div>

          <!-- Header -->
          <div class="sheet-header">
            <div class="sheet-title-group">
              <Tag :size="17" class="sheet-title-icon" />
              <h3>知识点标签</h3>
              <span class="sheet-count-tag">{{ availableTags.length }}</span>
            </div>
            <div class="sheet-header-actions">
              <button
                class="btn-toggle-manage"
                :class="{ active: isTagManageMode }"
                @click="isTagManageMode = !isTagManageMode"
              >
                {{ isTagManageMode ? '完成' : '编辑管理' }}
              </button>
              <button class="sheet-close-btn" @click="showTagSheet = false">
                <X :size="18" />
              </button>
            </div>
          </div>

          <div class="sheet-body tag-sheet-body">
            <!-- 搜索与新建栏 -->
            <div class="tag-toolbar-row">
              <div class="tag-search-minimal">
                <Search :size="14" class="search-ico" />
                <input
                  v-model="tagSearchQuery"
                  type="text"
                  placeholder="搜索标签..."
                  class="search-inp"
                />
                <button v-if="tagSearchQuery" class="clear-btn" @click="tagSearchQuery = ''">
                  <X :size="12" />
                </button>
              </div>

              <button
                v-if="!isAddingNewTag"
                class="btn-new-tag-pill"
                @click="openAddTagInput"
              >
                <Plus :size="13" />
                <span>新建</span>
              </button>
            </div>

            <!-- 新建标签输入行 (展开时优雅呈现) -->
            <div v-if="isAddingNewTag" class="new-tag-creator-card">
              <div class="creator-input-wrap">
                <span class="hash-symbol">#</span>
                <input
                  ref="newTagInputRef"
                  v-model="newTagNameInput"
                  type="text"
                  placeholder="输入新标签名称..."
                  class="creator-input"
                  maxlength="20"
                  @keydown.enter="submitCreateTag"
                  @keydown.esc="cancelCreateTag"
                />
              </div>
              <div class="creator-actions">
                <button class="btn-creator-cancel" @click="cancelCreateTag">取消</button>
                <button
                  class="btn-creator-submit"
                  :disabled="!newTagNameInput.trim()"
                  @click="submitCreateTag"
                >
                  创建
                </button>
              </div>
            </div>

            <!-- 选中的标签交集状态提示 -->
            <div v-if="selectedTags.length > 0 && !isTagManageMode" class="active-tags-status">
              <span class="status-summary">已勾选 <strong>{{ selectedTags.length }}</strong> 个标签交集筛选</span>
              <button class="btn-clear-selection" @click="clearAllTags">清空勾选</button>
            </div>

            <!-- 管理模式说明条 -->
            <div v-if="isTagManageMode" class="manage-mode-banner">
              <span>编辑模式：点击铅笔重命名标签，点击垃圾桶删除标签</span>
            </div>

            <!-- 标签列表流 (Tags Flow Grid) -->
            <div class="tags-modern-flow">
              <div
                v-for="t in filteredTagList"
                :key="t.name"
                class="modern-tag-card"
                :class="{
                  selected: isTagSelected(t.name) && !isTagManageMode,
                  'is-editing': editingTagName === t.name,
                }"
                @click="!isTagManageMode && toggleTag(t.name)"
              >
                <!-- 行内重命名模式 -->
                <div v-if="editingTagName === t.name" class="rename-inline-box" @click.stop>
                  <input
                    v-model="editingTagInput"
                    class="rename-field"
                    maxlength="20"
                    autofocus
                    @keydown.enter="submitRenameTag(t.name)"
                    @keydown.esc="cancelRenameTag"
                  />
                  <button class="btn-rename-ok" @click="submitRenameTag(t.name)">
                    <Check :size="13" />
                  </button>
                  <button class="btn-rename-cancel" @click="cancelRenameTag">
                    <X :size="13" />
                  </button>
                </div>

                <!-- 正常展示模式 -->
                <template v-else>
                  <div class="tag-card-main">
                    <span class="tag-hash-txt">#</span>
                    <span class="tag-name-txt">{{ t.name }}</span>
                    <span class="tag-count-bubble">{{ t.count }}</span>
                  </div>

                  <!-- 管理模式下的快捷操作 -->
                  <div v-if="isTagManageMode" class="tag-manage-ops" @click.stop>
                    <button class="btn-op-icon edit" title="重命名标签" @click.stop="startRenameTag(t.name)">
                      <Pencil :size="12" />
                    </button>
                    <button class="btn-op-icon del" title="删除标签" @click.stop="promptDeleteTag(t.name)">
                      <Trash2 :size="12" />
                    </button>
                  </div>
                </template>
              </div>

              <!-- 空状态 -->
              <div v-if="filteredTagList.length === 0" class="empty-tag-list">
                <span v-if="tagSearchQuery">未找到与“{{ tagSearchQuery }}”匹配的标签</span>
                <span v-else>当前学科暂无知识点标签，点击上方「新建」即可创建</span>
              </div>
            </div>
          </div>

          <!-- 底部完成按钮 -->
          <div class="sheet-bottom-bar">
            <button class="btn-sheet-done" @click="showTagSheet = false">
              完成
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 2. 综合筛选与排序抽屉 (Advanced Filter Sheet) -->
    <Transition name="sheet">
      <div v-if="showFilterSheet" class="bottom-sheet-backdrop" @click.self="showFilterSheet = false">
        <div class="bottom-sheet-panel">
          <div class="sheet-drag-handle"></div>
          <div class="sheet-header">
            <div class="sheet-title-group">
              <SlidersHorizontal :size="16" class="sheet-title-icon" />
              <h3>筛选与排序</h3>
            </div>
            <button class="sheet-close-btn" @click="showFilterSheet = false">
              <X :size="18" />
            </button>
          </div>

          <div class="sheet-body">
            <!-- 排序方式 Section -->
            <div class="filter-section">
              <label class="section-label">排序方式</label>
              <div class="chips-group">
                <button
                  v-for="s in sortOptions"
                  :key="s.value"
                  class="option-chip"
                  :class="{ active: selectedSort === s.value }"
                  @click="selectedSort = s.value"
                >
                  {{ s.label }}
                </button>
              </div>
            </div>

            <!-- 题型筛选 Section -->
            <div class="filter-section">
              <label class="section-label">题型筛选</label>
              <div class="chips-group">
                <button
                  v-for="t in typeOptions"
                  :key="t"
                  class="option-chip"
                  :class="{ active: selectedType === t }"
                  @click="selectedType = t"
                >
                  {{ t === 'all' ? '全部题型' : t }}
                </button>
              </div>
            </div>

            <!-- 难度星级 Section -->
            <div class="filter-section">
              <label class="section-label">星级难度</label>
              <div class="chips-group">
                <button
                  class="option-chip"
                  :class="{ active: selectedDifficulty === 0 }"
                  @click="selectedDifficulty = 0"
                >
                  全部难度
                </button>
                <button
                  v-for="star in [1, 2, 3, 4, 5]"
                  :key="star"
                  class="option-chip"
                  :class="{ active: selectedDifficulty === star }"
                  @click="selectedDifficulty = star"
                >
                  {{ star }} 星
                </button>
              </div>
            </div>
          </div>

          <div class="sheet-footer">
            <button class="sheet-btn btn-secondary" @click="resetFilters">重置全部</button>
            <button class="sheet-btn btn-primary" @click="showFilterSheet = false">完成筛选</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Create Notebook Modal (新建错题本弹窗) -->
    <Transition name="fade">
      <div v-if="showAddNotebookModal" class="modal-backdrop" @click.self="showAddNotebookModal = false">
        <div class="modal-card">
          <h3>新建错题本</h3>
          <p class="modal-hint">所属学科：{{ selectedSubject }}</p>
          <input
            v-model="newNotebookName"
            type="text"
            placeholder="输入错题本名称 (如: 函数专项突破)"
            class="modal-input"
            maxlength="30"
            @keydown.enter="confirmCreateNotebook"
          />
          <div class="modal-actions">
            <button class="btn-secondary" @click="showAddNotebookModal = false">取消</button>
            <button class="btn-primary" :disabled="!newNotebookName.trim()" @click="confirmCreateNotebook">
              创建
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Transfer / Copy Dialog (错题流转转移弹窗) -->
    <Transition name="fade">
      <div v-if="showTransferDialog" class="modal-backdrop" @click.self="showTransferDialog = false">
        <div class="modal-card" @click.stop>
          <h3>转移或复制题目</h3>
          <p class="modal-hint">对选中的错题执行错题本流转：</p>

          <div class="transfer-mode-selector">
            <button
              class="mode-btn"
              :class="{ active: transferMode === 'move' }"
              @click="transferMode = 'move'"
            >
              移动错题
            </button>
            <button
              class="mode-btn"
              :class="{ active: transferMode === 'copy' }"
              @click="transferMode = 'copy'"
            >
              复制错题
            </button>
          </div>

          <div class="transfer-field-group">
            <label class="field-label">目标错题本：</label>
            <select v-model="transferTargetNotebookId" class="modal-select">
              <option
                v-for="nb in notebooks"
                :key="nb.id"
                :value="nb.id"
              >
                {{ nb.name }} ({{ nb.subject }})
              </option>
            </select>
          </div>

          <div class="modal-actions">
            <button class="btn-secondary" @click="showTransferDialog = false">取消</button>
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
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, onActivated } from 'vue';
import {
  Search,
  X,
  Plus,
  SlidersHorizontal,
  Tag,
  BookOpen,
  Loader2,
  RotateCw,
  Pencil,
  Trash2,
  Check,
  Camera,
  ListChecks,
  SquareCheck,
  Square,
  Printer,
} from 'lucide-vue-next';
import { userAvatarUrl } from '../utils/avatar';
import type { Problem, Notebook, TagCount } from '../types/problem';
import {
  apiGetProblems,
  apiGetNotebooks,
  apiGetTags,
  apiDeleteProblem,
  apiCreateNotebook,
  apiUpdateRatings,
  apiSyncCloud,
  apiSyncAllMirrors,
  apiCreateTag,
  apiRenameTag,
  apiDeleteTag,
  apiMoveOrCopyProblems,
} from '../utils/api';
import ProblemCard_phoneOnly from '../components/ProblemCard_phoneOnly.vue';

const props = defineProps<{
  printCart: Problem[];
  isAutoSyncing?: boolean;
  targetProblem?: Problem | null;
  targetSubject?: string | null;
  targetNotebookId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'nav', tab: string): void;
  (e: 'toggle-cart', problem: Problem): void;
  (e: 'remove-from-cart', uuid: string): void;
  (e: 'notify', msg: string): void;
  (e: 'edit-problem', problem: Problem, context?: any): void;
  (e: 'clear-target'): void;
  (e: 'open-profile'): void;
}>();

// 核心数据集
const problems = ref<Problem[]>([]);
const notebooks = ref<Notebook[]>([]);
const availableTags = ref<TagCount[]>([]);
const isLoading = ref(true);
const isSyncing = ref(false);

// 学科与错题本 (同桌面端：只有数学/物理/化学/生物，默认数学，无“全部”集合)
const subjects = ['数学', '物理', '化学', '生物'];
const selectedSubject = ref<string>('数学');
const selectedNotebookId = ref<string>('all');

// 搜索与高级过滤状态
const searchQuery = ref('');
const selectedType = ref('all');
const selectedDifficulty = ref(0);
const selectedTags = ref<string[]>([]);
const selectedSort = ref('date_desc');

// 批量管理模式
const isBatchMode = ref(false);
const selectedUuids = ref<string[]>([]);

// 抽屉与浮动菜单
const showFilterSheet = ref(false);
const isFabExpanded = ref(false);

// 标签编辑状态
const tagSearchQuery = ref('');
const isAddingNewTag = ref(false);
const newTagNameInput = ref('');
const newTagInputRef = ref<HTMLInputElement | null>(null);
const editingTagName = ref<string | null>(null);
const editingTagInput = ref('');

// 新建错题本弹窗
const showAddNotebookModal = ref(false);
const newNotebookName = ref('');

const sortOptions = [
  { label: '最新录入', value: 'date_desc' },
  { label: '最早录入', value: 'date_asc' },
  { label: '难度降序', value: 'difficulty_desc' },
  { label: '难度升序', value: 'difficulty_asc' },
];

const typeOptions = ['all', '单选', '多选', '填空', '简答'];

onMounted(async () => {
  await loadData();

  // 若从其他页面携带了学科或错题本上下文，恢复定位
  if (props.targetSubject && subjects.includes(props.targetSubject)) {
    selectedSubject.value = props.targetSubject;
  }
  if (props.targetNotebookId) {
    selectedNotebookId.value = props.targetNotebookId;
  }
});

onActivated(async () => {
  if (props.targetSubject && subjects.includes(props.targetSubject)) {
    selectedSubject.value = props.targetSubject;
  }
  if (props.targetNotebookId) {
    selectedNotebookId.value = props.targetNotebookId;
  }

  // 若从详情页返回并带有目标题目，定位并静默刷新
  if (props.targetProblem) {
    const targetUuid = props.targetProblem.uuid;
    const idx = problems.value.findIndex((p) => p.uuid === targetUuid);
    if (idx >= 0) {
      problems.value[idx] = { ...props.targetProblem };
    } else {
      await loadData(true);
    }
    nextTick(() => {
      const el = document.getElementById(`phone-card-${targetUuid}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  } else {
    await loadData(true);
  }
});

async function loadData(silent = false) {
  if (!silent && problems.value.length === 0) {
    isLoading.value = true;
  }
  try {
    const [pList, nbList, tList] = await Promise.all([
      apiGetProblems(),
      apiGetNotebooks(),
      apiGetTags(),
    ]);
    problems.value = pList;
    notebooks.value = nbList;
    availableTags.value = tList;
  } catch (err: any) {
    emit('notify', '错题数据加载失败: ' + (err?.message || err));
  } finally {
    isLoading.value = false;
  }
}

function getSubjectClass(sub: string) {
  const map: Record<string, string> = {
    数学: 'subject-math',
    物理: 'subject-physics',
    化学: 'subject-chem',
    生物: 'subject-bio',
  };
  return map[sub] || '';
}

function getSubjectProblemCount(sub: string) {
  return problems.value.filter((p) => p.subject === sub).length;
}

const currentSubjectNotebooks = computed(() => {
  return notebooks.value.filter((nb) => nb.subject === selectedSubject.value);
});

function selectSubject(sub: string) {
  selectedSubject.value = sub;
  selectedNotebookId.value = 'all';
  selectedUuids.value = [];
}

function openCreateNotebookDialog() {
  newNotebookName.value = '';
  showAddNotebookModal.value = true;
}

// 筛选状态计算
const hasActiveFiltersNoTags = computed(() => {
  return selectedType.value !== 'all' || selectedDifficulty.value > 0 || selectedSort.value !== 'date_desc';
});

const activeFilterCount = computed(() => {
  let count = 0;
  if (selectedType.value !== 'all') count++;
  if (selectedDifficulty.value > 0) count++;
  if (selectedSort.value !== 'date_desc') count++;
  if (selectedTags.value.length > 0) count += selectedTags.value.length;
  return count;
});

const hasActiveFilters = computed(() => activeFilterCount.value > 0);

function resetFilters() {
  selectedType.value = 'all';
  selectedDifficulty.value = 0;
  selectedSort.value = 'date_desc';
}

function openFilterSheet() {
  showFilterSheet.value = true;
  isFabExpanded.value = false;
}

const showTagSheet = ref(false);
const isTagManageMode = ref(false);

function openTagSheet() {
  showTagSheet.value = true;
  isTagManageMode.value = false;
  isFabExpanded.value = false;
}

// 错题过滤计算 (直接展示当前学科、当前错题本下的错题)
const filteredProblems = computed(() => {
  // 1. 学科过滤 (永远只展示当前学科题目，绝不混杂其他学科)
  let list = problems.value.filter((p) => p.subject === selectedSubject.value);

  // 2. 错题本过滤
  if (selectedNotebookId.value !== 'all') {
    list = list.filter((p) => p.notebook_id === selectedNotebookId.value);
  }

  // 3. 题型过滤
  if (selectedType.value !== 'all') {
    list = list.filter((p) => p.type === selectedType.value);
  }

  // 4. 难度过滤
  if (selectedDifficulty.value > 0) {
    list = list.filter((p) => (p.difficulty || 1) === selectedDifficulty.value);
  }

  // 5. 多标签交集过滤
  if (selectedTags.value.length > 0) {
    list = list.filter((p) => {
      const pTags = p.tags || [];
      return selectedTags.value.every((t) => pTags.includes(t));
    });
  }

  // 6. 搜索关键字过滤
  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    list = list.filter((p) => {
      const matchSummary = p.summary?.toLowerCase().includes(q);
      const matchText = p.stem_clean_text?.toLowerCase().includes(q);
      const matchHtml = p.raw_html?.toLowerCase().includes(q);
      const matchTags = p.tags?.some((t) => t.toLowerCase().includes(q));
      return matchSummary || matchText || matchHtml || matchTags;
    });
  }

  // 7. 排序
  list.sort((a, b) => {
    if (selectedSort.value === 'date_desc') {
      return (b.date || '').localeCompare(a.date || '');
    }
    if (selectedSort.value === 'date_asc') {
      return (a.date || '').localeCompare(b.date || '');
    }
    if (selectedSort.value === 'difficulty_desc') {
      return (b.difficulty || 1) - (a.difficulty || 1);
    }
    if (selectedSort.value === 'difficulty_asc') {
      return (a.difficulty || 1) - (b.difficulty || 1);
    }
    return 0;
  });

  return list;
});

// 标签检索与编辑功能 (完全对齐桌面端)
const filteredTagList = computed(() => {
  const q = tagSearchQuery.value.trim().toLowerCase();
  if (!q) return availableTags.value;
  return availableTags.value.filter((t) => t.name.toLowerCase().includes(q));
});

function isTagSelected(name: string) {
  return selectedTags.value.includes(name);
}

function toggleTag(name: string) {
  const idx = selectedTags.value.indexOf(name);
  if (idx >= 0) {
    selectedTags.value.splice(idx, 1);
  } else {
    selectedTags.value.push(name);
  }
}

function clearAllTags() {
  selectedTags.value = [];
}

function onTagClick(tag: string) {
  if (!selectedTags.value.includes(tag)) {
    selectedTags.value.push(tag);
  }
  emit('notify', `已添加标签交集筛选: #${tag}`);
}

function openAddTagInput() {
  isAddingNewTag.value = true;
  newTagNameInput.value = '';
  nextTick(() => {
    newTagInputRef.value?.focus();
  });
}

function cancelCreateTag() {
  isAddingNewTag.value = false;
  newTagNameInput.value = '';
}

async function submitCreateTag() {
  const name = newTagNameInput.value.trim();
  if (!name) return;
  try {
    await apiCreateTag(name);
    newTagNameInput.value = '';
    isAddingNewTag.value = false;
    emit('notify', `已成功创建标签 “${name}”`);
    availableTags.value = await apiGetTags();
    if (!selectedTags.value.includes(name)) {
      selectedTags.value.push(name);
    }
  } catch (e: any) {
    emit('notify', '创建标签失败: ' + (e?.message || e));
  }
}

function startRenameTag(name: string) {
  editingTagName.value = name;
  editingTagInput.value = name;
}

function cancelRenameTag() {
  editingTagName.value = null;
  editingTagInput.value = '';
}

async function submitRenameTag(oldName: string) {
  const newName = editingTagInput.value.trim();
  if (!newName) {
    emit('notify', '标签名称不能为空');
    return;
  }
  if (newName === oldName) {
    cancelRenameTag();
    return;
  }
  try {
    const updatedCount = await apiRenameTag(oldName, newName);
    const idx = selectedTags.value.indexOf(oldName);
    if (idx >= 0) {
      selectedTags.value[idx] = newName;
    }
    cancelRenameTag();
    emit('notify', `已将标签 “${oldName}” 重命名为 “${newName}”，同步更新 ${updatedCount} 道题目`);
    await loadData();
  } catch (e: any) {
    emit('notify', '修改标签失败: ' + (e?.message || e));
  }
}

async function promptDeleteTag(name: string) {
  if (!confirm(`确认删除知识点标签 “${name}”？\n该标签将从所有题目中移除。`)) return;
  try {
    const count = await apiDeleteTag(name);
    selectedTags.value = selectedTags.value.filter((t) => t !== name);
    emit('notify', `已删除标签 “${name}”，已从 ${count} 道错题中解除关联`);
    await loadData();
  } catch (e: any) {
    emit('notify', '删除标签失败: ' + (e?.message || e));
  }
}

// 浮动菜单 Speed Dial 逻辑 (复用桌面端)
function toggleFabExpand() {
  isFabExpanded.value = !isFabExpanded.value;
}

function handlePageClick() {
  if (isFabExpanded.value) {
    isFabExpanded.value = false;
  }
}

function handleFabAction(action: 'ingest' | 'camera' | 'batch' | 'sync') {
  isFabExpanded.value = false;
  if (action === 'ingest') {
    emit('nav', 'ingest');
  } else if (action === 'camera') {
    emit('notify', '拍照识题功能即将开放，敬请期待！');
  } else if (action === 'batch') {
    isBatchMode.value = true;
    selectedUuids.value = [];
  } else if (action === 'sync') {
    handleCloudSync();
  }
}

async function handleCloudSync() {
  if (isSyncing.value) return;
  isSyncing.value = true;
  try {
    const isLoggedIn = localStorage.getItem('naosu_is_logged_in') === 'true';
    if (isLoggedIn) {
      const res = await apiSyncCloud((progressMsg) => {
        emit('notify', progressMsg);
      });
      await loadData();
      const details = [];
      if (res.pulledProblems > 0) details.push(`拉取 ${res.pulledProblems} 题`);
      if (res.pushedProblems > 0) details.push(`推送 ${res.pushedProblems} 题`);
      if (res.deletedProblems > 0) details.push(`清理已删 ${res.deletedProblems} 题`);
      if (res.downloadedImages > 0) details.push(`下载图片 ${res.downloadedImages} 张`);
      if (res.uploadedImages > 0) details.push(`上传图片 ${res.uploadedImages} 张`);
      const syncMsg = details.length > 0 ? `云端同步完成！(${details.join('，')})` : '云端同步完成，数据已是最新';
      emit('notify', syncMsg);
    } else {
      emit('notify', '正在刷新本地题库数据与镜像...');
      await Promise.all([loadData(), apiSyncAllMirrors()]);
      emit('notify', '本地题库与 HTML 镜像已刷新 (登录云账号可开启多端双向云同步)');
    }
  } catch (err: any) {
    emit('notify', '云端同步失败: ' + (err?.message || err));
  } finally {
    isSyncing.value = false;
  }
}

// 批量管理操作与 M3 Batch Dock
function exitBatchMode() {
  isBatchMode.value = false;
  selectedUuids.value = [];
}

function onToggleSelect(uuid: string) {
  const idx = selectedUuids.value.indexOf(uuid);
  if (idx >= 0) {
    selectedUuids.value.splice(idx, 1);
  } else {
    selectedUuids.value.push(uuid);
  }
}

function batchSelectAll() {
  if (selectedUuids.value.length === filteredProblems.value.length) {
    selectedUuids.value = [];
  } else {
    selectedUuids.value = filteredProblems.value.map((p) => p.uuid);
  }
}

function invertSelection() {
  const currentSelected = new Set(selectedUuids.value);
  selectedUuids.value = filteredProblems.value
    .filter((p) => !currentSelected.has(p.uuid))
    .map((p) => p.uuid);
}

function isInCart(uuid: string): boolean {
  return props.printCart.some((p) => p.uuid === uuid);
}

function batchAddToCart() {
  let added = 0;
  for (const uuid of selectedUuids.value) {
    const prob = problems.value.find((p) => p.uuid === uuid);
    if (prob && !isInCart(uuid)) {
      emit('toggle-cart', prob);
      added++;
    }
  }
  emit('notify', `已批量加入 ${added} 道错题到打印篮`);
  exitBatchMode();
}

async function batchDelete() {
  if (!confirm(`确认批量删除已选中的 ${selectedUuids.value.length} 道错题？`)) return;
  try {
    for (const uuid of selectedUuids.value) {
      await apiDeleteProblem(uuid);
      emit('remove-from-cart', uuid);
    }
    emit('notify', `已成功删除 ${selectedUuids.value.length} 道错题`);
    exitBatchMode();
    await loadData();
  } catch (err: any) {
    emit('notify', '批量删除失败: ' + (err?.message || err));
  }
}

// 单题操作
async function onUpdateRating(uuid: string, diff?: number, imp?: number) {
  try {
    const prob = problems.value.find((p) => p.uuid === uuid);
    const finalDiff = diff !== undefined ? diff : (prob?.difficulty || 1);
    const finalImp = imp !== undefined ? imp : (prob?.importance || 1);
    await apiUpdateRatings(uuid, finalDiff, finalImp);
    if (prob) {
      prob.difficulty = finalDiff;
      prob.importance = finalImp;
    }
  } catch (err: any) {
    emit('notify', '更新星级失败: ' + (err?.message || err));
  }
}

// 转移 / 复制错题弹窗逻辑
const showTransferDialog = ref(false);
const transferTargetNotebookId = ref('');
const transferMode = ref<'move' | 'copy'>('move');
const transferUuids = ref<string[]>([]);

function openSingleTransfer(prob: Problem) {
  transferUuids.value = [prob.uuid];
  const candidates = notebooks.value.filter((nb) => nb.id !== prob.notebook_id);
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
  } catch (e: any) {
    emit('notify', '流转操作失败: ' + (e?.message || e));
  }
}

async function onDeleteProblem(problem: Problem) {
  if (!confirm(`确认删除错题 (${problem.summary || '未命名'})？`)) return;
  try {
    await apiDeleteProblem(problem.uuid);
    emit('remove-from-cart', problem.uuid);
    emit('notify', '错题已成功删除');
    await loadData();
  } catch (err: any) {
    emit('notify', '删除失败: ' + (err?.message || err));
  }
}

function onEditProblem(problem: Problem) {
  emit('edit-problem', problem, {
    subject: selectedSubject.value,
    notebookId: selectedNotebookId.value,
  });
}

function onUpdateTags(uuid: string, tags: string[]) {
  const prob = problems.value.find((p) => p.uuid === uuid);
  if (prob) prob.tags = tags;
}

// 新建错题本确认
async function confirmCreateNotebook() {
  const name = newNotebookName.value.trim();
  if (!name) return;
  try {
    const created = await apiCreateNotebook(name, selectedSubject.value);
    notebooks.value.push(created);
    showAddNotebookModal.value = false;
    newNotebookName.value = '';
    selectedNotebookId.value = created.id;
    emit('notify', `已在${selectedSubject.value}下创建错题本「${name}」`);
  } catch (err: any) {
    emit('notify', '创建错题本失败: ' + (err?.message || err));
  }
}
</script>

<style scoped>
.library-phone-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--md-sys-color-background);
  position: relative;
  overflow: hidden;
}

/* 顶部搜索与核心头像栏 */
.phone-top-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background-color: var(--md-sys-color-surface);
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  z-index: 20;
}

.search-box-phone {
  display: flex;
  align-items: center;
  flex: 1;
  background-color: var(--md-sys-color-surface-container);
  border-radius: 20px;
  padding: 0 12px;
  height: 38px;
  gap: 8px;
}

.search-icon {
  color: var(--md-sys-color-outline);
  flex-shrink: 0;
}

.search-input-phone {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 13px;
  color: var(--md-sys-color-on-surface);
}

.clear-search-btn {
  color: var(--md-sys-color-outline);
  display: flex;
  align-items: center;
  padding: 2px;
  background: none;
  border: none;
}

.top-bar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-btn-phone {
  width: 36px;
  height: 36px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-on-surface-variant);
  border: none;
  cursor: pointer;
  position: relative;
  -webkit-tap-highlight-color: transparent;
  transition: all 0.2s ease;
}

.icon-btn-phone.active {
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}

.filter-active-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: var(--md-sys-color-primary);
}

/* 个人头像按钮 */
.profile-avatar-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-tap-highlight-color: transparent;
}

.top-avatar-img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5px solid var(--md-sys-color-primary);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.avatar-sync-dot {
  position: absolute;
  top: 1px;
  right: 1px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #10b981;
  border: 1.5px solid var(--md-sys-color-surface);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.95); opacity: 0.7; }
  50% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.7; }
}

/* 学科分类横滑条 (同桌面端规范：数学/物理/化学/生物，无混杂“全部”) */
.subject-tabs-scroll {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  padding: 8px 14px 4px 14px;
  background-color: var(--md-sys-color-surface);
  scrollbar-width: none;
}

.subject-tabs-scroll::-webkit-scrollbar {
  display: none;
}

.subject-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
  font-weight: 500;
  padding: 7px 14px;
  border-radius: 20px;
  background: transparent;
  color: var(--md-sys-color-on-surface-variant);
  border: none;
  flex-shrink: 0;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
}

.tab-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--md-sys-color-outline);
  transition: background-color 0.2s ease;
}

.subject-tab-btn.active {
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
  font-weight: 700;
}

.subject-tab-btn.active .tab-dot {
  background-color: var(--md-sys-color-primary);
}

.subject-tab-btn.subject-math.active .tab-dot { background-color: #0b57d0; }
.subject-tab-btn.subject-physics.active .tab-dot { background-color: #9c27b0; }
.subject-tab-btn.subject-chem.active .tab-dot { background-color: #00796b; }
.subject-tab-btn.subject-bio.active .tab-dot { background-color: #2e7d32; }

.count-pill {
  font-size: 10px;
  background: rgba(0, 0, 0, 0.08);
  padding: 1px 6px;
  border-radius: 10px;
}

[data-theme="dark"] .count-pill {
  background: rgba(255, 255, 255, 0.12);
}

/* 错题本 Filter Chips 横滑行 */
.notebooks-chips-row {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  padding: 6px 14px 8px 14px;
  background-color: var(--md-sys-color-surface);
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  scrollbar-width: none;
}

.notebooks-chips-row::-webkit-scrollbar {
  display: none;
}

.filter-chip-phone {
  font-size: 12px;
  padding: 5px 12px;
  border-radius: 10px;
  background: var(--md-sys-color-surface-container);
  border: 1px solid var(--md-sys-color-outline-variant);
  color: var(--md-sys-color-on-surface-variant);
  flex-shrink: 0;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.18s ease;
}

.filter-chip-phone.active {
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border-color: var(--md-sys-color-primary);
  font-weight: 600;
}

.add-nb-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  border-style: dashed;
  color: var(--md-sys-color-outline);
}

/* 筛选激活提示条 */
.active-filter-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 14px;
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  font-size: 12px;
}

.clear-filters-link {
  font-weight: 600;
  color: var(--md-sys-color-primary);
  background: none;
  border: none;
  cursor: pointer;
}

/* 错题卡片流 */
.problems-feed {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 12px 14px 110px 14px;
}

.feed-state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--md-sys-color-outline);
  gap: 12px;
}

.empty-state {
  text-align: center;
}

.empty-icon-circle {
  width: 64px;
  height: 64px;
  border-radius: 32px;
  background: var(--md-sys-color-surface-container);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--md-sys-color-outline);
  margin-bottom: 6px;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
}

.empty-desc {
  font-size: 13px;
  color: var(--md-sys-color-on-surface-variant);
  max-width: 270px;
  line-height: 1.45;
}

.btn-primary-mobile {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 14px;
  padding: 10px 20px;
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border-radius: 20px;
  font-weight: 600;
  font-size: 14px;
  border: none;
  cursor: pointer;
}

/* ==========================================================================
   M3 Floating Batch Dock (桌面端同款底部悬浮批量编辑胶囊控件)
   ========================================================================== */
.m3-floating-dock-wrapper {
  position: fixed;
  bottom: calc(76px + env(safe-area-inset-bottom, 0px));
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  z-index: 130;
  pointer-events: none;
  padding: 0 10px;
}

.m3-floating-dock {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background-color: var(--md-sys-color-surface-container-highest);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 9999px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22), 0 2px 6px rgba(0, 0, 0, 0.08);
  max-width: 100%;
}

[data-theme="light"] .m3-floating-dock {
  background-color: #ffffff;
}

[data-theme="dark"] .m3-floating-dock {
  background-color: #242831;
}

.dock-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dock-pill-badge {
  font-size: 11.5px;
  color: var(--md-sys-color-on-primary-container);
  padding: 3px 8px;
  background-color: var(--md-sys-color-primary-container);
  border-radius: 9999px;
  font-weight: 500;
  white-space: nowrap;
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
  padding: 3px 5px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
}

.dock-divider {
  width: 1px;
  height: 18px;
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
  gap: 4px;
  height: 32px;
  padding: 0 10px;
  border-radius: 9999px;
  background-color: var(--md-sys-color-surface-container-lowest);
  border: 1px solid var(--md-sys-color-outline-variant);
  color: var(--md-sys-color-on-surface);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.dock-action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.dock-btn-danger {
  color: var(--md-sys-color-error);
}

.dock-btn-close {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--md-sys-color-on-surface-variant);
  cursor: pointer;
}

.m3-dock-slide-enter-active,
.m3-dock-slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.2, 0, 0, 1), opacity 0.2s ease;
}
.m3-dock-slide-enter-from,
.m3-dock-slide-leave-to {
  opacity: 0;
  transform: translateY(24px) scale(0.95);
}

/* ==========================================================================
   M3 Floating Action Speed Dial (屏幕右下角悬浮工具栏)
   ========================================================================== */
.m3-speed-dial-wrapper {
  position: fixed;
  right: 18px;
  bottom: calc(76px + env(safe-area-inset-bottom, 0px));
  z-index: 120;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  pointer-events: none;
}

.m3-speed-dial-wrapper > * {
  pointer-events: auto;
}

.fab-scrim {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: -1;
  pointer-events: auto;
}

.speed-dial-menu {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

.speed-dial-action-pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 18px 8px 10px;
  border-radius: 9999px;
  background-color: var(--md-sys-color-secondary-container, #e8def8);
  color: var(--md-sys-color-on-secondary-container, #1d192b);
  border: 1px solid var(--md-sys-color-outline-variant, rgba(0, 0, 0, 0.08));
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.16);
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: 0.2px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  -webkit-tap-highlight-color: transparent;
}

.speed-dial-action-pill:active {
  transform: scale(0.96);
}

.speed-dial-action-pill.is-syncing {
  opacity: 0.85;
}

.pill-icon-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background-color: var(--md-sys-color-surface-container-highest, rgba(29, 25, 43, 0.12));
  color: inherit;
}

.m3-main-fab {
  width: 54px;
  height: 54px;
  border-radius: 16px;
  background-color: var(--md-sys-color-primary, #00639b);
  color: var(--md-sys-color-on-primary, #ffffff);
  border: none;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.22);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

.m3-main-fab:active {
  transform: scale(0.94);
}

.m3-main-fab.expanded {
  border-radius: 50%;
  background-color: var(--md-sys-color-primary-container, #cee5ff);
  color: var(--md-sys-color-on-primary-container, #001d33);
}

.m3-fab-pop-enter-active {
  transition: all 0.18s cubic-bezier(0.05, 0.7, 0.1, 1);
}
.m3-fab-pop-leave-active {
  transition: all 0.12s cubic-bezier(0.4, 0, 1, 1);
}

.m3-fab-pop-enter-from,
.m3-fab-pop-leave-to {
  opacity: 0;
  transform: scale(0.8) translateY(14px);
}

.m3-speed-dial-pills-enter-active {
  transition: all 0.16s cubic-bezier(0.05, 0.7, 0.1, 1);
}
.m3-speed-dial-pills-leave-active {
  transition: all 0.1s cubic-bezier(0.4, 0, 1, 1);
}

.m3-speed-dial-pills-enter-from,
.m3-speed-dial-pills-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.92);
}

.fab-icon-spin-enter-active,
.fab-icon-spin-leave-active {
  transition: all 0.18s ease;
}

.fab-icon-spin-enter-from {
  opacity: 0;
  transform: rotate(-90deg) scale(0.6);
}

.fab-icon-spin-leave-to {
  opacity: 0;
  transform: rotate(90deg) scale(0.6);
}

/* ==========================================================================
   移动端抽屉 (Bottom Sheet) 与桌面端完整 Tag 编辑功能
   ========================================================================== */
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.2s ease;
}
.sheet-enter-active .bottom-sheet-panel {
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}
.sheet-leave-active .bottom-sheet-panel {
  transition: transform 0.16s cubic-bezier(0.4, 0, 1, 1);
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from .bottom-sheet-panel,
.sheet-leave-to .bottom-sheet-panel {
  transform: translateY(100%);
}

.bottom-sheet-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}

.bottom-sheet-panel {
  background: var(--md-sys-color-surface);
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  width: 100%;
  max-height: 82vh;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom, 16px);
}

.sheet-drag-handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--md-sys-color-outline-variant);
  margin: 10px auto 4px auto;
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.sheet-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sheet-title-icon {
  color: var(--md-sys-color-primary);
}

.sheet-header h3 {
  font-size: 16px;
  font-weight: 700;
  color: var(--md-sys-color-on-surface);
}

.sheet-close-btn {
  color: var(--md-sys-color-outline);
  padding: 4px;
  background: none;
  border: none;
  cursor: pointer;
}

.sheet-body {
  padding: 16px 18px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.filter-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface-variant);
}

/* ==========================================================================
   专属标签管理与编辑抽屉 (Tag Management Sheet - 简约现代 Apple/Linear 风格)
   ========================================================================== */
.tag-editor-sheet {
  max-height: 84vh;
}

.sheet-count-tag {
  font-size: 11px;
  background: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface-variant);
  padding: 1px 7px;
  border-radius: 9999px;
  font-weight: 600;
}

.sheet-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-toggle-manage {
  font-size: 12px;
  font-weight: 600;
  color: var(--md-sys-color-primary);
  background: transparent;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 8px;
  padding: 4px 10px;
  cursor: pointer;
}

.btn-toggle-manage.active {
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border-color: var(--md-sys-color-primary);
}

.tag-sheet-body {
  padding: 14px 18px;
  gap: 12px;
}

.tag-toolbar-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tag-search-minimal {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--md-sys-color-surface-container);
  border-radius: 10px;
  padding: 6px 10px;
}

.search-ico {
  color: var(--md-sys-color-outline);
}

.search-inp {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 13px;
  color: var(--md-sys-color-on-surface);
}

.clear-btn {
  background: transparent;
  border: none;
  color: var(--md-sys-color-outline);
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.btn-new-tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border: none;
  border-radius: 10px;
  padding: 6px 12px;
  cursor: pointer;
  white-space: nowrap;
}

.new-tag-creator-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--md-sys-color-surface-container-low);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 12px;
  padding: 10px;
}

.creator-input-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
}

.hash-symbol {
  font-size: 14px;
  font-weight: 700;
  color: var(--md-sys-color-primary);
}

.creator-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 13.5px;
  color: var(--md-sys-color-on-surface);
}

.creator-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-creator-cancel {
  background: transparent;
  border: none;
  font-size: 12px;
  color: var(--md-sys-color-outline);
  padding: 4px 8px;
  cursor: pointer;
}

.btn-creator-submit {
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  cursor: pointer;
}

.btn-creator-submit:disabled {
  opacity: 0.5;
}

.active-tags-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--md-sys-color-primary);
}

.btn-clear-selection {
  background: transparent;
  border: none;
  font-size: 11.5px;
  color: var(--md-sys-color-outline);
  cursor: pointer;
}

.manage-mode-banner {
  font-size: 11.5px;
  color: var(--md-sys-color-on-surface-variant);
  background: var(--md-sys-color-surface-container);
  padding: 5px 10px;
  border-radius: 8px;
}

.tags-modern-flow {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 48vh;
  overflow-y: auto;
  padding: 2px;
}

.modern-tag-card {
  display: inline-flex;
  align-items: center;
  background: var(--md-sys-color-surface-container);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 10px;
  padding: 6px 10px;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.modern-tag-card.selected {
  background: var(--md-sys-color-primary-container);
  border-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary-container);
}

.tag-card-main {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.tag-hash-txt {
  opacity: 0.5;
  font-size: 12px;
}

.tag-name-txt {
  font-size: 13px;
  font-weight: 500;
  color: var(--md-sys-color-on-surface);
}

.modern-tag-card.selected .tag-name-txt {
  color: var(--md-sys-color-on-primary-container);
  font-weight: 600;
}

.tag-count-bubble {
  font-size: 10.5px;
  background: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-outline);
  padding: 1px 5px;
  border-radius: 6px;
  margin-left: 2px;
}

.modern-tag-card.selected .tag-count-bubble {
  background: rgba(255, 255, 255, 0.5);
  color: var(--md-sys-color-on-primary-container);
}

.tag-manage-ops {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
  padding-left: 6px;
  border-left: 1px solid var(--md-sys-color-outline-variant);
}

.btn-op-icon {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--md-sys-color-outline);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.btn-op-icon:active {
  background: var(--md-sys-color-surface-container-high);
}

.btn-op-icon.del:active {
  color: #dc2626;
  background: #fee2e2;
}

.rename-inline-box {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.rename-field {
  width: 90px;
  padding: 2px 4px;
  font-size: 12.5px;
  border: 1px solid var(--md-sys-color-primary);
  border-radius: 6px;
  background: var(--md-sys-color-surface);
  color: var(--md-sys-color-on-surface);
  outline: none;
}

.btn-rename-ok,
.btn-rename-cancel {
  border: none;
  background: transparent;
  padding: 2px;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.btn-rename-ok {
  color: var(--md-sys-color-primary);
}

.btn-rename-cancel {
  color: var(--md-sys-color-outline);
}

.empty-tag-list {
  font-size: 12.5px;
  color: var(--md-sys-color-outline);
  padding: 24px 0;
  text-align: center;
  width: 100%;
}

.sheet-bottom-bar {
  padding: 10px 18px env(safe-area-inset-bottom, 12px) 18px;
  border-top: 1px solid var(--md-sys-color-outline-variant);
}

.btn-sheet-done {
  width: 100%;
  padding: 11px;
  border-radius: 12px;
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  font-size: 13.5px;
  font-weight: 600;
  border: none;
  cursor: pointer;
}

.chips-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.option-chip {
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 14px;
  background: var(--md-sys-color-surface-container);
  border: 1px solid var(--md-sys-color-outline-variant);
  color: var(--md-sys-color-on-surface-variant);
}

.option-chip.active {
  background: var(--md-sys-color-primary-container);
  border-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary-container);
  font-weight: 600;
}

.sheet-footer {
  display: flex;
  gap: 12px;
  padding: 12px 18px;
  border-top: 1px solid var(--md-sys-color-outline-variant);
}

.sheet-btn {
  flex: 1;
  padding: 12px 0;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
}

.btn-secondary {
  background: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-on-surface);
  border: 1px solid var(--md-sys-color-outline-variant);
}

.btn-primary {
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border: none;
}

/* 新建错题本与弹窗动效 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}
.fade-enter-active .modal-card {
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease;
}
.fade-leave-active .modal-card {
  transition: transform 0.14s cubic-bezier(0.4, 0, 1, 1), opacity 0.14s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.fade-enter-from .modal-card {
  opacity: 0;
  transform: scale(0.94) translateY(8px);
}
.fade-leave-to .modal-card {
  opacity: 0;
  transform: scale(0.96);
}

.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 250;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-card {
  background: var(--md-sys-color-surface);
  border-radius: 24px;
  width: 100%;
  max-width: 320px;
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
}

.modal-hint {
  font-size: 13px;
  color: var(--md-sys-color-on-surface-variant);
}

.modal-input {
  padding: 10px 14px;
  border-radius: 12px;
  border: 1.5px solid var(--md-sys-color-outline);
  background: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-on-surface);
  font-size: 14px;
  outline: none;
}

.modal-input:focus {
  border-color: var(--md-sys-color-primary);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 6px;
}

.modal-actions button {
  padding: 8px 16px;
  border-radius: 18px;
  font-size: 13px;
  font-weight: 600;
}

.spin-anim {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 转移弹窗控件 */
.transfer-mode-selector {
  display: flex;
  background: var(--md-sys-color-surface-container);
  border-radius: 12px;
  padding: 3px;
  gap: 4px;
}

.mode-btn {
  flex: 1;
  border: none;
  background: transparent;
  padding: 6px 12px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface-variant);
  cursor: pointer;
  transition: all 0.2s;
}

.mode-btn.active {
  background: var(--md-sys-color-surface);
  color: var(--md-sys-color-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.transfer-field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.transfer-field-group .field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface-variant);
}

.modal-select {
  width: 100%;
  padding: 9px 12px;
  border-radius: 12px;
  border: 1.5px solid var(--md-sys-color-outline);
  background: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-on-surface);
  font-size: 14px;
  outline: none;
}
</style>
