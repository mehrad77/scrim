import { createContext, useContext } from 'react';

/**
 * Where popovers mount. A modal `<dialog>` sits in the top layer, so popovers opened inside it
 * must mount inside it too, or they render underneath.
 */
export const PortalContext = createContext<Element | null>(null);

export function usePortal(): { UNSTABLE_portalContainer?: Element } {
  const container = useContext(PortalContext);
  return container ? { UNSTABLE_portalContainer: container } : {};
}
