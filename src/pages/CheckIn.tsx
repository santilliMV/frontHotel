import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { guestsApi, checkInApi, roomsApi } from '../api/hotel-api';
import type {
  GuestResponse, GuestRequest, CheckInResponse,
  AvailableRoom, RoomTypeOption, CompanionRequest, PriceResponse,
} from '../api/hotel-api';
import { COLOMBIA_CITIES, COUNTRIES, DOC_TYPES, DOC_TYPES_SHORT, PAYMENT_METHODS } from '../constants';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PrefillData {
  roomTypeId?: string;
  roomId?: string;
  checkInDate?: string;
  checkOutDate?: string;
  numberOfGuests?: number;
  occupantType?: 'INDIVIDUAL' | 'PAREJA' | 'MULTIPLE_PERSON';
}

interface PaymentEntry {
  method: string;
  amount: string;
}

type Step = 'guest' | 'room' | 'companions' | 'payment' | 'confirm' | 'success';

const STEPS: { key: Step; label: string }[] = [
  { key: 'guest', label: 'Huésped' },
  { key: 'room', label: 'Habitación' },
  { key: 'companions', label: 'Acompañantes' },
  { key: 'payment', label: 'Pago' },
  { key: 'confirm', label: 'Confirmar' },
];

const OCCUPANT_LABELS: Record<string, string> = {
  INDIVIDUAL: 'Individual', PAREJA: 'Pareja', MULTIPLE_PERSON: 'Múltiple',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isEarlyHour = () => new Date().getHours() < 7;
const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const today = () => toLocalDateStr(new Date());
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return toLocalDateStr(d); };
const fmtCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');
const nightCount = (ci: string, co: string) =>
  !ci || !co ? 0 : Math.max(0, Math.round(
    (new Date(co + 'T12:00:00').getTime() - new Date(ci + 'T12:00:00').getTime()) / 86400000
  ));

function validateReservationPayload(payload: {
  firstName?: string; phone?: string; roomTypeId?: string;
  checkInDate?: string; checkOutDate?: string; numberOfGuests?: number; occupantType?: string;
}): string | null {
  if (!payload.firstName?.trim()) return 'El huésped debe tener nombre';
  if (!payload.phone?.trim()) return 'El huésped debe tener teléfono';
  if (!payload.roomTypeId) return 'Debes seleccionar un tipo de habitación';
  if (!payload.checkInDate) return 'La fecha de entrada es obligatoria';
  if (!payload.checkOutDate) return 'La fecha de salida es obligatoria';
  if (!payload.numberOfGuests || payload.numberOfGuests < 1) return 'El número de huéspedes es inválido';
  if (!payload.occupantType) return 'El tipo de ocupante es obligatorio';
  return null;
}

// ─── EarlyModal ───────────────────────────────────────────────────────────────

