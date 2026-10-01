<template>
  <div class="settings-view">
    <div class="settings-container">
      <div class="settings-header" data-tauri-drag-region="deep">
        <h2 class="view-title">系统设置</h2>
      </div>

      <!-- Theme Selection Card -->
      <div class="m3-card">
        <div class="card-icon-title">
          <div class="icon-circle icon-theme">
            <Sun v-if="!isDark" :size="22" />
            <Moon v-else :size="22" />
          </div>
          <div class="title-meta">
            <h3>外观主题</h3>
          </div>
        </div>

        <div class="theme-switch-row">
          <div class="segmented-control theme-segments">
            <button
              class="segment-btn"
              :class="{ active: currentThemeMode === 'light' }"
              @click="selectThemeMode('light')"
            >
              <Sun :size="15" />
              <span>浅色模式</span>
            </button>
            <button
              class="segment-btn"
              :class="{ active: currentThemeMode === 'dark' }"
              @click="selectThemeMode('dark')"
            >
              <Moon :size="15" />
              <span>深色模式</span>
            </button>
            <button
              class="segment-btn"
              :class="{ active: currentThemeMode === 'system' }"
              @click="selectThemeMode('system')"
            >
              <Laptop :size="15" />
              <span>跟随系统</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Storage Directory Card -->
      <div class="m3-card">
        <div class="card-icon-title">
          <div class="icon-circle">
            <Folder :size="22" />
          </div>
          <div class="title-meta">
            <h3>数据保存目录</h3>
          </div>
        </div>

        <div class="dir-path-box">
          <span class="dir-path">{{ currentDataDir || '读取中...' }}</span>
          <div class="dir-actions">
            <button class="btn-outlined" @click="handleOpenDir" title="在访达中打开保存目录">
              <ExternalLink :size="16" />
              <span>打开文件夹</span>
            </button>
            <button class="btn-outlined" @click="handleSelectDir">
              <FolderOpen :size="16" />
              <span>更改目录</span>
            </button>
          </div>
        </div>
      </div>

      <!-- User Notebooks Mirrors Card -->
      <div class="m3-card">
        <div class="card-header-bar">
          <div class="card-icon-title">
            <div class="icon-circle icon-html">
              <FileCode :size="22" />
            </div>
            <div class="title-meta">
              <h3>已建错题本</h3>
              <p>每个错题本均自动同步为单文件 HTML，内嵌所有 LaTeX 公式、表格与 SVG 图，可在任意电脑离线双击打开</p>
            </div>
          </div>
          <button
            class="btn-outlined btn-sm sync-mirrors-btn"
            @click="handleSyncMirrors"
            :disabled="isSyncing"
            title="重新生成所有错题本 HTML 镜像，清理注释并重排 KaTeX 公式"
          >
            <RefreshCw :size="14" :class="{ 'spin-anim': isSyncing }" />
            <span>{{ isSyncing ? '同步中...' : '立即同步 HTML 镜像' }}</span>
          </button>
        </div>

        <div v-if="notebooks.length === 0" class="empty-hint">
          暂无自定义错题本，请在「错题库」点击“新建错题本”。
        </div>

        <div v-else class="notebook-export-grid">
          <div v-for="nb in notebooks" :key="nb.id" class="nb-export-item">
            <div class="nb-item-info">
              <span class="nb-item-name">{{ nb.name }}</span>
              <span class="nb-item-sub">{{ nb.subject }} · {{ nb.name }}.html</span>
            </div>
            <div class="nb-item-actions">
              <button class="btn-action-icon" title="重命名该错题本" @click="openRenameDialog(nb)">
                <Pencil :size="14" />
              </button>
              <button class="btn-action-icon" title="导出为离线 HTML 单文件" @click="handleExportHtml(nb)">
                <Download :size="14" />
              </button>
              <button class="btn-danger-sm" title="删除该错题本" @click="nbToDelete = nb">
                <Trash2 :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Database Backup Card -->
      <div class="m3-card">
        <div class="card-icon-title">
          <div class="icon-circle icon-db">
            <Database :size="22" />
          </div>
          <div class="title-meta">
            <h3>SQLite 数据库备份</h3>
            <p>包含所有错题完整数据、难度星级、重要度指标与修改时间的底层数据库</p>
          </div>
        </div>

        <div class="backup-action-row">
          <span class="backup-hint">建议定期将数据库文件备份至外部存储设备或网盘。</span>
          <button class="btn-primary" @click="handleBackupDb">
            <HardDriveDownload :size="16" />
            <span>备份 SQLite 数据库文件</span>
          </button>
        </div>
      </div>

      <!-- About Card -->
      <div class="m3-card about-card">
        <div class="about-brand">
          <div class="brand-logo-mark-sm">
            <img src="/favicon.svg" alt="NaosuNote" class="logo-svg-sm" draggable="false" />
          </div>
          <div>
            <h4>NaosuNote</h4>
            <p>直すノート·错题整理</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Rename Notebook Dialog -->
    <div v-if="nbToRename" class="m3-dialog-scrim" @click.self="nbToRename = null">
      <div class="m3-dialog">
        <div class="dialog-icon-wrapper primary-icon">
          <Pencil :size="24" />
        </div>
        <h3 class="dialog-title">重命名错题本</h3>
        <div class="dialog-form">
          <p class="dialog-desc">
            将错题本「{{ nbToRename.name }}」重命名为：
          </p>
          <input
            v-model="renameInput"
            type="text"
            class="dialog-input"
            placeholder="输入新的错题本名称"
            maxlength="32"
            @keydown.enter.prevent="confirmRenameNb"
          />
        </div>
        <div class="dialog-actions">
          <button class="btn-text" @click="nbToRename = null">取消</button>
          <button
            class="btn-primary-dialog"
            :disabled="!renameInput.trim() || renameInput.trim() === nbToRename.name"
            @click="confirmRenameNb"
          >
            确认修改
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Notebook Confirmation Dialog -->
    <div v-if="nbToDelete" class="m3-dialog-scrim" @click.self="nbToDelete = null">
      <div class="m3-dialog">
        <div class="dialog-icon-wrapper danger-icon">
          <Trash2 :size="24" />
        </div>
        <h3 class="dialog-title">删除错题本确认</h3>
        <div class="dialog-form">
          <p class="dialog-desc">
            确定要彻底删除错题本「{{ nbToDelete.name }}」吗？
          </p>
          <p class="dialog-hint">
            此操作将同时删除该错题本名下的所有题目及其本地 HTML 镜像文件，无法撤销。
          </p>
        </div>
        <div class="dialog-actions">
          <button class="btn-text" @click="nbToDelete = null">取消</button>
          <button class="btn-danger" @click="confirmDeleteNb">
            确认删除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { Notebook } from '../types/problem';
