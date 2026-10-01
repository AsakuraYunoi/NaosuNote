<template>
  <Teleport to="body">
    <Transition :name="isMobile ? 'google-popover-mobile' : 'google-popover'">
      <div v-if="open" class="popover-backdrop" :class="{ 'is-mobile-backdrop': isMobile }" @click="handleBackdropClick">
        <div
          class="google-profile-card"
          :class="{ 'mobile-popover': isMobile }"
          role="dialog"
          aria-modal="true"
          aria-label="Google 风格个人信息卡片"
          @click.stop
        >
          <!-- Top Bar: Title & Close Button -->
          <div class="card-top-bar">
            <span class="card-brand-sub">Naosu Account</span>
            <button
              class="close-btn"
              title="关闭 (Esc)"
              aria-label="关闭"
              @click="close"
            >
              <X :size="18" />
            </button>
          </div>

          <!-- Section 1: User Profile Header Card -->
          <div class="inner-card profile-header-card">
            <!-- 状态 A: 已登录状态 -->
            <div v-if="isLoggedIn" class="profile-main-row">
              <!-- Avatar with Google-style Gradient Halo Ring & Edit Badge -->
              <div class="avatar-ring-container">
                <div class="avatar-ring clickable-avatar" title="点击更换头像" @click="triggerAvatarUpload">
                  <img :src="userAvatarUrl" alt="用户头像" class="user-avatar-img" />
                  <div class="avatar-hover-mask">
                    <Camera :size="16" class="camera-icon" />
                  </div>
                </div>
                <button
                  class="avatar-edit-badge"
                  title="更换头像"
                  @click.stop="triggerAvatarUpload"
                >
                  <Camera :size="11" />
                </button>
                <input
                  ref="avatarInputRef"
                  type="file"
                  accept="image/*"
                  style="display: none"
                  @change="handleAvatarFileChange"
                />
              </div>

              <!-- Name & Email & Badge -->
              <div class="profile-info-col">
                <div v-if="!isEditing" class="name-row">
                  <span class="user-name" :title="profileName">{{ profileName }}</span>
                </div>
                <div v-else class="edit-name-row">
                  <input
                    ref="nameInputRef"
                    v-model="tempName"
                    class="edit-input name-input"
                    placeholder="输入用户名"
                    maxlength="20"
                    @keydown.enter="saveProfile"
                  />
                </div>

                <div v-if="!isEditing" class="email-row">
                  <span class="user-email" :title="profileEmail">{{ profileEmail }}</span>
                </div>
                <div v-else class="edit-email-row">
                  <input
                    v-model="tempEmail"
                    class="edit-input email-input"
                    placeholder="输入邮箱或账号"
                    maxlength="40"
                    @keydown.enter="saveProfile"
                  />
                </div>

                <div class="tag-row">
                  <span class="pro-badge">Pro</span>
                  <span class="role-pill">本地与云端</span>
                </div>
              </div>

              <!-- Chevron Action / Toggle Details -->
              <button
                class="chevron-toggle-btn"
                :class="{ rotated: showExtraDetails }"
                :title="showExtraDetails ? '收起菜单' : '展开菜单'"
                @click="showExtraDetails = !showExtraDetails"
              >
                <ChevronDown :size="18" />
              </button>
            </div>

            <!-- 状态 B: 未登录状态 (伪登录展示) -->
            <div v-else class="profile-main-row logged-out-row">
              <div class="avatar-ring-container guest-avatar-wrap">
                <div class="avatar-ring guest-ring">
                  <CircleUserRound :size="38" class="guest-avatar-icon" />
                </div>
              </div>

              <div class="profile-info-col">
                <div class="name-row">
                  <span class="user-name guest-name">未登录账号</span>
                </div>
                <div class="email-row">
                  <span class="user-email guest-sub">登录后启用多端同步</span>
                </div>
                <div class="tag-row">
                  <span class="guest-pill">离线模式</span>
                </div>
              </div>

              <!-- 快捷登录主按钮 -->
              <button class="btn-login-hero" @click="openLoginModal">
                <LogIn :size="14" />
                <span>登录</span>
              </button>
            </div>

            <!-- Inline Edit Action Buttons -->
            <div v-if="isLoggedIn && isEditing" class="edit-actions-bar">
              <button class="edit-btn btn-save" @click="saveProfile">保存修改</button>
              <button class="edit-btn btn-cancel" @click="cancelEdit">取消</button>
            </div>

            <!-- 下拉菜单：改为单个“退出登录”按钮 -->
            <Transition name="fade-collapse">
              <div v-if="isLoggedIn && showExtraDetails" class="collapsible-shortcuts">
                <button class="shortcut-item logout-btn" @click="handleLogout">
                  <LogOut :size="14" />
                  <span>退出登录</span>
                </button>
              </div>
            </Transition>
          </div>

          <!-- Section 2: 本地数据总览 (已删除“进入错题库”入口) -->
          <div class="inner-card local-data-card">
            <div class="card-section-header">
              <div class="section-title-wrap">
                <div class="section-icon-box icon-local">
                  <Database :size="16" />
                </div>
                <span class="section-title">本地数据总览</span>
              </div>
            </div>

            <!-- 4-Stat Metrics Grid -->
            <div class="metrics-grid">
              <div class="metric-pill">
                <span class="metric-num">{{ stats.problemCount }}</span>
                <span class="metric-label">收录错题</span>
              </div>
              <div class="metric-pill">
                <span class="metric-num">{{ stats.notebookCount }}</span>
                <span class="metric-label">错题本</span>
              </div>
              <div class="metric-pill">
                <span class="metric-num">{{ stats.subjectCount }}</span>
                <span class="metric-label">覆盖学科</span>
              </div>
              <div class="metric-pill">
                <span class="metric-num review-num">{{ stats.reviewCount }}</span>
                <span class="metric-label">高频重点</span>
              </div>
            </div>

            <!-- Storage Folder Path Pill -->
            <div class="storage-path-row" @click="openDataDir" title="在访达中打开数据目录">
              <Folder :size="13" class="path-icon" />
              <span class="path-text">{{ displayDataDir }}</span>
              <ExternalLink :size="12" class="path-open-icon" />
            </div>
          </div>

          <!-- Section 3: 云端存储使用情况 (实际占用空间/200MB 进度条，删除提示词) -->
          <div class="inner-card cloud-usage-card">
            <div class="cloud-header-row">
              <div class="cloud-icon-title">
                <!-- Google Style Colored Cloud Icon -->
                <div class="cloud-svg-wrap">
                  <svg viewBox="0 0 24 24" class="cloud-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"
                      fill="url(#cloudGrad)"
                    />
                    <defs>
                      <linearGradient id="cloudGrad" x1="0" y1="4" x2="24" y2="20" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#4285F4" />
                        <stop offset="0.4" stop-color="#34A853" />
                        <stop offset="0.75" stop-color="#FBBC05" />
                        <stop offset="1" stop-color="#EA4335" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <span class="cloud-usage-text">{{ displayStorageText }} / 200 MB</span>
              </div>
              <span class="cloud-percent-tag">{{ storagePercentText }}</span>
            </div>

            <!-- Progress Bar -->
            <div class="cloud-progress-track">
              <div class="cloud-progress-fill" :style="{ width: `${storagePercent}%` }"></div>
            </div>
          </div>

          <!-- Section 4: 同步信息 (Sync Information) -->
          <div class="inner-card sync-info-card">
            <div class="sync-row">
              <div class="sync-status-col">
                <div class="sync-status-line">
                  <span
                    class="sync-indicator-dot"
                    :class="{
                      'is-syncing': isSyncing,
                      'is-synced': isLoggedIn && !isSyncing,
                      'is-offline': !isLoggedIn,
                    }"
                  ></span>
                  <span class="sync-title">
                    {{ !isLoggedIn ? '未登录 · 仅保存在本地' : isSyncing ? '正在同步镜像与云端...' : '云端与镜像已同步' }}
                  </span>
                </div>
                <span class="sync-sub">
                  {{ !isLoggedIn ? '登录后可开启自动同步' : isSyncing ? '更新 HTML 镜像与 LaTeX 渲染缓存' : `上次同步：${lastSyncTimeText}` }}
                </span>
              </div>

              <!-- Sync Now Button -->
              <button
                class="sync-action-btn"
                :disabled="isSyncing"
                title="重新生成所有错题本 HTML 镜像并同步"
                @click="triggerSync"
              >
                <RefreshCw :size="14" :class="{ 'spin-anim': isSyncing }" />
                <span>{{ isSyncing ? '同步中' : '立即同步' }}</span>
              </button>
            </div>
          </div>

          <!-- Bottom Footer (已删除“系统设置”) -->
          <div class="card-footer-links">
            <button class="footer-link-btn" @click="handlePrivacyClick">
              隐私政策
            </button>
            <span class="footer-dot">•</span>
            <button class="footer-link-btn" @click="handleTermsClick">
              用户协议
            </button>
          </div>

          <!-- 伪登录交互模态弹窗 (Fake Login Modal) -->
          <Transition name="fade-scale">
            <div v-if="showLoginModal" class="fake-login-overlay" @click.self="showLoginModal = false">
              <div class="fake-login-modal">
                <div class="login-modal-header">
                  <div class="login-logo-circle">
                    <img src="/favicon.svg" alt="NaosuNote" class="login-brand-icon" draggable="false" />
                  </div>
                  <h4 class="login-title">登录 Naosu 账号</h4>
                  <p class="login-desc">选择已有凭据或一键授权登录</p>
                </div>

                <!-- 账号选择卡片 (Google 风格一键登录) -->
                <div
                  class="quick-account-card"
                  :class="{ 'is-loading': isLoggingIn }"
                  @click="performFakeLogin('ゆのい 朝倉', 'As.Yunoi@outlook.jp')"
                >
                  <img :src="userAvatarUrl" alt="ゆのい 朝倉" class="quick-account-avatar" />
                  <div class="quick-account-info">
                    <span class="quick-account-name">ゆのい 朝倉</span>
                    <span class="quick-account-email">As.Yunoi@outlook.jp</span>
                  </div>
                  <span class="quick-account-badge">本机凭据</span>
                </div>

                <div class="login-divider">
                  <span>或使用其他账号</span>
                </div>

                <!-- 自定义登录表单 -->
                <div class="custom-login-form">
                  <input
                    v-model="customLoginEmail"
                    class="login-input"
                    placeholder="已注册的邮箱或手机号"
                    autocomplete="username"
                  />
                  <input
                    v-model="customLoginPassword"
                    type="password"
                    class="login-input"
                    placeholder="请输入登录密码"
                    autocomplete="current-password"
                    @keydown.enter="handleRealLogin"
                  />
                  <button
                    class="btn-submit-login"
                    :disabled="isLoggingIn || !customLoginEmail.trim() || !customLoginPassword"
                    @click="handleRealLogin"
                  >
                    <RefreshCw v-if="isLoggingIn" :size="15" class="spin-anim" />
                    <span>{{ isLoggingIn ? '正在验证并登录...' : '登录并开启云同步' }}</span>
                  </button>
                </div>

                <button class="btn-cancel-login" @click="showLoginModal = false">
                  取消
                </button>

                <!-- 注册账号按钮 (外部链接: https://naosunote.yunoi.online/registration) -->
                <div class="register-bottom-bar">
                  <button
                    class="btn-register-link"
                    title="在系统浏览器中打开注册页面 (https://naosunote.yunoi.online/registration)"
                    @click="handleOpenRegistration"
                  >
                    <span>还没有账号？前往注册</span>
                    <ExternalLink :size="12" class="register-ext-icon" />
                  </button>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue';
import {
  X,
  Pencil,
  ChevronDown,
  Database,
  Folder,
  RefreshCw,
  ExternalLink,
  LogOut,
  LogIn,
  CircleUserRound,
  Camera,
} from 'lucide-vue-next';
import avatarImg from '../assets/avatar.png';
import { userAvatarUrl, apiUploadUserAvatar } from '../utils/avatar';
import {
  apiGetProblems,
  apiGetNotebooks,
  apiGetDataDir,
  apiGetDataSize,
  apiOpenDataDir,
  apiOpenUrl,
  apiSyncAllMirrors,
  apiLogin,
  apiLogout,
  apiGetProfileSummary,
  apiSyncCloud,
  getAuthToken,
} from '../utils/api';

const props = withDefaults(
  defineProps<{
    open: boolean;
    isMobile?: boolean;
  }>(),
  {
    open: false,
    isMobile: false,
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'navigate', tab: string): void;
  (e: 'notify', msg: string): void;
}>();

// Login State
const isLoggedIn = ref(true);
const isLoggingIn = ref(false);
const showLoginModal = ref(false);
const customLoginName = ref('');
const customLoginEmail = ref('');
const customLoginPassword = ref('');

// User Profile States
const profileName = ref('ゆのい 朝倉');
const profileEmail = ref('As.Yunoi@outlook.jp');
const tempName = ref('');
const tempEmail = ref('');
const isEditing = ref(false);
const showExtraDetails = ref(false);
const nameInputRef = ref<HTMLInputElement | null>(null);
const avatarInputRef = ref<HTMLInputElement | null>(null);
const isUploadingAvatar = ref(false);

// Local Data Statistics
const stats = ref({
  problemCount: 0,
  notebookCount: 0,
  subjectCount: 0,
  reviewCount: 0,
});
const currentDataDir = ref('');
const displayDataDir = ref('~/Documents/NaosuNoteData');
const actualDataSizeBytes = ref(0);

// Sync States
const isSyncing = ref(false);
const lastSyncTimeText = ref('今天 10:48');

// Storage Calculations (200MB max)
const TOTAL_STORAGE_CAPACITY_BYTES = 200 * 1024 * 1024; // 200 MB

const displayStorageText = computed(() => {
  const bytes = actualDataSizeBytes.value;
  if (bytes <= 0) return '0.0 MB';
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
});

const storagePercent = computed(() => {
  if (actualDataSizeBytes.value <= 0) return 1.5; // subtle minimum bar
  const ratio = (actualDataSizeBytes.value / TOTAL_STORAGE_CAPACITY_BYTES) * 100;
  return Math.min(100, Math.max(1.5, Math.round(ratio * 10) / 10));
});

const storagePercentText = computed(() => {
  if (actualDataSizeBytes.value <= 0) return '0.1%';
  const ratio = (actualDataSizeBytes.value / TOTAL_STORAGE_CAPACITY_BYTES) * 100;
  return `${ratio.toFixed(1)}%`;
});

onMounted(() => {
  // Load saved login state
  const savedLogin = localStorage.getItem('naosu_is_logged_in');
  isLoggedIn.value = savedLogin !== 'false';

  // Load saved user info
  const savedName = localStorage.getItem('naosu_user_name');
  if (savedName) profileName.value = savedName;

  const savedEmail = localStorage.getItem('naosu_user_email');
  if (savedEmail) profileEmail.value = savedEmail;

  const savedSyncTime = localStorage.getItem('naosu_last_sync_time');
  if (savedSyncTime) lastSyncTimeText.value = savedSyncTime;

  window.addEventListener('keydown', onGlobalKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeyDown);
});

watch(
  () => props.open,
  (val) => {
    if (val) {
      loadStats();
    } else {
      isEditing.value = false;
      showExtraDetails.value = false;
      showLoginModal.value = false;
    }
  }
);

function onGlobalKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) {
    if (showLoginModal.value) {
      showLoginModal.value = false;
    } else {
      close();
    }
  }
}

