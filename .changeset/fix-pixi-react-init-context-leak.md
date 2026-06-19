---
'@ue-too/board-pixi-react-integration': patch
---

fix(board-pixi-react-integration): stop re-initializing Pixi on every render and reuse of lost GL contexts

`useInitializePixiApp` keyed its init effect on the `option` object and `initFunction` — both routinely passed as inline literals — so any re-render (including a React Fast Refresh from unrelated HMR) tore down and recreated the Pixi `Application` on the same reused `<canvas>`. Because Pixi calls `WEBGL_lose_context` on destroy, the new renderer would come up on a lost context that collided with the in-flight one, hard-freezing the GPU process on some drivers (notably Linux/Mesa).

The hook now: (1) initializes once per mount, reading the latest `option`/`initFunction` from refs rather than effect deps; (2) serializes init/teardown through a promise chain so two initializations never overlap (StrictMode mount→unmount→mount, fast remounts); and (3) creates a fresh `<canvas>` for each init and detaches it on teardown (`removeView`) so a lost context is never reused. `useInitializePixiApp` now returns `{ containerRef }` (attach to a wrapping element) instead of `{ canvasRef }`; the public `Wrapper`/`PixiCanvasApp` API is unchanged.
