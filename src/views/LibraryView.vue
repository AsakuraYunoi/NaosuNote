<template>
  <div class="library-view" @click="closeDropdowns">
    <!-- Layer 1: M3 Top App Bar (全局主栏：搜索与核心操作) -->
    <header class="top-bar" data-tauri-drag-region="deep">
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
    <nav class="m3-primary-tabs-bar" data-tauri-drag-region="deep">
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
      <!-- 错题本 Filter Chips 行 (最右侧放置批量编辑与筛选抽屉按钮) -->
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

        <!-- 学科错题本附属子错题本那一行最右端：排序检索按钮（原批量编辑位置）和筛选按钮 -->
        <div class="notebooks-right-actions">
          <!-- M3 排序下拉菜单 (原批量编辑位置) -->
          <div class="m3-menu-wrapper" ref="sortMenuRef">
            <button
              class="m3-menu-trigger-btn"
              :class="{ active: showSortMenu }"
              title="切换错题排序方式"
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

          <!-- 筛选抽屉按钮 -->
          <button
            class="m3-filter-chip filter-btn-chip"
            :class="{ active: showFilterDrawer || hasActiveFilters }"
            title="打开高级筛选抽屉"
            @click="openFilterDrawer"
          >
            <SlidersHorizontal :size="14" />
            <span>筛选</span>
            <span v-if="activeFilterCount > 0" class="filter-count-badge">{{ activeFilterCount }}</span>
          </button>
        </div>
      </div>

      <!-- 已激活的筛选胶囊徽章栏 (若在抽屉中选了题型、日期或标签，在此展示可快速移除的胶囊；已移除题目总计) -->
      <div v-if="hasActiveFilters" class="toolbar-section secondary-filters-section active-filters-section">
        <div class="active-filters-bar">
          <!-- 题型徽章 -->
          <button
            v-if="selectedType !== '全部'"
            class="active-filter-badge"
            title="移除题型筛选"
            @click="selectType('全部')"
          >
            <span>题型: {{ selectedType }}</span>
            <X :size="11" />
          </button>

          <!-- 日期徽章 -->
          <button
            v-if="dateFilterDisplay"
            class="active-filter-badge"
            title="移除日期筛选"
            @click="clearDateFilter"
          >
            <Calendar :size="11" />
            <span>{{ dateFilterDisplay }}</span>
            <X :size="11" />
          </button>

          <!-- 标签徽章 -->
          <button
            v-for="tagName in selectedTags"
            :key="tagName"
            class="active-filter-badge tag-badge"
            :title="'移除标签 ' + tagName"
            @click="toggleTag(tagName)"
          >
            <span>#{{ tagName }}</span>
            <X :size="11" />
          </button>

          <!-- 清除所有筛选 -->
          <button
            class="btn-clear-all-filters"
            title="重置全部筛选条件"
            @click="resetAllFilters"
          >
            <span>清除所有筛选</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Problems Scroll Area (错题呈现流) -->
    <div ref="scrollContainerRef" class="problems-scroll-area">
      <div v-if="loading && problems.length === 0" class="state-container">
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
          :id="'problem-card-' + prob.uuid"
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
          @edit="handleOpenDetail(prob)"
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

    <!-- M3 Floating Action Speed Dial (屏幕右下角浮动菜单：类似图1/图2 Google官方演示规范) -->
    <transition name="m3-fab-pop">
      <div
        v-if="!isBatchMode && selectedUuids.length === 0"
        class="m3-speed-dial-wrapper"
      >
        <!-- Speed Dial Action Pills (浮动子菜单胶囊：默认展开，支持收回) -->
        <transition name="m3-speed-dial-pills">
          <div v-if="isFabExpanded" class="speed-dial-menu">
            <!-- 同步 Action Pill (纯前端交互反馈与数据重载) -->
            <button
              class="speed-dial-action-pill"
              :class="{ 'is-syncing': isManualSyncing }"
              :disabled="isManualSyncing"
              title="同步数据与镜像"
              @click="triggerManualSync"
            >
              <div class="pill-icon-circle">
                <RotateCw :size="15" :class="{ 'spin-anim': isManualSyncing }" />
              </div>
              <span class="pill-text">{{ isManualSyncing ? '同步中...' : '同步' }}</span>
            </button>

            <!-- 批量编辑 Action Pill (类似图1的 Select 胶囊) -->
            <button
              class="speed-dial-action-pill"
              title="进入批量编辑模式"
              @click="startBatchModeFromFab"
            >
              <div class="pill-icon-circle">
                <ListChecks :size="15" />
              </div>
              <span class="pill-text">批量编辑</span>
            </button>
          </div>
        </transition>

        <!-- Main FAB Trigger Button (主触发按钮：展开态显示 X，折叠态显示图2铅笔) -->
        <button
          class="m3-main-fab"
          :class="{ expanded: isFabExpanded }"
          :title="isFabExpanded ? '收起浮动菜单' : '展开操作菜单'"
          @click="toggleFabExpand"
        >
          <transition name="fab-icon-spin" mode="out-in">
            <X v-if="isFabExpanded" key="close" :size="22" class="fab-icon" />
            <Pencil v-else key="pencil" :size="20" class="fab-icon" />
          </transition>
        </button>
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

    <!-- ==========================================================================
         二级抽屉菜单 (Filter & Tag Drawer)
         从上到下按顺序展示：
         1. 题目类型检索（单选多选……）
         2. 通过日期检索
         3. 通过所有 tag 检索及添加/修改/删除 tag 功能
         ========================================================================== -->
    <transition name="drawer-fade">
      <div v-if="showFilterDrawer" class="m3-drawer-scrim" @click.self="closeFilterDrawer">
        <transition name="drawer-slide">
          <div class="m3-filter-drawer">
            <!-- 抽屉顶部标题栏 -->
            <div class="drawer-header">
              <div class="drawer-title-group">
                <SlidersHorizontal :size="17" class="drawer-title-icon" />
                <h3 class="drawer-title">高级筛选与标签</h3>
              </div>
              <button class="drawer-close-btn" title="关闭抽屉" @click="closeFilterDrawer">
                <X :size="17" />
              </button>
            </div>

            <!-- 抽屉滚动内容主体 -->
            <div class="drawer-scroll-body">
              <!-- 1. 题目类型检索（单选多选……） -->
              <div class="drawer-group">
                <div class="group-header">
                  <span class="group-title">题目类型检索</span>
                  <span v-if="selectedType !== '全部'" class="group-active-tag">{{ selectedType }}</span>
                </div>
                <div class="type-chips-grid">
                  <button
                    v-for="t in types"
                    :key="t"
                    class="m3-filter-chip type-drawer-chip"
                    :class="{ active: selectedType === t }"
                    @click="selectType(t)"
                  >
                    {{ t }}
                  </button>
                </div>
              </div>

              <div class="drawer-separator"></div>

              <!-- 2. 通过日期检索 -->
              <div class="drawer-group">
                <div class="group-header">
                  <span class="group-title">通过日期检索</span>
                  <button
                    v-if="selectedDatePreset !== 'all'"
                    class="btn-text-action"
                    @click="clearDateFilter"
                  >
                    清除日期
                  </button>
                </div>

                <!-- 日期快捷选项 -->
                <div class="date-preset-chips">
                  <button
                    v-for="dp in datePresets"
                    :key="dp.id"
                    class="m3-filter-chip date-chip"
                    :class="{ active: selectedDatePreset === dp.id }"
                    @click="selectDatePreset(dp.id)"
                  >
                    {{ dp.label }}
                  </button>
                </div>
              </div>

              <div class="drawer-separator"></div>

              <!-- 3. 通过所有 tag 检索及增删改功能 -->
              <div class="drawer-group tags-group">
                <div class="group-header">
                  <div class="tags-header-info">
                    <span class="group-title">通过标签检索 (交集)</span>
                    <span class="tags-count-hint">共 {{ tagList.length }} 个</span>
                  </div>
                  <button
                    v-if="!isAddingNewTag"
                    class="btn-add-tag-action"
                    title="添加新知识点标签"
                    @click="openAddTagInput"
                  >
                    <Plus :size="13" />
                    <span>添加标签</span>
                  </button>
                </div>

                <!-- 标签快速搜索框 -->
                <div class="tag-search-container">
                  <Search :size="14" class="tag-search-icon" />
                  <input
                    v-model="tagSearchQuery"
                    type="text"
                    placeholder="搜索知识点标签..."
                    class="tag-search-field"
                  />
                  <button
                    v-if="tagSearchQuery"
                    class="tag-search-clear"
                    title="清空搜索"
                    @click="tagSearchQuery = ''"
                  >
                    <X :size="12" />
                  </button>
                </div>

                <!-- 新建标签输入行 -->
                <div v-if="isAddingNewTag" class="new-tag-input-row">
                  <input
                    ref="newTagInputRef"
                    v-model="newTagNameInput"
                    type="text"
                    placeholder="输入新标签名称..."
                    class="new-tag-input"
                    @keydown.enter="submitCreateTag"
                    @keydown.esc="cancelCreateTag"
                  />
                  <div class="new-tag-buttons">
                    <button class="btn-xs btn-primary" :disabled="!newTagNameInput.trim()" @click="submitCreateTag">
                      <Check :size="12" />
                      <span>添加</span>
                    </button>
                    <button class="btn-xs btn-ghost" @click="cancelCreateTag">
                      <X :size="12" />
                      <span>取消</span>
                    </button>
                  </div>
                </div>

                <!-- 已选交集提示条 -->
                <div v-if="selectedTags.length > 0" class="selected-tags-toolbar">
                  <span class="selected-summary-text">已勾选 {{ selectedTags.length }} 个标签交集</span>
                  <button class="btn-text-action" @click="clearAllTags">全部取消</button>
                </div>

                <!-- 标签列表 -->
                <div class="drawer-tags-list">
                  <div
                    v-for="t in filteredTagList"
                    :key="t.name"
                    class="drawer-tag-item"
                    :class="{ selected: isTagSelected(t.name) }"
                  >
                    <!-- 行内修改标签名称 -->
                    <div v-if="editingTagName === t.name" class="inline-rename-wrapper">
                      <input
                        v-model="editingTagInput"
                        class="inline-rename-input"
                        autofocus
                        @keydown.enter="submitRenameTag(t.name)"
                        @keydown.esc="cancelRenameTag"
                      />
                      <button class="tag-icon-action btn-confirm" title="保存修改" @click="submitRenameTag(t.name)">
                        <Check :size="13" />
                      </button>
                      <button class="tag-icon-action btn-cancel" title="取消" @click="cancelRenameTag">
                        <X :size="13" />
                      </button>
                    </div>

                    <!-- 正常展示标签项 -->
                    <template v-else>
                      <div class="drawer-tag-main" @click="toggleTag(t.name)">
                        <span class="tag-checkbox">
                          <SquareCheck v-if="isTagSelected(t.name)" :size="15" class="icon-checked" />
                          <Square v-else :size="15" class="icon-unchecked" />
                        </span>
                        <span class="tag-label-name"># {{ t.name }}</span>
                        <span class="tag-bubble-count">{{ t.count }}</span>
                      </div>

                      <div class="drawer-tag-actions">
                        <button
                          class="tag-action-icon edit-btn"
                          title="修改标签名称"
                          @click.stop="startRenameTag(t.name)"
                        >
                          <Pencil :size="12" />
                        </button>
                        <button
                          class="tag-action-icon delete-btn"
                          title="删除标签"
                          @click.stop="promptDeleteTag(t.name)"
                        >
                          <Trash2 :size="12" />
                        </button>
                      </div>
                    </template>
                  </div>

                  <div v-if="filteredTagList.length === 0" class="drawer-empty-tags">
                    <span v-if="tagSearchQuery">未检索到含“{{ tagSearchQuery }}”的标签</span>
                    <span v-else>暂无知识点标签，可点击右上角“添加标签”创建</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 抽屉底部统计与按钮 -->
            <div class="drawer-footer">
              <div class="drawer-stats">
                共匹配 <strong>{{ problems.length }}</strong> 题
              </div>
              <div class="drawer-footer-btns">
                <button
                  class="btn-drawer-reset"
                  :disabled="!hasActiveFilters"
                  @click="resetAllFilters"
                >
                  重置筛选
                </button>
                <button class="btn-drawer-done" @click="closeFilterDrawer">
                  完成
                </button>
              </div>
            </div>
          </div>
        </transition>
      </div>
    </transition>

    <!-- 删除标签二次确认弹窗 -->
    <div v-if="showDeleteTagDialog" class="m3-dialog-scrim" @click.self="showDeleteTagDialog = false">
      <div class="m3-dialog">
        <div class="dialog-icon-wrapper danger-icon">
          <Trash2 :size="24" />
        </div>
        <h3 class="dialog-title">删除标签确认</h3>
        <div class="dialog-form">
          <p class="dialog-desc">
            确定要彻底删除知识点标签 <strong>#{{ tagToDelete }}</strong> 吗？
          </p>
          <p class="dialog-hint">
            此操作将从题库中所有已打此标签的题目中彻底移除该标签，不可撤销。
          </p>
        </div>
        <div class="dialog-actions">
          <button class="btn-text" @click="showDeleteTagDialog = false">取消</button>
          <button class="btn-danger" @click="confirmDeleteTag">
            确认删除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
