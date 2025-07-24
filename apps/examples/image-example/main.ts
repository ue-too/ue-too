import Board from "@ue-too/core/boardify";

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const board = new Board(canvas);

function step() {
  board.step(performance.now());
  
  // Draw image example placeholder
  const ctx = board.context;
  ctx.fillStyle = '#feca57';
  ctx.font = '16px Arial';
  ctx.fillText('Image Example - Coming Soon', 50, 50);
  ctx.fillText('Image manipulation examples will be implemented here', 50, 80);
  
  requestAnimationFrame(step);
}

requestAnimationFrame(step); 