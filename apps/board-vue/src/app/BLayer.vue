<script setup lang="ts">
    import { provideBoard, useBoard, useCustomCameraMux } from "@ue-too/board-vue-adapter";
    import Test from "./Test.vue";
    import { Point } from "@ue-too/math";

    const board = useBoard();

    function restrictPan(){
        board.restrictRelativeXTranslation = true;
        board.restrictRelativeYTranslation = true;
    }


</script>

<template>
    <Test />
    <button @click="restrictPan">Restrict Pan</button>
</template>