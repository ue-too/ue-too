# はじめに

`@ue-too/being` は、イベント駆動の状態遷移とコンテキスト管理を備えた有限ステートマシンライブラリです。

## インストール

```bash
npm install @ue-too/being
```

## 基本的な使い方

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

machine.send("START"); // "running" に遷移
```
