<template>
  <div class="profile-phone-page">
    <!-- Top Header Navigation Bar -->
    <header class="profile-page-header">
      <button class="btn-back" @click="$emit('back')">
        <ChevronLeft :size="22" />
        <span>返回</span>
      </button>

      <h1 class="header-title">个人账号与档案</h1>

      <button class="btn-refresh-header" :disabled="loadingStats" title="刷新数据" @click="refreshData">
        <RefreshCw :size="16" :class="{ 'spin-anim': loadingStats }" />
      </button>
    </header>

    <!-- Page Scroll Body -->
    <div class="profile-page-body">
      <!-- 1. 用户档案 Hero 卡片 (User Profile Card) -->
      <div class="m3-hero-card">
        <!-- 已登录状态 -->
        <div v-if="isLoggedIn" class="user-hero-main">
          <div class="avatar-wrapper">
            <div class="avatar-ring clickable-ring" title="点击更换头像" @click="triggerAvatarUpload">
              <img :src="userAvatarUrl" alt="用户头像" class="user-avatar-img" />
            </div>
            <button
              class="avatar-edit-badge"
              title="更换头像"
              @click.stop="triggerAvatarUpload"
            >
              <Camera :size="12" />
            </button>
          </div>

          <div class="user-info-text">
            <!-- 昵称展示与行内编辑 -->
            <div v-if="!isEditing" class="name-row">
              <h2 class="user-name">{{ profileName }}</h2>
              <button class="inline-edit-btn" title="编辑用户名" @click="toggleEdit">
                <Pencil :size="12" />
              </button>
            </div>
            <div v-else class="edit-row">
              <input
                ref="nameInputRef"
                v-model="tempName"
                class="edit-input"
                placeholder="输入用户名"
                maxlength="20"
                @keydown.enter="saveProfile"
              />
            </div>

            <!-- 邮箱/账号展示与行内编辑 -->
            <div v-if="!isEditing" class="email-row">
              <span class="user-email">{{ profileEmail }}</span>
            </div>
            <div v-else class="edit-row">
              <input
                v-model="tempEmail"
                class="edit-input"
                placeholder="输入邮箱"
                maxlength="40"
                @keydown.enter="saveProfile"
              />
            </div>

            <!-- 身份与权益徽章 -->
            <div class="badges-row">
              <span class="pro-badge">Pro 尊享版</span>
              <span class="status-pill">
                <span class="dot-online"></span>
                <span>云端就绪</span>
              </span>
            </div>

            <!-- 编辑状态下的保存与取消 -->
            <div v-if="isEditing" class="edit-action-btns">
              <button class="btn-save-edit" @click="saveProfile">保存修改</button>
              <button class="btn-cancel-edit" @click="cancelEdit">取消</button>
            </div>
          </div>
        </div>

        <!-- 未登录状态 (本地模式) -->
        <div v-else class="user-hero-main logged-out-main">
          <div class="avatar-wrapper">
            <div class="avatar-ring clickable-ring" title="点击更换头像" @click="triggerAvatarUpload">
              <img :src="userAvatarUrl" alt="用户头像" class="user-avatar-img" />
            </div>
            <button
              class="avatar-edit-badge"
              title="更换头像"
              @click.stop="triggerAvatarUpload"
            >
              <Camera :size="12" />
            </button>
          </div>
          <div class="user-info-text">
            <div v-if="!isEditing" class="name-row">
              <h2 class="user-name">{{ profileName || '本地用户' }}</h2>
              <button class="inline-edit-btn" title="编辑用户名" @click="toggleEdit">
                <Pencil :size="12" />
              </button>
            </div>
            <div v-else class="edit-row">
              <input
                ref="nameInputRef"
                v-model="tempName"
                class="edit-input"
                placeholder="输入用户名"
                maxlength="20"
                @keydown.enter="saveProfile"
              />
            </div>

            <div class="email-row">
              <span class="user-email guest-sub">本地离线存储 · 数据保存在本机</span>
            </div>

            <div class="badges-row">
              <span class="status-pill local-pill">
                <span class="dot-local"></span>
                <span>本地模式</span>
              </span>
            </div>

            <div v-if="isEditing" class="edit-action-btns">
              <button class="btn-save-edit" @click="saveProfile">保存修改</button>
              <button class="btn-cancel-edit" @click="cancelEdit">取消</button>
            </div>

            <button v-if="!isEditing" class="btn-login-hero" @click="showLoginModal = true">
              <LogIn :size="14" />
              <span>登录 / 注册 Naosu 账号</span>
            </button>
          </div>
        </div>
        <input
          ref="avatarInputRef"
          type="file"
          accept="image/*"
          style="display: none"
          @change="handleAvatarFileChange"
        />
      </div>

      <!-- 2. 本地数据与资产总览 (Local Data Statistics) -->
      <div class="m3-content-card">
        <div class="card-title-row">
          <div class="icon-circle icon-storage">
            <Database :size="18" />
          </div>
          <div class="card-title-text">
            <h3>本地数据资产</h3>
            <span class="card-sub-hint">底层 SQLite 数据库与离线镜像</span>
          </div>
        </div>

        <div class="stats-grid-row">
          <div class="stat-cell">
            <span class="stat-number">{{ stats.problemCount }}</span>
            <span class="stat-desc">道错题</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-cell">
            <span class="stat-number">{{ stats.notebookCount }}</span>
            <span class="stat-desc">个错题本</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-cell">
            <span class="stat-number">{{ stats.subjectCount }}</span>
            <span class="stat-desc">门学科</span>
          </div>
        </div>

        <!-- 存储空间条 -->
        <div class="storage-bar-section">
          <div class="storage-meta">
            <span class="storage-label">已使用存储容量</span>
            <span class="storage-val">
              <strong>{{ displayStorageText }}</strong> / 200 MB ({{ storagePercentText }})
            </span>
          </div>
          <div class="storage-track">
            <div class="storage-fill" :style="{ width: `${storagePercent}%` }"></div>
          </div>
        </div>

        <div class="card-bottom-action">
          <button class="btn-full-action" @click="handleOpenDataDir">
            <Folder :size="15" />
            <span>在系统文件管理器中查看本地目录</span>
          </button>
        </div>
      </div>

      <!-- 3. 云端多端同步控制 (Cloud Sync Control) -->
      <div class="m3-content-card">
        <div class="card-title-row">
          <div class="icon-circle icon-sync">
            <RefreshCw :size="18" :class="{ 'spin-anim': isSyncing }" />
          </div>
          <div class="card-title-text">
            <h3>云端多端同步</h3>
            <span class="card-sub-hint">同步手机端与桌面端错题</span>
          </div>
        </div>

        <div class="sync-status-box">
          <div class="sync-status-item">
            <span class="label">上次同步：</span>
            <span class="value">{{ lastSyncTimeText }}</span>
          </div>
          <div class="sync-status-item">
            <span class="label">同步机制：</span>
            <span class="value">端到端增量同步 (包含配图与公式)</span>
          </div>
        </div>

        <div class="sync-btn-wrap">
          <button
            class="btn-primary-sync"
            :disabled="isSyncing"
            @click="handleTriggerCloudSync"
          >
            <RefreshCw :size="16" :class="{ 'spin-anim': isSyncing }" />
            <span>{{ isSyncing ? '正在拉取与推送错题...' : '立即执行云端同步' }}</span>
          </button>
        </div>

        <!-- 退出登录按钮 (仅已登录展示) -->
        <div v-if="isLoggedIn" class="logout-row">
          <button class="btn-logout-text" @click="handleLogout">
            <LogOut :size="14" />
            <span>退出当前账号登录</span>
          </button>
        </div>
      </div>

      <!-- 4. 离线 HTML 错题镜像全量同步 -->
      <div class="m3-content-card">
        <div class="card-title-row">
          <div class="icon-circle icon-html">
            <FileCode :size="18" />
          </div>
          <div class="card-title-text">
            <h3>本地 HTML 镜像全量同步</h3>
            <span class="card-sub-hint">离线单文件，任何浏览器可双击打开</span>
          </div>
        </div>

        <p class="card-intro-text">
          系统为每个错题本自动编译内嵌所有 LaTeX 公式与图片的离线 HTML 单文件，方便免网络复习。
        </p>

        <button
          class="btn-full-action"
          :disabled="isSyncingMirrors"
          @click="handleSyncMirrors"
        >
          <RefreshCw :size="15" :class="{ 'spin-anim': isSyncingMirrors }" />
          <span>{{ isSyncingMirrors ? '正在生成镜像...' : '全量重新生成本地 HTML 镜像' }}</span>
        </button>
      </div>

      <!-- 底部协议与品牌信息 -->
      <footer class="profile-page-footer">
        <div class="footer-brand">
          <img src="/favicon.svg" alt="NaosuNote" class="footer-logo" draggable="false" />
          <span>NaosuNote · 直すノート</span>
        </div>
        <p class="footer-rights">轻量、极速、离线优先的 AI 智能错题整理系统</p>
      </footer>
    </div>

    <!-- 登录交互模态弹窗 -->
    <Transition name="fade">
      <div v-if="showLoginModal" class="login-modal-backdrop" @click.self="showLoginModal = false">
        <div class="login-modal-card">
          <div class="login-header">
            <img src="/favicon.svg" alt="NaosuNote" class="login-brand-logo" draggable="false" />
            <h3>登录 Naosu 账号</h3>
            <p>登录后可享受多端自动同步与配图云备份</p>
          </div>

          <!-- 快速账号卡片 (仅当曾登录并存有本地凭据时展示，绝不硬编码预设) -->
          <div
            v-if="savedProfileUser"
            class="quick-login-card"
            :class="{ 'is-loading': isLoggingIn }"
            @click="fillSavedAccount(savedProfileUser)"
          >
            <img :src="userAvatarUrl" :alt="savedProfileUser.nickname || '用户'" class="quick-avatar" />
            <div class="quick-meta">
              <span class="quick-name">{{ savedProfileUser.nickname || '历史账号' }}</span>
              <span class="quick-email">{{ savedProfileUser.identifier || '' }}</span>
            </div>
            <span class="quick-badge">快捷填入</span>
          </div>

          <div v-if="savedProfileUser" class="login-sep">
            <span>或使用账号密码</span>
          </div>

          <!-- 表单登录 -->
          <div class="login-form">
            <input
              v-model="customLoginEmail"
              type="text"
              placeholder="已注册的邮箱或账号"
              class="login-field"
            />
            <input
              v-model="customLoginPassword"
              type="password"
              placeholder="请输入密码"
              class="login-field"
              @keydown.enter="handleRealLogin"
            />
            <button
              class="btn-login-submit"
              :disabled="isLoggingIn || !customLoginEmail.trim() || !customLoginPassword"
              @click="handleRealLogin"
            >
              <RefreshCw v-if="isLoggingIn" :size="14" class="spin-anim" />
              <span>{{ isLoggingIn ? '正在登录...' : '登录并启用云同步' }}</span>
            </button>
          </div>

          <button class="btn-close-modal" @click="showLoginModal = false">取消</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import {
  ChevronLeft,
  RefreshCw,
  Pencil,
  CircleUserRound,
  LogIn,
  LogOut,
  Database,
  Folder,
  FileCode,
  Camera,
} from 'lucide-vue-next';
import { userAvatarUrl, apiUploadUserAvatar } from '../utils/avatar';
import {
  apiGetProblems,
  apiGetNotebooks,
  apiGetDataDir,
  apiGetDataSize,
  apiOpenDataDir,
  apiSyncAllMirrors,
  apiLogin,
  apiLogout,
  apiGetProfileSummary,
  apiSyncCloud,
} from '../utils/api';

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'notify', msg: string): void;
}>();

