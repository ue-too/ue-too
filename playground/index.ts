import { vCanvas } from "../src";
import { vDial } from "../src";


customElements.define('v-canvas', vCanvas);
customElements.define('v-dial', vDial);

let element = document.getElementById("test-graph") as vCanvas;
let button = document.querySelector("button");
if (button) {
    button.onclick = (e) => element.resetCamera();
}