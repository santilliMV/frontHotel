import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type RatoStatus = 'ACTIVE' | 'CHECKED_OUT' | 'EXTENDED_TO_NIGHT';
type OccupantType = 'INDIVIDUAL' | 'PAREJA' | 'MULTIPLE_PERSON';
type CheckoutOption = 'normal' | 'late';

interface RatoResponse {
  id: string;
  reservationId: string;
  reservationNumber: string;
  roomNumber: string;
  roomTypeName: string;
  guestName: string;
  guestPhone: string;
  entryDateTime: string;
  expectedCheckOutTime: string;
  actualCheckOutTime: string | null;
  durationHours: number;
  basePriceRato: number;
  towelsDelivered: number;
  isLate: boolean;
  minutesLate: number | null;
  lateCharge: number;
  convertedToNightStay: boolean;
  nightExtensionCharge: number | null;
  status: RatoStatus;
  statusLabel: string;
  registeredBy: string;
}

interface Room {
  id: string;
  roomNumber: string;
  floor: number;
  status: string;
  statusLabel: string;
  roomTypeName: string;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const PAYMENT_METHODS = [
  { value: 'CASH',          label: 'Efectivo' },
  { value: 'CARD',          label: 'Tarjeta' },
  { value: 'TRANSFER',      label: 'Transferencia' },
  { value: 'QR',            label: 'QR' },
  { value: 'NEQUI_SALOMON', label: 'Nequi Salomón' },
  { value: 'NEQUI_BRAYAN',  label: 'Nequi Brayan' },
];

const OCCUPANT_LABELS: Record<OccupantType, string> = {
  INDIVIDUAL:      'Individual',
  PAREJA:          'Pareja',
  MULTIPLE_PERSON: 'Múltiple',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const tomorrowStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toLocalDateStr(d);
};

function useCountdown(expectedCheckOutTime: string) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const calc = () => setRemaining(new Date(expectedCheckOutTime).getTime() - Date.now());
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [expectedCheckOutTime]);
  return remaining;
}

