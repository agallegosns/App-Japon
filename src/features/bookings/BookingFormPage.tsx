import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BOOKING_STATUS_LABEL, CATEGORY_LABEL } from '../../models/labels';
import { BOOKING_CATEGORIES, BOOKING_STATUSES, DEFAULT_TZ, type BookingCategory } from '../../models/types';
import { createBooking, emptyBooking, getBooking, updateBooking, validateBooking, type BookingInput } from '../../storage/bookings';
import { getDb } from '../../storage/db';
import { getTrip } from '../../storage/trips';
import { ValidationError, type FieldErrors } from '../../storage/validation';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { DateTimeField } from '../../ui/DateTimeField';
import { SelectField, TextArea, TextField } from '../../ui/Field';
import { Notice } from '../../ui/Notice';
import { PageHeader } from '../../ui/PageHeader';
import { ErrorState, LoadingState, errorMessage } from '../../ui/States';
import { useToast } from '../../ui/Toast';

const CURRENCIES = ['EUR', 'JPY', 'USD', 'GBP'];

function startLabel(c: BookingCategory): string {
  switch (c) {
    case 'vuelo':
    case 'transporte':
      return 'Salida';
    case 'restaurante':
      return 'Fecha y hora de la reserva';
    default:
      return 'Fecha y hora';
  }
}

function arrivalLabel(c: BookingCategory): string {
  return c === 'vuelo' || c === 'transporte' ? 'Llegada' : 'Hora de llegada prevista';
}