// 登录与个人信息状态 - 默认未登录，本地模式
const isLoggedIn = ref(false);
const isLoggingIn = ref(false);
const showLoginModal = ref(false);
const customLoginEmail = ref('');
const customLoginPassword = ref('');

// 用户资料 - 头像与用户名均可自由自定义，无特定预设
const profileName = ref('本地用户');
const profileEmail = ref('');
const tempName = ref('');
const tempEmail = ref('');
const isEditing = ref(false);
const nameInputRef = ref<HTMLInputElement | null>(null);
const avatarInputRef = ref<HTMLInputElement | null>(null);
const isUploadingAvatar = ref(false);

const savedProfileUser = computed(() => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('naosu_user_profile');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
});

function triggerAvatarUpload() {
  avatarInputRef.value?.click();
}

async function handleAvatarFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  isUploadingAvatar.value = true;
  emit('notify', '正在处理并更新头像...');
  try {
    const success = await apiUploadUserAvatar(file);
    if (success) {
      emit('notify', '头像更新成功！');
    }
  } catch (err: any) {
    emit('notify', '头像更新失败: ' + (err?.message || err));
  } finally {
    isUploadingAvatar.value = false;
    target.value = '';
  }
}

function fillSavedAccount(user: any) {
  if (user?.identifier) {
    customLoginEmail.value = user.identifier;
  }
  emit('notify', `已选择账号：${user?.nickname || user?.identifier}，请输入密码`);
}

