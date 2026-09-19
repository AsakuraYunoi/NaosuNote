<template>
  <div v-if="visible" class="m3-dialog-scrim" @click.self="$emit('cancel')">
    <div class="m3-dialog">
      <div class="dialog-icon-wrapper">
        <AlertTriangle :size="28" class="dialog-icon" />
      </div>

      <h3 class="dialog-title">检测到高度相似错题</h3>

      <div class="dialog-content">
        <p class="dialog-desc">
          系统比对发现当前录入的错题与已有题目的题干文本高度重合：
        </p>

        <div class="match-card">
          <div class="match-meta">
            <span class="badge">{{ matchedProblem?.subject }} · {{ matchedProblem?.type }}</span>
            <span class="sim-badge">相似度 {{ (similarity * 100).toFixed(0) }}%</span>
          </div>
          <div class="match-summary">
            {{ matchedProblem?.summary || '未知错题' }}
          </div>
          <div class="match-sub">
            当前重要程度：
            <span class="importance-level-badge">{{ matchedProblem?.importance || 1 }} 级重要度</span>
          </div>
        </div>

        <p class="dialog-hint">
          根据学习认知规律，重蹈覆辙的题目往往更需要重点攻克。建议直接<strong>提升该题重要性</strong>，以便在组卷重刷时优先复习。
        </p>
      </div>

      <div class="dialog-actions">
        <button class="btn-text" @click="$emit('cancel')">取消</button>
        <button class="btn-outlined" @click="$emit('importAnyway')">依然作为新题导入</button>
        <button class="btn-primary" @click="$emit('upgradeImportance')">
          <Sparkles :size="16" />
          <span>提升原题重要性 (+1级)</span>
        </button>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import type { Problem } from '../types/problem';
import { AlertTriangle, Sparkles } from 'lucide-vue-next';

defineProps<{
  visible: boolean;
  similarity: number;
  matchedProblem?: Problem | null;
}>();

defineEmits<{
  (e: 'upgradeImportance'): void;
  (e: 'importAnyway'): void;
  (e: 'cancel'): void;
}>();
</script>

<style scoped>
.m3-dialog-scrim {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  animation: fadeIn 0.2s ease-out;
}

.m3-dialog {
  background: var(--md-sys-color-surface-container-high);
  border-radius: var(--md-shape-corner-xxl);
  width: 520px;
  max-width: 90vw;
  padding: 28px;
  box-shadow: var(--md-elevation-3);
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: popIn 0.25s cubic-bezier(0.1, 0.9, 0.2, 1);
}

.dialog-icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: var(--md-shape-corner-full);
  background: #fef3c7;
  color: #d97706;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dialog-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--md-sys-color-on-surface);
  margin: 0;
}

.dialog-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 14px;
  color: var(--md-sys-color-on-surface-variant);
  line-height: 1.6;
}

.match-card {
  background: var(--md-sys-color-surface-container-lowest);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-shape-corner-lg);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.match-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.match-meta .badge {
  font-size: 12px;
  font-weight: 600;
  background: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  padding: 2px 8px;
  border-radius: 6px;
}

.sim-badge {
  font-size: 12px;
  font-weight: 700;
  color: #d97706;
}

.match-summary {
  font-size: 15px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
}

.match-sub {
  font-size: 13px;
  color: var(--md-sys-color-on-surface-variant);
}

.stars-text {
  color: #e11d48;
  font-size: 15px;
  letter-spacing: 2px;
}

.dialog-hint {
  font-size: 13px;
  color: var(--md-sys-color-on-surface-variant);
  background: rgba(0, 0, 0, 0.03);
  padding: 8px 12px;
  border-radius: 8px;
}

.dialog-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.btn-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface-variant);
  padding: 8px 14px;
  border-radius: var(--md-shape-corner-full);
}
.btn-text:hover {
  background: var(--md-sys-color-surface-container);
}

.btn-outlined {
  font-size: 13px;
  font-weight: 600;
  color: var(--md-sys-color-primary);
  border: 1px solid var(--md-sys-color-outline-variant);
  padding: 8px 16px;
  border-radius: var(--md-shape-corner-full);
}
.btn-outlined:hover {
  background: var(--md-sys-color-surface-container);
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  padding: 8px 18px;
  border-radius: var(--md-shape-corner-full);
  box-shadow: var(--md-elevation-1);
}
.btn-primary:hover {
  box-shadow: var(--md-elevation-2);
  filter: brightness(1.05);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes popIn {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>
