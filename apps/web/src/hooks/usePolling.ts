import { useCallback, useEffect, useRef, useState } from 'react';

export interface UsePollingResult<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  isOnline: boolean;
  lastUpdated: Date | null;
  /** Bir sonraki tick'i beklemeden hemen yeniden yukler (ornegin bir islemden sonra). */
  refresh: () => Promise<void>;
}

/**
 * Self-scheduling poll loop: her tick bir onceki istek bittikten sonra
 * planlanir, boylece istekler asla ust uste binmez (Asama 5 madde 8).
 * Basarisiz bir tick mevcut `data`'yi silmez, sadece `isOnline`/`error`
 * gunceller (Asama 5 madde 12).
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  deps: readonly unknown[] = [],
): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // fetcher genelde inline bir arrow function oldugu icin ref'te tutulur;
  // bu sayede her render'da poll dongusunu yeniden baslatmadan en guncel
  // fetcher kullanilir.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
      setIsOnline(true);
      setLastUpdated(new Date());
    } catch (err) {
      setIsOnline(false);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      await load();
      if (!cancelled) {
        timeoutId = setTimeout(tick, intervalMs);
      }
    };

    setIsLoading(true);
    void tick();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, load, ...deps]);

  return { data, error, isLoading, isOnline, lastUpdated, refresh: load };
}
