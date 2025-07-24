import { Board } from "@ue-too/core";

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const board = new Board(canvas);

function step() {
  board.step(performance.now());
  
  // Draw a simple ruler overlay
  const ctx = board.context;
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  
  // Draw horizontal ruler lines
  for (let i = 0; i < canvas.width; i += 50) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 20);
    ctx.stroke();
    
    // Add numbers
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.fillText(i.toString(), i + 2, 15);
  }
  
  // Draw vertical ruler lines
  for (let i = 0; i < canvas.height; i += 50) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(20, i);
    ctx.stroke();
    
    // Add numbers
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.fillText(i.toString(), 2, i + 12);
  }
  
  requestAnimationFrame(step);
}

requestAnimationFrame(step);
