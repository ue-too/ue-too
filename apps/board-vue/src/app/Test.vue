<script setup lang="ts">
    import { useBoard } from "@ue-too/board-vue-adapter";
import { ref, onMounted } from "vue";
import { useAnimationFrameWithBoard, useCameraState } from "@ue-too/board-vue-adapter";

    const canvas = ref<HTMLCanvasElement | null>(null);
    const board = useBoard();
    const position = useCameraState("position");
    const zoomLevel = useCameraState("zoomLevel");

    useAnimationFrameWithBoard((timestamp, ctx) => {
        board.step(timestamp);
        ctx.fillStyle = "red";
        ctx.fillRect(0, 0, 100, 100);
    });


    onMounted(()=>{
        if(canvas.value){
            board.attach(canvas.value);
        } else {
            board.tearDown();
        }
    })

</script>

<template>
    <canvas ref="canvas" width="1000" height="300">
        Your browser does not support the canvas tag.
    </canvas>
    <div>position: {{ position.x }}, {{ position.y }}</div>
    <div>zoomLevel: {{ zoomLevel }}</div>
</template>