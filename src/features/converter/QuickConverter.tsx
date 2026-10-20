import { ArrowLeftRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BottomSheet } from '../../ui/BottomSheet';
import { ConverterPanel } from './ConverterPanel';

/** Botón «¥ ⇄ €» del menú superior: abre el conversor sin salir de la pantalla en la que estás. */
export function QuickConverter() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="fx-pill" onClick={() => setOpen(true)} aria-label="Abrir el conversor de yenes y euros">
        <span aria-hidden="true">¥</span>
        <ArrowLeftRight size={14} aria-hidden="true" />
        <span aria-hidden="true">€</span>
      </button>
      <BottomSheet open={open} title="Yenes y euros" onClose={() => setOpen(false)}>
        <div className="stack">
          <ConverterPanel showRate />
          <Link to="/conversor" className="btn btn-secondary btn-block" onClick={() => setOpen(false)}>
            Abrir el conversor completo
          </Link>
        </div>
      </BottomSheet>
    </>
  );
}
