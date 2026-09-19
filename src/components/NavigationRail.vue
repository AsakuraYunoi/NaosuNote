<template>
  <nav class="m3-nav-rail">
    <!-- Brand -->
    <div class="nav-brand">
      <div class="brand-logo-mark">
        <svg viewBox="0 0 40 40" class="logo-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="40" height="40" rx="12" fill="url(#brand-grad)"/>
          <!-- Modern Stylized STEM Mistake Note Path: folded notebook + sharp pen checkmark -->
          <path d="M12 11H25C26.6569 11 28 12.3431 28 14V27C28 28.6569 26.6569 30 25 30H12V11Z" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
          <path d="M17 18L21 22L30 13" stroke="#9ecaff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
          <defs>
            <linearGradient id="brand-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
              <stop stop-color="#00639b"/>
              <stop offset="1" stop-color="#003757"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      <span class="brand-title">NaosuNote</span>
    </div>

    <!-- Nav Items -->
    <div class="nav-destinations">
      <button
        v-for="item in navItems"
        :key="item.id"
        class="nav-item"
        :class="{ active: currentTab === item.id }"
        @click="$emit('update:currentTab', item.id)"
      >
        <div class="nav-pill">
          <component :is="item.icon" :size="20" class="nav-icon" />
          <span v-if="item.id === 'print' && printCount > 0" class="badge">
            {{ printCount }}
          </span>
        </div>
        <span class="nav-label">{{ item.label }}</span>
      </button>
    </div>

    <!-- Footer Controls -->
    <div class="nav-footer">
      <button
        class="theme-toggle-btn"
        :title="isDark ? '切换至浅色模式' : '切换至深色模式'"
        @click="toggleTheme"
      >
        <Sun v-if="isDark" :size="18" class="theme-icon" />
        <Moon v-else :size="18" class="theme-icon" />
      </button>
      <span class="version-tag">v0.1.0 beta</span>
    </div>
  </nav>
</template>

<script setup lang="ts">
import {
  BookOpen,
  PlusCircle,
  Printer,
  Settings,
  Sun,
  Moon,
} from 'lucide-vue-next';
import { isDark, toggleTheme } from '../utils/theme';

defineProps<{
  currentTab: string;
  printCount: number;
}>();

defineEmits<{
  (e: 'update:currentTab', tab: string): void;
}>();

const navItems = [
  { id: 'library', label: '错题库', icon: BookOpen },
  { id: 'ingest', label: '录入错题', icon: PlusCircle },
  { id: 'print', label: '组卷打印', icon: Printer },
  { id: 'settings', label: '设置备份', icon: Settings },
];
</script>

<style scoped>
.m3-nav-rail {
  width: 92px;
  background-color: var(--md-sys-color-surface-container-low);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 0 16px 0;
  border-right: 1px solid var(--md-sys-color-outline-variant);
  flex-shrink: 0;
  z-index: 10;
  transition: background-color 0.25s ease, border-color 0.25s ease;
}

.nav-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 28px;
}

.brand-logo-mark {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
  filter: drop-shadow(0 2px 8px rgba(0, 99, 155, 0.25));
  transition: transform 0.2s ease;
}
.brand-logo-mark:hover {
  transform: scale(1.05);
}

.logo-svg {
  width: 40px;
  height: 40px;
}

.brand-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--md-sys-color-primary);
  letter-spacing: 0.5px;
}

.nav-destinations {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  align-items: center;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 4px 0;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.nav-pill {
  width: 56px;
  height: 32px;
  border-radius: var(--md-shape-corner-full);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.25s ease;
  color: var(--md-sys-color-on-surface-variant);
}

.nav-item:hover .nav-pill {
  background-color: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface);
}

.nav-item.active .nav-pill {
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}

.nav-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--md-sys-color-on-surface-variant);
  transition: color 0.2s;
}

.nav-item.active .nav-label {
  color: var(--md-sys-color-on-surface);
  font-weight: 600;
}

.badge {
  position: absolute;
  top: -4px;
  right: 2px;
  background-color: var(--md-sys-color-error);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  border-radius: 999px;
  padding: 1px 6px;
  min-width: 18px;
  text-align: center;
}

.nav-footer {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.theme-toggle-btn {
  width: 38px;
  height: 38px;
  border-radius: var(--md-shape-corner-full);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--md-sys-color-on-surface-variant);
  background-color: var(--md-sys-color-surface-container-high);
  transition: all 0.2s ease;
}
.theme-toggle-btn:hover {
  background-color: var(--md-sys-color-surface-container-highest);
  color: var(--md-sys-color-primary);
  transform: rotate(15deg);
}

.version-tag {
  font-size: 10px;
  color: var(--md-sys-color-outline);
}
</style>
