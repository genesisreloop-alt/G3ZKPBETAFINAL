import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { G3ZKPProvider } from './contexts/G3ZKPContext';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <G3ZKPProvider>
      <App />
    </G3ZKPProvider>
  </React.StrictMode>
);
