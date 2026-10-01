import { createApp } from 'vue';
import AppDesktop from './App.vue';
import AppPhone from './App_phoneOnly.vue';
import 'katex/dist/katex.min.css';
import './assets/styles/base.css';
import { initTheme } from './utils/theme';
import { apiGetDeviceInfo } from './utils/api';

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
  if (typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return;
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

async function bootstrap() {
  // 1. 通过原生硬件、UA 与视口环境精确检测设备形态
  const deviceInfo = await apiGetDeviceInfo();
  console.log('[NaosuNote] Initialized device info:', deviceInfo);

  // 2. 移动端与桌面端分流挂载：
  //    - 只要是 Android、iOS 手机或视口宽度 < 768px 的移动触控环境，强制挂载移动端适配根组件 AppPhone
  //    - 桌面端 (macOS/Windows/Linux) 挂载包含多窗口与侧边栏的桌面组件 AppDesktop
  const isMobile =
    deviceInfo.form_factor === 'phone' ||
    deviceInfo.os === 'android' ||
    deviceInfo.os === 'ios' ||
    deviceInfo.platform === 'mobile' ||
    (typeof window !== 'undefined' && (/Android|iPhone|iPod/i.test(navigator.userAgent) || window.innerWidth < 768));

  const RootComponent = isMobile ? AppPhone : AppDesktop;

  createApp(RootComponent).mount('#app');
}

bootstrap();
