import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './audience.css';
import { Audience } from './Audience.js';

// Phones get the large-target density.
document.documentElement.dataset.density = 'stage';
// A shared tablet, passed from person to person, reads in large print.
if (new URLSearchParams(location.search).has('s'))
  document.documentElement.style.setProperty('--ui-scale', '1.25');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Audience />
  </StrictMode>,
);
