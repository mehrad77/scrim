export interface StorageInfo {
  usage: number;
  quota: number;
  persisted: boolean;
}

export async function storageInfo(): Promise<StorageInfo> {
  const est = (await navigator.storage?.estimate?.()) ?? {};
  const persisted = (await navigator.storage?.persisted?.()) ?? false;
  return { usage: est.usage ?? 0, quota: est.quota ?? 0, persisted };
}

/** Ask the browser not to evict our storage. Returns whether it agreed. */
export async function requestPersistence(): Promise<boolean> {
  return (await navigator.storage?.persist?.()) ?? false;
}
