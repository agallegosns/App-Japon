import { useState } from 'react';
import { airportLabel, searchAirports, type Airport } from '../../models/airports';
import { FieldShell } from '../../ui/Field';

interface Props {
  label: string;
  value: string;
  onChange: (value: string, airport: Airport | null) => void;
  error?: string;
  hint?: string;
}

/**
 * Campo de aeropuerto/ciudad con buscador (sin conexión). Se puede escribir cualquier texto:
 * si no está en la lista, se guarda tal cual.
 */
export function AirportField({ label, value, onChange, error, hint }: Props) {
  const [open, setOpen] = useState(false);
  const results = open ? searchAirports(value) : [];
  const exact = results.length === 1 && airportLabel(results[0] as Airport) === value;
  const showList = results.length > 0 && !exact;

  return (
    <div className="stack" style={{ gap: 'var(--sp-1)' }}>
      <FieldShell label={label} hint={hint} error={error}>
        {({ id, describedBy }) => (
          <input
            id={id}
            className="input"
            value={value}
            placeholder="Busca por ciudad, país o código (p. ej. Hong Kong, HKG)"
            autoComplete="off"
            autoCapitalize="words"
            spellCheck={false}
            role="combobox"
            aria-expanded={showList}
            aria-autocomplete="list"
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onChange={(e) => {
              setOpen(true);
              onChange(e.target.value, null);
            }}
          />
        )}
      </FieldShell>
      {showList && (
        <ul className="list" role="listbox" aria-label={`Resultados para ${label}`} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {results.map((a) => (
            <li key={a.code} role="option" aria-selected={false}>
              <button
                type="button"
                className="list-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(airportLabel(a), a);
                  setOpen(false);
                }}
              >
                <span className="grow">
                  <strong>
                    {a.city} ({a.code})
                  </strong>
                  <span className="muted small" style={{ display: 'block' }}>
                    {a.name} · {a.country}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
