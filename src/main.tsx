import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // ← この行があることを確認

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);