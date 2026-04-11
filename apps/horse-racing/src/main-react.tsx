import { ThemeProvider } from 'next-themes';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { Toaster } from '@/components/ui/sonner';
import '@/i18n';
import App from './App';
import { LandingPage } from './pages/landing';
import { NotFoundPage } from './pages/not-found';
import { RaceV2Page } from './pages/race-v2';
import { TrackMakerPage } from './pages/track-maker';

import './App.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
    throw new Error(
        'Root element not found. Make sure there is a <div id="root"></div> in your HTML.',
    );
}

const root = createRoot(rootElement);

root.render(
    <StrictMode>
        <ThemeProvider attribute="class" defaultTheme="light">
            <Toaster />
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/app" element={<App />} />
                    <Route path="/app/v2" element={<RaceV2Page />} />
                    <Route path="/track-maker" element={<TrackMakerPage />} />
                    <Route path="/404" element={<NotFoundPage />} />
                    <Route path="*" element={<Navigate to="/404" replace />} />
                </Routes>
            </BrowserRouter>
        </ThemeProvider>
    </StrictMode>,
);
