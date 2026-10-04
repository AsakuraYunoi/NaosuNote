<template>
  <component :is="activeComponent" :key="layoutKey" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import AppDesktop from './App.vue';
import AppPhone from './App_phoneOnly.vue';
import { apiGetDeviceInfo } from './utils/api';
import type { DeviceInfo } from './types/problem';

const currentLayout = ref<'desktop' | 'phone'>(getInitialLayout());
const activeComponent = computed(() => (currentLayout.value === 'desktop' ? AppDesktop : AppPhone));
const layoutKey = computed(() => currentLayout.value);

let cachedDeviceInfo: DeviceInfo | null = null;

/**
 * 判断当前是否处于横屏态 (Landscape)
 */
function isLandscape(): boolean {
  if (typeof window === 'undefined') return true;
  if (window.matchMedia && window.matchMedia('(orientation: landscape)').matches) {
    return true;
  }
  if (window.screen?.orientation?.type) {
    return window.screen.orientation.type.startsWith('landscape');
  }
  return window.innerWidth > window.innerHeight;
}

/**
 * 高精度判定是否为平板类设备 (iPad / Android 平板 / 大屏触控设备)
 */
function detectIsPad(info?: DeviceInfo | null): boolean {
  if (typeof window === 'undefined') return false;
  if (info?.form_factor === 'pad') return true;
  if (info?.form_factor === 'phone') return false;

  const ua = navigator.userAgent || '';
  // iPad 高精度检测 (包含 iPadOS 13+ 桌面级 UA: MacIntel 且支持多点触控)
  const isIPad =
    /iPad/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 && !/iPhone|iPod/i.test(ua));
  if (isIPad) return true;

  // Android 平板检测
  const isAndroid = /Android/i.test(ua);
  if (isAndroid) {
    const minScreen = Math.min(window.screen.width || 0, window.screen.height || 0);
    const isMobileUa = /Mobile/i.test(ua);
    if (!isMobileUa || minScreen >= 600) return true;
  }

  // 触控大屏判定（触控点 > 0 且短边 >= 600dp）
  const hasTouch = (navigator.maxTouchPoints || 0) > 0;
  const minDim = Math.min(window.innerWidth || 0, window.innerHeight || 0);
  if (hasTouch && minDim >= 600 && info?.platform === 'mobile') {
    return true;
  }

  return false;
}

/**
 * 计算当前环境下应采用的形态布局：
 * 1. 手机形态 (iPhone / Android 手机): 一律采用手机竖屏布局 (AppPhone)
 * 2. 平板形态 (iPad / Android 平板):
 *    - 横屏 (Landscape): 必须采用桌面端大屏布局 (AppDesktop)，以发挥完整侧边导轨与双栏排版能力
 *    - 竖屏 (Portrait): 采用移动单列流式布局 (AppPhone)
 * 3. 桌面端 (macOS / Windows / Linux): 始终采用桌面端布局 (AppDesktop)
 */
function determineLayout(info: DeviceInfo | null): 'desktop' | 'phone' {
  if (typeof window === 'undefined') return 'desktop';

  // 1. 显式模拟/强制参数 (支持开发调试及用户自选)
  const urlParams = new URLSearchParams(window.location.search);
  const forceParam = urlParams.get('device') || localStorage.getItem('naosu_force_device_mode');
  if (forceParam === 'phone') return 'phone';
  if (forceParam === 'desktop') return 'desktop';

  const ua = navigator.userAgent || '';
  const isIOSPhone = /iPhone|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const minDim = Math.min(window.screen.width || window.innerWidth, window.screen.height || window.innerHeight);

  // 2. 手机形态 (iPhone、带有明确 Mobile 标志的窄屏手机)
  const isPhone =
    isIOSPhone ||
    (isAndroid && /Mobile/i.test(ua) && minDim < 600) ||
    info?.form_factor === 'phone';

  const isPad = detectIsPad(info);

  if (isPhone && !isPad) {
    return 'phone';
  }

  // 3. 平板形态 (iPad / Android 平板等)
  if (isPad || forceParam === 'pad') {
    // 核心规则：平板横屏必须使用桌面端布局，竖屏使用移动端流式布局
    return isLandscape() ? 'desktop' : 'phone';
  }

  // 4. 纯桌面环境 (macOS/Windows/Linux)
  if (info?.platform === 'desktop' || info?.form_factor === 'desktop' || (!isAndroid && !isIOSPhone && !isPad)) {
    // 桌面端默认保持桌面布局；仅在窗口被极端压窄为手机竖屏 (< 680px 且高远大于宽) 时做移动端响应
    if (window.innerWidth < 680 && window.innerHeight > window.innerWidth) {
      return 'phone';
    }
    return 'desktop';
  }

  // 5. 兜底策略：横屏且宽度充足则桌面端，否则移动端
  return isLandscape() && window.innerWidth >= 768 ? 'desktop' : 'phone';
}

function getInitialLayout(): 'desktop' | 'phone' {
  return determineLayout(null);
}

let resizeDebounceTimer: any = null;
function handleViewportChange() {
  if (resizeDebounceTimer) clearTimeout(resizeDebounceTimer);
  resizeDebounceTimer = setTimeout(() => {
    const nextLayout = determineLayout(cachedDeviceInfo);
    if (nextLayout !== currentLayout.value) {
      console.log(
        `[NaosuNote] Layout adapted: ${currentLayout.value} -> ${nextLayout} ` +
        `(width: ${window.innerWidth}, height: ${window.innerHeight}, landscape: ${isLandscape()})`
      );
      currentLayout.value = nextLayout;
    }
  }, 100);
}

onMounted(async () => {
  try {
    cachedDeviceInfo = await apiGetDeviceInfo();
    const verifiedLayout = determineLayout(cachedDeviceInfo);
    if (verifiedLayout !== currentLayout.value) {
      currentLayout.value = verifiedLayout;
    }
  } catch (err) {
    console.warn('[NaosuNote] Failed to query device info:', err);
  }

  window.addEventListener('resize', handleViewportChange);
  window.addEventListener('orientationchange', handleViewportChange);
  if (window.screen?.orientation) {
    window.screen.orientation.addEventListener('change', handleViewportChange);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleViewportChange);
  window.removeEventListener('orientationchange', handleViewportChange);
  if (window.screen?.orientation) {
    window.screen.orientation.removeEventListener('change', handleViewportChange);
  }
});
</script>
