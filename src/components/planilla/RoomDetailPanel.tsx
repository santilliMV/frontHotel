import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface RoomByDate {
  id: string;
  roomNumber: string;
  floor: number;
  roomTypeName: string;
  status: string;
  statusLabel: string;
  guestName?: string;
  guestPhone?: string;
  checkInDate?: string;
  checkOutDate?: string;
  numberOfNights?: number;
  numberOfGuests?: number;
  reservationNumber?: string;
  reservationId?: string;
  rato?: boolean;
  overdue?: boolean;
}

interface ReservationDetail {
  id: string;
  reservationNumber: string;
  guestName: string;
  guestPhone: string;
  guestHasObservations: boolean;
  roomNumber: string;
  roomTypeName: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfNights: number;
  numberOfGuests: number;
  occupantType: string;
  status: string;
  depositAmount: number | null;
  depositPaid: boolean;
  estimatedTotal: number | null;
  companions: { id: string; name: string; documentNumber: string; phone: string | null }[];
}

interface ServiceCharge {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  addedAt: string;
  addedBy: string;
  serviceType: string;
}

interface TowelInventory {
  cleanTowels: number;
  dirtyTowels: number;
  inLaundry: number;
  totalTowels: number;
}

interface Props {
  room: RoomByDate;
  onClose: () => void;
  onEntregar: (reservaId: string) => void;
}

