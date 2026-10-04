<template>
  <div class="app-layout-phone">
    <!-- Top Notch / Status Bar Safe Area Spacer -->
    <div class="safe-area-top"></div>

    <!-- Main Content Area with View Transitions -->
    <main class="main-content-phone">
      <Transition :name="transitionName">
        <KeepAlive :include="['LibraryView_phoneOnly', 'IngestView_phoneOnly', 'PrintView_phoneOnly', 'SettingsView_phoneOnly']">
          <LibraryView_phoneOnly
            v-if="currentTab === 'library'"
            key="library"
            :print-cart="printCart"
            :is-auto-syncing="isAutoSyncing"
            :target-problem="lastActiveProblem"
            :target-subject="lastActiveSubject"
            :target-notebook-id="lastActiveNotebookId"
            @nav="currentTab = $event"
            @toggle-cart="toggleCart"
            @remove-from-cart="removeFromCart"
            @notify="showToast"
            @edit-problem="openProblemDetail"
            @clear-target="clearTargetProblem"
            @open-profile="openProfilePage"
          />

          <IngestView_phoneOnly
            v-else-if="currentTab === 'ingest'"
            key="ingest"
            @nav="currentTab = $event"
            @notify="showToast"
          />

          <PrintView_phoneOnly
            v-else-if="currentTab === 'print'"
            key="print"
            :print-cart="printCart"
            @nav="currentTab = $event"
            @clear-cart="clearCart"
            @remove-from-cart="removeFromCart"
            @move-up="moveCartItemUp"
            @move-down="moveCartItemDown"
            @notify="showToast"
          />

          <SettingsView_phoneOnly
            v-else-if="currentTab === 'settings'"
            key="settings"
            @notify="showToast"
            @open-profile="openProfilePage"
          />

          <ProblemDetailView_phoneOnly
            v-else-if="currentTab === 'problem-detail' && editingProblem"
            key="detail"
            :problem="editingProblem"
            @back="onBackToLibrary"
            @saved="onProblemSaved"
            @notify="showToast"
          />

          <ProfileView_phoneOnly
            v-else-if="currentTab === 'profile'"
            key="profile"
            @back="onBackFromProfile"
            @notify="showToast"
          />
        </KeepAlive>
      </Transition>
    </main>

    <!-- Bottom Navigation Bar (Hidden with smooth slide when editing problem or viewing full profile) -->
    <Transition name="mobile-bar-slide">
      <NavigationBar_phoneOnly
        v-if="currentTab !== 'problem-detail' && currentTab !== 'profile'"
        v-model:current-tab="currentTab"
        :print-count="printCart.length"
      />
    </Transition>

    <!-- Toast Notification (Snackbar) -->
    <Toast
      :visible="toastVisible"
      :message="toastMsg"
      @close="toastVisible = false"
    />

    <!-- Initial Storage Persistence Directory Setup Modal -->
    <StorageDirModal_phoneOnly
      :open="showInitialStorageModal"
      :is-initial-setup="true"
      @close="showInitialStorageModal = false"
      @saved="onInitialStorageDirSaved"
      @notify="showToast"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import type { Problem } from './types/problem';
import NavigationBar_phoneOnly from './components/NavigationBar_phoneOnly.vue';
import LibraryView_phoneOnly from './views/LibraryView_phoneOnly.vue';
import IngestView_phoneOnly from './views/IngestView_phoneOnly.vue';
import PrintView_phoneOnly from './views/PrintView_phoneOnly.vue';
import SettingsView_phoneOnly from './views/SettingsView_phoneOnly.vue';
import ProblemDetailView_phoneOnly from './views/problem-detail/ProblemDetailView_phoneOnly.vue';
import ProfileView_phoneOnly from './views/ProfileView_phoneOnly.vue';
import StorageDirModal_phoneOnly from './components/StorageDirModal_phoneOnly.vue';
import Toast from './components/Toast.vue';
import { apiSyncAllMirrors, apiSyncCloud } from './utils/api';
import { getCurrentWindow } from '@tauri-apps/api/window';

const currentTab = ref('library');
const previousTab = ref('library');
const transitionName = ref('mobile-crossfade');
const editingProblem = ref<Problem | null>(null);
const printCart = ref<Problem[]>([]);
const isAutoSyncing = ref(false);
const showInitialStorageModal = ref(false);

function onInitialStorageDirSaved(path: string) {
  showInitialStorageModal.value = false;
  showToast(`已成功配置设备持久化目录：${path}`);
}

watch(currentTab, (newTab, oldTab) => {
  if (newTab === 'problem-detail' || newTab === 'profile') {
    transitionName.value = 'mobile-push';
  } else if (oldTab === 'problem-detail' || oldTab === 'profile') {
    transitionName.value = 'mobile-pop';
  } else {
    transitionName.value = 'mobile-crossfade';
    if (newTab !== 'problem-detail' && newTab !== 'profile') {
      window.history.replaceState({ naosu: true, tab: newTab }, '');
    }
  }
});

