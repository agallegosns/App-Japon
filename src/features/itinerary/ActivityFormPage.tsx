import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { formatDateShort, isValidDate, nowInZone, tzLabel } from '../../models/datetime';
import { ACTIVITY_STATUS_LABEL, CATEGORY_LABEL } from '../../models/labels';
import { ACTIVITY_STATUSES, DEFAULT_TZ, type Booking, type Day, type MapRef } from '../../models/types';
import { createActivity, emptyActivity, getActivity, updateActivity, validateActivity, type ActivityInput } from '../../storage/activities';
import { listBookings } from '../../storage/bookings';
import { getDb } from '../../storage/db';
import { getTrip, listDays } from '../../storage/trips';
import { ValidationError, type FieldErrors } from '../../storage/validation';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { SelectField, TextArea, TextField } from '../../ui/Field';
import { PageHeader } from '../../ui/PageHeader';
import { ErrorState, LoadingState, errorMessage } from '../../ui/States';
import { useToast } from '../../ui/Toast';

type MapKind = 'none' | 'coords' | 'url';

export function ActivityFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | { error: unknown }>('loading');
  const [days, setDays] = useState<Day[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [form, setForm] = useState<ActivityInput>(() => emptyActivity(''));
  const [durationText, setDurationText] = useState('');
  const [mapKind, setMapKind] = useState<MapKind>('none');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const db = getDb();
    (async () => {
      const trip = await getTrip(db);
      const [ds, bs, existing] = await Promise.all([
        trip ? listDays(db, trip.id) : Promise.resolve([]),
        listBookings(db),
        id ? getActivity(db, id) : Promise.resolve(undefined),
      ]);
      setDays(ds);
      setBookings(bs);
      if (id && !existing) return setState('missing');
      if (existing) {
        const { id: _i, order: _o, createdAt: _c, updatedAt: _u, ...input } = existing;
        void [_i, _o, _c, _u];
        setForm(input);
        setDurationText(existing.durationMin ? String(existing.durationMin) : '');
        if (existing.mapRef?.type === 'coords') {
          setMapKind('coords');
          setLat(String(existing.mapRef.lat));
          setLng(String(existing.mapRef.lng));
        } else if (existing.mapRef?.type === 'url') {
          setMapKind('url');
          setMapUrl(existing.mapRef.url);
        }
      } else {
        const tz = trip?.tz ?? DEFAULT_TZ;
        const requested = params.get('fecha');
        const today = nowInZone(tz).date;
        const date =
          requested && isValidDate(requested) ? requested : ds.some((d) => d.date === today) ? today : (ds[0]?.date ?? today);
        setForm(emptyActivity(date, tz));
      }
      setState('ok');
    })().catch((error: unknown) => setState({ error }));
  }, [id, params]);

  const set = <K extends keyof ActivityInput>(key: K, value: ActivityInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const extra: FieldErrors = {};
    let durationMin: number | null = null;
    if (durationText.trim()) {
      durationMin = Number(durationText.trim());
      if (!Number.isInteger(durationMin)) extra.durationMin = 'Escribe los minutos como número entero.';
    }
    let mapRef: MapRef | null = null;
    if (mapKind === 'coords') {
      const la = Number(lat.replace(',', '.'));
      const ln = Number(lng.replace(',', '.'));
      if (!lat.trim() || !lng.trim() || Number.isNaN(la) || Number.isNaN(ln)) extra.mapRef = 'Escribe latitud y longitud (p. ej. 35.0116 y 135.7681).';
      else mapRef = { type: 'coords', lat: la, lng: ln };
    } else if (mapKind === 'url') {
      mapRef = { type: 'url', url: mapUrl.trim() };
    }
    const input: ActivityInput = { ...form, durationMin, mapRef };
    const errs = { ...validateActivity(input), ...extra };
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error('Revisa los campos marcados.');
      return;
    }
    setSaving(true);
    try {
      const saved = id ? await updateActivity(getDb(), id, input) : await createActivity(getDb(), input);
      toast.show(id ? 'Actividad guardada' : 'Actividad añadida');
      navigate(`/itinerario?fecha=${saved.date}`, { replace: true });
    } catch (err) {
      if (err instanceof ValidationError) setErrors(err.errors);
      else toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const dayOptions = days.some((d) => d.date === form.date) || !form.date ? days : [...days, { id: 'x', tripId: '', date: form.date, city: '' }];

  return (
    <>
      <PageHeader title={id ? 'Editar actividad' : 'Nueva actividad'} back={true} />
      {state === 'loading' && <LoadingState />}
      {state === 'missing' && <ErrorState error="La actividad no existe o se ha eliminado." />}
      {typeof state === 'object' && <ErrorState error={state.error} />}
      {state === 'ok' && (
        <form onSubmit={submit} className="stack-lg" noValidate>
          <Card>
            <div className="stack">
              <TextField label="Título" value={form.title} onChange={(v) => set('title', v)} error={errors.title} autoComplete="off" />
              {dayOptions.length > 0 ? (
                <SelectField
                  label="Día"
                  value={form.date}
                  options={dayOptions.map((d) => ({ value: d.date, label: `${formatDateShort(d.date)}${d.city ? ` · ${d.city}` : ''}` }))}
                  onChange={(v) => set('date', v)}
                  error={errors.date}
                />
              ) : (
                <TextField label="Fecha" type="date" value={form.date} onChange={(v) => set('date', v)} error={errors.date} />
              )}
              <div className="input-row">
                <TextField label="Hora inicio" type="time" value={form.startTime ?? ''} onChange={(v) => set('startTime', v || null)} error={errors.startTime} />
                <TextField label="Hora fin" type="time" value={form.endTime ?? ''} onChange={(v) => set('endTime', v || null)} error={errors.endTime} />
              </div>
              <TextField
                label="Duración estimada (minutos)"
                inputMode="numeric"
                value={durationText}
                onChange={setDurationText}
                error={errors.durationMin}
                hint={`Horas en ${form.tz.replace(/_/g, ' ')} (${tzLabel(form.tz)}).`}
              />
              <SelectField
                label="Estado"
                value={form.status}
                options={ACTIVITY_STATUSES.map((v) => ({ value: v, label: ACTIVITY_STATUS_LABEL[v] }))}
                onChange={(v) => set('status', v)}
              />
            </div>
          </Card>

          <Card title="Ubicación">
            <div className="stack">
              <TextField label="Lugar" value={form.location} onChange={(v) => set('location', v)} autoComplete="off" />
              <TextArea label="Dirección" value={form.address} onChange={(v) => set('address', v)} rows={2} />
              <TextArea label="Dirección en japonés" lang="ja" value={form.addressJa} onChange={(v) => set('addressJa', v)} rows={2} />
              <SelectField<MapKind>
                label="Referencia de mapa"
                value={mapKind}
                options={[
                  { value: 'none', label: 'Ninguna' },
                  { value: 'coords', label: 'Coordenadas' },
                  { value: 'url', label: 'Enlace' },
                ]}
                onChange={setMapKind}
                error={mapKind === 'none' ? undefined : errors.mapRef}
              />
              {mapKind === 'coords' && (
                <div className="input-row">
                  <TextField label="Latitud" inputMode="decimal" value={lat} onChange={setLat} placeholder="35.0116" />
                  <TextField label="Longitud" inputMode="decimal" value={lng} onChange={setLng} placeholder="135.7681" />
                </div>
              )}
              {mapKind === 'url' && (
                <TextField label="Enlace de mapa" type="url" inputMode="url" autoCapitalize="none" value={mapUrl} onChange={setMapUrl} placeholder="https://" />
              )}
            </div>
          </Card>

          <Card title="Más">
            <div className="stack">
              <SelectField
                label="Reserva relacionada"
                value={form.bookingId ?? ''}
                options={[{ value: '', label: 'Ninguna' }, ...bookings.map((b) => ({ value: b.id, label: `${b.name} (${CATEGORY_LABEL[b.category]})` }))]}
                onChange={(v) => set('bookingId', v || null)}
              />
              <TextArea label="Notas" value={form.notes} onChange={(v) => set('notes', v)} rows={3} />
            </div>
          </Card>

          <Button type="submit" variant="primary" block disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar actividad'}
          </Button>
        </form>
      )}
    </>
  );
}
