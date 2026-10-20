import { useId, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Portal, useModalBehavior } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Si se indica, el usuario debe escribir este texto para confirmar. */
  requireText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  danger = false,
  requireText,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const panelRef = useModalBehavior(open, onCancel);
  const titleId = useId();
  const inputId = useId();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  const canConfirm = !busy && (!requireText || typed.trim().toUpperCase() === requireText.toUpperCase());

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      setTyped('');
    }
  };

  return (
    <Portal>
      <div className="overlay">
        <div ref={panelRef} className="dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
          <h2 id={titleId}>{title}</h2>
          <div className="muted">{message}</div>
          {requireText && (
            <div className="field">
              <label className="field-label" htmlFor={inputId}>
                Escribe {requireText} para confirmar
              </label>
              <input
                id={inputId}
                className="input"
                autoComplete="off"
                autoCapitalize="characters"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                data-autofocus
              />
            </div>
          )}
          <div className="dialog-actions">
            <Button variant={danger ? 'danger' : 'primary'} block disabled={!canConfirm} onClick={confirm}>
              {confirmLabel}
            </Button>
            <Button
              variant="secondary"
              block
              onClick={() => {
                setTyped('');
                onCancel();
              }}
              data-autofocus={requireText ? undefined : true}
            >
              {cancelLabel}
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
