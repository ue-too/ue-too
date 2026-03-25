# 入門指南

`@ue-too/being` 是一個有限狀態機庫，用於建構具有事件驅動轉換和上下文管理的狀態機。

## 安裝

```bash
npm install @ue-too/being
```

## 基本用法

```typescript
import { StateMachine } from "@ue-too/being";

const machine = new StateMachine({
    initial: "idle",
    states: {
        idle: {
            on: { START: "running" },
        },
        running: {
            on: { STOP: "idle" },
        },
    },
});

machine.send("START"); // 轉換到 "running"
```
