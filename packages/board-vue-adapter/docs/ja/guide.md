# はじめに

`@ue-too/board-vue-adapter` は、board の無限キャンバスの Vue 統合を提供します。

## インストール

```bash
npm install @ue-too/board-vue-adapter @ue-too/board
```

## 基本的な使い方

```vue
<script setup lang="ts">
import { useBoardCanvas } from "@ue-too/board-vue-adapter";

const { bindTo } = useBoardCanvas();
</script>

<template>
    <canvas ref="bindTo" />
</template>
```
