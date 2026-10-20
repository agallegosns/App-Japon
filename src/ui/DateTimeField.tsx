import { useId, useMemo } from 'react';
import { timeZoneOptions, tzLabel } from '../models/datetime';
import type { LocalDateTime } from '../models/types';

interface DateTimeFieldProps {
  label: string;
  value: LocalDateTime | null;
  onChange: (value: LocalDateTime | null) => void;
  defaultTz: string;
  error?: string;
  hint?: string;
  /** Mostrar selector de zona horaria (vuelos: origen/destino). */
  showTz?: boolean;
  /** Ocultar la hora (solo fecha). */
  dateOnly?: boolean;
}

/** Selector de fecha + hora local + zona IANA. Vacío = null. */
export function DateTimeField({ label, value, onChange, defaultTz, error, hint, showTz = false, dateOnly = false }: DateTimeFieldProps) {
  const id = useId();
  const zones = useMemo(() => timeZoneOptions(), []);
  const tz = value?.tz ?? defaultTz;
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(' ') || undefined;

  const set = (patch: Partial<LocalDateTime>) => {
    const next: LocalDateTime = { date: value?.date ?? '', time: value?.time ?? null, tz, ...patch };
    if (!next.date) onChange(null);
    else onChange(next);
  };

  return (
    <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }} aria-describedby={describedBy}>
      <legend className="field-label" style={{ padding: 0, marginBottom: 'var(--sp-1)' }}>
        {label}
      </legend>
      <div className={dateOnly ? undefined : 'input-row'}>
        <input
          id={`${id}-date`}
          type="date"
          className="input"
          aria-label={`${label}: fecha`}
          aria-invalid={error ? true : undefined}
          value={value?.date ?? ''}
          onChange={(e) => set({ date: e.target.value })}
        />
        {!dateOnly && (
          <input
            id={`${id}-time`}
            type="time"
            className="input"
            aria-label={`${label}: hora`}
            aria-invalid={error ? true : undefined}
            value={value?.time ?? ''}
            disabled={!value?.date}
            onChange={(e) => set({ time: e.target.value || null })}
          />
        )}
      </div>
      {showTz && (
        <select
          className="input"
          aria-label={`${label}: zona horaria`}
          value={tz}
          onChange={(e) => (value ? set({ tz: e.target.value }) : undefined)}
          disabled={!value?.date}
        >
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replace(/_/g, ' ')} ({tzLabel(z)})
            </option>
          ))}
        </select>
      )}
      {hint && (
        <span id={`${id}-hint`} className="field-hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-err`} className="field-error" role="alert">
          {error}
        </span>
      )}
    </fieldset>
  );
}