import {
  apiGetDataDir,
  apiSelectDataDir,
  apiOpenDataDir,
  apiSyncAllMirrors,
  apiGetNotebooks,
  apiRenameNotebook,
  apiExportNotebookHtml,
  apiDeleteNotebook,
  apiBackupDatabase,
} from '../utils/api';
import {
  Folder,
  FolderOpen,
  FileCode,
  Database,
  HardDriveDownload,
  Trash2,
  Pencil,
  Download,
  Sun,
  Moon,
  Laptop,
  ExternalLink,
  RefreshCw,
} from 'lucide-vue-next';
import { isDark, setTheme, type ThemeMode } from '../utils/theme';

const emit = defineEmits<{
  (e: 'notify', msg: string): void;
}>();

const currentDataDir = ref('');
const notebooks = ref<Notebook[]>([]);
const nbToDelete = ref<Notebook | null>(null);
const nbToRename = ref<Notebook | null>(null);
const renameInput = ref('');
const isSyncing = ref(false);

const currentThemeMode = ref<ThemeMode>(
  (localStorage.getItem('naosu_theme') as ThemeMode) || 'system'
);

function selectThemeMode(mode: ThemeMode) {
  currentThemeMode.value = mode;
  setTheme(mode);
}

onMounted(() => {
  loadData();
});

async function loadData() {
  try {
    currentDataDir.value = await apiGetDataDir();
    notebooks.value = await apiGetNotebooks();
  } catch (e) {
    console.error(e);
  }
}

async function handleOpenDir() {
  try {
    await apiOpenDataDir();
  } catch (e: any) {
    emit('notify', '打开保存目录失败: ' + (e?.message || e));
  }
}

async function handleSyncMirrors() {
  if (isSyncing.value) return;
  isSyncing.value = true;
  try {
    await apiSyncAllMirrors();
    emit('notify', '已成功重新生成并同步所有错题本 HTML 镜像文件');
  } catch (e: any) {
    emit('notify', '同步失败: ' + (e?.message || e));
  } finally {
    isSyncing.value = false;
  }
}

