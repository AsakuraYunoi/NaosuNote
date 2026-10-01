<template>
  <Teleport to="body">
    <Transition name="m3-snackbar">
      <div
        v-if="visible"
        class="m3-snackbar-container"
        role="status"
        aria-live="polite"
      >
        <!-- 1. Container & 2. Supporting Text -->
        <span class="m3-snackbar-text">{{ message }}</span>

        <!-- 3. Action Button (Optional) -->
        <button
          v-if="actionLabel"
          class="m3-snackbar-action"
          @click="$emit('action')"
        >
          {{ actionLabel }}
        </button>

        <!-- 4. Close Icon Button (M3 Anatomy 4) -->
        <button
          class="m3-snackbar-close"
          title="关闭提示"
          aria-label="关闭提示"
          @click="$emit('close')"
        >
          <X :size="18" />
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next';

defineProps<{
  visible: boolean;
  message: string;
  actionLabel?: string;
}>();

defineEmits<{
  (e: 'action'): void;
  (e: 'close'): void;
}>();
</script>

<style scoped>
/**
 * Material Design 3 (M3) Snackbars / Toasts Specification
 * Strictly follows M3 Anatomy:
 * 1. Container: 4px corner radius, inverse-surface color, elevation level 3
 * 2. Supporting text: Body Medium (14px/20px), inverse-on-surface
 * 3. Action button: Label Large (14px), inverse-primary
 * 4. Close button: 18px icon, inverse-on-surface
 * High z-index (12000) & Teleported to body to float strictly above all popovers & dialogs
 */
.m3-snackbar-container {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 12000;
  display: flex;
  align-items: center;
  min-height: 48px;
  max-width: 568px;
  min-width: 344px;
  padding: 4px 12px 4px 16px;
  box-sizing: border-box;
  background-color: var(--md-sys-color-inverse-surface, #313033);
  color: var(--md-sys-color-inverse-on-surface, #f4eff4);
  border-radius: var(--md-shape-corner-xs, 4px);
  box-shadow: 0px 3px 5px -1px rgba(0, 0, 0, 0.2),
              0px 6px 10px 0px rgba(0, 0, 0, 0.14),
              0px 1px 18px 0px rgba(0, 0, 0, 0.12);
  user-select: none;
  pointer-events: auto;
}

/* 2. Supporting Text */
.m3-snackbar-text {
  flex: 1;
  font-family: Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.25px;
  color: var(--md-sys-color-inverse-on-surface, #f4eff4);
  padding: 10px 0;
  word-break: break-word;
}

/* 3. Action Button */
.m3-snackbar-action {
  background: transparent;
  border: none;
  color: var(--md-sys-color-inverse-primary, #9ecaff);
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.1px;
  height: 36px;
  padding: 0 12px;
  margin-left: 12px;
  border-radius: 4px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease;
  white-space: nowrap;
}

.m3-snackbar-action:hover {
  background-color: rgba(255, 255, 255, 0.08);
}

.m3-snackbar-action:active {
  background-color: rgba(255, 255, 255, 0.14);
}

/* 4. Close Icon Button */
.m3-snackbar-close {
  width: 32px;
  height: 32px;
  margin-left: 8px;
  background: transparent;
  border: none;
  border-radius: 50%;
  color: var(--md-sys-color-inverse-on-surface, #f4eff4);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.15s ease, transform 0.1s ease;
}

.m3-snackbar-close:hover {
  background-color: rgba(255, 255, 255, 0.12);
}

.m3-snackbar-close:active {
  transform: scale(0.95);
}

/* M3 Motion Spec: Smooth Container Enter/Leave */
.m3-snackbar-enter-active {
  transition: all 0.22s cubic-bezier(0.05, 0.7, 0.1, 1);
}

.m3-snackbar-leave-active {
  transition: all 0.16s cubic-bezier(0.3, 0, 0.8, 0.15);
}

.m3-snackbar-enter-from,
.m3-snackbar-leave-to {
  opacity: 0;
  transform: translate(-50%, 16px) scale(0.96);
}

/* Responsive adjustment */
@media (max-width: 600px) {
  .m3-snackbar-container {
    min-width: calc(100vw - 32px);
    max-width: calc(100vw - 32px);
    bottom: 16px;
  }
}
</style>