function handleBackdropClick() {
  close();
}

function close() {
  emit('close');
}

function toggleEdit() {
  if (isEditing.value) {
    isEditing.value = false;
  } else {
    tempName.value = profileName.value;
    tempEmail.value = profileEmail.value;
    isEditing.value = true;
    nextTick(() => {
      nameInputRef.value?.focus();
    });
  }
}

function cancelEdit() {
  isEditing.value = false;
}

function saveProfile() {
  if (tempName.value.trim()) {
    profileName.value = tempName.value.trim();
    localStorage.setItem('naosu_user_name', profileName.value);
  }
  if (tempEmail.value.trim()) {
    profileEmail.value = tempEmail.value.trim();
    localStorage.setItem('naosu_user_email', profileEmail.value);
  }
  isEditing.value = false;
  emit('notify', '个人资料已更新');
}

// 退出登录
function handleLogout() {
  apiLogout();
  isLoggedIn.value = false;
  showExtraDetails.value = false;
  emit('notify', '已退出当前账号，已切换为离线访客模式');
}

// 打开登录弹窗
function openLoginModal() {
  showLoginModal.value = true;
  customLoginEmail.value = profileEmail.value || '';
  customLoginPassword.value = '';
}

// 打开外部注册链接
function handleOpenRegistration() {
  const url = 'https://naosunote.yunoi.online/registration';
  apiOpenUrl(url);
  emit('notify', '正在外部浏览器中打开注册页面...');
}

