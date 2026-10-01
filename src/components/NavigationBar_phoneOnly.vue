<template>
  <nav class="m3-bottom-nav">
    <div class="nav-container">
      <button
        v-for="item in navItems"
        :key="item.id"
        class="nav-tab-btn"
        :class="{ active: currentTab === item.id, 'center-tab': item.id === 'library' }"
        @click="$emit('update:currentTab', item.id)"
      >
        <div class="nav-icon-wrapper">
          <div class="nav-active-pill" v-if="currentTab === item.id"></div>
          <component :is="item.icon" :size="20" class="nav-icon" />
          <span v-if="item.id === 'print' && printCount > 0" class="badge">
            {{ printCount > 99 ? '99+' : printCount }}
          </span>
        </div>
        <span class="nav-label">{{ item.label }}</span>
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import {
  BookOpen,
  Printer,
  Settings,
} from 'lucide-vue-next';

defineProps<{
  currentTab: string;
  printCount: number;
}>();

defineEmits<{
  (e: 'update:currentTab', tab: string): void;
}>();

// 错题库居中，左侧打印，右侧设置。添加题目和个人信息已移除
const navItems = [
  { id: 'print', label: '组卷打印', icon: Printer },
  { id: 'library', label: '错题库', icon: BookOpen },
  { id: 'settings', label: '设置', icon: Settings },
];
</script>

<style scoped>
.m3-bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background-color: var(--md-sys-color-surface-container);
  border-top: 1px solid var(--md-sys-color-outline-variant);
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.04);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  user-select: none;
  transition: background-color 0.25s ease, border-color 0.25s ease;
}

.nav-container {
  display: flex;
  height: 64px;
  align-items: center;
  justify-content: space-around;
  max-width: 600px;
  margin: 0 auto;
  padding: 0 8px;
}

.nav-tab-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 100%;
  position: relative;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 0;
  -webkit-tap-highlight-color: transparent;
}

.nav-icon-wrapper {
  position: relative;
  width: 58px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2px;
}

.nav-active-pill {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 16px;
  background-color: var(--md-sys-color-secondary-container);
  z-index: 0;
  animation: pillIn 0.2s cubic-bezier(0.2, 0, 0, 1);
}

@keyframes pillIn {
  from {
    transform: scaleX(0.4);
    opacity: 0;
  }
  to {
    transform: scaleX(1);
    opacity: 1;
  }
}

.nav-icon {
  position: relative;
  z-index: 1;
  color: var(--md-sys-color-on-surface-variant);
  transition: color 0.2s ease, transform 0.2s ease;
}

.nav-tab-btn.active .nav-icon {
  color: var(--md-sys-color-on-secondary-container);
}

.nav-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--md-sys-color-on-surface-variant);
  letter-spacing: 0.1px;
  transition: color 0.2s ease, font-weight 0.2s ease;
}

.nav-tab-btn.active .nav-label {
  color: var(--md-sys-color-on-surface);
  font-weight: 600;
}

.badge {
  position: absolute;
  top: 2px;
  right: 10px;
  z-index: 2;
  background-color: var(--md-sys-color-error);
  color: var(--md-sys-color-on-error);
  font-size: 10px;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  line-height: 16px;
  text-align: center;
  border-radius: 8px;
  padding: 0 4px;
}

.center-tab .nav-icon-wrapper {
  width: 64px;
}

.center-tab .nav-label {
  font-weight: 600;
}
</style>
