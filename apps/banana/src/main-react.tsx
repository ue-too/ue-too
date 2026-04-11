import { ThemeProvider } from 'next-themes';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { APP_DISPLAY_NAME } from '@/branding';
import { AnalyticsNotice } from '@/components/analytics-notice';
import { Toaster } from '@/components/ui/sonner';
import '@/i18n';
import { ExpPage } from '@/pages/exp';
import { IconHandoffPage } from '@/pages/icon-handoff/icon-handoff-page';
import { LandingPage } from '@/pages/landing';
import { MapOverlayPage } from '@/pages/map-overlay';
import { BananaAppComponents } from '@/utils/init-app';

import App from './App';
import { NotFoundPage } from './pages/not-found';
import { TerrainEditorPage } from './pages/terrain-editor';
import { TrainEditor } from './pages/train-editor';

declare module '@ue-too/board-pixi-react-integration' {
    interface PixiCanvasRegistry {
        components: BananaAppComponents;
    }
}

document.title = APP_DISPLAY_NAME;

const rootElement = document.getElementById('root');

if (!rootElement) {
    throw new Error(
        'Root element not found. Make sure there is a <div id="root"></div> in your HTML.'
    );
}

const root = createRoot(rootElement);

root.render(
    <StrictMode>
        <ThemeProvider attribute="class" defaultTheme="light">
            <Toaster />
            <AnalyticsNotice />
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/app" element={<App />} />
                    <Route path="/map-overlay" element={<MapOverlayPage />} />
                    <Route path="/exp" element={<ExpPage />} />
                    <Route path="/train-editor" element={<TrainEditor />} />
                    <Route
                        path="/terrain-editor"
                        element={<TerrainEditorPage />}
                    />
                    <Route
                        path="/icon-handoff"
                        element={<IconHandoffPage />}
                    />
                    <Route path="/404" element={<NotFoundPage />} />
                    <Route path="*" element={<Navigate to="/404" replace />} />
                </Routes>
            </BrowserRouter>
        </ThemeProvider>
    </StrictMode>
);