// 数据统计
const loadingStats = ref(false);
const stats = ref({
  problemCount: 0,
  notebookCount: 0,
  subjectCount: 0,
});
const currentDataDir = ref('');
const actualDataSizeBytes = ref(0);

// 同步状态
const isSyncing = ref(false);
const isSyncingMirrors = ref(false);
const lastSyncTimeText = ref('未同步');

// 存储计算 (200MB)
const TOTAL_STORAGE_CAPACITY_BYTES = 200 * 1024 * 1024;

const displayStorageText = computed(() => {
  const bytes = actualDataSizeBytes.value;
  if (bytes <= 0) return '0.0 MB';
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
});

const storagePercent = computed(() => {
  if (actualDataSizeBytes.value <= 0) return 2;
  const ratio = (actualDataSizeBytes.value / TOTAL_STORAGE_CAPACITY_BYTES) * 100;
  return Math.min(100, Math.max(2, Math.round(ratio * 10) / 10));
});

const storagePercentText = computed(() => {
  if (actualDataSizeBytes.value <= 0) return '0.1%';
  const ratio = (actualDataSizeBytes.value / TOTAL_STORAGE_CAPACITY_BYTES) * 100;
  return `${ratio.toFixed(1)}%`;
});

onMounted(() => {
  // 加载本地凭据 - 默认未登录，仅当值为 'true' 时判定登录
  const savedLogin = localStorage.getItem('naosu_is_logged_in');
  isLoggedIn.value = savedLogin === 'true';

  const savedName = localStorage.getItem('naosu_user_name');
  if (savedName) profileName.value = savedName;

  const savedEmail = localStorage.getItem('naosu_user_email');
  if (savedEmail) profileEmail.value = savedEmail;

  const savedSyncTime = localStorage.getItem('naosu_last_sync_time');
  if (savedSyncTime) lastSyncTimeText.value = savedSyncTime;

  refreshData();
});

