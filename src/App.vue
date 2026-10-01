<template>
  <div class="app-layout">
    <!-- Left M3 Navigation Rail -->
    <NavigationRail
      v-model:current-tab="currentTab"
      :print-count="printCart.length"
      :is-profile-open="isProfileOpen"
      @toggle-profile="isProfileOpen = !isProfileOpen"
      class="no-print"
    />

    <!-- Main Content Area with M3 Container Transform Transition -->
    <main class="main-content">
      <Transition :name="transitionName">
        <KeepAlive :include="['LibraryView', 'IngestView', 'PrintView', 'SettingsView']">
          <LibraryView
            v-if="currentTab === 'library'"
            key="library"
            :print-cart="printCart"
            :target-problem="lastActiveProblem"
            :target-subject="lastActiveSubject"
            :target-notebook-id="lastActiveNotebookId"
            @nav="currentTab = $event"
            @toggle-cart="toggleCart"
            @remove-from-cart="removeFromCart"
            @notify="showToast"
            @edit-problem="openProblemDetail"
            @clear-target="clearTargetProblem"
          />

          <IngestView
            v-else-if="currentTab === 'ingest'"
            key="ingest"
            @nav="currentTab = $event"
            @notify="showToast"
          />

          <PrintView
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

          <SettingsView
            v-else-if="currentTab === 'settings'"
            key="settings"
            @notify="showToast"
          />

          <ProblemDetailView
            v-else-if="currentTab === 'problem-detail' && editingProblem"
            key="detail"
            :problem="editingProblem"
            @back="onBackToLibrary"
            @saved="onProblemSaved"
            @notify="showToast"
          />
        </KeepAlive>
      </Transition>
    </main>

    <!-- Google-style Profile Popover Card -->
    <ProfilePopoverCard
      :open="isProfileOpen"
      @close="isProfileOpen = false"
      @navigate="handleProfileNavigate"
      @notify="showToast"
    />

    <!-- Global Toast Notification (Material Design 3 Snackbar) -->
    <Toast
      :visible="toastVisible"
      :message="toastMsg"
      @close="toastVisible = false"
      class="no-print"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import type { Problem } from './types/problem';
import NavigationRail from './components/NavigationRail.vue';
import LibraryView from './views/LibraryView.vue';
import IngestView from './views/IngestView.vue';
import PrintView from './views/PrintView.vue';
import SettingsView from './views/SettingsView.vue';
import ProfilePopoverCard from './components/ProfilePopoverCard.vue';
import ProblemDetailView from './views/problem-detail/ProblemDetailView.vue';
import Toast from './components/Toast.vue';
import { apiSyncAllMirrors } from './utils/api';

const currentTab = ref('library');
const transitionName = ref('m3-tab-fade');
const isProfileOpen = ref(false);
const editingProblem = ref<Problem | null>(null);
const printCart = ref<Problem[]>([]);

watch(currentTab, (newTab, oldTab) => {
  if (newTab === 'problem-detail') {
    transitionName.value = 'm3-detail-enter';
  } else if (oldTab === 'problem-detail') {
    transitionName.value = 'm3-detail-leave';
  } else {
    transitionName.value = 'm3-tab-fade';
  }
});

// 记录用户最近点击查看/编辑的错题及其上下文，以便返回时精准定位
const lastActiveProblem = ref<Problem | null>(null);
const lastActiveSubject = ref<string | null>(null);
const lastActiveNotebookId = ref<string | null>(null);

onMounted(async () => {
  try {
    await apiSyncAllMirrors();
  } catch (e) {
    console.error('Failed to sync mirrors on startup:', e);
  }
});

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
}

function onBackToLibrary() {
  if (editingProblem.value) {
    lastActiveProblem.value = editingProblem.value;
    lastActiveSubject.value = editingProblem.value.subject;
    lastActiveNotebookId.value = editingProblem.value.notebook_id ?? null;
  }
  currentTab.value = 'library';
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

function handleProfileNavigate(tab: string) {
  isProfileOpen.value = false;
  currentTab.value = tab;
}


// Toast
const toastVisible = ref(false);
const toastMsg = ref('');
let toastTimer: any = null;

function showToast(msg: string) {
  toastMsg.value = msg;
  toastVisible.value = true;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastVisible.value = false;
  }, 3200);
}

// 打印篮管理
function toggleCart(problem: Problem) {
  const index = printCart.value.findIndex((p) => p.uuid === problem.uuid);
  if (index >= 0) {
    printCart.value.splice(index, 1);
    showToast(`已将「${problem.summary}」移出打印篮`);
  } else {
    printCart.value.push(problem);
    showToast(`已将「${problem.summary}」加入打印篮 (共 ${printCart.value.length} 题)`);
  }
}

function removeFromCart(uuid: string) {
  printCart.value = printCart.value.filter((p) => p.uuid !== uuid);
}

function clearCart() {
  printCart.value = [];
  showToast('已清空打印篮');
}

function moveCartItemUp(index: number) {
  if (index > 0) {
    const temp = printCart.value[index];
    printCart.value[index] = printCart.value[index - 1];
    printCart.value[index - 1] = temp;
  }
}

function moveCartItemDown(index: number) {
  if (index < printCart.value.length - 1) {
    const temp = printCart.value[index];
    printCart.value[index] = printCart.value[index + 1];
    printCart.value[index + 1] = temp;
  }
}
</script>

<style scoped>
.app-layout {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: var(--md-sys-color-background);
}

.main-content {
  flex: 1;
  height: 100%;
  overflow: hidden;
  position: relative;
}

/* Tab Crossfade (Zero Blank Screen, Snappy & Fluid) */
.m3-tab-fade-enter-active {
  transition: opacity 0.16s cubic-bezier(0.16, 1, 0.3, 1), transform 0.16s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
}

.m3-tab-fade-leave-active {
  transition: opacity 0.1s cubic-bezier(0.4, 0, 1, 1), transform 0.1s ease;
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

.m3-tab-fade-enter-from {
  opacity: 0;
  transform: scale(0.992) translateY(4px);
}

.m3-tab-fade-leave-to {
  opacity: 0;
  transform: scale(0.996);
}

/* Detail Enter Transform */
.m3-detail-enter-enter-active {
  transition: opacity 0.18s cubic-bezier(0.05, 0.7, 0.1, 1), transform 0.18s cubic-bezier(0.05, 0.7, 0.1, 1);
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
}

.m3-detail-enter-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}

.m3-detail-enter-enter-from {
  opacity: 0;
  transform: scale(0.985) translateY(6px);
}

.m3-detail-enter-leave-to {
  opacity: 0;
  transform: scale(0.99);
}

/* Detail Leave Transform */
.m3-detail-leave-enter-active {
  transition: opacity 0.16s ease, transform 0.16s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
}

.m3-detail-leave-leave-active {
  transition: opacity 0.14s cubic-bezier(0.4, 0, 1, 1), transform 0.14s cubic-bezier(0.4, 0, 1, 1);
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  pointer-events: none;
}

.m3-detail-leave-enter-from {
  opacity: 0;
  transform: scale(0.99);
}

.m3-detail-leave-leave-to {
  opacity: 0;
  transform: scale(0.985) translateY(6px);
}

@media print {
  .app-layout {
    display: block;
    height: auto;
    overflow: visible;
  }
  .main-content {
    overflow: visible;
    height: auto;
  }
}
</style>