async function handleSelectDir() {
  try {
    const chosen = await apiSelectDataDir();
    if (chosen) {
      currentDataDir.value = chosen;
      emit('notify', `数据保存目录已更改为: ${chosen}`);
      await loadData();
    }
  } catch (e: any) {
    emit('notify', '切换目录失败: ' + (e?.message || e));
  }
}

function openRenameDialog(nb: Notebook) {
  nbToRename.value = nb;
  renameInput.value = nb.name;
}

async function confirmRenameNb() {
  if (!nbToRename.value) return;
  const newName = renameInput.value.trim();
  if (!newName || newName === nbToRename.value.name) {
    nbToRename.value = null;
    return;
  }
  const targetId = nbToRename.value.id;
  try {
    await apiRenameNotebook(targetId, newName);
    emit('notify', `错题本已成功重命名为「${newName}」`);
    await loadData();
  } catch (e: any) {
    emit('notify', '重命名失败: ' + (e?.message || e));
  } finally {
    nbToRename.value = null;
  }
}

async function handleExportHtml(nb: Notebook) {
  try {
    const savedPath = await apiExportNotebookHtml(nb.id);
    if (savedPath) {
      emit('notify', `「${nb.name}」已成功导出至: ${savedPath}`);
    }
  } catch (e: any) {
    emit('notify', '导出 HTML 失败: ' + (e?.message || e));
  }
}

async function confirmDeleteNb() {
  if (!nbToDelete.value) return;
  const target = nbToDelete.value;
  try {
    await apiDeleteNotebook(target.id);
    emit('notify', `已删除错题本「${target.name}」`);
    await loadData();
  } catch (e: any) {
    emit('notify', '删除失败: ' + (e?.message || e));
  } finally {
    nbToDelete.value = null;
  }
}

async function handleBackupDb() {
  try {
    const savedPath = await apiBackupDatabase();
    if (savedPath) {
      emit('notify', `SQLite 数据库已备份至: ${savedPath}`);
    }
  } catch (e: any) {
    emit('notify', '备份数据库失败: ' + (e?.message || e));
  }
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.settings-view {
  height: 100%;
  overflow-y: auto;
  padding: 24px 36px 60px 36px;
  background-color: var(--md-sys-color-background);
}

.settings-container {
  max-width: 860px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.settings-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
  -webkit-app-region: drag;
  user-select: none;
}

.view-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--md-sys-color-on-background);
}

.view-subtitle {
  font-size: 13px;
  color: var(--md-sys-color-on-surface-variant);
  line-height: 1.6;
}

.m3-card {
  background: var(--md-sys-color-surface-container-lowest);
  border-radius: var(--md-shape-corner-xl);
  border: 1px solid var(--md-sys-color-outline-variant);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.card-icon-title {
  display: flex;
  align-items: center;
  gap: 16px;
}

.icon-circle {
  width: 44px;
  height: 44px;
  border-radius: var(--md-shape-corner-full);
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  display: flex;
  align-items: center;
  justify-content: center;
}
.icon-theme { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.icon-html { background: #fef3c7; color: #b45309; }
.icon-db { background: #dcfce7; color: #15803d; }

[data-theme="dark"] .icon-html { background: #422006; color: #fde68a; }
[data-theme="dark"] .icon-db { background: #052e16; color: #86efac; }

.title-meta h3 {
  font-size: 16px;
  font-weight: 700;
  color: var(--md-sys-color-on-surface);
  margin-bottom: 2px;
}

.title-meta p {
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
}

.theme-switch-row {
  max-width: 380px;
}

.segmented-control {
  display: flex;
  background-color: var(--md-sys-color-surface-container-high);
  border-radius: var(--md-shape-corner-sm);
  padding: 3px;
  gap: 3px;
}

.segment-btn {
  flex: 1;
  height: 34px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  color: var(--md-sys-color-on-surface-variant);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s;
}

.segment-btn.active {
  background-color: var(--md-sys-color-surface-container-lowest);
  color: var(--md-sys-color-on-surface);
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.dir-path-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: var(--md-sys-color-surface-container-high);
  border-radius: var(--md-shape-corner-md);
  padding: 12px 18px;
}

.dir-path {
  font-family: ui-monospace, monospace;
  font-size: 13px;
  color: var(--md-sys-color-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dir-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.card-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 16px;
}

.sync-mirrors-btn {
  white-space: nowrap;
}

.btn-outlined {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-shape-corner-full);
  font-size: 13px;
  font-weight: 600;
  color: var(--md-sys-color-primary);
  background: var(--md-sys-color-surface-container-lowest);
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-outlined:hover {
  background: var(--md-sys-color-surface-container);
}
.btn-outlined:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-sm {
  padding: 4px 12px;
  font-size: 12px;
}

.spin-anim {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.notebook-export-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.nb-export-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--md-sys-color-surface-container-low);
  border-radius: var(--md-shape-corner-md);
}

.nb-item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nb-item-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--md-sys-color-on-surface);
}

.nb-item-sub {
  font-size: 11px;
  color: var(--md-sys-color-outline);
}

.nb-item-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-action-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--md-sys-color-on-surface-variant);
  background: transparent;
  border: 1px solid var(--md-sys-color-outline-variant);
  transition: all 0.2s;
}
.btn-action-icon:hover {
  background: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-primary);
  border-color: var(--md-sys-color-primary);
}

.btn-danger-sm {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--md-sys-color-error);
  background: transparent;
  border: 1px solid transparent;
  transition: all 0.2s;
}
.btn-danger-sm:hover {
  background: var(--md-sys-color-error-container);
}

