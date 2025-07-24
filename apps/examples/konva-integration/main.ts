import { Board } from "@ue-too/core";

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const board = new Board(canvas);

function step() {
  board.step(performance.now());
  
  // Draw Konva.js integration placeholder
  const ctx = board.context;
  ctx.fillStyle = '#4ecdc4';
  ctx.font = '16px Arial';
  ctx.fillText('Konva.js Integration - Coming Soon', 50, 50);
  ctx.fillText('Konva.js integration will be implemented here', 50, 80);
  
  requestAnimationFrame(step);
}

requestAnimationFrame(step);