// 模块级状态持久化记忆：在离开错题库（进入详情、组卷、录入等）再返回时，完整保持用户的学科、选定错题本及视口位姿
let preservedSubject = '物理';
let preservedNotebookId = 'all';
let preservedType = '全部';
let preservedTags: string[] = [];
let preservedSort: SortOption = 'date_desc';
let preservedSearchQuery = '';
let preservedDateStart = '';
let preservedDateEnd = '';
let preservedDatePreset = 'all';
let preservedScrollTop = 0;
</script>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, onActivated, onDeactivated } from 'vue';
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
  apiCreateTag,
  apiRenameTag,
  apiDeleteTag,
  apiSyncCloud,
  apiSyncAllMirrors,
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
  SlidersHorizontal,
  Calendar,
  Pencil,
  SquareCheck,
  Square,
} from 'lucide-vue-next';

const props = defineProps<{
  printCart: Problem[];
  targetProblem?: Problem | null;
  targetSubject?: string | null;
  targetNotebookId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'nav', tab: string): void;
  (e: 'toggleCart', prob: Problem): void;
  (e: 'removeFromCart', uuid: string): void;
  (e: 'notify', msg: string): void;
  (e: 'editProblem', prob: Problem, context?: { subject?: string; notebookId?: string }): void;
  (e: 'clearTarget'): void;
}>();