function fmt(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

function formatDateLong(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatTime(dt: string) {
  return new Date(dt).toLocaleString('es-CO', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

const OCCUPANT_LABELS: Record<string, string> = {
  INDIVIDUAL: 'Individual',
  PAREJA: 'Pareja',
  MULTIPLE_PERSON: 'Múltiple',
};

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'QR', label: 'QR' },
  { value: 'NEQUI_SALOMON', label: 'Nequi Salomón' },
  { value: 'NEQUI_BRAYAN', label: 'Nequi Brayan' },
];

// ─── Componente ──────────────────────────────────────────────────────────────

export default function RoomDetailPanel({ room, onClose, onEntregar }: Props) {
  const queryClient = useQueryClient();
  const reservationId = room.reservationId;

  const [section, setSection] = useState<'info' | 'vitrina' | 'toallas' | 'extender' | 'abono' | 'ocupantes'>(
    room.rato ? 'toallas' : 'info'
  );

  // Estado toallas
  const [towelQty, setTowelQty] = useState(1);
  const [towelDone, setTowelDone] = useState(false);

  // Estado extender
  const [newCheckOut, setNewCheckOut] = useState('');
  const [extendDone, setExtendDone] = useState(false);
  const [extendError, setExtendError] = useState('');

  // Estado abono
  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoMethod, setAbonoMethod] = useState('CASH');
  const [abonoNotes, setAbonoNotes] = useState('');
  const [abonoDone, setAbonoDone] = useState(false);
  const [abonoError, setAbonoError] = useState('');
  const [abonoResult, setAbonoResult] = useState<{ totalAbonado: number; saldoPendiente: number } | null>(null);

  // Estado ocupantes
  const [newGuests, setNewGuests] = useState(0);
  const [ocupantesDone, setOcupantesDone] = useState(false);
  const [ocupantesError, setOcupantesError] = useState('');
  const [ocupantesResult, setOcupantesResult] = useState<{
    oldNumberOfGuests: number;
    newNumberOfGuests: number;
    remainingNights: number;
    newEstimatedTotal: number;
    towelsToDeliver: number;
  } | null>(null);

  // Estado vitrina/pago consumos
  const [vitrinaPayAmount, setVitrinaPayAmount] = useState('');
  const [vitrinaPayMethod, setVitrinaPayMethod] = useState('CASH');
  const [vitrinaPayDone, setVitrinaPayDone] = useState(false);
  const [vitrinaPayError, setVitrinaPayError] = useState('');

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: reservation, isLoading: loadingRes } = useQuery<ReservationDetail>({
    queryKey: ['reservation-detail', reservationId],
    queryFn: () => apiClient.get(`/reservations/${reservationId}`).then(r => r.data),
    enabled: !!reservationId,
  });

  const { data: towels } = useQuery<TowelInventory>({
    queryKey: ['towels-inventory'],
    queryFn: () => apiClient.get('/towels/inventory').then(r => r.data),
  });

  const { data: serviceCharges = [], isLoading: loadingCharges } = useQuery<ServiceCharge[]>({
    queryKey: ['service-charges', reservationId],
    queryFn: () => apiClient.get(`/reservations/${reservationId}/charges`).then(r => r.data),
    enabled: !!reservationId && section === 'vitrina',
  });

  // ── Mutación: entregar toallas extra ──────────────────────────────────────

  const towelMutation = useMutation({
    mutationFn: () =>
      apiClient.post(
        `/towels/nightly-change?reservationId=${reservationId}&roomId=${room.id}&towelsReturned=0&towelsDelivered=${towelQty}&nightNumber=0`
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['towels-inventory'] });
      setTowelDone(true);
    },
  });

  // ── Mutación: ocupantes ───────────────────────────────────────────────────

  const ocupantesMutation = useMutation({
    mutationFn: () =>
      apiClient.patch(`/reservations/${reservationId}/guests`, {
        numberOfGuests: newGuests,
      }).then(r => r.data),
    onSuccess: (data) => {
      setOcupantesDone(true);
      setOcupantesError('');
      setOcupantesResult(data);
      queryClient.invalidateQueries({ queryKey: ['reservation-detail', reservationId] });
      queryClient.invalidateQueries({ queryKey: ['rooms-by-date'] });
    },
    onError: (err: any) => {
      setOcupantesError(err?.response?.data?.error ?? 'Error al actualizar ocupantes');
    },
  });

  // ── Mutación: extender estadía ────────────────────────────────────────────

  const extendMutation = useMutation({
    mutationFn: () =>
      apiClient.patch(`/reservations/${reservationId}/extend`, {
        newCheckOutDate: newCheckOut,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservation-detail', reservationId] });
      queryClient.invalidateQueries({ queryKey: ['rooms-by-date'] });
      setExtendDone(true);
      setExtendError('');
    },
    onError: (err: any) => {
      setExtendError(err?.response?.data?.error ?? 'Error al extender la estadía');
    },
  });

  // ── Mutación: abono ───────────────────────────────────────────────────────

  const abonoMutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/reservations/${reservationId}/abono`, {
        amount: abonoAmount,
        method: abonoMethod,
        notes: abonoNotes.trim() || null,
      }).then(r => r.data),
    onSuccess: (data) => {
      setAbonoDone(true);
      setAbonoError('');
      setAbonoResult(data);
      queryClient.invalidateQueries({ queryKey: ['reservation-detail', reservationId] });
      queryClient.invalidateQueries({ queryKey: ['rooms-by-date'] });
    },
    onError: (err: any) => {
      setAbonoError(err?.response?.data?.error ?? 'Error al registrar el abono');
    },
  });

  // ── Mutación: pagar consumos de vitrina ───────────────────────────────────

  const vitrinaPayMutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/reservations/${reservationId}/charges/pay`, {
        amount: vitrinaPayAmount,
        method: vitrinaPayMethod,
      }).then(r => r.data),
    onSuccess: () => {
      setVitrinaPayDone(true);
      setVitrinaPayError('');
      queryClient.invalidateQueries({ queryKey: ['service-charges', reservationId] });
      queryClient.invalidateQueries({ queryKey: ['rooms-by-date'] });
    },
    onError: (err: any) => {
      setVitrinaPayError(err?.response?.data?.error ?? 'Error al registrar el pago');
    },
  });

  // ── Cálculos ──────────────────────────────────────────────────────────────

  const depositPagado = reservation?.depositAmount ?? 0;
  const totalEstimado = reservation?.estimatedTotal ?? 0;
  const saldoPendiente = Math.max(0, totalEstimado - depositPagado);

  const totalConsumos = serviceCharges.reduce((sum, c) => sum + c.totalPrice, 0);

  const minExtendDate = reservation
    ? (() => {
        const d = new Date(reservation.checkOutDate + 'T12:00:00');
        d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
      })()
    : '';

  // ─────────────────────────────────────────────────────────────────────────

  const TABS = [
    { key: 'info',      label: 'Info' },
    { key: 'vitrina',   label: 'Vitrina' },
    { key: 'toallas',   label: 'Toallas' },
    { key: 'extender',  label: 'Extender' },
    { key: 'abono',     label: 'Abono' },
    { key: 'ocupantes', label: 'Ocupantes' },
  ] as const;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[420px] bg-white shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-slate-800">Hab. {room.roomNumber}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${room.rato
                ? 'bg-violet-100 text-violet-700 border-violet-200'
                : room.overdue
                  ? 'bg-orange-100 text-orange-700 border-orange-200'
                  : room.status === 'OCCUPIED'
                    ? 'bg-blue-100 text-blue-700 border-blue-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                {room.rato ? 'Rato' : room.overdue ? 'Vencida' : room.statusLabel}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{room.roomTypeName} · Piso {room.floor}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        {reservationId && room.status === 'OCCUPIED' && (
          <div className="flex border-b border-slate-200 overflow-x-auto">
            {(room.rato ? TABS.filter(t => t.key === 'toallas') : TABS).map(tab => (
              <button
                key={tab.key}
                onClick={() => setSection(tab.key)}
                className={`flex-shrink-0 px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  section === tab.key
                    ? 'text-slate-800 border-b-2 border-slate-800 bg-white'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tab.label}
                {tab.key === 'vitrina' && serviceCharges.length > 0 && (
                  <span className="ml-1 bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                    {serviceCharges.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Sección: INFO ─────────────────────────────────────────────── */}
          {(section === 'info' || !reservationId) && !room.rato && (
            <div className="p-6 space-y-5">

              {loadingRes && (
                <p className="text-sm text-slate-400 text-center py-8">Cargando...</p>
              )}

              {!loadingRes && reservation && (
                <>
                  {reservation.guestHasObservations && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                      <p className="text-sm font-medium text-red-700">Este huésped tiene observaciones registradas</p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Huésped principal</p>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Nombre</span>
                        <span className="text-sm font-medium text-slate-800">{reservation.guestName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Teléfono</span>
                        <span className="text-sm text-slate-700">{reservation.guestPhone || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Ocupación</span>
                        <span className="text-sm text-slate-700">{OCCUPANT_LABELS[reservation.occupantType] ?? reservation.occupantType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Personas</span>
                        <span className="text-sm text-slate-700">{reservation.numberOfGuests}</span>
                      </div>
                    </div>
                  </div>

                  {reservation.companions.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                        Acompañantes ({reservation.companions.length})
                      </p>
                      <div className="space-y-2">
                        {reservation.companions.map(c => (
                          <div key={c.id} className="bg-slate-50 rounded-lg px-3 py-2.5">
                            <p className="text-sm font-medium text-slate-700">{c.name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Doc: {c.documentNumber || '—'}
                              {c.phone ? ` · ${c.phone}` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Estadía</p>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Entrada</span>
                        <span className="text-sm text-slate-700">{formatDateLong(reservation.checkInDate)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Salida</span>
                        <span className="text-sm font-medium text-slate-800">{formatDateLong(reservation.checkOutDate)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Noches</span>
                        <span className="text-sm text-slate-700">{reservation.numberOfNights}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Reserva</span>
                        <span className="text-xs font-mono text-purple-600">{reservation.reservationNumber}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Estado de cuenta</p>
                    <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Total estimado</span>
                        <span className="text-sm font-medium text-slate-800">
                          {totalEstimado > 0 ? fmt(totalEstimado) : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Depósito pagado</span>
                        <span className={`text-sm font-medium ${depositPagado > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {depositPagado > 0 ? fmt(depositPagado) : 'Sin depósito'}
                        </span>
                      </div>
                      <div className="border-t border-slate-200 pt-2.5 flex justify-between">
                        <span className="text-sm font-semibold text-slate-700">Saldo pendiente</span>
                        <span className={`text-sm font-bold ${saldoPendiente > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {saldoPendiente > 0 ? fmt(saldoPendiente) : 'Al día'}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      * El total final se calcula al hacer checkout e incluye consumos de vitrina y cargos adicionales.
                    </p>
                  </div>
                </>
              )}

              {!loadingRes && !reservation && !reservationId && (
                <div className="py-12 text-center">
                  <p className="text-sm text-slate-400">Sin reserva activa en esta habitación.</p>
                </div>
              )}
            </div>
          )}

          {/* ── Sección: VITRINA ─────────────────────────────────────────── */}
          {section === 'vitrina' && reservation && (
            <div className="p-6 space-y-5">

              {/* Resumen consumos */}
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                  Consumos anotados a la habitación
                </p>

                {loadingCharges && (
                  <p className="text-sm text-slate-400 text-center py-4">Cargando...</p>
                )}

                {!loadingCharges && serviceCharges.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4">
                    Sin consumos anotados
                  </p>
                )}

                {!loadingCharges && serviceCharges.length > 0 && (
                  <div className="space-y-2">
                    {serviceCharges.map(charge => (
                      <div key={charge.id} className="bg-white rounded-lg px-3 py-2.5 border border-slate-100">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{charge.description}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {charge.quantity} × {fmt(charge.unitPrice)} · {formatTime(charge.addedAt)}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-slate-800 ml-3 flex-shrink-0">
                            {fmt(charge.totalPrice)}
                          </span>
                        </div>
                      </div>
                    ))}

                    {/* Total */}
                    <div className="flex justify-between items-center border-t border-slate-200 pt-3 mt-1">
                      <span className="text-sm font-semibold text-slate-700">Total consumos</span>
                      <span className="text-base font-bold text-amber-600">{fmt(totalConsumos)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Sección pago */}
              {serviceCharges.length > 0 && (
                <>
                  {vitrinaPayDone ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-4 text-center space-y-1">
                      <p className="text-sm font-medium text-emerald-700">Pago registrado correctamente</p>
                      <p className="text-xs text-slate-500">El cobro quedó registrado en caja</p>
                      <button
                        onClick={() => {
                          setVitrinaPayDone(false);
                          setVitrinaPayAmount('');
                          queryClient.invalidateQueries({ queryKey: ['service-charges', reservationId] });
                        }}
                        className="mt-2 text-xs text-emerald-600 underline"
                      >
                        Registrar otro pago
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                        Pagar consumos ahora
                      </p>

                      {/* Monto */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Monto a cobrar</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                          <input
                            type="number"
                            value={vitrinaPayAmount}
                            onChange={e => { setVitrinaPayAmount(e.target.value); setVitrinaPayError(''); }}
                            placeholder="0"
                            min="1"
                            className="w-full border border-slate-300 rounded-lg pl-7 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                          />
                        </div>
                        {/* Atajo total */}
                        <button
                          onClick={() => setVitrinaPayAmount(String(Math.round(totalConsumos)))}
                          className="mt-1.5 text-xs text-blue-600 hover:underline"
                        >
                          Usar total: {fmt(totalConsumos)}
                        </button>
                      </div>

                      {/* Método */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Método de pago</label>
                        <select
                          value={vitrinaPayMethod}
                          onChange={e => setVitrinaPayMethod(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                        >
                          {PAYMENT_METHODS.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                          ))}
                        </select>
                      </div>

                      {vitrinaPayError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                          <p className="text-sm text-red-600">{vitrinaPayError}</p>
                        </div>
                      )}

                      <button
                        onClick={() => vitrinaPayMutation.mutate()}
                        disabled={!vitrinaPayAmount || Number(vitrinaPayAmount) <= 0 || vitrinaPayMutation.isPending}
                        className="w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white text-sm font-medium py-3 rounded-xl transition-colors"
                      >
                        {vitrinaPayMutation.isPending
                          ? 'Registrando...'
                          : `Cobrar ${vitrinaPayAmount ? fmt(Number(vitrinaPayAmount)) : '...'}`}
                      </button>

                      <p className="text-xs text-slate-400 text-center">
                        Este pago se registra en caja. Los consumos seguirán apareciendo en el checkout para el resumen final.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Sección: TOALLAS EXTRA ────────────────────────────────────── */}
          {section === 'toallas' && reservation && (
            <div className="p-6 space-y-5">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Inventario actual</p>
                <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-3 mt-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-600">{towels?.cleanTowels ?? '—'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Limpias disponibles</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-600">{towels?.totalTowels ?? '—'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Total inventario</p>
                  </div>
                </div>
              </div>

              {towelDone ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-4 text-center">
                  <p className="text-sm font-medium text-emerald-700">
                    {towelQty} toalla{towelQty !== 1 ? 's' : ''} entregada{towelQty !== 1 ? 's' : ''} correctamente
                  </p>
                  <button
                    onClick={() => { setTowelDone(false); setTowelQty(1); }}
                    className="mt-3 text-xs text-emerald-600 underline"
                  >
                    Entregar más
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Cantidad a entregar</label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setTowelQty(q => Math.max(1, q - 1))}
                        className="w-10 h-10 rounded-lg border border-slate-300 text-slate-600 text-lg font-bold hover:bg-slate-50 flex items-center justify-center"
                      >−</button>
                      <span className="text-2xl font-bold text-slate-800 w-8 text-center">{towelQty}</span>
                      <button
                        onClick={() => setTowelQty(q => Math.min(towels?.cleanTowels ?? 10, q + 1))}
                        className="w-10 h-10 rounded-lg border border-slate-300 text-slate-600 text-lg font-bold hover:bg-slate-50 flex items-center justify-center"
                      >+</button>
                    </div>
                    {towels && towelQty > towels.cleanTowels && (
                      <p className="text-xs text-red-500 mt-2">No hay suficientes toallas limpias</p>
                    )}
                  </div>

                  <div className="bg-slate-50 rounded-lg px-4 py-3">
                    <p className="text-xs text-slate-500">Hab. {room.roomNumber} · {reservation.guestName}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Las toallas se registran como entrega adicional sin recoger sucias.</p>
                  </div>

                  <button
                    onClick={() => towelMutation.mutate()}
                    disabled={towelMutation.isPending || (towels ? towelQty > towels.cleanTowels : false)}
                    className="w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white text-sm font-medium py-3 rounded-xl transition-colors"
                  >
                    {towelMutation.isPending ? 'Registrando...' : `Entregar ${towelQty} toalla${towelQty !== 1 ? 's' : ''}`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Sección: EXTENDER ─────────────────────────────────────────── */}
          {section === 'extender' && reservation && (
            <div className="p-6 space-y-5">
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Estadía actual</p>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Salida actual</span>
                  <span className="text-sm font-semibold text-slate-800">{formatDateLong(reservation.checkOutDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Noches actuales</span>
                  <span className="text-sm text-slate-700">{reservation.numberOfNights}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Total estimado actual</span>
                  <span className="text-sm text-slate-700">{reservation.estimatedTotal ? fmt(reservation.estimatedTotal) : '—'}</span>
                </div>
              </div>

              {extendDone ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-4 text-center">
                  <p className="text-sm font-medium text-emerald-700">Estadía extendida correctamente</p>
                  <p className="text-xs text-slate-500 mt-1">Nueva salida: {newCheckOut ? formatDateLong(newCheckOut) : ''}</p>
                  <button
                    onClick={() => { setExtendDone(false); setNewCheckOut(''); }}
                    className="mt-3 text-xs text-emerald-600 underline"
                  >
                    Extender de nuevo
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Nueva fecha de salida</label>
                    <input
                      type="date" value={newCheckOut} min={minExtendDate}
                      onChange={e => { setNewCheckOut(e.target.value); setExtendError(''); setExtendDone(false); }}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                    />
                  </div>

                  {newCheckOut && reservation && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
                      <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Resumen del cambio</p>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Salida anterior</span>
                        <span className="text-sm text-slate-500 line-through">{formatDateLong(reservation.checkOutDate)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-700">Nueva salida</span>
                        <span className="text-sm font-semibold text-blue-700">{formatDateLong(newCheckOut)}</span>
                      </div>
                      <div className="flex justify-between border-t border-blue-100 pt-2">
                        <span className="text-sm text-slate-500">Noches adicionales</span>
                        <span className="text-sm font-medium text-slate-800">
                          {Math.max(0, Math.round(
                            (new Date(newCheckOut + 'T12:00:00').getTime() -
                              new Date(reservation.checkOutDate + 'T12:00:00').getTime())
                            / (1000 * 60 * 60 * 24)
                          ))} noche(s)
                        </span>
                      </div>
                    </div>
                  )}

                  {extendError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      <p className="text-sm text-red-600">{extendError}</p>
                    </div>
                  )}

                  <button
                    onClick={() => extendMutation.mutate()}
                    disabled={!newCheckOut || extendMutation.isPending}
                    className="w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white text-sm font-medium py-3 rounded-xl transition-colors"
                  >
                    {extendMutation.isPending ? 'Guardando...' : 'Confirmar extensión'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Sección: ABONO ───────────────────────────────────────────── */}
          {section === 'abono' && reservation && (
            <div className="p-6 space-y-5">

              <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Estado de cuenta</p>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Total estimado</span>
                  <span className="text-sm font-medium text-slate-800">
                    {reservation.estimatedTotal ? fmt(reservation.estimatedTotal) : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Total abonado</span>
                  <span className="text-sm font-medium text-emerald-600">
                    {reservation.depositAmount ? fmt(reservation.depositAmount) : '$0'}
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-2.5 flex justify-between">
                  <span className="text-sm font-semibold text-slate-700">Saldo pendiente</span>
                  <span className={`text-sm font-bold ${abonoResult
                    ? (abonoResult.saldoPendiente > 0 ? 'text-amber-600' : 'text-emerald-600')
                    : (saldoPendiente > 0 ? 'text-amber-600' : 'text-emerald-600')
                    }`}>
                    {abonoResult
                      ? (abonoResult.saldoPendiente > 0 ? fmt(abonoResult.saldoPendiente) : 'Al día')
                      : (saldoPendiente > 0 ? fmt(saldoPendiente) : 'Al día')}
                  </span>
                </div>
              </div>

              {abonoDone && abonoResult ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-4 text-center space-y-1">
                  <p className="text-sm font-medium text-emerald-700">Abono registrado correctamente</p>
                  <p className="text-xs text-slate-500">Total abonado: {fmt(abonoResult.totalAbonado)}</p>
                  <p className="text-xs text-slate-500">
                    Saldo pendiente: {abonoResult.saldoPendiente > 0 ? fmt(abonoResult.saldoPendiente) : '$0'}
                  </p>
                  <button
                    onClick={() => { setAbonoDone(false); setAbonoAmount(''); setAbonoNotes(''); setAbonoResult(null); }}
                    className="mt-2 text-xs text-emerald-600 underline"
                  >
                    Registrar otro abono
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Monto del abono</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                      <input
                        type="number" value={abonoAmount}
                        onChange={e => { setAbonoAmount(e.target.value); setAbonoError(''); }}
                        placeholder="0" min="1"
                        className="w-full border border-slate-300 rounded-lg pl-7 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Método de pago</label>
                    <select
                      value={abonoMethod} onChange={e => setAbonoMethod(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                    >
                      {PAYMENT_METHODS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Observación <span className="text-slate-400 font-normal">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={abonoNotes}
                      onChange={e => setAbonoNotes(e.target.value)}
                      placeholder="Ej: pago con billete roto, abono parcial..."
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                    />
                  </div>

                  {abonoAmount && Number(abonoAmount) > 0 && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-1.5">
                      <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Resumen</p>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Abono a registrar</span>
                        <span className="text-sm font-semibold text-blue-700">{fmt(Number(abonoAmount))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Saldo después del abono</span>
                        <span className="text-sm font-medium text-slate-700">
                          {fmt(Math.max(0, saldoPendiente - Number(abonoAmount)))}
                        </span>
                      </div>
                      {abonoNotes.trim() && (
                        <div className="border-t border-blue-100 pt-1.5">
                          <span className="text-xs text-slate-500">Obs: </span>
                          <span className="text-xs text-slate-700">{abonoNotes.trim()}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {abonoError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      <p className="text-sm text-red-600">{abonoError}</p>
                    </div>
                  )}

                  <button
                    onClick={() => abonoMutation.mutate()}
                    disabled={!abonoAmount || Number(abonoAmount) <= 0 || abonoMutation.isPending}
                    className="w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white text-sm font-medium py-3 rounded-xl transition-colors"
                  >
                    {abonoMutation.isPending ? 'Registrando...' : `Registrar abono de ${abonoAmount ? fmt(Number(abonoAmount)) : '...'}`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Sección: OCUPANTES ───────────────────────────────────── */}
          {section === 'ocupantes' && reservation && (
            <div className="p-6 space-y-5">
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Ocupación actual</p>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Personas registradas</span>
                  <span className="text-sm font-semibold text-slate-800">{reservation.numberOfGuests}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Tipo</span>
                  <span className="text-sm text-slate-700">{OCCUPANT_LABELS[reservation.occupantType] ?? reservation.occupantType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Total estimado actual</span>
                  <span className="text-sm text-slate-700">{reservation.estimatedTotal ? fmt(reservation.estimatedTotal) : '—'}</span>
                </div>
              </div>

              {ocupantesDone && ocupantesResult ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-4 text-center space-y-1">
                  <p className="text-sm font-medium text-emerald-700">Ocupantes actualizados</p>
                  <p className="text-xs text-slate-500">
                    {ocupantesResult.oldNumberOfGuests} → {ocupantesResult.newNumberOfGuests} personas
                  </p>
                  {ocupantesResult.towelsToDeliver > 0 && (
                    <p className="text-xs text-blue-600 font-medium">
                      Recuerda entregar {ocupantesResult.towelsToDeliver} toalla{ocupantesResult.towelsToDeliver !== 1 ? 's' : ''} adicional{ocupantesResult.towelsToDeliver !== 1 ? 'es' : ''}
                    </p>
                  )}
                  <p className="text-xs text-slate-500">
                    Nuevo total estimado: {fmt(ocupantesResult.newEstimatedTotal)}
                  </p>
                  <button
                    onClick={() => { setOcupantesDone(false); setOcupantesResult(null); setNewGuests(0); }}
                    className="mt-2 text-xs text-emerald-600 underline"
                  >
                    Modificar de nuevo
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Nuevo número de personas</label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setNewGuests(g => Math.max(1, g - 1))}
                        className="w-10 h-10 rounded-lg border border-slate-300 text-slate-600 text-lg font-bold hover:bg-slate-50 flex items-center justify-center"
                      >−</button>
                      <span className="text-2xl font-bold text-slate-800 w-8 text-center">
                        {newGuests || reservation.numberOfGuests}
                      </span>
                      <button
                        onClick={() => setNewGuests(g => (g || reservation.numberOfGuests) + 1)}
                        className="w-10 h-10 rounded-lg border border-slate-300 text-slate-600 text-lg font-bold hover:bg-slate-50 flex items-center justify-center"
                      >+</button>
                    </div>
                  </div>

                  {newGuests > 0 && newGuests !== reservation.numberOfGuests && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-1.5">
                      <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Resumen del cambio</p>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">Personas antes</span>
                        <span className="text-sm text-slate-500 line-through">{reservation.numberOfGuests}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-700">Personas nuevas</span>
                        <span className="text-sm font-semibold text-blue-700">{newGuests}</span>
                      </div>
                      {newGuests > reservation.numberOfGuests && (
                        <div className="flex justify-between border-t border-blue-100 pt-1.5">
                          <span className="text-sm text-slate-500">Toallas a entregar</span>
                          <span className="text-sm font-medium text-slate-800">
                            {newGuests - reservation.numberOfGuests} toalla{newGuests - reservation.numberOfGuests !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                      <p className="text-xs text-slate-400 mt-1">El nuevo precio aplica solo para las noches restantes.</p>
                    </div>
                  )}

                  {ocupantesError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      <p className="text-sm text-red-600">{ocupantesError}</p>
                    </div>
                  )}

                  <button
                    onClick={() => ocupantesMutation.mutate()}
                    disabled={!newGuests || newGuests === reservation.numberOfGuests || ocupantesMutation.isPending}
                    className="w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white text-sm font-medium py-3 rounded-xl transition-colors"
                  >
                    {ocupantesMutation.isPending
                      ? 'Guardando...'
                      : `Actualizar a ${newGuests || reservation.numberOfGuests} persona${(newGuests || reservation.numberOfGuests) !== 1 ? 's' : ''}`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {reservation && room.status === 'OCCUPIED' && (
          <div className="border-t border-slate-200 px-6 py-4">
            <button
              onClick={() => onEntregar(reservation.id)}
              className="w-full bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
            >
              Iniciar checkout
            </button>
          </div>
        )}
      </div>
    </>
  );
}