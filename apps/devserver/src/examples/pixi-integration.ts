import { Board } from "@ue-too/core";

export function pixiIntegrationExample(canvas: HTMLCanvasElement) {
  const board = new Board(canvas);

  function step() {
    board.step(performance.now());
    
    // Draw PixiJS integration placeholder
    const ctx = board.context;
    ctx.fillStyle = '#ff6b6b';
    ctx.font = '16px Arial';
    ctx.fillText('PixiJS Integration - Coming Soon', 50, 50);
    ctx.fillText('PixiJS integration will be implemented here', 50, 80);
    
    requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
} 