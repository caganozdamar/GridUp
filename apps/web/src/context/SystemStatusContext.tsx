import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface SystemStatusState {
  isOnline: boolean;
  lastUpdated: Date | null;
}

interface SystemStatusContextValue extends SystemStatusState {
  report: (status: SystemStatusState) => void;
}

const SystemStatusContext = createContext<SystemStatusContextValue | null>(null);

/**
 * Aktif sayfanin polling durumunu (bagli/kopuk, son basarili guncelleme)
 * Header ve Sidebar'in gosterebilmesi icin paylasir. Her sayfa kendi
 * usePolling sonucunu `report` ile buraya yansitir.
 */
export function SystemStatusProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SystemStatusState>({ isOnline: true, lastUpdated: null });

  const report = useCallback((status: SystemStatusState) => {
    setState((prev) => {
      if (prev.isOnline === status.isOnline && prev.lastUpdated?.getTime() === status.lastUpdated?.getTime()) {
        return prev;
      }
      return status;
    });
  }, []);

  const value = useMemo(() => ({ ...state, report }), [state, report]);

  return <SystemStatusContext.Provider value={value}>{children}</SystemStatusContext.Provider>;
}

export function useSystemStatus(): SystemStatusContextValue {
  const ctx = useContext(SystemStatusContext);
  if (!ctx) throw new Error('useSystemStatus must be used within SystemStatusProvider');
  return ctx;
}
