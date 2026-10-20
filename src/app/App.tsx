import { CloudDownload, Settings } from 'lucide-react';
import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { MapPage } from '../features/map/MapPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { TranslatorPage } from '../features/translator/TranslatorPage';
import { LinkButton } from '../ui/Button';
import { PageHeader } from '../ui/PageHeader';
import { LoadingState } from '../ui/States';
import { ToastProvider } from '../ui/Toast';
import { BottomNav } from './BottomNav';
import { GlobalBanners } from './GlobalBanners';
import { NotFoundPage } from './NotFoundPage';
import { PendingPhase } from './PendingPhase';
import './layout.css';

const LabPage = lazy(() => import('../features/lab/LabPage'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function TripPage() {
  return (
    <>
      <PageHeader
        title="Viaje"
        actions={
          <>
            <LinkButton to="/sin-conexion" variant="ghost" icon={<CloudDownload size={22} />} label="Preparar Japón sin conexión" />
            <LinkButton to="/ajustes" variant="ghost" icon={<Settings size={22} />} label="Ajustes" />
          </>
        }
      />
      <PendingPhase what="Aquí verás el viaje, la cuenta atrás, la próxima actividad y la próxima reserva." />
    </>
  );
}

export function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <ScrollToTop />
        <div className="app">
          <main className="app-main">
            <GlobalBanners />
            <Routes>
              <Route path="/" element={<TripPage />} />
              <Route path="/itinerario" element={<><PageHeader title="Itinerario" /><PendingPhase what="El itinerario por días y ciudades." /></>} />
              <Route path="/mapa" element={<MapPage />} />
              <Route path="/traductor" element={<TranslatorPage />} />
              <Route path="/reservas" element={<><PageHeader title="Reservas" /><PendingPhase what="Vuelos, hoteles, restaurantes y entradas con sus documentos y QR." /></>} />
              <Route path="/sin-conexion" element={<><PageHeader title="Preparar Japón sin conexión" back="/" /><PendingPhase what="La lista de comprobaciones reales sin conexión." /></>} />
              <Route path="/ajustes" element={<SettingsPage />} />
              <Route
                path="/lab"
                element={
                  <Suspense fallback={<LoadingState label="Cargando laboratorio…" />}>
                    <LabPage />
                  </Suspense>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
          <BottomNav />
        </div>
      </ToastProvider>
    </HashRouter>
  );
}
