import React from 'react';
import ReactDOM from 'react-dom/client';
import {Provider} from 'react-redux';
import {store} from './store';
import App from './App';
import './index.css';

// Register the app-shell service worker for PWA installability/offline
// support. (firebase-messaging-sw.js is registered separately by
// notificationService.js only once a user logs in and grants permission.)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(e => {
      console.warn('[PWA] service worker registration failed:', e.message);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>,
);
