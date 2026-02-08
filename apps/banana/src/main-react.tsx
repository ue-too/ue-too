import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';

import App from './App';

/**
 * React application entry point
 * Mounts the App component to the root element
 */
const rootElement = document.getElementById('root');

if (!rootElement) {
    throw new Error(
        'Root element not found. Make sure there is a <div id="root"></div> in your HTML.'
    );
}

const root = createRoot(rootElement);

root.render(
    <StrictMode>
        <BrowserRouter basename="/react">
            <Routes>
                <Route path="/" element={<App />} />
            </Routes>
        </BrowserRouter>
    </StrictMode>
);
