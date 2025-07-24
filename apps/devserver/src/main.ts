import { baseExample } from './examples/base';
import { rulerExample } from './examples/ruler';
import { navigationExample } from './examples/navigation';
import { pixiIntegrationExample } from './examples/pixi-integration';
import { konvaIntegrationExample } from './examples/konva-integration';
import { fabricIntegrationExample } from './examples/fabric-integration';
import { cameraAnimationExample } from './examples/camera-animation';
import { imageExample } from './examples/image-example';

type ExampleFunction = (canvas: HTMLCanvasElement) => void;

const examples: Record<string, { fn: ExampleFunction; description: string }> = {
  base: { fn: baseExample, description: 'Basic canvas with pan, zoom, and rotate functionality' },
  ruler: { fn: rulerExample, description: 'Ruler overlay with measurement tools' },
  navigation: { fn: navigationExample, description: 'Advanced navigation controls' },
  'pixi-integration': { fn: pixiIntegrationExample, description: 'Integration with PixiJS' },
  'konva-integration': { fn: konvaIntegrationExample, description: 'Integration with Konva.js' },
  'fabric-integration': { fn: fabricIntegrationExample, description: 'Integration with Fabric.js' },
  'camera-animation': { fn: cameraAnimationExample, description: 'Camera animation examples' },
  'image-example': { fn: imageExample, description: 'Image manipulation examples' }
};

// let currentExample: string = 'base';
let currentCleanup: (() => void) | null = null;

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const description = document.getElementById('description') as HTMLElement;

function loadExample(exampleName: string) {
  // Clean up current example
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }

  const example = examples[exampleName];
  if (!example) {
    console.error(`Example "${exampleName}" not found`);
    return;
  }

  // Update UI
  document.querySelectorAll('.nav button').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-example="${exampleName}"]`)?.classList.add('active');
  
  description.textContent = example.description;
  // currentExample = exampleName;

  // Load the example
  try {
    example.fn(canvas);
  } catch (error) {
    console.error(`Error loading example "${exampleName}":`, error);
    description.textContent = `Error loading example: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// Set up navigation
document.querySelectorAll('.nav button').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const exampleName = (e.target as HTMLElement).getAttribute('data-example');
    if (exampleName) {
      loadExample(exampleName);
    }
  });
});

// Load initial example
loadExample('base'); 