import { FlaskConical, Settings } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { SettingsPage } from '../features/settings/SettingsPage';
import { LinkButton } from '../ui/Button';
import { Card } from '../ui/Card';
import { PageHeader } from '../ui/PageHeader';
import { LoadingState } from '../ui/States';
import { ToastProvider } from '../ui/Toast';
import { GlobalBanners } from './GlobalBanners';
import { NotFoundPage } from './NotFoundPage';
import './layout.css';

const LabPage = lazy(() => import('../features/lab/LabPage'));

function HomePage() {
  return (
    <>
      <PageHeader title="Nihon Trip" actions={<LinkButton to="/ajustes" variant="ghost" icon={<Settings size={22} />} label="Ajustes" />} />
      <Card title="Fase 1: base y laboratorio">
        <div className="stack">
          <p className="muted">
            Las pantallas del viaje llegan en las fases 2 y 3. Ahora mismo puedes comprobar qué funciona en tu iPhone
            desde el Laboratorio de viabilidad.
          </p>
          <LinkButton to="/lab" variant="primary" icon={<FlaskConical size={18} />}>
            Abrir el Laboratorio
          </LinkButton>
        </div>
      </Card>
    </>
  );
}

export function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <div className="app">
          <main className="app-main">
            <GlobalBanners />
            <Routes>
              <Route path="/" element={<HomePage />} />
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
        </div>
      </ToastProvider>
    </HashRouter>
  );
}
