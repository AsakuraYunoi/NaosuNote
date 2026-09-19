<template>
  <div class="app-layout">
    <!-- Left M3 Navigation Rail -->
    <NavigationRail
      v-model:current-tab="currentTab"
      :print-count="printCart.length"
      class="no-print"
    />

    <!-- Main Content Area -->
    <main class="main-content">
      <LibraryView
        v-if="currentTab === 'library'"
        :print-cart="printCart"
        @nav="currentTab = $event"
        @toggle-cart="toggleCart"
        @remove-from-cart="removeFromCart"
        @notify="showToast"
      />


      <IngestView
        v-else-if="currentTab === 'ingest'"
        @nav="currentTab = $event"
        @notify="showToast"
      />

      <PrintView
        v-else-if="currentTab === 'print'"
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
        @notify="showToast"
      />
    </main>

    <!-- Global Toast Notification -->
    <Toast
      :visible="toastVisible"
      :message="toastMsg"
      class="no-print"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Problem } from './types/problem';
import NavigationRail from './components/NavigationRail.vue';
import LibraryView from './views/LibraryView.vue';
import IngestView from './views/IngestView.vue';
import PrintView from './views/PrintView.vue';
import SettingsView from './views/SettingsView.vue';
import Toast from './components/Toast.vue';

const currentTab = ref('library');
const printCart = ref<Problem[]>([]);

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
