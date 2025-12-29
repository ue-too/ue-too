<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Board } from '@ue-too/board';

const canvas = ref<HTMLCanvasElement | null>(null);
const board = ref<Board>(new Board());

onMounted(() => {
    if (canvas.value) {
        board.value.attach(canvas.value);
    } else {
        board.value.tearDown();
    }
});
</script>

<template>
    <canvas ref="canvas">
        Your browser does not support the canvas tag.
    </canvas>
</template>
