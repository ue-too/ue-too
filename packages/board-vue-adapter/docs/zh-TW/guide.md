# 入門指南

`@ue-too/board-vue-adapter` 提供 Vue 與 board 無限畫布的整合。

## 安裝

```bash
npm install @ue-too/board-vue-adapter @ue-too/board
```

## 基本用法

```vue
<script setup lang="ts">
import { useBoardCanvas } from "@ue-too/board-vue-adapter";

const { bindTo } = useBoardCanvas();
</script>

<template>
    <canvas ref="bindTo" />
</template>
```
