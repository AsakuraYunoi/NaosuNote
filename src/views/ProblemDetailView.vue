<template>
  <ProblemDetailView
    :problem="props.problem"
    @back="emit('back')"
    @saved="emit('saved', $event)"
    @notify="emit('notify', $event)"
  />
</template>

<script setup lang="ts">
import type { Problem } from '../types/problem';
import ProblemDetailView from './problem-detail/ProblemDetailView.vue';

const props = defineProps<{
  problem: Problem;
}>();

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'saved', updatedProblem: Problem): void;
  (e: 'notify', msg: string): void;
}>();
</script>
