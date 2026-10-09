import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './audience.css';
import { Audience } from './Audience.js';

// Phones get the large-target density.
document.documentElement.dataset.density = 'stage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Audience />
  </StrictMode>,
);
