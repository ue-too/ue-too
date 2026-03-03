/**
 * Entry point for the Three.js POC page (standalone HTML).
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { ThreeJSPOCPage } from './page';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

createRoot(rootEl).render(
    <StrictMode>
        <ThreeJSPOCPage />
    </StrictMode>
);
