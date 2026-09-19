<template>
  <div class="star-rating-container" :title="`${label}: ${modelValue} 星`">
    <span class="rating-label">{{ label }}</span>
    <div class="stars-group" @mouseleave="hoverIndex = 0">
      <button
        v-for="star in 5"
        :key="star"
        type="button"
        class="star-btn"
        @mouseenter="hoverIndex = star"
        @click.stop="$emit('update:modelValue', star)"
      >
        <svg
          viewBox="0 0 24 24"
          class="star-icon"
          :class="{
            filled: star <= (hoverIndex || modelValue),
            'theme-importance': theme === 'importance',
            'theme-difficulty': theme === 'difficulty',
          }"
        >
          <path
            d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
          />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: number;
    label: string;
    theme?: 'importance' | 'difficulty';
  }>(),
  {
    modelValue: 1,
    theme: 'difficulty',
  }
);

defineEmits<{
  (e: 'update:modelValue', val: number): void;
}>();

const hoverIndex = ref(0);
</script>

<style scoped>
.star-rating-container {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--md-sys-color-surface-container);
  padding: 4px 10px;
  border-radius: var(--md-shape-corner-full);
}

.rating-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface-variant);
}

.stars-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.star-btn {
  padding: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease;
}

.star-btn:hover {
  transform: scale(1.2);
}

.star-icon {
  width: 15px;
  height: 15px;
  fill: var(--md-sys-color-outline-variant);
  transition: fill 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.star-icon.filled.theme-difficulty {
  fill: #f59e0b; /* Amber */
}

.star-icon.filled.theme-importance {
  fill: #e11d48; /* Rose/Red Coral */
}
</style>