// 执行真实网络登录
async function handleRealLogin() {
  if (isLoggingIn.value) return;
  const idVal = customLoginEmail.value.trim();
  const pwdVal = customLoginPassword.value;

  if (!idVal || !pwdVal) {
    emit('notify', '请输入账号与密码');
    return;
  }

  isLoggingIn.value = true;
  try {
    const { user } = await apiLogin(idVal, pwdVal);
    profileName.value = user.nickname;
    profileEmail.value = user.identifier;
    isLoggedIn.value = true;
    showLoginModal.value = false;
    emit('notify', `登录成功，欢迎回来 ${user.nickname}！`);
    // 登录成功后自动触发一次全量增量同步
    await triggerSync();
  } catch (err: any) {
    emit('notify', err?.message || '登录失败，请检查账号密码');
  } finally {
    isLoggingIn.value = false;
  }
}

function triggerAvatarUpload() {
  avatarInputRef.value?.click();
}

async function handleAvatarFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  isUploadingAvatar.value = true;
  emit('notify', '正在处理并上传新头像...');
  try {
    const success = await apiUploadUserAvatar(file);
    if (success) {
      emit('notify', '头像更新成功并已同步到云端！');
    } else {
      emit('notify', '头像已保存到本地（未连接服务器或上传异常）');
    }
  } catch (err: any) {
    emit('notify', '头像更新失败: ' + (err?.message || err));
  } finally {
    isUploadingAvatar.value = false;
    target.value = '';
  }
}