async function refreshData() {
  loadingStats.value = true;
  try {
    const [probs, nbs, dirPath, sizeBytes] = await Promise.all([
      apiGetProblems().catch(() => []),
      apiGetNotebooks().catch(() => []),
      apiGetDataDir().catch(() => ''),
      apiGetDataSize().catch(() => 0),
    ]);

    const subjectsSet = new Set(probs.map((p) => p.subject));

    stats.value = {
      problemCount: probs.length,
      notebookCount: nbs.length,
      subjectCount: subjectsSet.size || 4,
    };
    currentDataDir.value = dirPath;
    actualDataSizeBytes.value = sizeBytes;

    if (isLoggedIn.value) {
      const summary = await apiGetProfileSummary().catch(() => null);
      if (summary) {
        if (summary.nickname) profileName.value = summary.nickname;
        if (summary.identifier) profileEmail.value = summary.identifier;
      }
    }
  } catch (err: any) {
    console.warn('Failed to load profile data:', err);
  } finally {
    loadingStats.value = false;
  }
}

function toggleEdit() {
  if (!isEditing.value) {
    tempName.value = profileName.value;
    tempEmail.value = profileEmail.value;
    isEditing.value = true;
    nextTick(() => {
      nameInputRef.value?.focus();
    });
  } else {
    isEditing.value = false;
  }
}

