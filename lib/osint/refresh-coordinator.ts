interface RefreshEntry<T> {
  completedAt: number;
  value?: T;
  inFlight?: Promise<T>;
}

export function createRefreshCoordinator<T>(
  cooldownMs: number,
  now: () => number = Date.now,
) {
  const entries = new Map<string, RefreshEntry<T>>();

  return {
    async run(key: string, loader: () => Promise<T>): Promise<T> {
      const entry = entries.get(key);
      if (entry?.inFlight) return entry.inFlight;
      if (entry?.value !== undefined && now() - entry.completedAt < cooldownMs) {
        return entry.value;
      }

      const inFlight = loader()
        .then((value) => {
          entries.set(key, { completedAt: now(), value });
          return value;
        })
        .catch((error) => {
          entries.delete(key);
          throw error;
        });

      entries.set(key, {
        completedAt: entry?.completedAt ?? 0,
        value: entry?.value,
        inFlight,
      });
      return inFlight;
    },
    clear() {
      entries.clear();
    },
  };
}
