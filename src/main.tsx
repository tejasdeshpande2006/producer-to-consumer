import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress benign Vite WebSocket connection errors in AI Studio
if (import.meta.env.DEV) {
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.message && 
        (event.reason.message.includes('WebSocket') || 
         event.reason.message.includes('vite'))) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
