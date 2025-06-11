// import the Board Class
import Board from 'src/boardify';

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
    board.context.drawImage(tileImage, 0, 0);
  }

  // request the next frame
  requestAnimationFrame(draw);
}

requestAnimationFrame(draw);
