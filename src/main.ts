import { createApp } from 'vue';
import AppRoot from './AppRoot.vue';
import 'katex/dist/katex.min.css';
import './assets/styles/base.css';
import { initTheme } from './utils/theme';

initTheme();

// 全局禁用右键菜单，防止打开 web 调试面板
window.addEventListener(
  'contextmenu',
  (e) => {
    e.preventDefault();
  },
  true
);

// 禁用常见的开发者调试快捷键 (F12, Cmd+Option+I, Cmd+Option+J, Cmd+Option+C, Ctrl+Shift+I 等)
window.addEventListener(
  'keydown',
  (e) => {
    if (
      e.key === 'F12' ||
      ((e.metaKey || e.ctrlKey) && (e.altKey || e.shiftKey) && ['i', 'I', 'j', 'J', 'c', 'C'].includes(e.key))
    ) {
      e.preventDefault();
      e.stopPropagation();
    }
  },
  true
);

import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

let appWindow: any = null;
try {
  appWindow = getCurrentWindow();
} catch (e) {}

window.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  // 排除触控移动与平板设备 (Android, iPhone, iPad)
  if (
    typeof navigator !== 'undefined' &&
    (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
  ) {
    return;
  }
  const target = e.target as HTMLElement | null;
  if (!target) return;

  // 排除输入框、按钮、选择器、下拉框、标签项等交互元素
  if (
    target.closest(
      'button, input, textarea, select, a, [contenteditable="true"], .no-drag, [data-no-drag], .m3-search-box, .m3-filter-chip, .speed-dial-action-pill, .m3-main-fab, .m3-tab-item, .batch-edit-capsule, .modal, .dialog, .google-profile-card, .search-box-phone, .nav-tab-btn'
    )
  ) {
    return;
  }

  // 检测是否位于侧边栏或顶部操作栏等可拖拽窗口区域
  const isDraggableRegion = target.closest(
    '.m3-nav-rail, .top-bar, .profile-top-bar, .profile-header, .settings-header, .ingest-header, .detail-top-bar, .sidebar-header, .m3-primary-tabs-bar, [data-tauri-drag-region], .window-drag-region'
  );

  if (isDraggableRegion) {
    invoke('start_window_drag').catch(() => {
      try {
        appWindow?.startDragging();
      } catch (err) {}
    });
  }
});

// 挂载响应式多端形态根组件 (平板横屏桌面端 / 平板竖屏移动端 / 手机端 / 桌面端)
createApp(AppRoot).mount('#app');

