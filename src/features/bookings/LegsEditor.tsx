import { Plane, Plus, TrainFront, Trash2 } from 'lucide-react';
import { airportFromLabel } from '../../models/airports';
import { emptyLeg, formatMinutes, layoverMinutes, SHORT_TRANSFER_MIN } from '../../models/flights';
import { FARE_LABEL } from '../../models/labels';
import { LEG_FARES, type FlightLeg, type LegFare } from '../../models/types';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { DateTimeField } from '../../ui/DateTimeField';
import { SelectField, TextField } from '../../ui/Field';
import { AirportField } from './AirportField';

interface Props {
  kind: 'vuelo' | 'transporte';
  legs: FlightLeg[];
  onChange: (legs: FlightLeg[]) => void;
  errors: Record<string, string>;
  tripTz: string;
}

/** Editor de tramos: vuelos con escalas (aeropuertos) o trenes con transbordos (estaciones, vagón, asiento y billete). */
export function LegsEditor({ kind, legs, onChange, errors, tripTz }: Props) {
  const isTrain = kind === 'transporte';
  const noun = isTrain ? 'Trayecto' : 'Tramo';
  const tzOf = (label: string): string | undefined => (isTrain ? 'Asia/Tokyo' : airportFromLabel(label)?.tz);
  const set = (i: number, patch: Partial<FlightLeg>) => onChange(legs.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <Card title={isTrain ? 'Trayectos del tren' : 'Tramos del vuelo'}>
      <div className="stack">
        <p className="muted small">
          {isTrain
            ? 'Añade un trayecto por cada tren. Si cambias de tren, añade otro trayecto. Las horas son las locales de cada estación.'
            : 'Añade un tramo por cada despegue. Un vuelo con una escala tiene dos tramos. Las horas son siempre las locales del aeropuerto.'}
        </p>
        {legs.map((leg, i) => {
          const prev = legs[i - 1];
          const gap = prev ? layoverMinutes(prev, leg) : null;
          const short = isTrain && gap !== null && gap >= 0 && gap < SHORT_TRANSFER_MIN;
          return (
            <div key={leg.id} className="stack" style={{ paddingBottom: 'var(--sp-3)', borderBottom: '1px solid var(--c-border)' }}>
              {prev && (
                <p className={gap !== null && gap < 0 ? 'field-error' : short ? 'warn-text' : 'muted small'}>
                  {isTrain ? 'Transbordo' : 'Escala'} en {prev.to || (isTrain ? 'la estación' : 'la escala')}
                  {gap !== null ? `: ${formatMinutes(gap)}${short ? ' (muy justo)' : ''}` : ' (rellena las horas para ver cuánto dura)'}
                </p>
              )}
              <p style={{ fontWeight: 600 }}>
                {isTrain ? <TrainFront size={16} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> : <Plane size={16} aria-hidden="true" style={{ verticalAlign: '-2px' }} />}{' '}
                {noun} {i + 1}
              </p>
              <AirportField
                kind={isTrain ? 'station' : 'airport'}
                label={`${noun} ${i + 1}: origen`}
                value={leg.from}
                onChange={(v, tz) => set(i, { from: v, ...(tz && leg.depart ? { depart: { ...leg.depart, tz } } : {}) })}
              />
              <AirportField
                kind={isTrain ? 'station' : 'airport'}
                label={`${noun} ${i + 1}: destino`}
                value={leg.to}
                onChange={(v, tz) => set(i, { to: v, ...(tz && leg.arrive ? { arrive: { ...leg.arrive, tz } } : {}) })}
              />
              <TextField
                label={isTrain ? `${noun} ${i + 1}: tren o servicio (opcional)` : `${noun} ${i + 1}: número de vuelo (opcional)`}
                value={leg.flightNumber}
                onChange={(v) => set(i, { flightNumber: v })}
                autoCapitalize={isTrain ? 'words' : 'characters'}
                autoComplete="off"
                spellCheck={false}
                placeholder={isTrain ? 'Nozomi 25, Hikari 503, Haruka…' : undefined}
              />
              {isTrain && (
                <>
                  <SelectField<LegFare | ''>
                    label={`${noun} ${i + 1}: tipo de billete`}
                    value={leg.fare}
                    options={[{ value: '', label: 'Sin indicar' }, ...LEG_FARES.map((f) => ({ value: f, label: FARE_LABEL[f] }))]}
                    onChange={(v) => set(i, { fare: v })}
                    hint="La Suica sirve para metro y trenes locales; el Shinkansen suele necesitar billete aparte."
                  />
                  {leg.fare !== 'suica' && (
                    <div className="input-row">
                      <TextField label={`${noun} ${i + 1}: vagón`} value={leg.car} onChange={(v) => set(i, { car: v })} autoComplete="off" placeholder="7" />
                      <TextField
                        label={`${noun} ${i + 1}: asiento`}
                        value={leg.seat}
                        onChange={(v) => set(i, { seat: v })}
                        autoComplete="off"
                        autoCapitalize="characters"
                        placeholder="12A"
                      />
                    </div>
                  )}
                </>
              )}
              <DateTimeField
                label={`${noun} ${i + 1}: salida`}
                value={leg.depart}
                onChange={(v) => set(i, { depart: v })}
                defaultTz={tzOf(leg.from) ?? prev?.arrive?.tz ?? tripTz}
                showTz={!isTrain}
                hint={isTrain ? 'Hora local de la estación de salida.' : 'Hora local del aeropuerto de origen.'}
                error={errors[`legs.${i}.depart`]}
              />
              <DateTimeField
                label={`${noun} ${i + 1}: llegada`}
                value={leg.arrive}
                onChange={(v) => set(i, { arrive: v })}
                defaultTz={tzOf(leg.to) ?? tripTz}
                showTz={!isTrain}
                hint={isTrain ? 'Hora local de la estación de llegada.' : 'Hora local del aeropuerto de destino.'}
                error={errors[`legs.${i}.arrive`]}
              />
              {legs.length > 1 && (
                <Button variant="ghost" small icon={<Trash2 size={16} />} onClick={() => onChange(legs.filter((_, j) => j !== i))}>
                  Quitar {noun.toLowerCase()} {i + 1}
                </Button>
              )}
            </div>
          );
        })}
        <Button
          variant="secondary"
          icon={<Plus size={18} />}
          onClick={() => {
            const last = legs[legs.length - 1];
            onChange([...legs, { ...emptyLeg(), from: last?.to ?? '', fare: isTrain ? (last?.fare ?? '') : '' }]);
          }}
        >
          {isTrain ? 'Añadir transbordo (otro trayecto)' : 'Añadir escala (otro tramo)'}
        </Button>
      </div>
    </Card>
  );
}
