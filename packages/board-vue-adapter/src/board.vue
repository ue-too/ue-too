<script setup lang="ts">
import { Board } from '@ue-too/board';
import { onMounted, ref } from 'vue';

import { useAnimationFrameWithBoard, useBoard } from './useBoard';

const canvas = ref<HTMLCanvasElement | null>(null);
const board = new Board();

onMounted(() => {
    if (canvas.value) {
        board.attach(canvas.value);
    } else {
        board.tearDown();
    }
});

useAnimationFrameWithBoard((timestamp, ctx) => {
    board.step(timestamp);
    ctx.fillStyle = 'red';
    ctx.fillRect(0, 0, 100, 100);
});
</script>

<template>
    <canvas ref="canvas">
        Your browser does not support the canvas tag.
    </canvas>
</template>
