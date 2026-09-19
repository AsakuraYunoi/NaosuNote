import { createApp } from 'vue';
import App from './App.vue';
import 'katex/dist/katex.min.css';
import './assets/styles/base.css';
import { initTheme } from './utils/theme';

initTheme();

createApp(App).mount('#app');

