import { CanvasPositionDimensionPublisher } from "src/boardify/utils/canvas-position-dimension";

const canvas = document.getElementById("graph") as HTMLCanvasElement;
const canvas2 = document.getElementById("graph2") as HTMLCanvasElement;

const canvasPositionDimensionPublisher = new CanvasPositionDimensionPublisher(canvas);
canvasPositionDimensionPublisher.onPositionUpdate((rect) => {
    console.log(rect);
});

canvasPositionDimensionPublisher.attach(canvas2);

canvas2.width = 700;

const utilBtn = document.getElementById("util-btn") as HTMLButtonElement;

utilBtn.addEventListener("click", () => {
    canvas2.width = 800;
});