function EarlyModal({ onSelect, onCancel }: {
  onSelect: (o: 'PREVIOUS_NIGHT' | 'CURRENT_NIGHT') => void;
  onCancel: () => void;
}) {
  const now = new Date(); const prev = new Date(now); prev.setDate(prev.getDate() - 1);
  const dn = (d: Date) => d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <span className="inline-block bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full border border-blue-200 mb-3">
          🌙 Early Check-in — {now.toTimeString().slice(0, 5)}
        </span>
        <h2 className="text-lg font-bold text-slate-800 mb-1">¿Qué noche se cobra?</h2>
        <p className="text-sm text-slate-500 mb-5">El cliente llega antes de las 7:00 AM. Selecciona la noche a facturar:</p>
        <div className="flex flex-col gap-3">
          {[
            { opt: 'PREVIOUS_NIGHT' as const, icon: '📅', label: 'Noche anterior', sub: dn(prev) },
            { opt: 'CURRENT_NIGHT' as const, icon: '🌅', label: 'Noche actual', sub: dn(now) },
          ].map(({ opt, icon, label, sub }) => (
            <button key={opt}
              onClick={() => onSelect(opt)}
              className="flex items-center gap-3 border border-slate-200 rounded-xl p-4 hover:border-slate-800 hover:bg-slate-50 transition-all text-left">
              <span className="text-2xl">{icon}</span>
              <div className="flex-1">
                <span className="block font-semibold text-slate-800 text-sm">{label}</span>
                <span className="text-xs text-slate-500">{sub}</span>
              </div>
              <span className="text-slate-400">→</span>
            </button>
          ))}
        </div>
        <button onClick={onCancel} className="mt-4 w-full text-center text-sm text-slate-400 hover:text-slate-600 py-2">
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── SuccessScreen ────────────────────────────────────────────────────────────

function SuccessScreen({ result, payments, totalPaid, onReset }: {
  result: CheckInResponse; payments: PaymentEntry[]; totalPaid: number; onReset: () => void;
}) {
  const validPayments = payments.filter(p => parseFloat(p.amount) > 0);
  return (
    <div className="text-center py-4">
      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 border-4 border-emerald-200">✓</div>
      <h2 className="text-xl font-bold text-slate-800 mb-6">¡Check-in completado!</h2>
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-left max-w-sm mx-auto mb-6">
        <div className="text-3xl font-black text-slate-800 tracking-tight">HAB {result.roomNumber}</div>
        <div className="text-sm text-slate-500 mb-4">{result.roomTypeName} · Piso {result.floor}</div>
        <div className="border-t border-slate-200 pt-3 space-y-2">
          {[
            ['Huésped', result.guestName],
            ['Teléfono', result.guestPhone],
            ['Reserva', result.reservationNumber],
            ['Toallas', `${result.towelsDelivered} 🛁`],
            ['Hora entrada', new Date(result.checkInDateTime).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })],
            ...(result.isEarlyCheckIn ? [['Early check-in', result.earlyCheckInOption === 'PREVIOUS_NIGHT' ? '🌙 Noche anterior' : '🌅 Noche actual']] : []),
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between items-center">
              <span className="text-xs text-slate-500">{k}</span>
              <span className="text-sm font-medium text-slate-700">{v}</span>
            </div>
          ))}
        </div>
        {validPayments.length > 0 && (
          <div className="border-t border-slate-200 mt-3 pt-3 space-y-2">
            {validPayments.map((p, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-xs text-slate-500">{PAYMENT_METHODS.find(m => m.value === p.method)?.label}</span>
                <span className="text-sm font-medium text-emerald-600">{fmtCOP(parseFloat(p.amount))}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-200 pt-2 mt-1">
              <span className="text-sm font-semibold text-slate-700">Total abonado</span>
              <span className="text-sm font-bold text-emerald-600">{fmtCOP(totalPaid)}</span>
            </div>
          </div>
        )}
        {validPayments.length === 0 && (
          <div className="border-t border-slate-200 mt-3 pt-3 flex justify-between">
            <span className="text-xs text-slate-500">Pago</span>
            <span className="text-sm text-amber-600 font-medium">Sin abono — queda debiendo</span>
          </div>
        )}
      </div>
      <button onClick={onReset}
        className="w-full max-w-sm mx-auto block px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors">
        Nuevo check-in
      </button>
    </div>
  );
}

// ─── CreateGuestModal ─────────────────────────────────────────────────────────

function CreateGuestModal({ onCreated, onCancel }: {
  onCreated: (g: GuestResponse) => void; onCancel: () => void;
}) {
  const [form, setForm] = useState<GuestRequest>({
    firstName: '', lastName: '', phone: '', documentType: undefined,
    documentNumber: '', address: '', city: '', country: 'Colombia',
    occupation: '', vehiclePlate: '', observations: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof GuestRequest, v: string) => setForm(f => ({ ...f, [k]: v || undefined }));

  const handleSave = async () => {
    if (!form.firstName || !form.phone) { setError('Nombre y teléfono son obligatorios'); return; }
    if (!form.documentType || !form.documentNumber) { setError('Tipo y número de documento son obligatorios'); return; }
    setSaving(true); setError('');
    try { onCreated(await guestsApi.create(form)); }
    catch (e: any) { setError(e?.response?.data?.message || 'Error al crear huésped'); }
    finally { setSaving(false); }
  };

  const fi = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 placeholder:text-slate-400";
  const fl = "text-xs text-slate-500 mb-1 block";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 my-4">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-slate-800">Registrar nuevo huésped</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={fl}>Nombre *</label><input className={fi} placeholder="Nombre" autoFocus value={form.firstName} onChange={e => set('firstName', e.target.value)} /></div>
            <div><label className={fl}>Apellido</label><input className={fi} placeholder="Apellido" value={form.lastName ?? ''} onChange={e => set('lastName', e.target.value)} /></div>
          </div>
          <div><label className={fl}>Teléfono *</label><input className={fi} placeholder="3101234567" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={fl}>Tipo documento *</label>
              <select className={fi} value={form.documentType ?? ''} onChange={e => set('documentType', e.target.value)}>
                <option value="">— Seleccionar —</option>
                {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div><label className={fl}>Número documento *</label><input className={fi} placeholder="123456789" value={form.documentNumber ?? ''} onChange={e => set('documentNumber', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={fl}>País</label>
              <select className={fi} value={form.country ?? 'Colombia'} onChange={e => set('country', e.target.value)}>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label className={fl}>Ciudad</label>
              <select className={fi} value={form.city ?? ''} onChange={e => set('city', e.target.value)}>
                <option value="">— Seleccionar —</option>
                {COLOMBIA_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div><label className={fl}>Dirección</label><input className={fi} placeholder="Calle 123 #45-67" value={form.address ?? ''} onChange={e => set('address', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={fl}>Ocupación</label><input className={fi} placeholder="Comerciante" value={form.occupation ?? ''} onChange={e => set('occupation', e.target.value)} /></div>
            <div><label className={fl}>Placa vehículo</label><input className={fi} placeholder="ABC-123" value={form.vehiclePlate ?? ''} onChange={e => set('vehiclePlate', e.target.value)} /></div>
          </div>
          <div><label className={fl}>⚠ Observaciones</label>
            <textarea className={fi} rows={2} placeholder="No arrendar, cliente problemático…"
              value={form.observations ?? ''} onChange={e => set('observations', e.target.value)}
              style={{ resize: 'vertical' }} />
          </div>
        </div>
        {error && <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠ {error}</div>}
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onCancel} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg">
            {saving ? '⟳ Guardando…' : '✓ Crear huésped'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PriceBox ─────────────────────────────────────────────────────────────────

function PriceBox({ price, loading }: { price: PriceResponse | null; loading: boolean }) {
  if (loading) return (
    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-4 text-sm text-slate-500">
      <span className="animate-spin inline-block">⟳</span> Calculando precio…
    </div>
  );
  if (!price) return null;
  return (
    <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4">
      <div>
        <div className="text-2xl font-black text-slate-800 tracking-tight">{fmtCOP(price.totalPrice)}</div>
        <div className="text-xs text-slate-500 mt-0.5">
          {price.numberOfNights} noche{price.numberOfNights !== 1 ? 's' : ''} · {OCCUPANT_LABELS[price.occupantType] ?? price.occupantType}
          {price.numberOfGuests > 1 ? ` · ${price.numberOfGuests} personas` : ''}
        </div>
      </div>
      <span className="text-2xl">💰</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CheckIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill: PrefillData | undefined = (location.state as any)?.prefill;
  const existingReservationId: string | null = (location.state as any)?.reservationId ?? null;
  const fromPlanilla = !!prefill?.roomId;

  const [step, setStep] = useState<Step>('guest');

  // Guest
  const [guestQuery, setGuestQuery] = useState('');
  const [guestResults, setGuestResults] = useState<GuestResponse[]>([]);
  const [guestLoading, setGuestLoading] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<GuestResponse | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Room
  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<AvailableRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState(prefill?.roomTypeId ?? '');
  const [selectedRoomId, setSelectedRoomId] = useState(prefill?.roomId ?? '');
  const [checkInDate, setCheckInDate] = useState(prefill?.checkInDate ?? today());
  const [checkOutDate, setCheckOutDate] = useState(prefill?.checkOutDate ?? tomorrow());
  const [numberOfGuests, setNumberOfGuests] = useState(prefill?.numberOfGuests ?? 1);
  const [occupantType, setOccupantType] = useState<'INDIVIDUAL' | 'PAREJA' | 'MULTIPLE_PERSON'>(prefill?.occupantType ?? 'INDIVIDUAL');
  const [towels, setTowels] = useState(prefill?.numberOfGuests ?? 1);

  // Price
  const [priceData, setPriceData] = useState<PriceResponse | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const priceDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Companions
  const [companions, setCompanions] = useState<CompanionRequest[]>([]);

  // Payment
  const [payments, setPayments] = useState<PaymentEntry[]>([{ method: 'CASH', amount: '' }]);

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showEarlyModal, setShowEarlyModal] = useState(false);
  const [earlyOption, setEarlyOption] = useState<'PREVIOUS_NIGHT' | 'CURRENT_NIGHT' | null>(null);
  const [result, setResult] = useState<CheckInResponse | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { roomsApi.getTypes().then(setRoomTypes).catch(() => { }); }, []);

  useEffect(() => {
    if (!selectedRoomTypeId) { setFilteredRooms([]); return; }
    setRoomsLoading(true);
    const fetchFn = fromPlanilla ? roomsApi.getAvailableOrReservedByType : roomsApi.getAvailableByType;
    fetchFn(selectedRoomTypeId).then(setFilteredRooms).catch(() => setFilteredRooms([])).finally(() => setRoomsLoading(false));
  }, [selectedRoomTypeId, fromPlanilla]);

  useEffect(() => {
    if (!selectedRoomTypeId || !checkInDate || !checkOutDate || nightCount(checkInDate, checkOutDate) <= 0) { setPriceData(null); return; }
    if (priceDebounceRef.current) clearTimeout(priceDebounceRef.current);
    priceDebounceRef.current = setTimeout(async () => {
      setPriceLoading(true);
      try { setPriceData(await roomsApi.getPrice({ roomTypeId: selectedRoomTypeId, occupantType, checkIn: checkInDate, checkOut: checkOutDate, numberOfGuests })); }
      catch { setPriceData(null); }
      finally { setPriceLoading(false); }
    }, 600);
  }, [selectedRoomTypeId, occupantType, checkInDate, checkOutDate, numberOfGuests]);

  useEffect(() => { setTowels(numberOfGuests); }, [numberOfGuests]);
  useEffect(() => {
    if (numberOfGuests === 1) setOccupantType('INDIVIDUAL');
    else if (numberOfGuests === 2) setOccupantType('PAREJA');
    else setOccupantType('MULTIPLE_PERSON');
  }, [numberOfGuests]);
  useEffect(() => { if (occupantType === 'INDIVIDUAL') setCompanions([]); }, [occupantType]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!guestQuery.trim()) { setGuestResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setGuestLoading(true);
      try { setGuestResults(await guestsApi.search(guestQuery.trim())); }
      catch { setGuestResults([]); }
      finally { setGuestLoading(false); }
    }, 350);
  }, [guestQuery]);

  const nights = nightCount(checkInDate, checkOutDate);
  const totalPrice = priceData?.totalPrice ?? 0;
  const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const hasPaidSomething = totalPaid > 0;
  const overLimit = totalPrice > 0 && totalPaid > totalPrice;

  const addPaymentLine = () => setPayments(p => [...p, { method: 'CASH', amount: '' }]);
  const removePaymentLine = (i: number) => setPayments(p => p.filter((_, idx) => idx !== i));
  const updatePayment = (i: number, key: 'method' | 'amount', val: string) =>
    setPayments(p => p.map((x, idx) => idx === i ? { ...x, [key]: val } : x));

  const addCompanion = () => setCompanions(c => [...c, { name: '', documentType: undefined, documentNumber: '' }]);
  const updateCompanion = (i: number, k: keyof CompanionRequest, v: string) =>
    setCompanions(c => c.map((x, idx) => idx === i ? { ...x, [k]: v || undefined } : x));
  const removeCompanion = (i: number) => setCompanions(c => c.filter((_, idx) => idx !== i));

  const handleConfirm = () => {
    if (overLimit) { setSubmitError(`El abono (${fmtCOP(totalPaid)}) supera el total (${fmtCOP(totalPrice)})`); return; }
    if (isEarlyHour() && !earlyOption) { setShowEarlyModal(true); return; }
    executeCheckIn(earlyOption);
  };

  // ═══════════════════════════════════════════════════════════════════════════
// REEMPLAZAR executeCheckIn en CheckIn.tsx
// ═══════════════════════════════════════════════════════════════════════════

const executeCheckIn = async (earlyOpt: 'PREVIOUS_NIGHT' | 'CURRENT_NIGHT' | null) => {
    if (!selectedGuest || !selectedRoomTypeId || !selectedRoomId) return;
    setSubmitting(true); setSubmitError('');

    const validationError = validateReservationPayload({
      firstName: selectedGuest.firstName, phone: selectedGuest.phone,
      roomTypeId: selectedRoomTypeId, checkInDate, checkOutDate, numberOfGuests, occupantType,
    });
    if (validationError) { setSubmitError(validationError); setSubmitting(false); return; }

    try {
      let reservationId: string;

      if (existingReservationId) {
        reservationId = existingReservationId;
      } else {
        // Construir lista de pagos válidos
        const validPayments = payments
          .filter(p => parseFloat(p.amount) > 0)
          .map(p => ({ method: p.method, amount: parseFloat(p.amount) }));

        const totalDeposit = validPayments.reduce((sum, p) => sum + p.amount, 0);

        const reservation = await checkInApi.createReservation({
          guestId:        selectedGuest.id,
          firstName:      selectedGuest.firstName,
          lastName:       selectedGuest.lastName ?? undefined,
          phone:          selectedGuest.phone,
          roomTypeId:     selectedRoomTypeId,
          roomId:         selectedRoomId,
          checkInDate,
          checkOutDate,
          numberOfGuests,
          occupantType,
          companions:     companions.filter(c => c.name?.trim()),
          // Total del depósito
          depositAmount:  totalDeposit > 0 ? totalDeposit : undefined,
          // Primer método (para compatibilidad)
          depositMethod:  validPayments.length > 0 ? validPayments[0].method : undefined,
          // Lista completa de pagos (nuevo campo)
          depositPayments: validPayments.length > 0 ? validPayments : undefined,
        });
        reservationId = reservation.id as string;
      }

      const checkIn = await checkInApi.doCheckIn({
        reservationId,
        roomId:             selectedRoomId,
        earlyCheckInOption: earlyOpt ?? undefined,
        towelsDelivered:    towels,
      });
      setResult(checkIn);
      setStep('success');
    } catch (e: any) {
      setSubmitError(
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        'Error al registrar check-in'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep('guest'); setSelectedGuest(null); setGuestQuery(''); setGuestResults([]);
    setSelectedRoomTypeId(''); setSelectedRoomId(''); setFilteredRooms([]);
    setCheckInDate(today()); setCheckOutDate(tomorrow());
    setNumberOfGuests(1); setOccupantType('INDIVIDUAL'); setTowels(1);
    setCompanions([]); setPayments([{ method: 'CASH', amount: '' }]);
    setPriceData(null); setEarlyOption(null); setSubmitError(''); setResult(null);
    navigate('/checkin', { replace: true, state: {} });
  };

  const currentIdx = STEPS.findIndex(s => s.key === step);
  const canAdvGuest = !!selectedGuest;
  const canAdvRoom = !!selectedRoomTypeId && !!selectedRoomId && nights > 0;
  const roomTypeName = roomTypes.find(r => r.id === selectedRoomTypeId)?.name ?? '';
  const roomNumber = filteredRooms.find(r => r.id === selectedRoomId)?.roomNumber ?? '';
  const hasPrefill = !!prefill?.roomTypeId;

  // ─── Clases comunes ──────────────────────────────────────────────────────────
  const fi = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 placeholder:text-slate-400";
  const fl = "text-xs text-slate-500 mb-1 block";
  const btn = "px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors";
  const btnBack = "px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium rounded-xl transition-colors";

  return (
    <div className="p-6 space-y-5">

      {/* Encabezado */}
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Check-in</h1>
        <p className="text-sm text-slate-500 mt-0.5">Registro de entrada de huéspedes</p>
      </div>

      {/* Stepper */}
      {step !== 'success' && (
        <div className="flex items-center">
          {STEPS.map((s, i) => (
            <div key={s.key} className={`flex items-center ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 flex-shrink-0 transition-all ${i < currentIdx ? 'bg-slate-800 border-slate-800 text-white' :
                    i === currentIdx ? 'bg-white border-slate-800 text-slate-800' :
                      'bg-white border-slate-200 text-slate-400'
                  }`}>
                  {i < currentIdx ? '✓' : i + 1}
                </div>
                <span className={`text-xs font-medium ${i === currentIdx ? 'text-slate-800' : 'text-slate-400'}`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-3 ${i < currentIdx ? 'bg-slate-800' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── PASO 1: Huésped ──────────────────────────────────────────────────── */}
      {step === 'guest' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">1. Seleccionar huésped</p>

          {hasPrefill && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-4 text-sm text-emerald-700">
              ✓ Datos de habitación pre-cargados desde la planilla. Solo selecciona el huésped.
            </div>
          )}

          {selectedGuest ? (
            <>
              {selectedGuest.hasObservations && (
                <div className="flex gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-3">
                  <span>⚠️</span>
                  <div>
                    <strong className="text-red-700 text-sm block">Huésped con observaciones</strong>
                    <p className="text-red-600 text-xs mt-0.5">{selectedGuest.observations}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${selectedGuest.hasObservations ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700'}`}>
                    {(selectedGuest.firstName[0] + (selectedGuest.lastName?.[0] ?? '')).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{selectedGuest.fullName}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      📞 {selectedGuest.phone}
                      {selectedGuest.documentNumber && ` · 🪪 ${selectedGuest.documentType} ${selectedGuest.documentNumber}`}
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedGuest(null)}
                  className="text-xs border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100">
                  Cambiar
                </button>
              </div>
            </>
          ) : (
            <>
              <input className={`${fi} mb-3`}
                placeholder="Buscar por nombre, teléfono o documento…"
                value={guestQuery} onChange={e => setGuestQuery(e.target.value)} autoFocus />

              {guestLoading && (
                <p className="text-slate-400 text-sm text-center py-3">
                  <span className="animate-spin inline-block mr-1">⟳</span> Buscando…
                </p>
              )}

              {!guestLoading && guestResults.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {guestResults.map(g => (
                    <button key={g.id}
                      onClick={() => { setSelectedGuest(g); setGuestQuery(''); setGuestResults([]); }}
                      className="flex items-center gap-3 w-full bg-slate-50 border border-slate-200 hover:border-slate-400 rounded-xl px-4 py-3 text-left transition-all">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${g.hasObservations ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700'}`}>
                        {(g.firstName[0] + (g.lastName?.[0] ?? '')).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-slate-800">
                          {g.fullName}
                          {g.hasObservations && <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">⚠ Obs.</span>}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          📞 {g.phone}
                          {g.documentNumber && ` · ${g.documentType} ${g.documentNumber}`}
                          {g.city && ` · ${g.city}`}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!guestLoading && guestQuery.trim().length > 1 && guestResults.length === 0 && (
                <div className="text-sm text-slate-500 text-center bg-slate-50 rounded-xl py-4 mb-3">
                  No se encontró ningún huésped con "{guestQuery}"
                </div>
              )}

              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400">o</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              <button onClick={() => setShowCreateModal(true)}
                className="w-full py-3 border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-xl text-sm text-slate-500 hover:text-slate-700 transition-all">
                + Registrar nuevo huésped
              </button>
            </>
          )}

          <div className="flex gap-3 mt-5">
            <button className={`${btn} flex-1`} disabled={!canAdvGuest} onClick={() => setStep('room')}>
              Continuar →
            </button>
          </div>
        </div>
      )}

      {/* ── PASO 2: Habitación ───────────────────────────────────────────────── */}
      {step === 'room' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">2. Habitación y fechas</p>

          {hasPrefill && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-4 text-sm text-emerald-700">
              ✓ Datos pre-cargados desde la planilla. Puedes modificarlos si es necesario.
            </div>
          )}

          <PriceBox price={priceData} loading={priceLoading} />

          <p className="text-xs text-slate-500 mb-2">Tipo de habitación</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            {roomTypes.map(rt => (
              <div key={rt.id}
                onClick={() => { setSelectedRoomTypeId(rt.id); setSelectedRoomId(''); setPriceData(null); }}
                className={`border-2 rounded-xl p-3 cursor-pointer transition-all text-center ${selectedRoomTypeId === rt.id
                    ? 'border-slate-800 bg-slate-50'
                    : 'border-slate-200 hover:border-slate-400'
                  }`}>
                <div className="text-sm font-semibold text-slate-800">{rt.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">Cap. {rt.capacity}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div><label className={fl}>Fecha entrada</label>
              <input type="date" className={fi} value={checkInDate} min={today()} onChange={e => setCheckInDate(e.target.value)} /></div>
            <div><label className={fl}>Fecha salida</label>
              <input type="date" className={fi} value={checkOutDate} min={checkInDate} onChange={e => setCheckOutDate(e.target.value)} /></div>
          </div>

          {nights > 0 && (
            <div className="inline-block bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg mb-4">
              🌙 {nights} noche{nights !== 1 ? 's' : ''}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div><label className={fl}>Número de personas</label>
              <select className={fi} value={numberOfGuests} onChange={e => setNumberOfGuests(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} persona{n !== 1 ? 's' : ''}</option>)}
              </select>
            </div>
            <div><label className={fl}>Tipo ocupante</label>
              <select className={fi} value={occupantType} onChange={e => setOccupantType(e.target.value as typeof occupantType)}>
                {Object.entries(OCCUPANT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className={`${fl} mb-2`}>Toallas a entregar</label>
            <div className="flex items-center gap-3">
              <div className="flex">
                <button onClick={() => setTowels(t => Math.max(1, t - 1))}
                  className="w-9 h-9 border border-slate-200 rounded-l-lg bg-slate-50 hover:bg-slate-100 text-slate-600 text-lg flex items-center justify-center">−</button>
                <div className="w-12 h-9 border-t border-b border-slate-200 flex items-center justify-center text-sm font-bold text-slate-800">{towels}</div>
                <button onClick={() => setTowels(t => t + 1)}
                  className="w-9 h-9 border border-slate-200 rounded-r-lg bg-slate-50 hover:bg-slate-100 text-slate-600 text-lg flex items-center justify-center">+</button>
              </div>
              <span className="text-sm text-slate-500">🛁 {towels} toalla{towels !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {selectedRoomTypeId && (
            <>
              <label className={`${fl} mb-2`}>Habitaciones disponibles — {roomTypeName}</label>
              {roomsLoading ? (
                <p className="text-slate-400 text-sm py-2">Cargando habitaciones…</p>
              ) : filteredRooms.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-700 text-sm">
                  ⚠ No hay habitaciones disponibles del tipo {roomTypeName}.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredRooms.map(r => (
                    <div key={r.id}
                      onClick={() => setSelectedRoomId(r.id)}
                      className={`flex items-center justify-between border-2 rounded-xl px-4 py-3 cursor-pointer transition-all ${selectedRoomId === r.id
                          ? 'border-slate-800 bg-slate-50'
                          : r.status === 'RESERVED'
                            ? 'border-purple-200 hover:border-purple-400'
                            : 'border-slate-200 hover:border-slate-400'
                        }`}>
                      <div>
                        <div className="text-base font-bold text-slate-800">Hab. {r.roomNumber}</div>
                        <div className="text-xs text-slate-400">
                          Piso {r.floor}
                          {r.status === 'RESERVED' && <span className="ml-2 text-purple-600 font-semibold">· Pre-asignada</span>}
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${selectedRoomId === r.id ? 'bg-slate-800 border-slate-800 text-white' : 'border-slate-300'
                        }`}>
                        {selectedRoomId === r.id ? '✓' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="flex gap-3 mt-5">
            <button className={btnBack} onClick={() => setStep('guest')}>← Volver</button>
            <button className={`${btn} flex-1`} disabled={!canAdvRoom} onClick={() => setStep('companions')}>Continuar →</button>
          </div>
        </div>
      )}

      {/* ── PASO 3: Acompañantes ─────────────────────────────────────────────── */}
      {step === 'companions' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">3. Acompañantes</p>

          {occupantType === 'INDIVIDUAL' ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm text-slate-500 text-center">
              🚫 Habitación individual — no se registran acompañantes.
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500 mb-4">Nombre y cédula de cada acompañante. Opcional.</p>
              {companions.map((c, i) => (
                <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-3">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-semibold text-slate-700">Acompañante {i + 1}</span>
                    <button onClick={() => removeCompanion(i)} className="text-slate-400 hover:text-red-500 text-xl leading-none">×</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-3 sm:col-span-1">
                      <label className={fl}>Nombre *</label>
                      <input className={fi} placeholder="Nombre completo" value={c.name} onChange={e => updateCompanion(i, 'name', e.target.value)} />
                    </div>
                    <div>
                      <label className={fl}>Tipo doc.</label>
                      <select className={fi} value={c.documentType ?? ''} onChange={e => updateCompanion(i, 'documentType', e.target.value)}>
                        <option value="">—</option>
                        {DOC_TYPES_SHORT.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={fl}>Número</label>
                      <input className={fi} placeholder="Cédula / ID" value={c.documentNumber ?? ''} onChange={e => updateCompanion(i, 'documentNumber', e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={addCompanion}
                className="w-full py-3 border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-xl text-sm text-slate-500 hover:text-slate-700 transition-all">
                + Agregar acompañante
              </button>
            </>
          )}

          <div className="flex gap-3 mt-5">
            <button className={btnBack} onClick={() => setStep('room')}>← Volver</button>
            <button className={`${btn} flex-1`} onClick={() => setStep('payment')}>Continuar →</button>
          </div>
        </div>
      )}

      {/* ── PASO 4: Pago ─────────────────────────────────────────────────────── */}
      {step === 'payment' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">4. Pago</p>

          {priceData && (
            <div className="flex justify-between items-center bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4">
              <div>
                <div className="text-xs text-slate-500 mb-0.5">Total de la estadía</div>
                <div className="text-2xl font-black text-slate-800">{fmtCOP(priceData.totalPrice)}</div>
              </div>
              <div className="text-right text-xs text-slate-400">
                <div>{priceData.numberOfNights} noche{priceData.numberOfNights !== 1 ? 's' : ''}</div>
                <div>{roomTypeName}</div>
              </div>
            </div>
          )}

          <p className="text-sm text-slate-500 mb-4">Registra el pago o abono. Puedes usar múltiples métodos.</p>

          {payments.map((p, i) => (
            <div key={i} className="grid grid-cols-2 gap-3 mb-3 items-end">
              <div><label className={fl}>Método de pago</label>
                <select className={fi} value={p.method} onChange={e => updatePayment(i, 'method', e.target.value)}>
                  {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1"><label className={fl}>Monto</label>
                  <input className={fi} type="number" min="0" placeholder="0"
                    value={p.amount} onChange={e => updatePayment(i, 'amount', e.target.value)} />
                </div>
                {payments.length > 1 && (
                  <button onClick={() => removePaymentLine(i)} className="text-slate-400 hover:text-red-500 text-xl pb-2 leading-none">×</button>
                )}
              </div>
            </div>
          ))}

          <button onClick={addPaymentLine}
            className="w-full py-2.5 border border-dashed border-slate-300 hover:border-slate-400 rounded-xl text-sm text-slate-500 hover:text-slate-700 transition-all mb-4">
            + Agregar otro método de pago
          </button>

          <div className={`flex justify-between items-center border rounded-xl px-4 py-3 ${overLimit ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
            <div>
              <div className="text-xs text-slate-500">Total abonado</div>
              {overLimit && <div className="text-xs text-red-600 mt-0.5">⚠ Supera el total ({fmtCOP(totalPrice)})</div>}
            </div>
            <div className={`text-lg font-bold ${overLimit ? 'text-red-600' : 'text-slate-800'}`}>{fmtCOP(totalPaid)}</div>
          </div>

          {!hasPaidSomething && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-700 text-sm mt-3">
              ⚠ Sin abono — el huésped quedará con saldo pendiente al checkout.
            </div>
          )}

          <div className="flex gap-3 mt-5">
            <button className={btnBack} onClick={() => setStep('companions')}>← Volver</button>
            <button className={`${btn} flex-1`} disabled={overLimit} onClick={() => setStep('confirm')}>Continuar →</button>
          </div>
        </div>
      )}

      {/* ── PASO 5: Confirmar ────────────────────────────────────────────────── */}
      {step === 'confirm' && selectedGuest && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">5. Confirmar check-in</p>

          {isEarlyHour() && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 text-sm text-blue-700">
              🌙 <strong className="mr-1">Early check-in</strong> — Al confirmar elegirás la noche a cobrar.
            </div>
          )}

          {[
            {
              title: 'Huésped', rows: [
                ['Nombre', selectedGuest.fullName],
                ['Teléfono', selectedGuest.phone],
                ...(selectedGuest.documentNumber ? [['Documento', `${selectedGuest.documentType} ${selectedGuest.documentNumber}`]] : []),
              ]
            },
            {
              title: 'Habitación', rows: [
                ['Tipo', roomTypeName],
                ['Habitación', `#${roomNumber}`],
                ['Entrada', new Date(checkInDate + 'T12:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })],
                ['Salida', new Date(checkOutDate + 'T12:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })],
                ['Noches', String(nights)],
                ['Personas', `${numberOfGuests} · ${OCCUPANT_LABELS[occupantType]}`],
                ['Toallas', `${towels} 🛁`],
                ...(priceData ? [['Total estadía', fmtCOP(priceData.totalPrice)]] : []),
              ]
            },
          ].map(section => (
            <div key={section.title} className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">{section.title}</p>
              <div className="bg-slate-50 border border-slate-100 rounded-xl divide-y divide-slate-100">
                {section.rows.map(([k, v]) => (
                  <div key={k} className="flex justify-between px-4 py-2.5">
                    <span className="text-xs text-slate-500">{k}</span>
                    <span className="text-sm font-medium text-slate-700">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {companions.filter(c => c.name?.trim()).length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Acompañantes ({companions.filter(c => c.name?.trim()).length})
              </p>
              <div className="bg-slate-50 border border-slate-100 rounded-xl divide-y divide-slate-100">
                {companions.filter(c => c.name?.trim()).map((c, i) => (
                  <div key={i} className="flex justify-between px-4 py-2.5">
                    <span className="text-xs text-slate-500">{c.documentType ?? '—'} {c.documentNumber ?? ''}</span>
                    <span className="text-sm font-medium text-slate-700">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Pago</p>
            <div className="bg-slate-50 border border-slate-100 rounded-xl divide-y divide-slate-100">
              {!hasPaidSomething ? (
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-xs text-slate-500">Estado</span>
                  <span className="text-sm text-amber-600 font-medium">Sin pago — queda debiendo</span>
                </div>
              ) : (
                <>
                  {payments.filter(p => parseFloat(p.amount) > 0).map((p, i) => (
                    <div key={i} className="flex justify-between px-4 py-2.5">
                      <span className="text-xs text-slate-500">{PAYMENT_METHODS.find(m => m.value === p.method)?.label}</span>
                      <span className="text-sm font-medium text-emerald-600">{fmtCOP(parseFloat(p.amount))}</span>
                    </div>
                  ))}
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-sm font-semibold text-slate-700">Total abonado</span>
                    <span className="text-sm font-bold text-emerald-600">{fmtCOP(totalPaid)}</span>
                  </div>
                  {priceData && totalPaid < priceData.totalPrice && (
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-xs text-slate-500">Saldo pendiente al checkout</span>
                      <span className="text-sm text-amber-600 font-medium">{fmtCOP(priceData.totalPrice - totalPaid)}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm mb-4">⚠ {submitError}</div>
          )}

          <div className="flex gap-3">
            <button className={btnBack} onClick={() => setStep('payment')} disabled={submitting}>← Volver</button>
            <button className={`${btn} flex-1`} onClick={handleConfirm} disabled={submitting || overLimit}>
              {submitting
                ? <span className="flex items-center justify-center gap-2"><span className="animate-spin">⟳</span> Registrando…</span>
                : `✓ Confirmar check-in${isEarlyHour() ? ' 🌙' : ''}`}
            </button>
          </div>
        </div>
      )}

      {/* ── PASO 6: Éxito ───────────────────────────────────────────────────── */}
      {step === 'success' && result && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <SuccessScreen result={result} payments={payments} totalPaid={totalPaid} onReset={handleReset} />
        </div>
      )}

      {/* Modales */}
      {showCreateModal && (
        <CreateGuestModal
          onCreated={g => { setSelectedGuest(g); setShowCreateModal(false); }}
          onCancel={() => setShowCreateModal(false)}
        />
      )}
      {showEarlyModal && (
        <EarlyModal
          onSelect={opt => { setEarlyOption(opt); setShowEarlyModal(false); executeCheckIn(opt); }}
          onCancel={() => setShowEarlyModal(false)}
        />
      )}
    </div>
  );
}