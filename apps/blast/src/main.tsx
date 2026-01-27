import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import './style.css';
import MyWorker from './worker.ts?worker';

const worker = new MyWorker();

worker.postMessage({ type: 'initialize' });
worker.onmessage = event => {
    console.log(event.data);
};

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
