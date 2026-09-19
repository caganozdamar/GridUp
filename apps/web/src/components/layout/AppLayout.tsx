import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { SystemStatusProvider } from '../../context/SystemStatusContext';

export function AppLayout() {
  return (
    <SystemStatusProvider>
      <div className="app-shell">
        <Sidebar />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </SystemStatusProvider>
  );
}