function performFakeLogin(name: string, email: string) {
  customLoginEmail.value = email;
  customLoginName.value = name;
  emit('notify', `已选择账号凭据：${name} (${email})，请输入密码完成登录`);
}

async function loadStats() {
  try {
    const [problems, notebooks, dir, realBytes] = await Promise.all([
      apiGetProblems(),
      apiGetNotebooks(),
      apiGetDataDir(),
      apiGetDataSize(),
    ]);

    const subjects = new Set<string>();
    let highImportanceCount = 0;

    for (const p of problems) {
      if (p.subject) subjects.add(p.subject);
      if ((p.importance ?? 1) >= 3) {
        highImportanceCount++;
      }
    }

    stats.value = {
      problemCount: problems.length,
      notebookCount: notebooks.length,
      subjectCount: subjects.size,
      reviewCount: highImportanceCount,
    };

    currentDataDir.value = dir || '';
    if (dir) {
      const parts = dir.split('/');
      displayDataDir.value = parts.length > 3 ? '.../' + parts.slice(-2).join('/') : dir;
    }

    // 尝试拉取服务端配额与云端使用量
    if (getAuthToken()) {
      try {
        const summary = await apiGetProfileSummary();
        if (summary && summary.used_storage_bytes !== undefined) {
          actualDataSizeBytes.value = summary.used_storage_bytes;
          return;
        }
      } catch (_) {}
    }

    // 本地存储空间实际占用计算
    if (realBytes && realBytes > 0) {
      actualDataSizeBytes.value = realBytes;
    } else {
      const estimated = 40 * 1024 + problems.length * 480 * 1024;
      actualDataSizeBytes.value = Math.max(120 * 1024, estimated);
    }
  } catch (e) {
    console.warn('Failed to load profile stats:', e);
  }
}

