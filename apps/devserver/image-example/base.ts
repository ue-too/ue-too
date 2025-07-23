// import the Board Class
import Board from 'src/boardify';
import { drawArrow } from 'src/utils/drawing';

const canvas = document.getElementById('graph') as HTMLCanvasElement;

// Create an image object
const tileImage = new Image();
tileImage.src = 'tile.png';

// instantiate the board by passing in the canvas element
const board = new Board(canvas);

function draw(timestamp: number) {
  // step the board
  board.step(timestamp);

  // Draw the image if it's loaded
  if (tileImage.complete) {
    board.context.drawImage(tileImage, 0, 0, 300, 300, 200, 200, 300, 300);
  }

  // draw the axis arrow as reference
  board.context.save();
  board.context.strokeStyle = "red";
  drawArrow(board.context, 1, {x: 0, y: 0}, {x: 0, y: board.camera.boundaries.max.y}, 10, 0.3);
  board.context.restore();

  board.context.save();
  board.context.strokeStyle = "green";
  drawArrow(board.context, 1, {x: 0, y: 0}, {x: board.camera.boundaries.max.x, y: 0}, 10, 0.3);
  board.context.restore();

  // request the next frame
  requestAnimationFrame(draw);
}

requestAnimationFrame(draw);