const lastActiveProblem = ref<Problem | null>(null);
const lastActiveSubject = ref<string | null>(null);
const lastActiveNotebookId = ref<string | null>(null);

const toastVisible = ref(false);
const toastMsg = ref('');
let lastBackPressTime = 0;

async function handlePopState(_e: PopStateEvent) {
  // 1. 先触发自定义返回事件，允许子页面内部（抽屉、选择器、Dialog）拦截
  const customBackEvt = new CustomEvent('naosu:back', { cancelable: true });
  window.dispatchEvent(customBackEvt);
  if (customBackEvt.defaultPrevented) {
    // 子组件消费了该返回手势，补充 pushState 恢复历史防御层
    window.history.pushState({ naosu: true, tab: currentTab.value }, '');
    return;
  }

  // 2. 检查顶层全局弹窗
  if (showInitialStorageModal.value) {
    showInitialStorageModal.value = false;
    window.history.pushState({ naosu: true, tab: currentTab.value }, '');
    return;
  }

  // 3. 检查题目详情页面
  if (currentTab.value === 'problem-detail') {
    doBackToLibrary();
    return;
  }

  // 4. 检查个人中心全屏页面
  if (currentTab.value === 'profile') {
    doBackFromProfile();
    return;
  }

  // 5. 检查非主页底栏 Tab (如 ingest, print, settings)
  if (currentTab.value !== 'library') {
    currentTab.value = 'library';
    window.history.pushState({ naosu: true, tab: 'library' }, '');
    return;
  }

  // 6. 处于 library 根页面：双滑退出防误触逻辑
  const now = Date.now();
  if (now - lastBackPressTime < 2000) {
    // 2 秒内再次触发返回：执行退出应用
    try {
      await getCurrentWindow().close();
    } catch {
      window.history.back();
    }
  } else {
    lastBackPressTime = now;
    showToast('再划一次退出应用');
    // 重新压栈，确保下一次滑动能再次触发 popstate 捕获
    window.history.pushState({ naosu: true, tab: 'root' }, '');
  }
}

onMounted(async () => {
  // 初始化 WebView 历史栈，建立防御基准防止边缘滑动导致系统直接杀死 App
  if (!window.history.state || !window.history.state.naosu) {
    window.history.replaceState({ naosu: true, tab: 'root' }, '');
    window.history.pushState({ naosu: true, tab: currentTab.value }, '');
  }

  window.addEventListener('popstate', handlePopState);

  // 检查移动端是否已选择持久化目录
  const hasSelectedDir = localStorage.getItem('naosu_storage_dir_selected');
  if (hasSelectedDir !== 'true') {
    showInitialStorageModal.value = true;
  }

  try {
    await apiSyncAllMirrors();
  } catch (e) {
    console.error('Failed to sync mirrors on startup:', e);
  }

  // 手机端启动自动执行云同步 (若已登录)
  if (localStorage.getItem('naosu_is_logged_in') === 'true') {
    isAutoSyncing.value = true;
    try {
      const res = await apiSyncCloud();
      const hasChanges = res.pulledProblems > 0 || res.pushedProblems > 0 || res.downloadedImages > 0 || res.uploadedImages > 0 || res.deletedProblems > 0;
      if (hasChanges) {
        const details: string[] = [];
        if (res.pulledProblems > 0) details.push(`拉取${res.pulledProblems}题`);
        if (res.pushedProblems > 0) details.push(`推送${res.pushedProblems}题`);
        if (res.downloadedImages > 0) details.push(`下载${res.downloadedImages}图`);
        if (res.uploadedImages > 0) details.push(`上传${res.uploadedImages}图`);
        if (res.deletedProblems > 0) details.push(`删除${res.deletedProblems}题`);
        showToast(`已自动完成云同步 (${details.join(' / ')})`);
      }
    } catch (err) {
      console.warn('Auto cloud sync failed:', err);
    } finally {
      isAutoSyncing.value = false;
    }
  }
});

onUnmounted(() => {
  window.removeEventListener('popstate', handlePopState);
});

function showToast(msg: string) {
  toastMsg.value = msg;
  toastVisible.value = true;
}

function openProblemDetail(prob: Problem, context?: { subject?: string; notebookId?: string }) {
  lastActiveProblem.value = prob;
  if (context?.subject) {
    lastActiveSubject.value = context.subject;
  } else {
    lastActiveSubject.value = prob.subject;
  }
  if (context?.notebookId) {
    lastActiveNotebookId.value = context.notebookId;
  } else {
    lastActiveNotebookId.value = prob.notebook_id ?? null;
  }

  editingProblem.value = prob;
  currentTab.value = 'problem-detail';
  window.history.pushState({ naosu: true, tab: 'problem-detail' }, '');
}