export function BookingFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | { error: unknown }>('loading');
  const [tripTz, setTripTz] = useState(DEFAULT_TZ);
  const [form, setForm] = useState<BookingInput>(() => {
    const c = params.get('cat');
    return emptyBooking(BOOKING_CATEGORIES.includes(c as BookingCategory) ? (c as BookingCategory) : 'otro');
  });
  const [priceText, setPriceText] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const db = getDb();
    Promise.all([id ? getBooking(db, id) : Promise.resolve(undefined), getTrip(db)])
      .then(([booking, trip]) => {
        if (trip) setTripTz(trip.tz);
        if (id && !booking) return setState('missing');
        if (booking) {
          const { id: _i, sortAt: _s, createdAt: _c, updatedAt: _u, ...input } = booking;
          void [_i, _s, _c, _u];
          setForm(input);
          if (booking.price) {
            setPriceText(String(booking.price.amount).replace('.', ','));
            setCurrency(booking.price.currency);
          }
        }
        setState('ok');
      })
      .catch((error: unknown) => setState({ error }));
  }, [id]);

  const set = <K extends keyof BookingInput>(key: K, value: BookingInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    let price: BookingInput['price'] = null;
    const priceErrors: FieldErrors = {};
    if (priceText.trim()) {
      const amount = Number(priceText.replace(/\s/g, '').replace(',', '.'));
      if (!Number.isFinite(amount)) priceErrors.price = 'Escribe el precio como número (p. ej. 120,50).';
      else price = { amount, currency };
    }
    const input: BookingInput = { ...form, price };
    const errs = { ...validateBooking(input), ...priceErrors };
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error('Revisa los campos marcados.');
      return;
    }
    setSaving(true);
    try {
      const saved = id ? await updateBooking(getDb(), id, input) : await createBooking(getDb(), input);
      toast.show(id ? 'Reserva guardada' : 'Reserva creada');
      navigate(`/reservas/${saved.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ValidationError) setErrors(err.errors);
      else toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const c = form.category;
  const isTransport = c === 'vuelo' || c === 'transporte';

  return (
    <>
      <PageHeader title={id ? 'Editar reserva' : 'Nueva reserva'} back={id ? `/reservas/${id}` : '/reservas'} />
      {state === 'loading' && <LoadingState />}
      {state === 'missing' && <ErrorState error="La reserva no existe o se ha eliminado." />}
      {typeof state === 'object' && <ErrorState error={state.error} />}
      {state === 'ok' && (
        <form onSubmit={submit} className="stack-lg" noValidate>
          <Card>
            <div className="stack">
              <SelectField
                label="Categoría"
                value={c}
                options={BOOKING_CATEGORIES.map((v) => ({ value: v, label: CATEGORY_LABEL[v] }))}
                onChange={(v) => set('category', v)}
              />
              <TextField
                label="Nombre"
                value={form.name}
                onChange={(v) => set('name', v)}
                error={errors.name}
                placeholder={c === 'vuelo' ? 'Compañía, número de vuelo, origen → destino' : undefined}
                autoComplete="off"
              />
              <SelectField
                label="Estado"
                value={form.status}
                options={BOOKING_STATUSES.map((v) => ({ value: v, label: BOOKING_STATUS_LABEL[v] }))}
                onChange={(v) => set('status', v)}
              />
            </div>
          </Card>

          <Card title="Fechas">
            <div className="stack">
              {c === 'alojamiento' ? (
                <>
                  <DateTimeField label="Check-in" value={form.checkIn} onChange={(v) => set('checkIn', v)} defaultTz={tripTz} error={errors.checkIn} />
                  <DateTimeField label="Check-out" value={form.checkOut} onChange={(v) => set('checkOut', v)} defaultTz={tripTz} error={errors.checkOut} />
                  <DateTimeField label={arrivalLabel(c)} value={form.arrival} onChange={(v) => set('arrival', v)} defaultTz={tripTz} error={errors.arrival} />
                </>
              ) : (
                <>
                  <DateTimeField
                    label={startLabel(c)}
                    value={form.start}
                    onChange={(v) => set('start', v)}
                    defaultTz={isTransport ? form.start?.tz ?? tripTz : tripTz}
                    showTz={isTransport}
                    hint={isTransport ? 'Hora local y zona horaria del origen.' : undefined}
                    error={errors.start}
                  />
                  <DateTimeField
                    label={arrivalLabel(c)}
                    value={form.arrival}
                    onChange={(v) => set('arrival', v)}
                    defaultTz={tripTz}
                    showTz={isTransport}
                    hint={isTransport ? 'Hora local y zona horaria del destino.' : undefined}
                    error={errors.arrival}
                  />
                </>
              )}
            </div>
          </Card>

          <Card title="Lugar y contacto">
            <div className="stack">
              <TextArea label="Dirección" value={form.address} onChange={(v) => set('address', v)} rows={2} />
              <TextArea
                label="Dirección en japonés"
                value={form.addressJa}
                onChange={(v) => set('addressJa', v)}
                rows={2}
                lang="ja"
                hint="Para enseñarla a un taxista o en la recepción."
              />
              <TextField label="Teléfono" type="tel" value={form.phone} onChange={(v) => set('phone', v)} autoComplete="off" />
              <TextField label="Contacto" value={form.contact} onChange={(v) => set('contact', v)} autoComplete="off" />
            </div>
          </Card>

          <Card title="Reserva">
            <div className="stack">
              <TextField
                label="Localizador"
                value={form.confirmationCode}
                onChange={(v) => set('confirmationCode', v)}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
              />
              <div className="input-row">
                <TextField label="Precio (opcional)" inputMode="decimal" value={priceText} onChange={setPriceText} error={errors.price} autoComplete="off" />
                <SelectField label="Moneda" value={currency} options={CURRENCIES.map((v) => ({ value: v, label: v }))} onChange={setCurrency} />
              </div>
              <TextArea label="Notas" value={form.notes} onChange={(v) => set('notes', v)} rows={3} />
            </div>
          </Card>

          <Card title="Enlaces externos">
            <div className="stack">
              {form.links.length === 0 && <p className="muted small">Sin enlaces.</p>}
              {form.links.map((l, i) => (
                <div key={i} className="stack" style={{ gap: 'var(--sp-2)', paddingBottom: 'var(--sp-3)', borderBottom: '1px solid var(--c-border)' }}>
                  <TextField
                    label={`Enlace ${i + 1}: texto`}
                    value={l.label}
                    onChange={(v) => set('links', form.links.map((x, j) => (j === i ? { ...x, label: v } : x)))}
                    autoComplete="off"
                  />
                  <TextField
                    label={`Enlace ${i + 1}: dirección web`}
                    type="url"
                    inputMode="url"
                    value={l.url}
                    placeholder="https://"
                    onChange={(v) => set('links', form.links.map((x, j) => (j === i ? { ...x, url: v } : x)))}
                    error={errors[`links.${i}`]}
                    autoComplete="off"
                    autoCapitalize="none"
                  />
                  <Button variant="ghost" small icon={<Trash2 size={16} />} onClick={() => set('links', form.links.filter((_, j) => j !== i))}>
                    Quitar enlace
                  </Button>
                </div>
              ))}
              <Button variant="secondary" icon={<Plus size={18} />} onClick={() => set('links', [...form.links, { label: '', url: '' }])}>
                Añadir enlace
              </Button>
            </div>
          </Card>

          {!id && <Notice tone="info">Los adjuntos (PDF, capturas y códigos QR) se añaden desde la ficha de la reserva, después de guardarla.</Notice>}

          <Button type="submit" variant="primary" block disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar reserva'}
          </Button>
        </form>
      )}
    </>
  );
}