async function triggerSync() {
  if (!isLoggedIn.value) {
    emit('notify', '请先登录账号以启用云端同步功能');
    openLoginModal();
    return;
  }

  if (isSyncing.value) return;
  isSyncing.value = true;
  try {
    if (getAuthToken()) {
      const result = await apiSyncCloud((msg) => emit('notify', msg));
      emit('notify', `云端同步完成 (拉取 ${result.pulledProblems} 题，推送 ${result.pushedProblems} 题，上传图片 ${result.uploadedImages} 张)`);
      try {
        const summary = await apiGetProfileSummary();
        if (summary.used_storage_bytes) {
          actualDataSizeBytes.value = summary.used_storage_bytes;
        }
      } catch (_) {}
    } else {
      await apiSyncAllMirrors();
      emit('notify', '错题本 HTML 镜像已同步');
    }
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    lastSyncTimeText.value = `今天 ${hours}:${minutes}`;
    localStorage.setItem('naosu_last_sync_time', lastSyncTimeText.value);
  } catch (e: any) {
    emit('notify', '同步失败: ' + (e?.message || e));
  } finally {
    isSyncing.value = false;
  }
}

async function openDataDir() {
  try {
    await apiOpenDataDir();
  } catch (e: any) {
    emit('notify', '打开目录失败: ' + (e?.message || e));
  }
}

function handlePrivacyClick() {
  emit('notify', '数据严格保存在本地 SQLite 与私有 WebDAV，保障绝对隐私');
}

function handleTermsClick() {
  emit('notify', 'NaosuNote 离线双向同步及开源协议');
}
</script>

<style scoped>
/* Backdrop */
.popover-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background-color: rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(1.5px);
  -webkit-backdrop-filter: blur(1.5px);
  display: flex;
  align-items: flex-end;
  pointer-events: auto;
}

/* Google-style Floating Container */
.google-profile-card {
  position: fixed;
  left: 92px;
  bottom: 18px;
  width: 384px;
  max-width: calc(100vw - 110px);
  max-height: calc(100vh - 36px);
  background-color: #f0f4f9;
  border-radius: 28px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.18), 0 3px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.06);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  user-select: none;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  z-index: 1001;
  box-sizing: border-box;
}

/* 移动端专属悬浮定位：紧贴右上角头像下方展开 */
.google-profile-card.mobile-popover {
  left: 12px;
  right: 12px;
  top: calc(env(safe-area-inset-top, 0px) + 64px);
  bottom: auto;
  width: auto;
  max-width: 390px;
  margin-left: auto;
  margin-right: 0;
  max-height: calc(100dvh - env(safe-area-inset-top, 0px) - 78px);
  border-radius: 24px;
  transform-origin: top right;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.32), 0 4px 12px rgba(0, 0, 0, 0.15);
}

.is-mobile-backdrop {
  background-color: rgba(0, 0, 0, 0.35);
}

@media (max-width: 768px) {
  .google-profile-card {
    left: 12px;
    right: 12px;
    top: calc(env(safe-area-inset-top, 0px) + 64px);
    bottom: auto;
    width: auto;
    max-width: 390px;
    margin-left: auto;
    margin-right: 0;
    max-height: calc(100dvh - env(safe-area-inset-top, 0px) - 78px);
    border-radius: 24px;
    transform-origin: top right;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.32), 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .popover-backdrop {
    background-color: rgba(0, 0, 0, 0.35);
  }
}

/* Top Bar */
.card-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 4px 4px 8px;
}

.card-brand-sub {
  font-size: 12px;
  font-weight: 600;
  color: #5f6368;
  letter-spacing: 0.2px;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: #444746;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, transform 0.15s ease;
}

.close-btn:hover {
  background-color: rgba(0, 0, 0, 0.08);
  color: #1f1f1f;
  transform: scale(1.05);
}

/* Inner White Cards */
.inner-card {
  background-color: #ffffff;
  border-radius: 20px;
  padding: 14px 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.2s ease, transform 0.15s ease;
}

/* Profile Header Card */
.profile-header-card {
  padding: 16px 18px;
  border-radius: 24px;
}

.profile-main-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

/* Avatar Ring & Edit Badge */
.avatar-ring-container {
  position: relative;
  flex-shrink: 0;
}

