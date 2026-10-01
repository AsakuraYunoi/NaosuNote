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
  // 1. 通过 Rust 底层或视口环境检测硬件设备形态
  const deviceInfo = await apiGetDeviceInfo();
  console.log('[NaosuNote] Initialized device info:', deviceInfo);

  // 2. 根据用户架构规则分流：
  //    - Phone (<600dp 手机): 挂载全新的 App_phoneOnly.vue
  //    - Desktop / Pad (桌面端与平板端): 挂载原有经充分打磨的 App.vue
  const RootComponent = deviceInfo.form_factor === 'phone' ? AppPhone : AppDesktop;

  createApp(RootComponent).mount('#app');
}

bootstrap();