function formatCountdown(ms: number) {
  if (ms <= 0) {
    const abs = Math.abs(ms);
    const h = Math.floor(abs / 3600000);
    const m = Math.floor((abs % 3600000) / 60000);
    const s = Math.floor((abs % 60000) / 1000);
    if (h > 0) return `+${h}h ${m}m tarde`;
    if (m > 0) return `+${m}m ${s}s tarde`;
    return `+${s}s tarde`;
  }
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function getErrorMsg(e: unknown) {
  return (e as { response?: { data?: { error?: string } } })?.response?.data?.error
    ?? 'Ocurrió un error. Intenta de nuevo.';
}

// ── API ───────────────────────────────────────────────────────────────────────

const fetchActive  = async (): Promise<RatoResponse[]> => (await apiClient.get('/rato/active')).data;
const fetchRooms   = async (): Promise<Room[]>         => (await apiClient.get('/rooms')).data;
const postEntry    = async (body: object): Promise<RatoResponse> => (await apiClient.post('/rato/entry', body)).data;
const postCheckout = async (body: object): Promise<RatoResponse> => (await apiClient.post('/rato/checkout', body)).data;
const postConvert  = async (body: object): Promise<RatoResponse> => (await apiClient.post('/rato/convert-to-night', body)).data;

// ── Subcomponentes ────────────────────────────────────────────────────────────

function CountdownBadge({ expectedCheckOutTime }: { expectedCheckOutTime: string }) {
  const remaining = useCountdown(expectedCheckOutTime);
  const isLate = remaining <= 0;
  return (
    <span className={`font-mono text-sm font-semibold tabular-nums ${
      isLate ? 'text-red-600' : remaining < 600000 ? 'text-amber-600' : 'text-green-700'
    }`}>
      {formatCountdown(remaining)}
    </span>
  );
}

function PaymentMethodGrid({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {PAYMENT_METHODS.map(m => (
        <button key={m.value} onClick={() => onChange(m.value)}
          className={`text-xs py-2 px-1 rounded-lg border transition-colors ${
            value === m.value
              ? 'bg-slate-800 text-white border-slate-800'
              : 'border-slate-300 text-slate-600 hover:border-slate-400'
          }`}>
          {m.label}
        </button>
      ))}
    </div>
  );
}

// ── Modal: Nueva entrada ──────────────────────────────────────────────────────

function NuevaEntradaModal({ rooms, onClose, onSaved }: {
  rooms: Room[]; onClose: () => void; onSaved: () => void;
}) {
  const [roomId, setRoomId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: postEntry,
    onSuccess: () => { onSaved(); onClose(); },
    onError: (e: unknown) => setError(getErrorMsg(e)),
  });

  const availableRooms = rooms
    .filter(r => r.status === 'AVAILABLE')
    .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));

  const handleSubmit = () => {
    setError('');
    if (!roomId) { setError('Selecciona una habitación.'); return; }
    mutation.mutate({ roomId, paymentMethod, notes: notes.trim() || undefined });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Nueva entrada — Rato</h2>
            <p className="text-xs text-slate-500 mt-0.5">$40.000 · 3 horas · 2 toallas</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Habitación <span className="text-red-500">*</span></label>
            {availableRooms.length === 0 ? (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">No hay habitaciones disponibles.</p>
            ) : (
              <select value={roomId} onChange={e => setRoomId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
                <option value="">Selecciona una habitación</option>
                {availableRooms.map(r => (
                  <option key={r.id} value={r.id}>{r.roomNumber} — {r.roomTypeName} (Piso {r.floor})</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Método de pago <span className="text-red-500">*</span></label>
            <PaymentMethodGrid value={paymentMethod} onChange={setPaymentMethod} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notas <span className="text-slate-400">(opcional)</span></label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Servicio rato (3 horas)</span>
              <span className="font-semibold text-slate-800">$40.000</span>
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Toallas entregadas</span><span>2</span>
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Método</span>
              <span>{PAYMENT_METHODS.find(m => m.value === paymentMethod)?.label}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium">Cancelar</button>
          <button onClick={handleSubmit} disabled={mutation.isPending || availableRooms.length === 0}
            className="px-5 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {mutation.isPending ? 'Registrando...' : 'Registrar entrada'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Checkout ───────────────────────────────────────────────────────────

function CheckoutModal({ rato, onClose, onSaved, onConvert }: {
  rato: RatoResponse; onClose: () => void; onSaved: () => void;
  onConvert: (r: RatoResponse) => void;
}) {
  const remaining = useCountdown(rato.expectedCheckOutTime);
  const isLate = remaining <= 0;
  const minutesLate = isLate ? Math.floor(Math.abs(remaining) / 60000) : 0;

  const [option, setOption] = useState<CheckoutOption>(isLate ? 'late' : 'normal');
  const [lateCharge, setLateCharge] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: postCheckout,
    onSuccess: () => { onSaved(); onClose(); },
    onError: (e: unknown) => setError(getErrorMsg(e)),
  });

  const showMethodSelector = option === 'late' && !!lateCharge && parseFloat(lateCharge) > 0;

  const handleSubmit = () => {
    setError('');
    const body: Record<string, unknown> = { ratoServiceId: rato.id, convertToNight: false };
    if (option === 'late') {
      const charge = parseFloat(lateCharge);
      if (!isNaN(charge) && charge > 0) {
        body.lateCharge = charge;
        body.paymentMethod = paymentMethod;
      }
    }
    mutation.mutate(body);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Checkout — Rato</h2>
            <p className="text-xs text-slate-500 mt-0.5">Hab. {rato.roomNumber} · {rato.roomTypeName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}

          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Entrada</span>
              <span className="text-slate-800">{formatTime(rato.entryDateTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Límite</span>
              <span className="text-slate-800">{formatTime(rato.expectedCheckOutTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tiempo</span>
              <CountdownBadge expectedCheckOutTime={rato.expectedCheckOutTime} />
            </div>
            {isLate && (
              <div className="flex justify-between">
                <span className="text-slate-500">Retraso</span>
                <span className="text-red-600 font-medium">{minutesLate} min tarde</span>
              </div>
            )}
          </div>

          {isLate && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2 rounded-lg">
              El huésped se pasó del tiempo límite.
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">¿Cómo sale?</p>

            <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              option === 'normal' ? 'border-slate-800 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
            }`}>
              <input type="radio" name="co" value="normal" checked={option === 'normal'}
                onChange={() => setOption('normal')} className="mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-800">Sale normal</p>
                <p className="text-xs text-slate-500">Sin recargo · Ya pagó: {formatCOP(rato.basePriceRato)}</p>
              </div>
            </label>

            <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              option === 'late' ? 'border-slate-800 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
            }`}>
              <input type="radio" name="co" value="late" checked={option === 'late'}
                onChange={() => setOption('late')} className="mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">Sale tarde — cobrar recargo</p>
                <p className="text-xs text-slate-500 mb-2">Recepcionista decide el monto</p>
                {option === 'late' && (
                  <input type="number" value={lateCharge} onChange={e => setLateCharge(e.target.value)}
                    placeholder="Monto del recargo (vacío = no cobrar)" min="0"
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                )}
              </div>
            </label>
          </div>

          {showMethodSelector && (
            <div>
              <p className="text-xs font-medium text-slate-600 mb-2">Método de pago del recargo</p>
              <PaymentMethodGrid value={paymentMethod} onChange={setPaymentMethod} />
            </div>
          )}

          <div className="border-t border-slate-100 pt-3">
            <button onClick={() => { onClose(); onConvert(rato); }}
              className="w-full text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 hover:bg-blue-100 transition-colors font-medium">
              Convertir a noche completa
            </button>
            <p className="text-xs text-slate-400 text-center mt-1">Abre el flujo de check-in — se cobra la diferencia</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium">Cancelar</button>
          <button onClick={handleSubmit} disabled={mutation.isPending}
            className="px-5 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {mutation.isPending ? 'Procesando...' : 'Confirmar salida'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Convertir a noche ──────────────────────────────────────────────────

function ConvertToNightModal({ rato, onClose, onSaved }: {
  rato: RatoResponse; onClose: () => void; onSaved: () => void;
}) {
  const [step, setStep]                   = useState<1 | 2>(1);
  const [firstName, setFirstName]         = useState('');
  const [lastName, setLastName]           = useState('');
  const [phone, setPhone]                 = useState('');
  const [occupantType, setOccupantType]   = useState<OccupantType>('PAREJA');
  const [numberOfGuests, setNumberOfGuests] = useState('1');
  const [checkOutDate, setCheckOutDate]   = useState(tomorrowStr());
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [error, setError]                 = useState('');

  const mutation = useMutation({
    mutationFn: postConvert,
    onSuccess: () => { onSaved(); onClose(); },
    onError: (e: unknown) => setError(getErrorMsg(e)),
  });

  const handleNext = () => {
    setError('');
    if (!firstName.trim()) { setError('El nombre es obligatorio.'); return; }
    if (!phone.trim())     { setError('El teléfono es obligatorio.'); return; }
    setStep(2);
  };

  const handleSubmit = () => {
    setError('');
    mutation.mutate({
      ratoServiceId:  rato.id,
      firstName:      firstName.trim(),
      lastName:       lastName.trim() || undefined,
      phone:          phone.trim(),
      occupantType,
      numberOfGuests: parseInt(numberOfGuests) || 1,
      checkOutDate,
      paymentMethod,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Convertir a noche — Hab. {rato.roomNumber}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{rato.roomTypeName} · Ya pagó: {formatCOP(rato.basePriceRato)} (rato)</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        {/* Indicador pasos */}
        <div className="flex items-center gap-2 px-6 pt-4">
          {([1, 2] as const).map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                step === s ? 'bg-slate-800 text-white' : step > s ? 'bg-slate-400 text-white' : 'bg-slate-100 text-slate-400'
              }`}>{s}</div>
              <span className={`text-xs ${step === s ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
                {s === 1 ? 'Datos del huésped' : 'Reserva y pago'}
              </span>
              {s < 2 && <div className="w-8 h-px bg-slate-200 mx-1" />}
            </div>
          ))}
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}

          {/* Paso 1 */}
          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nombre <span className="text-red-500">*</span></label>
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                    placeholder="Nombre" autoFocus
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Apellido <span className="text-slate-400">(opcional)</span></label>
                  <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                    placeholder="Apellido"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Teléfono <span className="text-red-500">*</span></label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="3001234567"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Tipo de ocupante</label>
                <div className="flex gap-2">
                  {(['INDIVIDUAL', 'PAREJA', 'MULTIPLE_PERSON'] as OccupantType[]).map(t => (
                    <button key={t} onClick={() => setOccupantType(t)}
                      className={`flex-1 text-xs py-2 rounded-lg border transition-colors ${
                        occupantType === t ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-300 text-slate-600 hover:border-slate-400'
                      }`}>
                      {OCCUPANT_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Número de huéspedes</label>
                <input type="number" value={numberOfGuests} onChange={e => setNumberOfGuests(e.target.value)}
                  min="1" max="10"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>
            </>
          )}

          {/* Paso 2 */}
          {step === 2 && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fecha de salida <span className="text-red-500">*</span></label>
                <input type="date" value={checkOutDate} min={tomorrowStr()}
                  onChange={e => setCheckOutDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Método de pago de la diferencia</label>
                <PaymentMethodGrid value={paymentMethod} onChange={setPaymentMethod} />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Huésped</span>
                  <span className="font-medium text-slate-800">{firstName} {lastName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Teléfono</span>
                  <span className="text-slate-700">{phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ocupante</span>
                  <span className="text-slate-700">{OCCUPANT_LABELS[occupantType]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Salida</span>
                  <span className="text-slate-700">{new Date(checkOutDate + 'T12:00:00').toLocaleDateString('es-CO')}</span>
                </div>
                <div className="border-t border-slate-200 pt-1.5 flex justify-between">
                  <span className="text-slate-500">Ya pagó (rato)</span>
                  <span className="text-slate-700">{formatCOP(rato.basePriceRato)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-slate-600">Cobra diferencia</span>
                  <span className="text-slate-800">precio noche − {formatCOP(rato.basePriceRato)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Método</span>
                  <span>{PAYMENT_METHODS.find(m => m.value === paymentMethod)?.label}</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-between gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <button onClick={step === 1 ? onClose : () => { setStep(1); setError(''); }}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium">
            {step === 1 ? 'Cancelar' : 'Atrás'}
          </button>
          {step === 1 ? (
            <button onClick={handleNext}
              className="px-5 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors">
              Siguiente
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={mutation.isPending}
              className="px-5 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {mutation.isPending ? 'Procesando...' : 'Confirmar conversión'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tarjeta rato activo ───────────────────────────────────────────────────────

function RatoCard({ rato, onCheckout }: { rato: RatoResponse; onCheckout: (r: RatoResponse) => void }) {
  const remaining = useCountdown(rato.expectedCheckOutTime);
  const isLate = remaining <= 0;

  return (
    <div className={`bg-white border rounded-xl px-5 py-4 transition-colors ${
      isLate ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold text-slate-800">Hab. {rato.roomNumber}</span>
            <span className="text-xs text-slate-400">{rato.roomTypeName}</span>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
            <span>Entrada: <span className="font-medium text-slate-700">{formatTime(rato.entryDateTime)}</span></span>
            <span>Límite: <span className="font-medium text-slate-700">{formatTime(rato.expectedCheckOutTime)}</span></span>
            <span>Toallas: <span className="font-medium text-slate-700">{rato.towelsDelivered}</span></span>
          </div>
        </div>
        <div className="text-right shrink-0 flex flex-col items-end gap-3">
          <div>
            <p className="text-xs text-slate-400 mb-0.5">{isLate ? 'Tiempo excedido' : 'Tiempo restante'}</p>
            <CountdownBadge expectedCheckOutTime={rato.expectedCheckOutTime} />
          </div>
          <div className="text-xs text-slate-500">{formatCOP(rato.basePriceRato)}</div>
          <button onClick={() => onCheckout(rato)}
            className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              isLate ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-800 text-white hover:bg-slate-700'
            }`}>
            {isLate ? 'Checkout urgente' : 'Checkout'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tarjeta rato cerrado ──────────────────────────────────────────────────────

function RatoClosedCard({ rato }: { rato: RatoResponse }) {
  const statusColors: Record<RatoStatus, string> = {
    ACTIVE:            'bg-green-100 text-green-700',
    CHECKED_OUT:       'bg-slate-100 text-slate-600',
    EXTENDED_TO_NIGHT: 'bg-blue-100 text-blue-700',
  };
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 opacity-80">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base font-semibold text-slate-700">Hab. {rato.roomNumber}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[rato.status]}`}>
              {rato.statusLabel}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
            <span>Entrada: {formatTime(rato.entryDateTime)}</span>
            {rato.actualCheckOutTime && <span>Salida: {formatTime(rato.actualCheckOutTime)}</span>}
            {rato.minutesLate && rato.minutesLate > 0
              ? <span className="text-amber-600">{rato.minutesLate} min tarde</span> : null}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-slate-800">
            {formatCOP(rato.basePriceRato + (rato.lateCharge ?? 0) + (rato.nightExtensionCharge ?? 0))}
          </p>
          {rato.lateCharge > 0 && <p className="text-xs text-amber-600">+{formatCOP(rato.lateCharge)} recargo</p>}
          {rato.nightExtensionCharge && rato.nightExtensionCharge > 0
            ? <p className="text-xs text-blue-600">+{formatCOP(rato.nightExtensionCharge)} extensión</p> : null}
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function Rato() {
  const today = toLocalDateStr(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [showEntrada, setShowEntrada]   = useState(false);
  const [checkoutRato, setCheckoutRato] = useState<RatoResponse | null>(null);
  const [convertRato, setConvertRato]   = useState<RatoResponse | null>(null);
  const queryClient = useQueryClient();

  const isToday = selectedDate === today;

  // Ratos activos — solo para hoy
  const { data: active = [], isLoading: loadingActive, isError: errorActive } = useQuery<RatoResponse[]>({
    queryKey: ['rato-active'],
    queryFn: fetchActive,
    refetchInterval: isToday ? 30000 : false,
    enabled: isToday,
  });

  // Historial por fecha
  const { data: history = [], isLoading: loadingHistory, isError: errorHistory } = useQuery<RatoResponse[]>({
    queryKey: ['rato-date', selectedDate],
    queryFn: () => apiClient.get(`/rato/date/${selectedDate}`).then(r => r.data),
    refetchInterval: isToday ? 30000 : false,
  });

  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ['rooms'],
    queryFn: fetchRooms,
  });

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['rato-active'] });
    queryClient.invalidateQueries({ queryKey: ['rato-date', selectedDate] });
    queryClient.invalidateQueries({ queryKey: ['rooms'] });
  };

  const activeRatos = isToday ? active.filter(r => r.status === 'ACTIVE') : [];
  const lateCount   = activeRatos.filter(r => r.isLate).length;

  // Para historial: todos los del día seleccionado
  const historyAll     = history;
  const historyDone    = historyAll.filter(r => r.status !== 'ACTIVE');
  const historyActive  = historyAll.filter(r => r.status === 'ACTIVE');
  const totalRecaudado = historyAll.reduce((sum, r) =>
    sum + r.basePriceRato + (r.lateCharge ?? 0) + (r.nightExtensionCharge ?? 0), 0);

  const isLoading = isToday ? loadingActive : loadingHistory;
  const isError   = isToday ? errorActive : errorHistory;

  const changeDate = (delta: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    const newDate = toLocalDateStr(d);
    if (newDate <= today) setSelectedDate(newDate);
  };

  const formatDateLabel = (str: string) =>
    new Date(str + 'T12:00:00').toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* Encabezado */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Servicio Rato</h1>
            <p className="text-sm text-slate-500 mt-0.5 capitalize">
              {formatDateLabel(selectedDate)}
              {!isToday && (
                <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                  Histórico
                </span>
              )}
              {isToday && lateCount > 0 && (
                <span className="ml-2 text-red-600 font-medium">· {lateCount} con tiempo excedido</span>
              )}
            </p>
          </div>
          {isToday && (
            <button onClick={() => setShowEntrada(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors">
              <span className="text-base leading-none">+</span>
              Nueva entrada
            </button>
          )}
        </div>

        {/* Selector de fecha */}
        <div className="flex items-center gap-2">
          <button onClick={() => changeDate(-1)}
            className="p-1.5 rounded-lg border border-slate-300 hover:bg-white text-slate-600 text-sm">
            &#8592;
          </button>
          <input type="date" value={selectedDate} max={today}
            onChange={e => { if (e.target.value) setSelectedDate(e.target.value); }}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white" />
          <button onClick={() => changeDate(1)} disabled={selectedDate >= today}
            className="p-1.5 rounded-lg border border-slate-300 hover:bg-white text-slate-600 text-sm disabled:opacity-40">
            &#8594;
          </button>
          {!isToday && (
            <button onClick={() => setSelectedDate(today)}
              className="text-xs text-slate-500 hover:text-slate-700 underline ml-1">
              Hoy
            </button>
          )}
        </div>

        {/* Resumen del día */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-slate-800">{historyAll.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Total del día</p>
          </div>
          <div className={`border rounded-xl px-4 py-3 text-center ${
            isToday && lateCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'
          }`}>
            <p className={`text-2xl font-bold ${isToday && lateCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>
              {isToday ? activeRatos.length : historyActive.length}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">En curso</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-slate-800">{historyDone.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Completados</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-center">
            <p className="text-lg font-bold text-slate-800">{formatCOP(totalRecaudado)}</p>
            <p className="text-xs text-slate-500 mt-0.5">Recaudado</p>
          </div>
        </div>

        {isLoading && <div className="text-center py-10 text-slate-400 text-sm">Cargando...</div>}
        {isError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">No se pudieron cargar los ratos.</div>}

        {/* Activos — solo hoy */}
        {isToday && !isLoading && activeRatos.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">En curso ahora</h2>
            {activeRatos
              .sort((a, b) => new Date(a.expectedCheckOutTime).getTime() - new Date(b.expectedCheckOutTime).getTime())
              .map(r => <RatoCard key={r.id} rato={r} onCheckout={setCheckoutRato} />)}
          </div>
        )}

        {isToday && !isLoading && activeRatos.length === 0 && historyAll.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">No hay ratos registrados hoy.</div>
        )}

        {/* Historial del día */}
        {!isLoading && historyDone.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {isToday ? 'Completados hoy' : 'Ratos del día'}
            </h2>
            {historyDone
              .sort((a, b) => new Date(b.entryDateTime).getTime() - new Date(a.entryDateTime).getTime())
              .map(r => <RatoClosedCard key={r.id} rato={r} />)}
          </div>
        )}

        {!isToday && !isLoading && historyAll.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">No hay ratos registrados para este día.</div>
        )}

      </div>

      {showEntrada && (
        <NuevaEntradaModal rooms={rooms} onClose={() => setShowEntrada(false)} onSaved={handleSaved} />
      )}

      {checkoutRato && (
        <CheckoutModal
          rato={checkoutRato}
          onClose={() => setCheckoutRato(null)}
          onSaved={handleSaved}
          onConvert={r => { setCheckoutRato(null); setConvertRato(r); }}
        />
      )}

      {convertRato && (
        <ConvertToNightModal
          rato={convertRato}
          onClose={() => setConvertRato(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}