.avatar-ring {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  padding: 2.5px;
  background: linear-gradient(135deg, #a8c7fa 0%, #1a73e8 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(26, 115, 232, 0.25);
}

.guest-ring {
  background: linear-gradient(135deg, #dadce0 0%, #9aa0a6 100%);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #5f6368;
}

.guest-avatar-icon {
  color: #ffffff;
}

.user-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  background-color: #f1f3f4;
  display: block;
}

.clickable-avatar {
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.avatar-hover-mask {
  position: absolute;
  inset: 2.5px;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.clickable-avatar:hover .avatar-hover-mask {
  opacity: 1;
}

.avatar-hover-mask .camera-icon {
  color: #ffffff;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
}

.avatar-edit-badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background-color: #ffffff;
  border: 1.5px solid #d3d3d3;
  color: #444746;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
  transition: transform 0.15s ease, background-color 0.15s ease;
}

.avatar-edit-badge:hover {
  transform: scale(1.12);
  background-color: #f8f9fa;
  color: #1a73e8;
}

/* Profile Info Column */
.profile-info-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.name-row {
  display: flex;
  align-items: center;
}

.user-name {
  font-size: 17px;
  font-weight: 600;
  color: #1f1f1f;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.guest-name {
  color: #444746;
}

.email-row {
  margin-top: 2px;
}

.user-email {
  font-size: 13px;
  color: #5f6368;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.guest-sub {
  font-size: 11.5px;
  color: #80868b;
}

.tag-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}

.pro-badge {
  background-color: #d3e3fd;
  color: #041e49;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 9px;
  border-radius: 8px;
  letter-spacing: 0.2px;
}

.role-pill {
  background-color: #f1f3f4;
  color: #444746;
  font-size: 11px;
  font-weight: 500;
  padding: 1px 7px;
  border-radius: 6px;
}

.guest-pill {
  background-color: #f1f3f4;
  color: #5f6368;
  font-size: 11px;
  font-weight: 500;
  padding: 1px 8px;
  border-radius: 6px;
}

.btn-login-hero {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background-color: #1a73e8;
  color: #ffffff;
  border: none;
  font-size: 12.5px;
  font-weight: 600;
  padding: 7px 16px;
  border-radius: 999px;
  cursor: pointer;
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(26, 115, 232, 0.3);
  transition: all 0.15s ease;
}

.btn-login-hero:hover {
  background-color: #1557b0;
  box-shadow: 0 2px 6px rgba(26, 115, 232, 0.4);
  transform: translateY(-1px);
}

.chevron-toggle-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background-color: #f0f4f9;
  color: #444746;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s ease, background-color 0.15s ease;
  flex-shrink: 0;
}

.chevron-toggle-btn:hover {
  background-color: #e3e8ee;
  color: #1f1f1f;
}

.chevron-toggle-btn.rotated {
  transform: rotate(180deg);
}

/* Edit Mode Inputs */
.edit-input {
  width: 100%;
  box-sizing: border-box;
  padding: 4px 8px;
  border-radius: 8px;
  border: 1px solid #1a73e8;
  outline: none;
  font-size: 13px;
  background-color: #f8fafd;
  margin-bottom: 4px;
}

.name-input {
  font-size: 15px;
  font-weight: 600;
}

.edit-actions-bar {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid #f1f3f4;
}

.edit-btn {
  padding: 4px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s;
}

.btn-save {
  background-color: #1a73e8;
  color: #ffffff;
}

.btn-cancel {
  background-color: #f1f3f4;
  color: #444746;
}

/* Dropdown: 单个退出登录按钮 */
.collapsible-shortcuts {
  display: flex;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #f1f3f4;
}

.shortcut-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s ease;
}

.logout-btn {
  background-color: #fdf2f2;
  color: #d93025;
  border-color: #fad2cf;
}

.logout-btn:hover {
  background-color: #fce8e6;
  color: #c5221f;
  border-color: #f5c2be;
  box-shadow: 0 1px 3px rgba(217, 48, 37, 0.15);
}

