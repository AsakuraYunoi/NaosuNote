<template>
  <ProblemAnswerCard
    :problem-uuid="props.problemUuid"
    :initial-markdown="props.initialMarkdown"
    :initial-images="props.initialImages"
    @change="emit('change', $event)"
    @notify="emit('notify', $event)"
  />
</template>

<script setup lang="ts">
import ProblemAnswerCard from '../../views/problem-detail/ProblemAnswerCard.vue';

const props = defineProps<{
  problemUuid: string;
  initialMarkdown?: string;
  initialImages?: string[];
}>();

const emit = defineEmits<{
  (e: 'change', payload: { answerMarkdown: string; answerImages: string[] }): void;
  (e: 'notify', msg: string): void;
}>();
</script>
