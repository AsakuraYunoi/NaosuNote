<template>
  <div class="settings-phone-view">
    <header class="phone-header">
      <h2 class="title">系统设置</h2>
    </header>

    <div class="settings-scroll-body">
      <!-- 1. 外观主题 (Theme Selection Card) -->
      <div class="settings-m3-card">
        <div class="card-icon-title">
          <div class="icon-circle icon-theme">
            <Sun v-if="!isDark" :size="20" />
            <Moon v-else :size="20" />
          </div>
          <div class="title-meta">
            <h3>外观主题</h3>
            <p>切换应用明暗色彩与显示风格</p>
          </div>
        </div>

        <div class="segmented-control-m3">
          <button
            class="seg-pill"
            :class="{ active: currentThemeMode === 'light' }"
            @click="selectThemeMode('light')"
          >
            <Sun :size="14" />
            <span>浅色模式</span>
          </button>
          <button
            class="seg-pill"
            :class="{ active: currentThemeMode === 'dark' }"
            @click="selectThemeMode('dark')"
          >
            <Moon :size="14" />
            <span>深色模式</span>
          </button>
          <button
            class="seg-pill"
            :class="{ active: currentThemeMode === 'system' }"
            @click="selectThemeMode('system')"
          >
            <Laptop :size="14" />
            <span>跟随系统</span>
          </button>
        </div>
      </div>

      <!-- 2. 数据保存目录 (Storage Directory Card) -->
      <div class="settings-m3-card">
        <div class="card-icon-title">
          <div class="icon-circle icon-folder">
            <Folder :size="20" />
          </div>
          <div class="title-meta">
            <h3>数据保存目录</h3>
            <p>所有题目、配图与离线镜像存储路径</p>
          </div>
        </div>

        <div class="dir-path-box">
          <span class="dir-path-text">{{ currentDataDir || '正在读取数据路径...' }}</span>
          <div class="dir-actions-row">
            <button class="btn-outlined-m3" @click="handleOpenDir" title="打开保存目录">
              <ExternalLink :size="14" />
              <span>打开文件夹</span>
            </button>
            <button class="btn-outlined-m3" @click="handleSelectDir" title="更改保存目录">
              <FolderOpen :size="14" />
              <span>更改目录</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 3. 已建错题本与 HTML 离线镜像 (User Notebooks Mirrors Card) -->
      <div class="settings-m3-card">
        <div class="card-header-bar">
          <div class="card-icon-title">
            <div class="icon-circle icon-html">
              <FileCode :size="20" />
            </div>
            <div class="title-meta">
              <h3>已建错题本</h3>
              <p>各错题本均自动同步为单文件 HTML，公式与图表离线内嵌</p>
            </div>
          </div>

          <button
            class="btn-sync-mirrors"
            :disabled="isSyncingMirrors"
            title="重新生成并全量同步所有错题本 HTML 镜像"
            @click="handleSyncMirrors"
          >
            <RefreshCw :size="13" :class="{ 'spin-anim': isSyncingMirrors }" />
            <span>{{ isSyncingMirrors ? '同步中...' : '同步 HTML 镜像' }}</span>
          </button>
        </div>

        <div v-if="notebooks.length === 0" class="empty-hint">
          暂无自定义错题本，可在「错题库」点击“新建错题本”。
        </div>

        <div v-else class="notebook-export-list">
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
              <button class="btn-action-icon btn-danger" title="删除该错题本" @click="nbToDelete = nb">
                <Trash2 :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. SQLite 数据库备份 (Database Backup Card) -->
      <div class="settings-m3-card">
        <div class="card-icon-title">
          <div class="icon-circle icon-db">
            <Database :size="20" />
          </div>
          <div class="title-meta">
            <h3>SQLite 数据库备份</h3>
            <p>包含错题题干、考点、难度星级与排版标记的完整底层数据库</p>
          </div>
        </div>

        <div class="backup-action-row">
          <span class="backup-hint">建议定期将数据库文件导出备份至安全存储。</span>
          <button class="btn-primary-m3" @click="handleBackupDb">
            <HardDriveDownload :size="15" />
            <span>备份 SQLite 数据库文件</span>
          </button>
        </div>
      </div>

      <!-- 5. 云端服务器设置 -->
      <div class="settings-m3-card">
        <div class="card-icon-title">
          <div class="icon-circle icon-cloud">
            <Cloud :size="20" />
          </div>
          <div class="title-meta">
            <h3>云端多端同步服务器</h3>
            <p>多设备间错题云端备份与协同拉取</p>
          </div>
        </div>

        <div class="field-item">
          <div class="server-input-box">
            <input
              v-model="serverUrl"
              type="text"
              class="mobile-text-input"
              placeholder="https://naosunote.yunoi.online"
              @change="saveServerUrl"
            />
            <button class="btn-save-sm" @click="saveServerUrl">保存</button>
          </div>
        </div>
      </div>

      <!-- 6. 关于卡片 (About Card) -->
      <div class="settings-m3-card about-card">
        <div class="about-brand">
          <div class="brand-logo-mark-sm">
            <img src="/favicon.svg" alt="NaosuNote" class="logo-svg-sm" draggable="false" />
          </div>
          <div>
            <h4>NaosuNote</h4>
            <p>直すノート · 错题整理</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Rename Notebook Dialog (重命名错题本弹窗) -->
    <div v-if="nbToRename" class="m3-dialog-scrim" @click.self="nbToRename = null">
      <div class="m3-dialog">
        <div class="dialog-icon-wrapper primary-icon">
          <Pencil :size="22" />
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
          <button class="btn-text-dialog" @click="nbToRename = null">取消</button>
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

    <!-- Delete Notebook Confirmation Dialog (删除错题本确认弹窗) -->
    <div v-if="nbToDelete" class="m3-dialog-scrim" @click.self="nbToDelete = null">
      <div class="m3-dialog">
        <div class="dialog-icon-wrapper danger-icon">
          <Trash2 :size="22" />
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
          <button class="btn-text-dialog" @click="nbToDelete = null">取消</button>
          <button class="btn-danger-dialog" @click="confirmDeleteNb">
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
  getServerBaseUrl,
  setServerBaseUrl,
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
  Cloud,
} from 'lucide-vue-next';
import { isDark, setTheme, type ThemeMode } from '../utils/theme';