/* Local Data Card */
.local-data-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-icon-box {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-local {
  background-color: #e8f0fe;
  color: #1a73e8;
}

.section-title {
  font-size: 13.5px;
  font-weight: 600;
  color: #1f1f1f;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.metric-pill {
  background-color: #f8fafd;
  border: 1px solid #edf2f7;
  border-radius: 12px;
  padding: 8px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.metric-num {
  font-size: 15px;
  font-weight: 700;
  color: #1f1f1f;
  line-height: 1.2;
}

.review-num {
  color: #d93025;
}

.metric-label {
  font-size: 10.5px;
  color: #5f6368;
  margin-top: 2px;
}

.storage-path-row {
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: #f1f3f4;
  border-radius: 8px;
  padding: 5px 8px;
  font-size: 11px;
  color: #5f6368;
  cursor: pointer;
  transition: background-color 0.15s;
}

.storage-path-row:hover {
  background-color: #e8eaed;
  color: #1f1f1f;
}

.path-icon {
  flex-shrink: 0;
  color: #444746;
}

.path-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.path-open-icon {
  flex-shrink: 0;
  opacity: 0.6;
}

/* Cloud Usage Card (200MB 进度条) */
.cloud-usage-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cloud-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cloud-icon-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cloud-svg-wrap {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cloud-svg {
  width: 22px;
  height: 22px;
}

.cloud-usage-text {
  font-size: 14px;
  font-weight: 600;
  color: #1f1f1f;
}

.cloud-percent-tag {
  font-size: 12px;
  font-weight: 600;
  color: #1a73e8;
  background-color: #e8f0fe;
  padding: 1px 8px;
  border-radius: 6px;
}

.cloud-progress-track {
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background-color: #e9ecef;
  overflow: hidden;
  margin-top: 2px;
}

.cloud-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #4285f4 0%, #1a73e8 100%);
  transition: width 0.4s ease;
}

/* Sync Info Card */
.sync-info-card {
  padding: 12px 16px;
}

.sync-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sync-status-col {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.sync-status-line {
  display: flex;
  align-items: center;
  gap: 7px;
}

.sync-indicator-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sync-indicator-dot.is-synced {
  background-color: #34a853;
  box-shadow: 0 0 5px rgba(52, 168, 83, 0.4);
}

.sync-indicator-dot.is-syncing {
  background-color: #1a73e8;
  box-shadow: 0 0 5px rgba(26, 115, 232, 0.5);
  animation: pulse-dot 1.2s infinite ease-in-out;
}

.sync-indicator-dot.is-offline {
  background-color: #f9ab00;
  box-shadow: 0 0 4px rgba(249, 171, 0, 0.4);
}

@keyframes pulse-dot {
  0%, 100% { opacity: 0.5; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.15); }
}

.sync-title {
  font-size: 13px;
  font-weight: 600;
  color: #1f1f1f;
  white-space: nowrap;
}

.sync-sub {
  font-size: 11.5px;
  color: #5f6368;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sync-action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: #f0f4f9;
  border: 1px solid #d3e3fd;
  color: #0b57d0;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 14px;
  border-radius: 999px;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.sync-action-btn:hover:not(:disabled) {
  background-color: #d3e3fd;
  color: #041e49;
}

.sync-action-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.spin-anim {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

/* Footer Links */
.card-footer-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 6px 0 2px 0;
}

.footer-link-btn {
  background: transparent;
  border: none;
  font-size: 11.5px;
  color: #5f6368;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: color 0.15s, background-color 0.15s;
}

.footer-link-btn:hover {
  color: #1f1f1f;
  background-color: rgba(0, 0, 0, 0.04);
}

.footer-dot {
  font-size: 10px;
  color: #9aa0a6;
}

/* 伪登录模态窗口 */
.fake-login-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  border-radius: 28px;
  z-index: 1010;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.fake-login-modal {
  width: 100%;
  background-color: #ffffff;
  border-radius: 24px;
  padding: 20px;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.login-modal-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.login-logo-circle {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.login-brand-icon {
  width: 44px;
  height: 44px;
  display: block;
  object-fit: contain;
}

.login-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #1f1f1f;
}

.login-desc {
  margin: 3px 0 0 0;
  font-size: 12px;
  color: #5f6368;
}

.quick-account-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1.5px solid #d3e3fd;
  background-color: #f8fafd;
  cursor: pointer;
  transition: all 0.15s ease;
}

.quick-account-card:hover {
  background-color: #e8f0fe;
  border-color: #1a73e8;
  transform: translateY(-1px);
}

.quick-account-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  object-fit: cover;
}

.quick-account-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.quick-account-name {
  font-size: 13.5px;
  font-weight: 600;
  color: #1f1f1f;
}

.quick-account-email {
  font-size: 11.5px;
  color: #5f6368;
}

.quick-account-badge {
  font-size: 10.5px;
  color: #1a73e8;
  background-color: #ffffff;
  border: 1px solid #c2e7ff;
  padding: 2px 6px;
  border-radius: 6px;
  font-weight: 500;
}

.login-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin: 2px 0;
}

.login-divider::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background-color: #e8eaed;
}

.login-divider span {
  position: relative;
  background-color: #ffffff;
  padding: 0 8px;
  font-size: 11px;
  color: #80868b;
}

.custom-login-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.login-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid #dadce0;
  font-size: 13px;
  outline: none;
  background-color: #ffffff;
  color: #1f1f1f;
  transition: border-color 0.15s;
}

.login-input:focus {
  border-color: #1a73e8;
}

.btn-submit-login {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 9px 16px;
  border-radius: 10px;
  background-color: #1a73e8;
  color: #ffffff;
  border: none;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s;
}

.btn-submit-login:hover:not(:disabled) {
  background-color: #1557b0;
}

.btn-submit-login:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-cancel-login {
  background: transparent;
  border: none;
  font-size: 12px;
  color: #5f6368;
  cursor: pointer;
  padding: 4px;
}

.btn-cancel-login:hover {
  color: #1f1f1f;
}

.register-bottom-bar {
  display: flex;
  justify-content: center;
  align-items: center;
  padding-top: 8px;
  margin-top: 2px;
  border-top: 1px solid #f1f3f4;
}

.btn-register-link {
  background: transparent;
  border: none;
  color: #1a73e8;
  font-size: 12.5px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  padding: 5px 12px;
  border-radius: 8px;
  transition: all 0.15s ease;
  user-select: none;
}

.btn-register-link:hover {
  background-color: #f1f5fd;
  color: #1557b0;
  text-decoration: underline;
}

.register-ext-icon {
  opacity: 0.8;
  transition: transform 0.15s ease;
}

.btn-register-link:hover .register-ext-icon {
  transform: translate(1px, -1px);
}

/* Animations */
.google-popover-enter-active,
.google-popover-mobile-enter-active {
  transition: all 0.22s cubic-bezier(0.1, 0.9, 0.2, 1);
}

