import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';

import { MapOverlayPage } from '@/pages/map-overlay';
import { BananaAppComponents } from '@/utils/init-app';
import { MapOverlayPage } from '@/pages/map-overlay';
import { ExpPage } from '@/pages/exp';

import App from './App';
import { TrainEditor } from './pages/train-editor';

declare module '@ue-too/board-pixi-react-integration' {
    interface PixiCanvasRegistry {
        components: BananaAppComponents;
    }
}

const rootElement = document.getElementById('root');

if (!rootElement) {
    throw new Error(
        'Root element not found. Make sure there is a <div id="root"></div> in your HTML.'
    );
}

const root = createRoot(rootElement);

root.render(
    <StrictMode>
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<App />} />
                <Route path="/map-overlay" element={<MapOverlayPage />} />
             <Route path="/exp" element={<ExpPage />} />
                <Route path="/train-editor" element={<TrainEditor />} />
            </Routes>
        </BrowserRouter>
    </StrictMode>
);