const scrollContainerRef = ref<HTMLElement | null>(null);

function handleOpenDetail(prob: Problem) {
  emit('editProblem', prob, {
    subject: selectedSubject.value,
    notebookId: selectedNotebookId.value,
  });
}

function locateProblemCard(uuid: string, retries = 8) {
  nextTick(() => {
    const el = document.getElementById(`problem-card-${uuid}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('locate-pulse-highlight');
      setTimeout(() => {
        el.classList.remove('locate-pulse-highlight');
        emit('clearTarget');
      }, 2200);
    } else if (retries > 0) {
      setTimeout(() => locateProblemCard(uuid, retries - 1), 60);
    }
  });
}

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

// 右下角 M3 浮动工具栏状态 (默认展开)
const isFabExpanded = ref(true);
const isManualSyncing = ref(false);

function toggleFabExpand() {
  isFabExpanded.value = !isFabExpanded.value;
}

function startBatchModeFromFab() {
  isFabExpanded.value = false;
  isBatchMode.value = true;
}

async function triggerManualSync() {
  if (isManualSyncing.value) return;
  isManualSyncing.value = true;

  try {
    const isLoggedIn = localStorage.getItem('naosu_is_logged_in') === 'true';
    if (isLoggedIn) {
      emit('notify', '正在执行双向云端同步...');
      const res = await apiSyncCloud((msg) => emit('notify', msg));
      await loadData();
      const details = [];
      if (res.pulledProblems > 0) details.push(`拉取 ${res.pulledProblems} 题`);
      if (res.pushedProblems > 0) details.push(`推送 ${res.pushedProblems} 题`);
      if (res.deletedProblems > 0) details.push(`清理已删 ${res.deletedProblems} 题`);
      if (res.downloadedImages > 0) details.push(`下载图片 ${res.downloadedImages} 张`);
      if (res.uploadedImages > 0) details.push(`上传图片 ${res.uploadedImages} 张`);
      const syncMsg = details.length > 0 ? `同步完成！(${details.join('，')})` : '同步完成，数据已是最新';
      emit('notify', syncMsg);
    } else {
      emit('notify', '正在刷新本地题库数据与镜像...');
      await Promise.all([
        loadData(),
        apiSyncAllMirrors(),
      ]);
      emit('notify', '本地题库与 HTML 镜像已刷新 (登录云账号可开启多端双向云同步)');
    }
  } catch (err: any) {
    console.error('Sync failed:', err);
    emit('notify', '同步失败: ' + (err?.message || err));
  } finally {
    isManualSyncing.value = false;
  }
}

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

// 二级抽屉筛选与标签管理状态
const showFilterDrawer = ref(false);
const filterDateStart = ref('');
const filterDateEnd = ref('');
const selectedDatePreset = ref<'all' | 'today' | '7days' | '30days' | 'month'>('all');
const tagSearchQuery = ref('');
const isAddingNewTag = ref(false);
const newTagNameInput = ref('');
const newTagInputRef = ref<HTMLInputElement | null>(null);
const editingTagName = ref<string | null>(null);
const editingTagInput = ref('');
const tagToDelete = ref<string | null>(null);
const showDeleteTagDialog = ref(false);

const datePresets = [
  { id: 'all', label: '全部时间' },
  { id: 'today', label: '今天' },
  { id: '7days', label: '最近7天' },
  { id: '30days', label: '最近30天' },
  { id: 'month', label: '本月' },
];

const hasActiveFilters = computed(() => {
  return (
    selectedType.value !== '全部' ||
    selectedTags.value.length > 0 ||
    selectedDatePreset.value !== 'all'
  );
});

const activeFilterCount = computed(() => {
  let count = 0;
  if (selectedType.value !== '全部') count++;
  if (selectedDatePreset.value !== 'all') count++;
  count += selectedTags.value.length;
  return count;
});

const dateFilterDisplay = computed(() => {
  if (selectedDatePreset.value === 'today') return '今天';
  if (selectedDatePreset.value === '7days') return '最近7天';
  if (selectedDatePreset.value === '30days') return '最近30天';
  if (selectedDatePreset.value === 'month') return '本月';
  return '';
});

const filteredTagList = computed(() => {
  const kw = tagSearchQuery.value.trim().toLowerCase();
  if (!kw) return tagList.value;
  return tagList.value.filter((t) => t.name.toLowerCase().includes(kw));
});

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
    isFabExpanded.value = true;
  } else {
    isFabExpanded.value = false;
  }
}

function exitBatchMode() {
  isBatchMode.value = false;
  selectedUuids.value = [];
  isFabExpanded.value = true;
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

async function loadData(silent = false) {
  if (!silent && problems.value.length === 0) {
    loading.value = true;
  }
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
        selectedSort.value,
        filterDateStart.value || undefined,
        filterDateEnd.value || undefined
      ),
      apiGetTags(nbIdParam, selectedSubject.value),
    ]);

    notebooks.value = nbList;
    problems.value = probList;
    tagList.value = tagsData;

    // 清理已勾选但已不存在的题目
    selectedUuids.value = selectedUuids.value.filter((u) => probList.some((p) => p.uuid === u));

    // 统计当前学科题目数量
    if (selectedNotebookId.value === 'all' && !searchQuery.value && selectedType.value === '全部' && selectedTags.value.length === 0 && !filterDateStart.value && !filterDateEnd.value) {
      subjectCounts.value[selectedSubject.value] = probList.length;
    }
  } catch (e: any) {
    emit('notify', '读取数据失败: ' + (e?.message || e));
  } finally {
    loading.value = false;
  }
}

function openFilterDrawer() {
  showFilterDrawer.value = true;
}

function closeFilterDrawer() {
  showFilterDrawer.value = false;
  isAddingNewTag.value = false;
  editingTagName.value = null;
}

function selectDatePreset(presetId: string) {
  selectedDatePreset.value = presetId as any;
  const now = new Date();
  const formatYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  if (presetId === 'all') {
    filterDateStart.value = '';
    filterDateEnd.value = '';
  } else if (presetId === 'today') {
    const todayStr = formatYMD(now);
    filterDateStart.value = todayStr;
    filterDateEnd.value = todayStr;
  } else if (presetId === '7days') {
    const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    filterDateStart.value = formatYMD(past);
    filterDateEnd.value = formatYMD(now);
  } else if (presetId === '30days') {
    const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    filterDateStart.value = formatYMD(past);
    filterDateEnd.value = formatYMD(now);
  } else if (presetId === 'month') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    filterDateStart.value = formatYMD(firstDay);
    filterDateEnd.value = formatYMD(now);
  }
  loadData();
}

function clearDateFilter() {
  selectedDatePreset.value = 'all';
  filterDateStart.value = '';
  filterDateEnd.value = '';
  loadData();
}

function resetAllFilters() {
  selectedType.value = '全部';
  selectedTags.value = [];
  selectedDatePreset.value = 'all';
  filterDateStart.value = '';
  filterDateEnd.value = '';
  loadData();
}

function openAddTagInput() {
  isAddingNewTag.value = true;
  newTagNameInput.value = '';
  nextTick(() => {
    newTagInputRef.value?.focus();
  });
}

function cancelCreateTag() {
  newTagNameInput.value = '';
  isAddingNewTag.value = false;
}

async function submitCreateTag() {
  const name = newTagNameInput.value.trim();
  if (!name) return;
  try {
    await apiCreateTag(name);
    newTagNameInput.value = '';
    isAddingNewTag.value = false;
    emit('notify', `已创建新标签 “${name}”`);
    const nbIdParam = selectedNotebookId.value === 'all' ? undefined : selectedNotebookId.value;
    tagList.value = await apiGetTags(nbIdParam, selectedSubject.value);
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

function promptDeleteTag(name: string) {
  tagToDelete.value = name;
  showDeleteTagDialog.value = true;
}

async function confirmDeleteTag() {
  if (!tagToDelete.value) return;
  const name = tagToDelete.value;
  try {
    const removedCount = await apiDeleteTag(name);
    selectedTags.value = selectedTags.value.filter((t) => t !== name);
    showDeleteTagDialog.value = false;
    tagToDelete.value = null;
    emit('notify', `已删除标签 “${name}”，从 ${removedCount} 道题目中移除`);
    await loadData();
  } catch (e: any) {
    emit('notify', '删除标签失败: ' + (e?.message || e));
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

onMounted(async () => {
  // 恢复或者采用目标学科与错题本设置
  if (props.targetSubject) {
    selectedSubject.value = props.targetSubject;
  } else {
    selectedSubject.value = preservedSubject;
  }

  if (props.targetNotebookId !== undefined && props.targetNotebookId !== null) {
    selectedNotebookId.value = props.targetNotebookId;
  } else {
    selectedNotebookId.value = preservedNotebookId;
  }

  selectedType.value = preservedType;
  selectedTags.value = [...preservedTags];
  selectedSort.value = preservedSort;
  searchQuery.value = preservedSearchQuery;
  filterDateStart.value = preservedDateStart;
  filterDateEnd.value = preservedDateEnd;
  selectedDatePreset.value = preservedDatePreset as any;

  window.addEventListener('keydown', onGlobalKeyDown);

  await loadData();
  await refreshSubjectStats();

  // 若从详情页返回并带有目标题目，定位并施加聚焦脉冲高亮
  if (props.targetProblem) {
    const targetUuid = props.targetProblem.uuid;
    const exists = problems.value.some((p) => p.uuid === targetUuid);
    if (!exists) {
      // 若当前过滤条件导致未查到该题，自动适配该题的所属学科与所属错题本并重载
      selectedSubject.value = props.targetProblem.subject;
      if (selectedNotebookId.value !== props.targetProblem.notebook_id && selectedNotebookId.value !== 'all') {
        selectedNotebookId.value = props.targetProblem.notebook_id;
      }
      searchQuery.value = '';
      selectedTags.value = [];
      selectedType.value = '全部';
      filterDateStart.value = '';
      filterDateEnd.value = '';
      selectedDatePreset.value = 'all';
      await loadData();
    }
    locateProblemCard(targetUuid);
  } else if (scrollContainerRef.value && preservedScrollTop > 0) {
    scrollContainerRef.value.scrollTop = preservedScrollTop;
  }
});

function onGlobalKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (showFilterDrawer.value) {
      closeFilterDrawer();
    }
    if (showDeleteTagDialog.value) {
      showDeleteTagDialog.value = false;
    }
  }
}

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeyDown);
  preservedSubject = selectedSubject.value;
  preservedNotebookId = selectedNotebookId.value;
  preservedType = selectedType.value;
  preservedTags = [...selectedTags.value];
  preservedSort = selectedSort.value;
  preservedSearchQuery = searchQuery.value;
  preservedDateStart = filterDateStart.value;
  preservedDateEnd = filterDateEnd.value;
  preservedDatePreset = selectedDatePreset.value;
  if (scrollContainerRef.value) {
    preservedScrollTop = scrollContainerRef.value.scrollTop;
  }
});

onActivated(async () => {
  window.addEventListener('keydown', onGlobalKeyDown);

  // 若从详情页返回并带有目标题目，定位并施加聚焦脉冲高亮
  if (props.targetProblem) {
    const targetUuid = props.targetProblem.uuid;
    const idx = problems.value.findIndex((p) => p.uuid === targetUuid);
    if (idx >= 0) {
      problems.value[idx] = { ...props.targetProblem };
    } else {
      await loadData(true);
    }
    locateProblemCard(targetUuid);
  } else {
    // 静默后台比对同步
    await loadData(true);
  }
  await refreshSubjectStats();

  if (scrollContainerRef.value && preservedScrollTop > 0) {
    scrollContainerRef.value.scrollTop = preservedScrollTop;
  }
});

onDeactivated(() => {
  window.removeEventListener('keydown', onGlobalKeyDown);
  preservedSubject = selectedSubject.value;
  preservedNotebookId = selectedNotebookId.value;
  preservedType = selectedType.value;
  preservedTags = [...selectedTags.value];
  preservedSort = selectedSort.value;
  preservedSearchQuery = searchQuery.value;
  preservedDateStart = filterDateStart.value;
  preservedDateEnd = filterDateEnd.value;
  preservedDatePreset = selectedDatePreset.value;
  if (scrollContainerRef.value) {
    preservedScrollTop = scrollContainerRef.value.scrollTop;
  }
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
  -webkit-app-region: drag;
  user-select: none;
}

.top-actions {
  -webkit-app-region: no-drag;
}

.m3-search-box {
  -webkit-app-region: no-drag;
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

.notebooks-section {
  justify-content: space-between;
}

.chips-scroll-container {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
  flex: 1;
  min-width: 0;
}

.notebooks-right-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
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

.filter-btn-chip {
  position: relative;
}
.filter-btn-chip.active {
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  border-color: var(--md-sys-color-primary);
  font-weight: 600;
}
.filter-count-badge {
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border-radius: var(--md-shape-corner-full);
  font-size: 10px;
  min-width: 16px;
  height: 16px;
  line-height: 16px;
  text-align: center;
  font-weight: 700;
  padding: 0 4px;
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

/* Secondary Filters (Sort + Stats + Active Filter Badges) */
.secondary-filters-section {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.m3-vertical-divider {
  width: 1px;
  height: 18px;
  background-color: var(--md-sys-color-outline-variant);
  flex-shrink: 0;
}

.active-filters-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.active-filter-badge {
  height: 26px;
  padding: 0 8px 0 10px;
  border-radius: var(--md-shape-corner-full);
  background-color: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface);
  border: 1px solid var(--md-sys-color-outline-variant);
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.active-filter-badge:hover {
  background-color: var(--md-sys-color-error-container);
  color: var(--md-sys-color-error);
  border-color: transparent;
}
.active-filter-badge.tag-badge {
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  border-color: transparent;
}
.active-filter-badge.tag-badge:hover {
  background-color: var(--md-sys-color-error-container);
  color: var(--md-sys-color-error);
}

.btn-clear-all-filters {
  background: transparent;
  border: none;
  color: var(--md-sys-color-primary);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: var(--md-shape-corner-sm);
  transition: background-color 0.15s;
}
.btn-clear-all-filters:hover {
  background-color: var(--md-sys-color-surface-container);
  text-decoration: underline;
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
  padding: 16px 28px 96px 28px;
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

/* ==========================================================================
   M3 Floating Action Speed Dial (右下角悬浮工具菜单)
   遵循 Google Material 3 悬浮菜单规范 (图1/图2)
   ========================================================================== */
.m3-speed-dial-wrapper {
  position: fixed;
  right: 28px;
  bottom: 28px;
  z-index: 95;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  pointer-events: none;
}

.m3-speed-dial-wrapper > * {
  pointer-events: auto;
}

/* Speed Dial Actions Container */
.speed-dial-menu {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

/* Speed Dial Action Pill (图1样式) */
.speed-dial-action-pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px 10px 12px;
  border-radius: 9999px;
  background-color: var(--md-sys-color-secondary-container, #e8def8);
  color: var(--md-sys-color-on-secondary-container, #1d192b);
  border: 1px solid var(--md-sys-color-outline-variant, rgba(0, 0, 0, 0.08));
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.08);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.2px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
  user-select: none;
}

.speed-dial-action-pill:hover {
  background-color: var(--md-sys-color-primary-container, #eaddff);
  color: var(--md-sys-color-on-primary-container, #21005d);
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.16), 0 2px 6px rgba(0, 0, 0, 0.1);
}

.speed-dial-action-pill:active {
  transform: translateY(0) scale(0.97);
}

.speed-dial-action-pill.is-syncing {
  opacity: 0.85;
  cursor: wait;
}

.spin-anim {
  animation: spin 0.8s linear infinite;
}

.pill-icon-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background-color: var(--md-sys-color-surface-container-highest, rgba(29, 25, 43, 0.12));
  color: inherit;
  transition: all 0.2s ease;
}

.speed-dial-action-pill:hover .pill-icon-circle {
  background-color: var(--md-sys-color-primary, #6750a4);
  color: var(--md-sys-color-on-primary, #ffffff);
}

/* Main FAB Button (图1/图2样式) */
.m3-main-fab {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background-color: var(--md-sys-color-primary, #6750a4);
  color: var(--md-sys-color-on-primary, #ffffff);
  border: none;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18), 0 1px 4px rgba(0, 0, 0, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
  outline: none;
}

.m3-main-fab:hover {
  transform: scale(1.06);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.22), 0 2px 6px rgba(0, 0, 0, 0.15);
}

.m3-main-fab:active {
  transform: scale(0.95);
}

.m3-main-fab.expanded {
  border-radius: 50%;
  background-color: var(--md-sys-color-primary-container, #eaddff);
  color: var(--md-sys-color-on-primary-container, #21005d);
}

/* Speed Dial Transitions */
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

/* ==========================================================================
   Secondary Filter Drawer (M3 侧边抽屉)
   ========================================================================== */
.m3-drawer-scrim {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.4);
  z-index: 950;
  backdrop-filter: blur(3px);
  display: flex;
  justify-content: flex-end;
}

.m3-filter-drawer {
  width: 400px;
  max-width: 92vw;
  height: 100%;
  background-color: var(--md-sys-color-surface);
  box-shadow: var(--md-elevation-3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 951;
}

/* 抽屉头部 */
.drawer-header {
  height: 56px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  background-color: var(--md-sys-color-surface-container-low);
  flex-shrink: 0;
}
.drawer-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}
.drawer-title-icon {
  color: var(--md-sys-color-primary);
}
.drawer-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
}
.drawer-close-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--md-shape-corner-full);
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--md-sys-color-on-surface-variant);
  cursor: pointer;
  transition: all 0.15s ease;
}
.drawer-close-btn:hover {
  background-color: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface);
}

/* 抽屉可滚动内容 */
.drawer-scroll-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.drawer-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.group-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--md-sys-color-on-surface);
  letter-spacing: 0.2px;
}
.group-active-tag {
  font-size: 11px;
  font-weight: 600;
  color: var(--md-sys-color-primary);
  background-color: var(--md-sys-color-primary-container);
  padding: 2px 8px;
  border-radius: var(--md-shape-corner-full);
}
.btn-text-action {
  background: transparent;
  border: none;
  font-size: 12px;
  color: var(--md-sys-color-primary);
  cursor: pointer;
  padding: 2px 4px;
  font-weight: 500;
}
.btn-text-action:hover {
  text-decoration: underline;
}

.drawer-separator {
  height: 1px;
  background-color: var(--md-sys-color-outline-variant);
  opacity: 0.7;
}

/* 1. 题目类型网格 */
.type-chips-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.type-drawer-chip {
  flex: 1;
  min-width: 60px;
  justify-content: center;
  height: 32px;
  font-size: 12px;
}

/* 2. 日期检索 */
.date-preset-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.date-chip {
  height: 28px;
  padding: 0 10px;
  font-size: 11px;
}

/* 3. 标签检索 & 增删改 */
.tags-header-info {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tags-count-hint {
  font-size: 11px;
  color: var(--md-sys-color-outline);
}
.btn-add-tag-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  border: none;
  padding: 4px 10px;
  border-radius: var(--md-shape-corner-full);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-add-tag-action:hover {
  filter: brightness(0.95);
}

.tag-search-container {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 12px;
  border-radius: var(--md-shape-corner-full);
  background-color: var(--md-sys-color-surface-container);
  border: 1px solid transparent;
  transition: all 0.15s ease;
}
.tag-search-container:focus-within {
  border-color: var(--md-sys-color-primary);
  background-color: var(--md-sys-color-surface);
}
.tag-search-icon {
  color: var(--md-sys-color-outline);
}
.tag-search-field {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 12px;
  color: var(--md-sys-color-on-surface);
  outline: none;
}
.tag-search-clear {
  background: transparent;
  border: none;
  color: var(--md-sys-color-outline);
  cursor: pointer;
  display: flex;
  align-items: center;
}

/* 新建标签输入行 */
.new-tag-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--md-sys-color-surface-container-high);
  padding: 6px 10px;
  border-radius: var(--md-shape-corner-md);
  border: 1px solid var(--md-sys-color-primary);
}
.new-tag-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 12px;
  color: var(--md-sys-color-on-surface);
  outline: none;
}
.new-tag-buttons {
  display: flex;
  gap: 4px;
}
.btn-xs {
  height: 24px;
  padding: 0 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  border: none;
}
.btn-xs.btn-primary {
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
}
.btn-xs.btn-ghost {
  background: transparent;
  color: var(--md-sys-color-on-surface-variant);
}
.btn-xs.btn-ghost:hover {
  background: rgba(0, 0, 0, 0.08);
}

.selected-tags-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px;
  background-color: var(--md-sys-color-surface-container-low);
  border-radius: var(--md-shape-corner-sm);
}
.selected-summary-text {
  font-size: 11px;
  font-weight: 600;
  color: var(--md-sys-color-primary);
}

.drawer-tags-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 280px;
  overflow-y: auto;
  padding-right: 4px;
}
.drawer-tag-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-radius: var(--md-shape-corner-sm);
  background-color: var(--md-sys-color-surface-container-low);
  border: 1px solid transparent;
  transition: all 0.15s ease;
}
.drawer-tag-item:hover {
  background-color: var(--md-sys-color-surface-container-high);
}
.drawer-tag-item.selected {
  background-color: var(--md-sys-color-primary-container);
  border-color: rgba(0, 0, 0, 0.06);
}
.drawer-tag-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  cursor: pointer;
  user-select: none;
}
.tag-checkbox {
  display: flex;
  align-items: center;
  color: var(--md-sys-color-outline);
}
.icon-checked {
  color: var(--md-sys-color-primary);
}
.tag-label-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--md-sys-color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.drawer-tag-item.selected .tag-label-name {
  color: var(--md-sys-color-on-primary-container);
  font-weight: 600;
}
.tag-bubble-count {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: var(--md-shape-corner-full);
  background: rgba(0, 0, 0, 0.08);
  color: var(--md-sys-color-on-surface-variant);
}
.drawer-tag-item.selected .tag-bubble-count {
  background: rgba(255, 255, 255, 0.4);
  color: var(--md-sys-color-on-primary-container);
}

.drawer-tag-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.drawer-tag-item:hover .drawer-tag-actions {
  opacity: 1;
}
.tag-action-icon {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--md-sys-color-on-surface-variant);
  cursor: pointer;
  transition: all 0.12s ease;
}
.tag-action-icon:hover {
  background: rgba(0, 0, 0, 0.1);
  color: var(--md-sys-color-on-surface);
}
.tag-action-icon.delete-btn:hover {
  background-color: var(--md-sys-color-error-container);
  color: var(--md-sys-color-error);
}

.inline-rename-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}
.inline-rename-input {
  flex: 1;
  height: 26px;
  padding: 0 6px;
  border-radius: 4px;
  border: 1px solid var(--md-sys-color-primary);
  background: var(--md-sys-color-surface);
  font-size: 12px;
  color: var(--md-sys-color-on-surface);
  outline: none;
}
.tag-icon-action {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.tag-icon-action.btn-confirm {
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
}
.tag-icon-action.btn-cancel {
  background: transparent;
  color: var(--md-sys-color-outline);
}

.drawer-empty-tags {
  padding: 24px 0;
  text-align: center;
  font-size: 12px;
  color: var(--md-sys-color-outline);
}

/* 抽屉底部 */
.drawer-footer {
  height: 60px;
  padding: 0 20px;
  border-top: 1px solid var(--md-sys-color-outline-variant);
  background-color: var(--md-sys-color-surface-container-low);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.drawer-stats {
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
}
.drawer-stats strong {
  color: var(--md-sys-color-primary);
  font-size: 14px;
}
.drawer-footer-btns {
  display: flex;
  align-items: center;
  gap: 8px;
}
.btn-drawer-reset {
  height: 34px;
  padding: 0 14px;
  border-radius: var(--md-shape-corner-full);
  border: 1px solid var(--md-sys-color-outline-variant);
  background: transparent;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-drawer-reset:hover:not(:disabled) {
  background-color: var(--md-sys-color-surface-container-high);
}
.btn-drawer-reset:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.btn-drawer-done {
  height: 34px;
  padding: 0 18px;
  border-radius: var(--md-shape-corner-full);
  border: none;
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-drawer-done:hover {
  filter: brightness(1.08);
}

/* 抽屉动画 */
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.25s ease;
}
.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}

.drawer-slide-enter-active {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.drawer-slide-leave-active {
  transition: transform 0.2s cubic-bezier(0.4, 0, 1, 1);
}
.drawer-slide-enter-from,
.drawer-slide-leave-to {
  transform: translateX(100%);
}
</style>
