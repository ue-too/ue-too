# Getting Started

`@ue-too/board-vue-adapter` provides Vue integration for the board infinite canvas.

## Installation

```bash
npm install @ue-too/board-vue-adapter @ue-too/board
```

## Basic Usage

```vue
<script setup lang="ts">
import { useBoardCanvas } from "@ue-too/board-vue-adapter";

const { bindTo } = useBoardCanvas();
</script>

<template>
    <canvas ref="bindTo" />
</template>
```