function doBackToLibrary() {
  if (editingProblem.value) {
    lastActiveProblem.value = editingProblem.value;
    lastActiveSubject.value = editingProblem.value.subject;
    lastActiveNotebookId.value = editingProblem.value.notebook_id ?? null;
  }
  currentTab.value = 'library';
}

function onBackToLibrary() {
  if (window.history.state?.tab === 'problem-detail') {
    window.history.back();
  } else {
    doBackToLibrary();
  }
}

function onProblemSaved(updated: Problem) {
  const idx = printCart.value.findIndex((p) => p.uuid === updated.uuid);
  if (idx >= 0) {
    printCart.value[idx] = updated;
  }
  editingProblem.value = updated;
  lastActiveProblem.value = updated;
  lastActiveSubject.value = updated.subject;
  lastActiveNotebookId.value = updated.notebook_id ?? null;
}

function clearTargetProblem() {
  lastActiveProblem.value = null;
  lastActiveSubject.value = null;
  lastActiveNotebookId.value = null;
}

function toggleCart(problem: Problem) {
  const index = printCart.value.findIndex((p) => p.uuid === problem.uuid);
  if (index >= 0) {
    printCart.value.splice(index, 1);
    showToast(`已从打印篮移出: ${problem.summary || '选定题目'}`);
  } else {
    printCart.value.push(problem);
    showToast(`已加入打印篮: ${problem.summary || '选定题目'}`);
  }
}

function removeFromCart(uuid: string) {
  printCart.value = printCart.value.filter((p) => p.uuid !== uuid);
}

function clearCart() {
  printCart.value = [];
}

function moveCartItemUp(index: number) {
  if (index > 0 && index < printCart.value.length) {
    const item = printCart.value.splice(index, 1)[0];
    printCart.value.splice(index - 1, 0, item);
  }
}

function moveCartItemDown(index: number) {
  if (index >= 0 && index < printCart.value.length - 1) {
    const item = printCart.value.splice(index, 1)[0];
    printCart.value.splice(index + 1, 0, item);
  }
}

function openProfilePage() {
  previousTab.value = currentTab.value;
  currentTab.value = 'profile';
  window.history.pushState({ naosu: true, tab: 'profile' }, '');
}

function doBackFromProfile() {
  currentTab.value = previousTab.value || 'library';
}

function onBackFromProfile() {
  if (window.history.state?.tab === 'profile') {
    window.history.back();
  } else {
    doBackFromProfile();
  }
}
</script>

<style scoped>
.app-layout-phone {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  width: 100vw;
  background-color: var(--md-sys-color-background);
  color: var(--md-sys-color-on-background);
  overflow: hidden;
  position: relative;
}

.safe-area-top {
  height: env(safe-area-inset-top, 0px);
  background-color: var(--md-sys-color-surface);
  flex-shrink: 0;
}

.main-content-phone {
  flex: 1;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

/* Mobile Tab Crossfade (Zero Blank Screen, Smooth Dissolve) */
.mobile-crossfade-enter-active {
  transition: opacity 0.14s cubic-bezier(0.16, 1, 0.3, 1), transform 0.14s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
}

.mobile-crossfade-leave-active {
  transition: opacity 0.09s cubic-bezier(0.4, 0, 1, 1);
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}

.mobile-crossfade-enter-from {
  opacity: 0;
  transform: scale(0.99) translateY(4px);
}

.mobile-crossfade-leave-to {
  opacity: 0;
}

/* Mobile Push (iOS / Native Slide Left) */
.mobile-push-enter-active {
  transition: transform 0.22s cubic-bezier(0.32, 0.72, 0, 1);
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
}

.mobile-push-leave-active {
  transition: transform 0.22s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.22s ease;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: none;
}

.mobile-push-enter-from {
  transform: translateX(100%);
}

.mobile-push-leave-to {
  transform: translateX(-18%);
  opacity: 0.88;
}

/* Mobile Pop (iOS / Native Slide Right) */
.mobile-pop-enter-active {
  transition: transform 0.2s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease;
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
}

.mobile-pop-leave-active {
  transition: transform 0.2s cubic-bezier(0.32, 0.72, 0, 1);
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  pointer-events: none;
}

.mobile-pop-enter-from {
  transform: translateX(-18%);
  opacity: 0.88;
}

.mobile-pop-leave-to {
  transform: translateX(100%);
}

/* Bottom Bar Slide */
.mobile-bar-slide-enter-active,
.mobile-bar-slide-leave-active {
  transition: transform 0.2s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.15s ease;
}

.mobile-bar-slide-enter-from,
.mobile-bar-slide-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
