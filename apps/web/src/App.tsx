import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { OverviewPage } from './pages/OverviewPage';
import { PanelsPage } from './pages/PanelsPage';
import { PanelDetailPage } from './pages/PanelDetailPage';
import { AlarmsPage } from './pages/AlarmsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="panels" element={<PanelsPage />} />
          <Route path="panels/:id" element={<PanelDetailPage />} />
          <Route path="alarms" element={<AlarmsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
