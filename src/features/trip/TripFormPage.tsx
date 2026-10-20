import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { timeZoneOptions, tzLabel } from '../../models/datetime';
import { DEFAULT_TZ } from '../../models/types';
import { getDb } from '../../storage/db';
import { getTrip, saveTrip, validateTrip, type TripInput } from '../../storage/trips';
import { ValidationError, type FieldErrors } from '../../storage/validation';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { SelectField, TextField } from '../../ui/Field';
import { PageHeader } from '../../ui/PageHeader';
import { ErrorState, LoadingState, errorMessage } from '../../ui/States';
import { useToast } from '../../ui/Toast';

export function TripFormPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const zones = useMemo(() => timeZoneOptions(), []);
  const [loaded, setLoaded] = useState<'loading' | 'ok' | { error: unknown }>('loading');
  const [isNew, setIsNew] = useState(true);
  const [form, setForm] = useState<TripInput>({ name: '', startDate: '', endDate: '', cities: [], tz: DEFAULT_TZ });
  const [citiesText, setCitiesText] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getTrip(getDb())
      .then((trip) => {
        if (trip) {
          setIsNew(false);
          setForm({ name: trip.name, startDate: trip.startDate, endDate: trip.endDate, cities: trip.cities, tz: trip.tz });
          setCitiesText(trip.cities.join(', '));
        }
        setLoaded('ok');
      })
      .catch((error: unknown) => setLoaded({ error }));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const input = { ...form, cities: citiesText.split(',').map((c) => c.trim()).filter(Boolean) };
    const errs = validateTrip(input);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await saveTrip(getDb(), input);
      toast.show(isNew ? 'Viaje creado' : 'Viaje guardado');
      navigate('/');
    } catch (err) {
      if (err instanceof ValidationError) setErrors(err.errors);
      else toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title={isNew ? 'Crear viaje' : 'Editar viaje'} back="/" />
      {loaded === 'loading' && <LoadingState />}
      {typeof loaded === 'object' && <ErrorState error={loaded.error} />}
      {loaded === 'ok' && (
        <form onSubmit={submit} className="stack-lg" noValidate>
          <Card>
            <div className="stack">
              <TextField label="Nombre del viaje" value={form.name} onChange={(name) => setForm({ ...form, name })} error={errors.name} required autoComplete="off" />
              <div className="input-row">
                <TextField label="Inicio" type="date" value={form.startDate} onChange={(startDate) => setForm({ ...form, startDate })} error={errors.startDate} required />
                <TextField label="Fin" type="date" value={form.endDate} onChange={(endDate) => setForm({ ...form, endDate })} error={errors.endDate} required />
              </div>
              <TextField
                label="Ciudades"
                hint="Separadas por comas. Luego asignas una ciudad a cada día en el Itinerario."
                value={citiesText}
                onChange={setCitiesText}
                autoComplete="off"
              />
              <SelectField
                label="Zona horaria del viaje"
                value={form.tz}
                options={zones.map((z) => ({ value: z, label: `${z.replace(/_/g, ' ')} (${tzLabel(z)})` }))}
                onChange={(tz) => setForm({ ...form, tz })}
                error={errors.tz}
                hint="Se usa para la cuenta atrás, el día actual y las nuevas actividades."
              />
            </div>
          </Card>
          <Button type="submit" variant="primary" block disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar viaje'}
          </Button>
        </form>
      )}
    </>
  );
}
