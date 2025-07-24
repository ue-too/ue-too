import { Board } from "@ue-too/core";

export function fabricIntegrationExample(canvas: HTMLCanvasElement) {
  const board = new Board(canvas);

  function step() {
    board.step(performance.now());
    
    // Draw Fabric.js integration placeholder
    const ctx = board.context;
    ctx.fillStyle = '#45b7d1';
    ctx.font = '16px Arial';
    ctx.fillText('Fabric.js Integration - Coming Soon', 50, 50);
    ctx.fillText('Fabric.js integration will be implemented here', 50, 80);
    
    requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
} 