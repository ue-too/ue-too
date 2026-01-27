<script setup lang="ts">
import { Board, provideBoard, useBoard } from '@ue-too/board-vue-adapter';

import ALayer from './ALayer.vue';
import Test from './Test.vue';

provideBoard();
</script>

<template>
    <Test />
    <ALayer />
</template>
