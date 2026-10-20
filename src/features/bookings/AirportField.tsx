import { useState } from 'react';
import { airportLabel, searchAirports } from '../../models/airports';
import { searchStations } from '../../models/stations';
import { FieldShell } from '../../ui/Field';

interface Option {
  key: string;
  label: string;
  title: string;
  subtitle: string;
  tz: string;
}

interface Props {
  label: string;
  value: string;
  /** Qué se busca: aeropuertos (vuelos) o estaciones (trenes). */
  kind?: 'airport' | 'station';
  /** Recibe el texto y, si se eligió un resultado de la lista, su zona horaria. */
  onChange: (value: string, tz: string | null) => void;
  error?: string;
  hint?: string;
}

function options(kind: 'airport' | 'station', query: string): Option[] {
  if (kind === 'station')
    return searchStations(query).map((s) => ({ key: s.name, label: s.name, title: s.name, subtitle: `${s.jp} · ${s.city}`, tz: 'Asia/Tokyo' }));
  return searchAirports(query).map((a) => ({
    key: a.code,
    label: airportLabel(a),
    title: `${a.city} (${a.code})`,
    subtitle: `${a.name} · ${a.country}`,
    tz: a.tz,
  }));
}

/**
 * Campo de aeropuerto o estación con buscador (sin conexión). Se puede escribir cualquier texto:
 * si no está en la lista, se guarda tal cual.
 */
export function AirportField({ label, value, kind = 'airport', onChange, error, hint }: Props) {
  const [open, setOpen] = useState(false);
  const results = open ? options(kind, value) : [];
  const exact = results.length === 1 && results[0]?.label === value;
  const showList = results.length > 0 && !exact;

  return (
    <div className="stack" style={{ gap: 'var(--sp-1)' }}>
      <FieldShell label={label} hint={hint} error={error}>
        {({ id, describedBy }) => (
          <input
            id={id}
            className="input"
            value={value}
            placeholder={kind === 'station' ? 'Busca la estación (p. ej. Kioto, Shin-Osaka)' : 'Busca por ciudad, país o código (p. ej. Hong Kong, HKG)'}
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
          {results.map((o) => (
            <li key={o.key} role="option" aria-selected={false}>
              <button
                type="button"
                className="list-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(o.label, o.tz);
                  setOpen(false);
                }}
              >
                <span className="grow">
                  <strong>{o.title}</strong>
                  <span className="muted small" style={{ display: 'block' }}>
                    {o.subtitle}
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
