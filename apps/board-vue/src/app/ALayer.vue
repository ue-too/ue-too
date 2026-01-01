<script setup lang="ts">
    import { provideBoard } from "@ue-too/board-vue-adapter";
    import BLayer from "./BLayer.vue";

    provideBoard();


</script>

<template>
    <BLayer />
</template>