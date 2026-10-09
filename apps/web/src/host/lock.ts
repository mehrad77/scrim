/**
 * Web Locks keep a single operator per show; `steal` takes it from another
 * tab. A lock being released (a reload, a remount) gets a moment to clear.
 * `onLost` runs if another tab takes the lock later: this one must stop driving the show.
 */
export async function acquireLock(
  name: string,
  steal: boolean,
  onLost?: () => void,
): Promise<(() => void) | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const release = await tryLock(name, steal, onLost);
    if (release) return release;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

function tryLock(name: string, steal: boolean, onLost?: () => void): Promise<(() => void) | null> {
  if (!navigator.locks) return Promise.resolve(() => undefined);
  return new Promise((resolve) => {
    let done = false;
    void navigator.locks
      .request(name, steal ? { steal: true } : { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(null);
          return;
        }
        return new Promise<void>((release) => {
          done = true;
          resolve(release);
        });
      })
      // Once held, a rejection means another tab stole it.
      .catch(() => (done ? onLost?.() : resolve(null)));
  });
}

/** The lock one show's host holds on this machine: the operator view's or an installation's. */
export const lockName = (showId: string) => `scrim-host-${showId}`;
