import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './Button';

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  /** Ruta a la que volver; si es true, vuelve en el historial. */
  back?: string | true;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, back, actions }: PageHeaderProps) {
  const navigate = useNavigate();
  return (
    <header className="page-header">
      <div className="page-header-row">
        {back && (
          <Button
            variant="ghost"
            icon={<ChevronLeft size={26} />}
            label="Volver"
            onClick={() => {
              if (back === true) {
                if (window.history.length > 1) navigate(-1);
                else navigate('/');
              } else navigate(back);
            }}
            className="page-back"
          />
        )}
        <div className="grow">
          <h1>{title}</h1>
          {subtitle && <p className="muted small">{subtitle}</p>}
        </div>
        {actions && <div className="row">{actions}</div>}
      </div>
    </header>
  );
}