function cancelEdit() {
  isEditing.value = false;
}

function saveProfile() {
  const name = tempName.value.trim();
  const email = tempEmail.value.trim();

  if (name) {
    profileName.value = name;
    localStorage.setItem('naosu_user_name', name);
  }
  if (email) {
    profileEmail.value = email;
    localStorage.setItem('naosu_user_email', email);
  }
  isEditing.value = false;
  emit('notify', '个人资料已成功保存');
}

async function handleOpenDataDir() {
  try {
    await apiOpenDataDir();
  } catch (e: any) {
    emit('notify', '打开保存目录失败: ' + (e?.message || e));
  }
}

async function handleTriggerCloudSync() {
  if (isSyncing.value) return;
  isSyncing.value = true;
  try {
    const res = await apiSyncCloud((progressMsg) => {
      emit('notify', progressMsg);
    });

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    lastSyncTimeText.value = `今天 ${timeStr}`;
    localStorage.setItem('naosu_last_sync_time', lastSyncTimeText.value);

    const details: string[] = [];
    if (res.pulledProblems > 0) details.push(`拉取 ${res.pulledProblems} 题`);
    if (res.pushedProblems > 0) details.push(`推送 ${res.pushedProblems} 题`);
    if (res.downloadedImages > 0) details.push(`下载 ${res.downloadedImages} 张图片`);
    if (res.uploadedImages > 0) details.push(`上传 ${res.uploadedImages} 张图片`);
    if (res.deletedProblems > 0) details.push(`同步删除 ${res.deletedProblems} 题`);
    const summaryMsg = details.length > 0 ? `云端同步成功！已${details.join('，')}` : '云端同步完成，数据已为最新状态！';
    emit('notify', summaryMsg);
    await refreshData();
  } catch (err: any) {
    emit('notify', '云端同步失败: ' + (err?.message || err));
  } finally {
    isSyncing.value = false;
  }
}

async function handleSyncMirrors() {
  if (isSyncingMirrors.value) return;
  isSyncingMirrors.value = true;
  try {
    await apiSyncAllMirrors();
    emit('notify', '已全量同步错题本 HTML 离线镜像');
  } catch (e: any) {
    emit('notify', '同步镜像失败: ' + (e?.message || e));
  } finally {
    isSyncingMirrors.value = false;
  }
}

async function handleRealLogin() {
  if (!customLoginEmail.value.trim() || !customLoginPassword.value) return;
  isLoggingIn.value = true;
  try {
    const res = await apiLogin(customLoginEmail.value.trim(), customLoginPassword.value);
    profileName.value = res.user.nickname || customLoginEmail.value.trim();
    profileEmail.value = res.user.identifier || customLoginEmail.value.trim();
    isLoggedIn.value = true;
    localStorage.setItem('naosu_is_logged_in', 'true');
    localStorage.setItem('naosu_user_name', profileName.value);
    localStorage.setItem('naosu_user_email', profileEmail.value);

    showLoginModal.value = false;
    emit('notify', `登录成功！欢迎回来，${profileName.value}`);
    await refreshData();
  } catch (err: any) {
    emit('notify', '登录失败: ' + (err?.message || err));
  } finally {
    isLoggingIn.value = false;
  }
}

async function handleLogout() {
  try {
    apiLogout();
    isLoggedIn.value = false;
    localStorage.setItem('naosu_is_logged_in', 'false');
    emit('notify', '已退出当前账号，已切换为本地模式');
  } catch (e: any) {
    emit('notify', '退出失败: ' + (e?.message || e));
  }
}
</script>

<style scoped>
.profile-phone-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background-color: var(--md-sys-color-background);
  position: relative;
  overflow: hidden;
}

