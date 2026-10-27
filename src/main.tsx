import React from 'react';
import ReactDOM from 'react-dom/client';
import MissionApp from './game/MissionApp';
import './index.css';

// Offline shell: everything is bundled (fonts, procedural textures, synthesized audio).
// http(s) only — no service worker on file:// or during development.
if (import.meta.env.PROD && 'serviceWorker' in navigator && /^https?:$/.test(window.location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./ma-sw.js').catch(() => {
      /* offline cache is best-effort */
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MissionApp />
  </React.StrictMode>
);