const emit = defineEmits<{
  (e: 'notify', msg: string): void;
  (e: 'open-profile'): void;
}>();

const currentDataDir = ref('');
const notebooks = ref<Notebook[]>([]);
const nbToDelete = ref<Notebook | null>(null);
const nbToRename = ref<Notebook | null>(null);
const renameInput = ref('');
const isSyncingMirrors = ref(false);
const serverUrl = ref('');

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
    serverUrl.value = getServerBaseUrl();
  } catch (e) {
    console.error(e);
  }
}

async function saveServerUrl() {
  const url = serverUrl.value.trim();
  if (!url) return;
  try {
    setServerBaseUrl(url);
    emit('notify', '已保存同步服务器地址');
  } catch (e: any) {
    emit('notify', '保存服务器地址失败: ' + (e?.message || e));
  }
}

async function handleOpenDir() {
  try {
    await apiOpenDataDir();
  } catch (e: any) {
    emit('notify', '打开保存目录失败: ' + (e?.message || e));
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

async function handleSyncMirrors() {
  if (isSyncingMirrors.value) return;
  isSyncingMirrors.value = true;
  try {
    await apiSyncAllMirrors();
    emit('notify', '已成功重新生成并同步所有错题本 HTML 镜像文件');
  } catch (e: any) {
    emit('notify', '同步失败: ' + (e?.message || e));
  } finally {
    isSyncingMirrors.value = false;
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
</script>

<style scoped>
.settings-phone-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--md-sys-color-background);
  position: relative;
  overflow: hidden;
}

.phone-header {
  padding: 14px 18px;
  background-color: var(--md-sys-color-surface);
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.title {
  font-size: 18px;
  font-weight: 700;
  color: var(--md-sys-color-on-surface);
}

.settings-scroll-body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 14px 14px 100px 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* 核心 M3 卡片 (对齐桌面端设计规范) */
.settings-m3-card {
  background: var(--md-sys-color-surface-container-lowest);
  border-radius: 20px;
  border: 1px solid var(--md-sys-color-outline-variant);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.card-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.card-icon-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon-circle {
  width: 38px;
  height: 38px;
  border-radius: 19px;
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.icon-theme { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
.icon-folder { background: var(--md-sys-color-surface-container-high); color: var(--md-sys-color-primary); }
.icon-html { background: #fef3c7; color: #b45309; }
.icon-db { background: #dcfce7; color: #15803d; }
.icon-cloud { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-primary); }

[data-theme="dark"] .icon-html { background: #422006; color: #fde68a; }
[data-theme="dark"] .icon-db { background: #052e16; color: #86efac; }

.title-meta h3 {
  font-size: 15px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
}

.title-meta p {
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
  margin-top: 2px;
  line-height: 1.4;
}

/* 分段选择器 (M3 Segmented Control) */
.segmented-control-m3 {
  display: flex;
  background-color: var(--md-sys-color-surface-container-high);
  border-radius: 14px;
  padding: 3px;
  gap: 4px;
}

.seg-pill {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 0;
  border-radius: 11px;
  border: none;
  background: transparent;
  color: var(--md-sys-color-on-surface-variant);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s ease;
}

.seg-pill.active {
  background-color: var(--md-sys-color-surface-container-lowest);
  color: var(--md-sys-color-on-surface);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  font-weight: 600;
}

/* 路径展示与操作 */
.dir-path-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dir-path-text {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11.5px;
  color: var(--md-sys-color-on-surface-variant);
  background: var(--md-sys-color-surface-container);
  padding: 8px 10px;
  border-radius: 8px;
  word-break: break-all;
}

.dir-actions-row {
  display: flex;
  gap: 8px;
}

.btn-outlined-m3 {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--md-sys-color-outline-variant);
  background: transparent;
  color: var(--md-sys-color-primary);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}

.btn-sync-mirrors {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 12px;
  border: 1px solid var(--md-sys-color-outline-variant);
  background: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-on-surface);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

/* 错题本列表项 */
.empty-hint {
  font-size: 12.5px;
  color: var(--md-sys-color-outline);
  padding: 10px 0;
}

.notebook-export-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nb-export-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 12px;
  background-color: var(--md-sys-color-surface-container);
  border: 1px solid var(--md-sys-color-outline-variant);
}

.nb-item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
  margin-right: 8px;
}

.nb-item-name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nb-item-sub {
  font-size: 11px;
  color: var(--md-sys-color-outline);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nb-item-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-action-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--md-sys-color-on-surface-variant);
}

.btn-action-icon:active {
  background: var(--md-sys-color-surface-container-high);
}

.btn-action-icon.btn-danger {
  color: var(--md-sys-color-error);
}

/* 数据库备份与通用操作 */
.backup-action-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.backup-hint {
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
}

.btn-primary-m3 {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border: none;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

/* 云端输入 */
.field-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.server-input-box {
  display: flex;
  gap: 8px;
}

.mobile-text-input {
  flex: 1;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--md-sys-color-outline-variant);
  background: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-on-surface);
  font-size: 13px;
  outline: none;
}

.mobile-text-input:focus {
  border-color: var(--md-sys-color-primary);
}

.btn-save-sm {
  padding: 0 14px;
  border-radius: 10px;
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border: none;
  font-size: 13px;
  font-weight: 600;
}

/* 关于卡片 */
.about-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-logo-mark-sm {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--md-sys-color-surface-container-high);
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-svg-sm {
  width: 24px;
  height: 24px;
}

.about-brand h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
}

.about-brand p {
  font-size: 12px;
  color: var(--md-sys-color-outline);
}

/* 对话框 Dialog (同桌面端规范) */
.m3-dialog-scrim {
  position: fixed;
  inset: 0;
  z-index: 300;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.m3-dialog {
  background-color: var(--md-sys-color-surface-container-lowest);
  border-radius: 24px;
  width: 100%;
  max-width: 330px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.25);
}

.dialog-icon-wrapper {
  width: 44px;
  height: 44px;
  border-radius: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.primary-icon {
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}

.danger-icon {
  background-color: var(--md-sys-color-error-container);
  color: var(--md-sys-color-error);
}

.dialog-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--md-sys-color-on-surface);
}

.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dialog-desc {
  font-size: 13px;
  color: var(--md-sys-color-on-surface-variant);
  line-height: 1.45;
}

.dialog-hint {
  font-size: 12px;
  color: var(--md-sys-color-error);
  line-height: 1.4;
}

.dialog-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1.5px solid var(--md-sys-color-outline);
  background: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-on-surface);
  font-size: 13.5px;
  outline: none;
}

.dialog-input:focus {
  border-color: var(--md-sys-color-primary);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}

.btn-text-dialog {
  padding: 8px 14px;
  border: none;
  background: transparent;
  color: var(--md-sys-color-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.btn-primary-dialog {
  padding: 8px 16px;
  border-radius: 16px;
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border: none;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.btn-danger-dialog {
  padding: 8px 16px;
  border-radius: 16px;
  background-color: var(--md-sys-color-error);
  color: var(--md-sys-color-on-error);
  border: none;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.spin-anim {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
