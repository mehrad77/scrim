import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { Library } from './routes/Library.js';
import './styles.css';
import { Toaster } from './ui/toast.js';

const Editor = lazy(() => import('./routes/editor/Editor.js'));
const Operator = lazy(() => import('./routes/operator/Operator.js'));
const OutputWindow = lazy(() => import('./routes/OutputWindow.js'));
const RemoteOutput = lazy(() => import('./routes/RemoteOutput.js'));
const Remote = lazy(() => import('./routes/Remote.js'));

const router = createBrowserRouter([
  { path: '/', element: <Library /> },
  { path: '/show/:id', element: <Editor /> },
  { path: '/show/:id/run', element: <Operator /> },
  { path: '/output/:showId/:outputId', element: <OutputWindow /> },
  { path: '/remote-output', element: <RemoteOutput /> },
  { path: '/remote', element: <Remote /> },
  { path: '*', element: <Library /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div className="p-6 text-sm text-ink-400">Loading…</div>}>
      <RouterProvider router={router} />
    </Suspense>
    <Toaster />
  </StrictMode>,
);

// Cache the app for offline shows. Output and remote windows benefit too.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
}
