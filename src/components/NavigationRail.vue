<template>
  <nav class="m3-nav-rail" data-tauri-drag-region="deep">
    <!-- macOS Traffic Light Spacer & Window Drag Area -->
    <div class="window-drag-region" data-tauri-drag-region="deep"></div>

    <!-- Brand -->
    <div class="nav-brand" data-tauri-drag-region="deep">
      <div class="brand-logo-mark">
        <img src="/favicon.svg" alt="NaosuNote" class="logo-svg" draggable="false" />
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

    <!-- Footer Controls: User Profile Avatar Entry Button -->
    <div class="nav-footer">
      <button
        class="nav-avatar-btn"
        :class="{ 'is-active': isProfileOpen }"
        title="个人信息与数据总览"
        aria-label="个人信息与数据总览"
        @click="$emit('toggle-profile')"
      >
        <img :src="userAvatarUrl" alt="用户头像" class="nav-avatar-img" />
      </button>
      <span class="version-tag">beta0.2.0-v1</span>
    </div>
  </nav>
</template>

<script setup lang="ts">
import {
  BookOpen,
  PlusCircle,
  Printer,
  Settings,
} from 'lucide-vue-next';
import { userAvatarUrl } from '../utils/avatar';

defineProps<{
  currentTab: string;
  printCount: number;
  isProfileOpen?: boolean;
}>();

defineEmits<{
  (e: 'update:currentTab', tab: string): void;
  (e: 'toggle-profile'): void;
}>();

const navItems = [
  { id: 'library', label: '错题库', icon: BookOpen },
  { id: 'ingest', label: '录入错题', icon: PlusCircle },
  { id: 'print', label: '组卷打印', icon: Printer },
  { id: 'settings', label: '设置', icon: Settings },
];
</script>

<style scoped>
.m3-nav-rail {
  width: 81px;
  background-color: var(--md-sys-color-surface-container-low);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 0 16px 0;
  border-right: 1px solid var(--md-sys-color-outline-variant);
  flex-shrink: 0;
  z-index: 10;
  -webkit-app-region: drag;
  user-select: none;
  transition: background-color 0.25s ease, border-color 0.25s ease;
}

.window-drag-region {
  width: 100%;
  height: 52px;
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.nav-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 20px;
  -webkit-app-region: drag;
}

.brand-logo-mark {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 5px;
  transition: transform 0.2s ease;
  -webkit-app-region: no-drag;
}
.brand-logo-mark:hover {
  transform: scale(1.05);
}

.logo-svg {
  width: 36px;
  height: 36px;
  display: block;
  object-fit: contain;
}

.brand-title {
  font-size: 10px;
  font-weight: 700;
  color: var(--md-sys-color-primary);
  letter-spacing: 0.3px;
  -webkit-app-region: drag;
}

.nav-destinations {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  align-items: center;
  -webkit-app-region: drag;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 3px 0;
  background: transparent;
  border: none;
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.nav-pill {
  width: 52px;
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
  font-size: 11px;
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
  padding: 1px 5px;
  min-width: 16px;
  text-align: center;
}

.nav-footer {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
  -webkit-app-region: drag;
}

.nav-avatar-btn {
  background: transparent;
  border: none;
  padding: 0;
  margin: 4px 0 0 0;
  cursor: pointer;
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  outline: none;
  position: relative;
}

.nav-avatar-btn:hover {
  transform: scale(1.08);
}

.nav-avatar-btn.is-active {
  transform: scale(1.08);
}

.nav-avatar-img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
  transition: box-shadow 0.2s ease, outline 0.2s ease;
}

.nav-avatar-btn:hover .nav-avatar-img {
  box-shadow: 0 3px 10px rgba(0, 99, 155, 0.3);
  outline: 2px solid var(--md-sys-color-primary);
  outline-offset: 1.5px;
}

.nav-avatar-btn.is-active .nav-avatar-img {
  outline: 2.5px solid var(--md-sys-color-primary);
  outline-offset: 1.5px;
}

.version-tag {
  font-size: 9px;
  color: var(--md-sys-color-outline);
  -webkit-app-region: drag;
  margin-top: 2px;
}
</style>
