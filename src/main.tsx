import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { isTauriRuntime } from './services/tauriBridge';
import './index.css';

if (isTauriRuntime()) {
  document.documentElement.classList.add('is-tauri');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
