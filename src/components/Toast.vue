<template>
  <Transition name="toast">
    <div v-if="visible" class="m3-snackbar">
      <span class="snackbar-text">{{ message }}</span>
      <button v-if="actionLabel" class="snackbar-action" @click="$emit('action')">
        {{ actionLabel }}
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean;
  message: string;
  actionLabel?: string;
}>();

defineEmits<{
  (e: 'action'): void;
}>();
</script>

<style scoped>
.m3-snackbar {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  background-color: var(--md-sys-color-on-surface);
  color: var(--md-sys-color-surface-container-lowest);
  padding: 12px 24px;
  border-radius: var(--md-shape-corner-xs);
  display: flex;
  align-items: center;
  gap: 18px;
  box-shadow: var(--md-elevation-3);
  z-index: 1000;
  font-size: 14px;
  max-width: 90vw;
}

.snackbar-text {
  font-weight: 500;
  letter-spacing: 0.25px;
}

.snackbar-action {
  color: #90caf9;
  font-weight: 700;
  font-size: 13px;
  padding: 2px 6px;
  border-radius: 4px;
}

.snackbar-action:hover {
  background: rgba(255, 255, 255, 0.1);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s cubic-bezier(0, 0, 0.2, 1);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 16px);
}
</style>
