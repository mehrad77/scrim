import { MotionConfig } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';
import { reducedMotion, spring } from './motion.js';

/** Root motion settings for a route; follows <html data-motion> as it changes. */
export function MotionRoot({ children }: { children: ReactNode }) {
  const [reduced, setReduced] = useState(reducedMotion);
  useEffect(() => {
    const obs = new MutationObserver(() => setReduced(reducedMotion()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
    return () => obs.disconnect();
  }, []);
  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'} transition={spring.settle}>
      {children}
    </MotionConfig>
  );
}
