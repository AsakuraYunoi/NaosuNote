import { ref } from 'vue';

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_KEY = 'naosu_theme';

export const isDark = ref(false);

export function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) as ThemeMode | null;
  if (saved === 'dark') {
    applyTheme(true);
  } else if (saved === 'light') {
    applyTheme(false);
  } else {
    // 跟随系统
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark);
  }

  // 监听系统主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const current = localStorage.getItem(THEME_KEY);
    if (!current || current === 'system') {
      applyTheme(e.matches);
    }
  });
}

export function toggleTheme() {
  applyTheme(!isDark.value);
  localStorage.setItem(THEME_KEY, isDark.value ? 'dark' : 'light');
}

export function setTheme(mode: ThemeMode) {
  if (mode === 'system') {
    localStorage.removeItem(THEME_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark);
  } else {
    localStorage.setItem(THEME_KEY, mode);
    applyTheme(mode === 'dark');
  }
}

function applyTheme(dark: boolean) {
  isDark.value = dark;
  if (dark) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}
