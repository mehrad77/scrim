import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles.css';
import { Audience } from './Audience.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Audience />
  </StrictMode>,
);