/* 顶部原生导航栏 */
.profile-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: var(--md-sys-color-surface);
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  z-index: 20;
}

.btn-back {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: none;
  border: none;
  font-size: 14px;
  font-weight: 600;
  color: var(--md-sys-color-primary);
  cursor: pointer;
  padding: 4px 6px 4px 0;
  -webkit-tap-highlight-color: transparent;
}

.header-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--md-sys-color-on-surface);
}

.btn-refresh-header {
  width: 34px;
  height: 34px;
  border-radius: 17px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-on-surface-variant);
  border: none;
  cursor: pointer;
}

/* 页面滚动主体 (纯净无模糊原生卡片) */
.profile-page-body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 14px 14px 40px 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* 1. 用户档案 Hero 卡片 */
.m3-hero-card {
  background-color: var(--md-sys-color-surface-container-lowest);
  border-radius: 20px;
  border: 1px solid var(--md-sys-color-outline-variant);
  padding: 18px 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.user-hero-main {
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar-wrapper {
  position: relative;
  flex-shrink: 0;
}

.avatar-ring {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  padding: 2.5px;
  background: linear-gradient(135deg, #1a73e8, #ea4335, #fbbc04, #34a853);
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  background: #ffffff;
}

.avatar-edit-badge {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 24px;
  height: 24px;
  border-radius: 12px;
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border: 2px solid var(--md-sys-color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.clickable-ring {
  cursor: pointer;
}

.inline-edit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  background-color: var(--md-sys-color-surface-variant);
  color: var(--md-sys-color-primary);
  margin-left: 6px;
  cursor: pointer;
  padding: 0;
}

.local-pill {
  background-color: var(--md-sys-color-surface-container-high) !important;
  color: var(--md-sys-color-primary) !important;
  border: 1px solid var(--md-sys-color-outline-variant);
}

.dot-local {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--md-sys-color-primary);
}

.user-info-text {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-name {
  font-size: 17px;
  font-weight: 700;
  color: var(--md-sys-color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: 12.5px;
  color: var(--md-sys-color-on-surface-variant);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.badges-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

.pro-badge {
  font-size: 10.5px;
  font-weight: 700;
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  padding: 2px 8px;
  border-radius: 6px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--md-sys-color-on-surface-variant);
  background-color: var(--md-sys-color-surface-container);
  padding: 2px 7px;
  border-radius: 6px;
}

.dot-online {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #10b981;
}

/* 行内编辑 */
.edit-row {
  margin-bottom: 2px;
}

.edit-input {
  width: 100%;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--md-sys-color-primary);
  background: var(--md-sys-color-surface);
  color: var(--md-sys-color-on-surface);
  font-size: 13px;
  outline: none;
}

.edit-action-btns {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

.btn-save-edit {
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border: none;
  font-size: 11.5px;
  font-weight: 600;
}

.btn-cancel-edit {
  padding: 4px 8px;
  background: transparent;
  color: var(--md-sys-color-outline);
  border: none;
  font-size: 11.5px;
}

/* 未登录状态 */
.logged-out-main {
  display: flex;
  align-items: center;
  gap: 14px;
}

.guest-ring {
  background: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-outline);
}

.guest-desc {
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
  margin-top: 2px;
  line-height: 1.4;
}

.btn-login-hero {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 6px 14px;
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border-radius: 12px;
  font-size: 12.5px;
  font-weight: 600;
  border: none;
  cursor: pointer;
}

/* 2. 通用 M3 纯色内容卡片 (绝无 backdrop-filter 模糊) */
.m3-content-card {
  background-color: var(--md-sys-color-surface-container-lowest);
  border-radius: 20px;
  border: 1px solid var(--md-sys-color-outline-variant);
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon-circle {
  width: 36px;
  height: 36px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.icon-storage { background: #dcfce7; color: #15803d; }
.icon-sync { background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container); }
.icon-html { background: #fef3c7; color: #b45309; }

[data-theme="dark"] .icon-storage { background: #052e16; color: #86efac; }
[data-theme="dark"] .icon-html { background: #422006; color: #fde68a; }

.card-title-text h3 {
  font-size: 15px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
}

.card-sub-hint {
  font-size: 11.5px;
  color: var(--md-sys-color-on-surface-variant);
}

/* 资产网格 */
.stats-grid-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
  background-color: var(--md-sys-color-surface-container);
  border-radius: 14px;
  padding: 12px 6px;
}

.stat-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-number {
  font-size: 18px;
  font-weight: 700;
  color: var(--md-sys-color-on-surface);
}

.stat-desc {
  font-size: 11.5px;
  color: var(--md-sys-color-outline);
}

.stat-divider {
  width: 1px;
  height: 24px;
  background-color: var(--md-sys-color-outline-variant);
}

/* 存储条 */
.storage-bar-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.storage-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
}

.storage-track {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background-color: var(--md-sys-color-surface-container-high);
  overflow: hidden;
}

.storage-fill {
  height: 100%;
  background: linear-gradient(90deg, #34a853, #1a73e8);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.btn-full-action {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid var(--md-sys-color-outline-variant);
  background: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-on-surface);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}

/* 同步状态与操作 */
.sync-status-box {
  background-color: var(--md-sys-color-surface-container);
  border-radius: 12px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
}

.sync-status-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sync-status-item .label {
  color: var(--md-sys-color-outline);
}

.sync-status-item .value {
  color: var(--md-sys-color-on-surface);
  font-weight: 500;
}

.btn-primary-sync {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border-radius: 14px;
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border: none;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
}

.btn-primary-sync:disabled {
  opacity: 0.7;
}

.logout-row {
  display: flex;
  justify-content: center;
}

.btn-logout-text {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12.5px;
  color: var(--md-sys-color-error);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
}

.card-intro-text {
  font-size: 12.5px;
  color: var(--md-sys-color-on-surface-variant);
  line-height: 1.45;
}

/* 底部协议与品牌 */
.profile-page-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding-top: 10px;
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--md-sys-color-outline);
}

.footer-logo {
  width: 16px;
  height: 16px;
}

.footer-rights {
  font-size: 11px;
  color: var(--md-sys-color-outline);
}

/* 登录弹窗 (纯色不模糊) */
.login-modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.55);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.login-modal-card {
  background-color: var(--md-sys-color-surface);
  border-radius: 24px;
  width: 100%;
  max-width: 330px;
  padding: 22px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.login-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 4px;
}

.login-brand-logo {
  width: 38px;
  height: 38px;
  margin-bottom: 4px;
}

.login-header h3 {
  font-size: 17px;
  font-weight: 700;
  color: var(--md-sys-color-on-surface);
}

.login-header p {
  font-size: 12px;
  color: var(--md-sys-color-outline);
}

.quick-login-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background-color: var(--md-sys-color-surface-container);
  border: 1px solid var(--md-sys-color-outline-variant);
  cursor: pointer;
}

.quick-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
}

.quick-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.quick-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
}

.quick-email {
  font-size: 11px;
  color: var(--md-sys-color-outline);
}

.quick-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}

.login-sep {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--md-sys-color-outline);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.login-field {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--md-sys-color-outline-variant);
  background: var(--md-sys-color-surface-container);
  color: var(--md-sys-color-on-surface);
  font-size: 13px;
  outline: none;
}

.btn-login-submit {
  padding: 10px;
  border-radius: 12px;
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  font-size: 13px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.btn-close-modal {
  background: none;
  border: none;
  font-size: 12.5px;
  color: var(--md-sys-color-outline);
  cursor: pointer;
  padding: 4px;
}

.spin-anim {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Modal Dialog Transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}
.fade-enter-active .login-modal-card {
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease;
}
.fade-leave-active .login-modal-card {
  transition: transform 0.14s cubic-bezier(0.4, 0, 1, 1), opacity 0.14s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.fade-enter-from .login-modal-card {
  opacity: 0;
  transform: scale(0.94) translateY(8px);
}
.fade-leave-to .login-modal-card {
  opacity: 0;
  transform: scale(0.96);
}
</style>
