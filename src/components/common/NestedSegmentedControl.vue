<script setup lang="ts">
import NestedSegmentedControl from '../../views/problem-detail/components/NestedSegmentedControl.vue';
import type { AnswerPrimaryMode, AnswerSubMode } from '../../views/problem-detail/components/NestedSegmentedControl.vue';

export type { AnswerPrimaryMode, AnswerSubMode };
</script>

<template>
  <NestedSegmentedControl v-bind="$attrs" />
</template>
