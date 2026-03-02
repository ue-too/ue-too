import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { BananaAppComponents } from '@/utils/init-app';

import App from './App';

declare module '@ue-too/board-pixi-react-integration' {
  interface PixiCanvasRegistry {
    components: BananaAppComponents;
  }
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error(
    'Root element not found. Make sure there is a <div id="root"></div> in your HTML.',
  );
}

const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
