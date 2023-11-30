import { vCanvas } from "../src";


customElements.define('v-canvas', vCanvas);

let element = document.getElementById("test-graph") as vCanvas;