.empty-hint {
  font-size: 13px;
  color: var(--md-sys-color-outline);
}

.backup-action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

.backup-hint {
  font-size: 13px;
  color: var(--md-sys-color-on-surface-variant);
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: var(--md-shape-corner-full);
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  font-size: 13px;
  font-weight: 600;
}
.btn-primary:hover {
  filter: brightness(1.05);
}

.about-card {
  background: var(--md-sys-color-surface-container-low);
  border: none;
}

.about-brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand-logo-mark-sm {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.logo-svg-sm {
  width: 38px;
  height: 38px;
  display: block;
  object-fit: contain;
}

.about-brand h4 {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 2px;
  color: var(--md-sys-color-on-surface);
}

.about-brand p {
  font-size: 12px;
  color: var(--md-sys-color-outline);
}

/* M3 Dialog Styles */
.m3-dialog-scrim {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.m3-dialog {
  width: 90%;
  max-width: 440px;
  background-color: var(--md-sys-color-surface-container-high);
  border-radius: var(--md-shape-corner-xxl);
  box-shadow: var(--md-elevation-3);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: dialog-pop 0.2s cubic-bezier(0.2, 0, 0, 1);
}

@keyframes dialog-pop {
  from { opacity: 0; transform: scale(0.92); }
  to { opacity: 1; transform: scale(1); }
}

.dialog-icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: var(--md-shape-corner-full);
  display: flex;
  align-items: center;
  justify-content: center;
}

.danger-icon {
  background-color: var(--md-sys-color-error-container);
  color: var(--md-sys-color-error);
}

.dialog-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--md-sys-color-on-surface);
  margin: 0;
}

.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dialog-desc {
  font-size: 14px;
  color: var(--md-sys-color-on-surface);
  margin: 0;
  line-height: 1.5;
}

.dialog-hint {
  font-size: 12px;
  color: var(--md-sys-color-outline);
  margin: 0;
  line-height: 1.4;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}

.btn-text {
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface-variant);
  border-radius: var(--md-shape-corner-full);
}

.btn-danger {
  height: 40px;
  padding: 0 20px;
  border-radius: var(--md-shape-corner-full);
  background-color: var(--md-sys-color-error);
  color: var(--md-sys-color-on-error);
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
}
.btn-danger:hover {
  filter: brightness(1.1);
  box-shadow: var(--md-elevation-1);
}

.primary-icon {
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-primary);
}

.dialog-input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  border-radius: var(--md-shape-corner-sm);
  border: 1px solid var(--md-sys-color-outline-variant);
  background-color: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface);
  font-size: 14px;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
  transition: all 0.2s;
}
.dialog-input:focus {
  border-color: var(--md-sys-color-primary);
  background-color: var(--md-sys-color-surface-container-lowest);
  box-shadow: 0 0 0 2px var(--md-sys-color-primary-container);
}

.btn-primary-dialog {
  height: 40px;
  padding: 0 20px;
  border-radius: var(--md-shape-corner-full);
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
}
.btn-primary-dialog:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-primary-dialog:not(:disabled):hover {
  box-shadow: var(--md-elevation-1);
  filter: brightness(1.08);
}
</style>