.google-popover-leave-active,
.google-popover-mobile-leave-active {
  transition: all 0.16s cubic-bezier(0.4, 0, 1, 1);
}

.google-popover-enter-from {
  opacity: 0;
  transform: scale(0.93) translateY(12px);
}

.google-popover-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* Mobile: 从右上角向下轻微展开 */
.google-popover-mobile-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(-10px);
}

.google-popover-mobile-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-4px);
}

.fade-collapse-enter-active,
.fade-collapse-leave-active {
  transition: all 0.2s ease;
}

.fade-collapse-enter-from,
.fade-collapse-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.2s ease;
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.94);
}

/* Dark Mode Overrides */
[data-theme="dark"] .google-profile-card {
  background-color: #1e222a;
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45), 0 3px 12px rgba(0, 0, 0, 0.25);
}

[data-theme="dark"] .card-brand-sub {
  color: #9aa0a6;
}

[data-theme="dark"] .close-btn {
  color: #c4c7c5;
}

[data-theme="dark"] .close-btn:hover {
  background-color: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

[data-theme="dark"] .inner-card {
  background-color: #282c35;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

[data-theme="dark"] .user-name {
  color: #f1f3f4;
}

[data-theme="dark"] .user-email {
  color: #9aa0a6;
}

[data-theme="dark"] .pro-badge {
  background-color: #004a77;
  color: #c2e7ff;
}

[data-theme="dark"] .role-pill,
[data-theme="dark"] .guest-pill {
  background-color: #373b44;
  color: #c4c7c5;
}

[data-theme="dark"] .chevron-toggle-btn {
  background-color: #373b44;
  color: #c4c7c5;
}

[data-theme="dark"] .chevron-toggle-btn:hover {
  background-color: #424752;
  color: #ffffff;
}

[data-theme="dark"] .avatar-edit-badge {
  background-color: #282c35;
  border-color: #444746;
  color: #c4c7c5;
}

[data-theme="dark"] .avatar-edit-badge:hover {
  background-color: #373b44;
  color: #a8c7fa;
}

[data-theme="dark"] .section-title {
  color: #f1f3f4;
}

[data-theme="dark"] .cloud-usage-text {
  color: #f1f3f4;
}

[data-theme="dark"] .cloud-percent-tag {
  background-color: #004a77;
  color: #c2e7ff;
}

[data-theme="dark"] .sync-title {
  color: #f1f3f4;
}

[data-theme="dark"] .metric-pill {
  background-color: #22262f;
  border-color: #333842;
}

[data-theme="dark"] .metric-num {
  color: #f1f3f4;
}

[data-theme="dark"] .storage-path-row {
  background-color: #22262f;
  color: #9aa0a6;
}

[data-theme="dark"] .storage-path-row:hover {
  background-color: #333842;
  color: #f1f3f4;
}

[data-theme="dark"] .cloud-progress-track {
  background-color: #3c4043;
}

[data-theme="dark"] .sync-action-btn {
  background-color: #004a77;
  border-color: #004a77;
  color: #c2e7ff;
}

[data-theme="dark"] .sync-action-btn:hover:not(:disabled) {
  background-color: #005b94;
  color: #ffffff;
}

[data-theme="dark"] .footer-link-btn {
  color: #9aa0a6;
}

[data-theme="dark"] .footer-link-btn:hover {
  color: #ffffff;
  background-color: rgba(255, 255, 255, 0.06);
}

[data-theme="dark"] .shortcut-item.logout-btn {
  background-color: #3b2325;
  color: #ff8a80;
  border-color: #5c2d30;
}

[data-theme="dark"] .shortcut-item.logout-btn:hover {
  background-color: #4a2b2e;
  color: #ff9e99;
}

[data-theme="dark"] .edit-input {
  background-color: #22262f;
  border-color: #a8c7fa;
  color: #f1f3f4;
}

[data-theme="dark"] .fake-login-modal {
  background-color: #282c35;
  color: #f1f3f4;
}

[data-theme="dark"] .login-title {
  color: #f1f3f4;
}

[data-theme="dark"] .login-desc {
  color: #9aa0a6;
}

[data-theme="dark"] .quick-account-card {
  background-color: #22262f;
  border-color: #004a77;
}

[data-theme="dark"] .quick-account-name {
  color: #f1f3f4;
}

[data-theme="dark"] .quick-account-email {
  color: #9aa0a6;
}

[data-theme="dark"] .login-divider span {
  background-color: #282c35;
  color: #9aa0a6;
}

[data-theme="dark"] .login-divider::before {
  background-color: #3c4043;
}

[data-theme="dark"] .login-input {
  background-color: #22262f;
  border-color: #3c4043;
  color: #f1f3f4;
}

[data-theme="dark"] .register-bottom-bar {
  border-top-color: #373b44;
}

[data-theme="dark"] .btn-register-link {
  color: #a8c7fa;
}

[data-theme="dark"] .btn-register-link:hover {
  background-color: #272a31;
  color: #d2e3fc;
}
</style>
