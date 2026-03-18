import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@richie-router/react';
import { router } from './router';

const container = document.getElementById('app');

if (!container) {
  throw new Error('Missing #app container for Richie Router hydration.');
}

createRoot(container).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
