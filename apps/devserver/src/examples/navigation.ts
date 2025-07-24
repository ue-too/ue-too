import { Board } from "@ue-too/core";

export function navigationExample(canvas: HTMLCanvasElement) {
  const board = new Board(canvas);

  function step() {
    board.step(performance.now());
    
    // Draw navigation controls
    const ctx = board.context;
    ctx.fillStyle = '#007bff';
    ctx.font = '16px Arial';
    ctx.fillText('Navigation Example - Coming Soon', 50, 50);
    ctx.fillText('Advanced navigation controls will be implemented here', 50, 80);
    
    requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
} 