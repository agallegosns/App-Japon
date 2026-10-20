import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ConverterPage } from '../features/converter/ConverterPage';
import { BookingDetailPage } from '../features/bookings/BookingDetailPage';
import { BookingFormPage } from '../features/bookings/BookingFormPage';
import { BookingsPage } from '../features/bookings/BookingsPage';
import { ActivityFormPage } from '../features/itinerary/ActivityFormPage';
import { ItineraryPage } from '../features/itinerary/ItineraryPage';
import { MapPage } from '../features/map/MapPage';
import { OfflinePrepPage } from '../features/offline/OfflinePrepPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { TranslatorPage } from '../features/translator/TranslatorPage';
import { TripFormPage } from '../features/trip/TripFormPage';
import { TripHomePage } from '../features/trip/TripHomePage';
import { getDb } from '../storage/db';
import { startAutoSync } from '../sync/service';
import { LoadingState } from '../ui/States';
import { ToastProvider } from '../ui/Toast';
import { BottomNav } from './BottomNav';
import { GlobalBanners } from './GlobalBanners';
import { NotFoundPage } from './NotFoundPage';
import './layout.css';

// El laboratorio carga librerías pesadas (OCR, traducción, mapas): se separa en su propio bloque.
const LabPage = lazy(() => import('../features/lab/LabPage'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<TripHomePage />} />
      <Route path="/viaje/editar" element={<TripFormPage />} />
      <Route path="/itinerario" element={<ItineraryPage />} />
      <Route path="/itinerario/nueva" element={<ActivityFormPage />} />
      <Route path="/itinerario/:id/editar" element={<ActivityFormPage />} />
      <Route path="/mapa" element={<MapPage />} />
      <Route path="/traductor" element={<TranslatorPage />} />
      <Route path="/reservas" element={<BookingsPage />} />
      <Route path="/reservas/nueva" element={<BookingFormPage />} />
      <Route path="/reservas/:id" element={<BookingDetailPage />} />
      <Route path="/reservas/:id/editar" element={<BookingFormPage />} />
      <Route path="/conversor" element={<ConverterPage />} />
      <Route path="/ajustes" element={<SettingsPage />} />
      <Route path="/sin-conexion" element={<OfflinePrepPage />} />
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
  );
}

/** Cada cambio de pantalla entra con un fundido suave (CSS, sin librerías). */
function AnimatedRoutes() {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="page-transition">
      <AppRoutes />
    </div>
  );
}

export function App() {
  useEffect(() => startAutoSync(getDb()), []);
  return (
    <HashRouter>
      <ToastProvider>
        <ScrollToTop />
        <div className="app">
          <main className="app-main">
            <GlobalBanners />
            <AnimatedRoutes />
          </main>
          <BottomNav />
        </div>
      </ToastProvider>
    </HashRouter>
  );
}
