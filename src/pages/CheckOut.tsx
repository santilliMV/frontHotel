import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import apiClient from '../api/client';
import type { ReservationResponse } from '../types';
import { useLocation } from 'react-router-dom';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'QR' | 'NEQUI_SALOMON' | 'NEQUI_BRAYAN';

interface LateStatusResponse {
  isLate: boolean;
  minutesLate: number;
}

interface BillingResponse {
  billingId: string;
  reservationId: string;
  invoiceNumber: string;
  basePrice: number;
  additionalCharges: number;
  discounts: number;
  subtotal: number;
  taxes: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE';
  requiresElectronicInvoice: boolean;
  generatedAt: string;
  guestName?: string;
  roomNumber?: string;
  checkInDate?: string;
  checkOutDate?: string;
  numberOfNights?: number;
}

interface PaymentLine {
  method: PaymentMethod;
  amount: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  QR: 'QR',
  NEQUI_SALOMON: 'Nequi Salomón',
  NEQUI_BRAYAN: 'Nequi Brayan',
};

const ALL_METHODS: PaymentMethod[] = ['CASH', 'CARD', 'TRANSFER', 'QR', 'NEQUI_SALOMON', 'NEQUI_BRAYAN'];

function formatDateTime(dt: string) {
  if (!dt) return '';
  const d = new Date(dt);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(d: string) {
  if (!d) return '';
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Componente principal ─────────────────────────────────────────────────────


export default function CheckOut() {

  const location = useLocation();

  useEffect(() => {
    const stateReservationId = location.state?.reservationId as string | undefined;
    if (stateReservationId) {
      // Buscar la reserva directamente y saltar al paso checkout
      apiClient.get(`/reservations/${stateReservationId}`).then(r => {
        handleSelectReservation(r.data);
      }).catch(() => {/* si falla, queda en búsqueda */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Búsqueda
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'phone' | 'number'>('phone');

  // Reserva seleccionada
  const [reservation, setReservation] = useState<ReservationResponse | null>(null);

  // Estado del checkout
  const [step, setStep] = useState<'search' | 'checkout' | 'payment' | 'done'>('search');
  const [lateStatus, setLateStatus] = useState<LateStatusResponse | null>(null);

  // Opciones de checkout
  const [applyLate, setApplyLate] = useState(false);
  const [lateCharge, setLateCharge] = useState('');
  const [electronicInvoice, setElectronic] = useState(false);
  const [inspectionNotes, setInspection] = useState('');
  const [damageReported, setDamage] = useState('');
  const [notes, setNotes] = useState('');

  // Factura
  const [billing, setBilling] = useState<BillingResponse | null>(null);

  // Pagos
  const [payments, setPayments] = useState<PaymentLine[]>([{ method: 'CASH', amount: '' }]);
  const [payingAll, setPayingAll] = useState(false);

  // ── Búsqueda de reservas ──────────────────────────────────────────────────

  const { data: searchResults = [], isFetching: searching } = useQuery<ReservationResponse[]>({
    queryKey: ['checkout-search', searchQuery, searchMode],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      if (searchMode === 'phone') {
        const r = await apiClient.get(`/reservations/phone/${searchQuery.trim()}`);
        const data = r.data;
        // Filtramos solo CHECKED_IN
        return (Array.isArray(data) ? data : [data]).filter(
          (res: ReservationResponse) => res.status === 'CHECKED_IN'
        );
      } else {
        const r = await apiClient.get(`/reservations/number/${searchQuery.trim()}`);
        const data = r.data;
        const arr = Array.isArray(data) ? data : [data];
        return arr.filter((res: ReservationResponse) => res.status === 'CHECKED_IN');
      }
    },
    enabled: searchQuery.trim().length >= 3,
  });

  // ── Seleccionar reserva ───────────────────────────────────────────────────

  const handleSelectReservation = async (res: ReservationResponse) => {
    setReservation(res);
    setStep('checkout');

    // Consultar late status
    try {
      const r = await apiClient.get(`/checkout/late-status/${res.id}`);
      setLateStatus(r.data as LateStatusResponse);
      if (r.data.isLate) setApplyLate(true);
    } catch {
      setLateStatus(null);
    }
  };

  // ── Mutación checkout ─────────────────────────────────────────────────────

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const body = {
        reservationId: reservation!.id,
        applyLateCheckoutCharge: applyLate,
        lateCheckoutCharge: applyLate && lateCharge ? parseFloat(lateCharge) : null,
        requiresElectronicInvoice: electronicInvoice,
        inspectionNotes: inspectionNotes || null,
        damageReported: damageReported || null,
        notes: notes || null,
      };
      const r = await apiClient.post('/checkout', body);
      return r.data as BillingResponse;
    },
    onSuccess: (data) => {
      setBilling(data);
      setStep('payment');
      // Pre-rellenar primer pago con el balance total
      setPayments([{ method: 'CASH', amount: String(Math.round(data.balanceDue)) }]);
    },
  });

  // ── Mutación pago ─────────────────────────────────────────────────────────

  const paymentMutation = useMutation({
    mutationFn: async () => {
      console.log('billing object:', billing);
      console.log('billing.id:', billing!.billingId);

      const validPayments = payments.filter(p => p.amount && parseFloat(p.amount) > 0);

      for (const p of validPayments) {
        const res = await apiClient.post('/billing/payment', {
          billingId: billing!.billingId,
          amount: parseFloat(p.amount),
          method: p.method,
        });
        console.log('Payment response:', res.data);
      }

      const r = await apiClient.get(`/billing/${billing!.billingId}`);
      return r.data as BillingResponse;
    },

    onError: (e: any) => {
      console.error('Payment error body:', e?.response?.data);
      console.error('Payment error status:', e?.response?.status);
    },

    onSuccess: (data) => {
      setBilling(data);
      setStep('done');
    },
  });

  // ── Cálculos de pago ──────────────────────────────────────────────────────

  const totalPaid = payments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
  const pendingBalance = billing ? Math.max(0, billing.balanceDue - totalPaid) : 0;
  const overpaid = billing && totalPaid > billing.balanceDue;

  const handleAddPayment = () => setPayments(prev => [...prev, { method: 'CASH', amount: '' }]);
  const handleRemovePayment = (i: number) => setPayments(prev => prev.filter((_, idx) => idx !== i));
  const handlePaymentChange = (i: number, field: keyof PaymentLine, value: string) => {
    setPayments(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  };

  const handlePayAll = () => {
    if (!billing) return;
    setPayments([{ method: 'CASH', amount: String(Math.round(billing.balanceDue)) }]);
    setPayingAll(true);
  };

  // ── Reset ─────────────────────────────────────────────────────────────────

  const handleReset = () => {
    setSearchInput('');
    setSearchQuery('');
    setReservation(null);
    setStep('search');
    setLateStatus(null);
    setApplyLate(false);
    setLateCharge('');
    setElectronic(false);
    setInspection('');
    setDamage('');
    setNotes('');
    setBilling(null);
    setPayments([{ method: 'CASH', amount: '' }]);
    setPayingAll(false);
    checkoutMutation.reset();
    paymentMutation.reset();
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Check-out</h2>
          <p className="text-sm text-slate-500 mt-0.5">Procesa la salida y facturación de un huésped</p>
        </div>
        {step !== 'search' && (
          <button
            onClick={handleReset}
            className="text-sm text-slate-500 border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-lg"
          >
            ← Nueva búsqueda
          </button>
        )}
      </div>

      {/* ── PASO 1: BÚSQUEDA ── */}
      {step === 'search' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <h3 className="font-semibold text-slate-700">Buscar reserva activa</h3>

          {/* Tabs de modo */}
          <div className="flex bg-slate-100 rounded-lg p-1 w-fit gap-1">
            {(['phone', 'number'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => { setSearchMode(mode); setSearchQuery(''); setSearchInput(''); }}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${searchMode === mode
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                {mode === 'phone' ? 'Por teléfono' : 'Por número de reserva'}
              </button>
            ))}
          </div>

          {/* Input de búsqueda */}
          <div className="flex gap-3">
            <input
              type="text"
              placeholder={searchMode === 'phone' ? 'Ej: 3001234567' : 'Ej: RES-20240415-001'}
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setSearchQuery(searchInput)}
              className="flex-1 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <button
              onClick={() => setSearchQuery(searchInput)}
              disabled={!searchInput.trim()}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg"
            >
              Buscar
            </button>
          </div>

          {/* Resultados */}
          {searching && (
            <p className="text-sm text-slate-400">Buscando...</p>
          )}

          {!searching && searchQuery && searchResults.length === 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
              No se encontraron reservas con check-in activo para esa búsqueda.
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map(res => (
                <button
                  key={res.id}
                  onClick={() => handleSelectReservation(res)}
                  className="w-full text-left border border-slate-200 rounded-lg px-4 py-3 hover:border-slate-400 hover:bg-slate-50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-800">{res.guestName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {res.reservationNumber} · {res.roomNumber ? `Hab. ${res.roomNumber}` : 'Sin hab. asignada'} · {res.numberOfNights} noche{res.numberOfNights !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2.5 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                        Check-in activo
                      </span>
                      {res.guestHasObservations && (
                        <p className="text-xs text-red-500 mt-1">⚠️ Tiene observaciones</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── PASO 2: DETALLES DE CHECKOUT ── */}
      {step === 'checkout' && reservation && (
        <div className="space-y-4">

          {/* Alerta late checkout */}
          {lateStatus?.isLate && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
              <span className="text-red-500 text-xl mt-0.5">⏰</span>
              <div>
                <p className="font-semibold text-red-700 text-sm">Late checkout detectado</p>
                <p className="text-xs text-red-600 mt-0.5">
                  {lateStatus.minutesLate} minuto{lateStatus.minutesLate !== 1 ? 's' : ''} después de las 11:00 AM.
                  El recepcionista decide si aplica multa.
                </p>
              </div>
            </div>
          )}

          {/* Info de la reserva */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-700 mb-4">Información de la estadía</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <InfoRow label="Huésped" value={reservation.guestName} />
              <InfoRow label="Teléfono" value={reservation.guestPhone} />
              <InfoRow label="Reserva" value={reservation.reservationNumber} />
              <InfoRow label="Habitación" value={reservation.roomNumber ? `Hab. ${reservation.roomNumber}` : '—'} />
              <InfoRow label="Tipo" value={reservation.roomTypeName} />
              <InfoRow label="Noches" value={`${reservation.numberOfNights}`} />
              <InfoRow label="Check-in" value={formatDate(reservation.checkInDate)} />
              <InfoRow label="Check-out" value={formatDate(reservation.checkOutDate)} />
              {reservation.estimatedTotal && (
                <InfoRow label="Total estimado" value={fmtCOP(reservation.estimatedTotal)} highlight />
              )}
              {reservation.depositAmount && reservation.depositAmount > 0 && (
                <InfoRow label="Depósito pagado" value={fmtCOP(reservation.depositAmount)} />
              )}
            </div>

            {reservation.guestHasObservations && (
              <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                ⚠️ Este huésped tiene observaciones registradas. Revisa el perfil antes de proceder.
              </div>
            )}
          </div>

          {/* Opciones de checkout */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
            <h3 className="font-semibold text-slate-700">Opciones de facturación</h3>

            {/* Late checkout charge */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">Cobrar multa por late checkout</p>
                  <p className="text-xs text-slate-400 mt-0.5">El recepcionista decide el monto</p>
                </div>
                <button
                  onClick={() => { setApplyLate(v => !v); if (applyLate) setLateCharge(''); }}
                  className={`relative w-11 h-6 rounded-full transition-colors ${applyLate ? 'bg-slate-700' : 'bg-slate-200'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${applyLate ? 'left-6' : 'left-1'}`} />
                </button>
              </div>

              {applyLate && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-500 shrink-0">Monto de la multa:</span>
                  <div className="relative flex-1 max-w-xs">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={lateCharge}
                      onChange={e => setLateCharge(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg pl-7 pr-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100" />

            {/* Factura electrónica */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Requiere factura electrónica</p>
                <p className="text-xs text-slate-400 mt-0.5">Aplica IVA del 19%</p>
              </div>
              <button
                onClick={() => setElectronic(v => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors ${electronicInvoice ? 'bg-slate-700' : 'bg-slate-200'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${electronicInvoice ? 'left-6' : 'left-1'}`} />
              </button>
            </div>

            <div className="border-t border-slate-100" />

            {/* Notas opcionales */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">Notas opcionales</p>
              <textarea
                rows={2}
                placeholder="Inspección de habitación..."
                value={inspectionNotes}
                onChange={e => setInspection(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
              <textarea
                rows={2}
                placeholder="Daños reportados (si aplica)..."
                value={damageReported}
                onChange={e => setDamage(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
              <textarea
                rows={2}
                placeholder="Observaciones generales..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
          </div>

          {/* Error */}
          {checkoutMutation.isError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {(checkoutMutation.error as Error)?.message ?? 'Error al procesar el check-out. Intenta de nuevo.'}
            </div>
          )}

          {/* Botón procesar */}
          <button
            onClick={() => checkoutMutation.mutate()}
            disabled={checkoutMutation.isPending || (applyLate && !lateCharge)}
            className="w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white font-medium py-3 rounded-xl text-sm"
          >
            {checkoutMutation.isPending ? 'Generando factura...' : 'Procesar check-out y generar factura →'}
          </button>
        </div>
      )}

      {/* ── PASO 3: PAGO ── */}
      {step === 'payment' && billing && (
        <div className="space-y-4">

          {/* Resumen de factura */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-700">Resumen de factura</h3>
              <span className="text-xs text-slate-400">{billing.invoiceNumber}</span>
            </div>

            <div className="space-y-2 text-sm">
              <BillingRow label="Base (noches)" value={fmtCOP(billing.basePrice)} />
              {billing.additionalCharges > 0 && (
                <BillingRow label="Cargos adicionales" value={fmtCOP(billing.additionalCharges)} />
              )}
              {billing.discounts > 0 && (
                <BillingRow label="Descuentos" value={`-${fmtCOP(billing.discounts)}`} negative />
              )}
              <div className="border-t border-slate-100 my-2" />
              <BillingRow label="Subtotal" value={fmtCOP(billing.subtotal)} />
              {billing.taxes > 0 && (
                <BillingRow label="IVA (19%)" value={fmtCOP(billing.taxes)} />
              )}
              <div className="border-t border-slate-200 my-2" />
              <BillingRow label="Total" value={fmtCOP(billing.totalAmount)} bold />
              {billing.amountPaid > 0 && (
                <BillingRow label="Depósito recibido" value={`-${fmtCOP(billing.amountPaid)}`} negative />
              )}
              <div className="border-t border-slate-200 my-1" />
              <BillingRow label="Saldo a cobrar" value={fmtCOP(billing.balanceDue)} bold highlight />
            </div>
          </div>

          {/* Métodos de pago */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-700">Registrar pago</h3>
              <button
                onClick={handlePayAll}
                className="text-xs text-slate-600 border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-lg"
              >
                Pagar todo en efectivo
              </button>
            </div>

            <div className="space-y-3">
              {payments.map((p, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select
                    value={p.method}
                    onChange={e => handlePaymentChange(i, 'method', e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
                  >
                    {ALL_METHODS.map(m => (
                      <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
                    ))}
                  </select>

                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={p.amount}
                      onChange={e => handlePaymentChange(i, 'amount', e.target.value)}
                      className="w-full border border-slate-200 rounded-lg pl-7 pr-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
                    />
                  </div>

                  {payments.length > 1 && (
                    <button
                      onClick={() => handleRemovePayment(i)}
                      className="text-slate-400 hover:text-red-500 text-lg leading-none px-1"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleAddPayment}
              className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
            >
              <span className="text-base leading-none">+</span> Agregar otro método de pago
            </button>

            {/* Barra de totales */}
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Saldo a cobrar</span>
                <span className="font-medium">{fmtCOP(billing.balanceDue)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total abonado ahora</span>
                <span className="font-medium">{fmtCOP(totalPaid)}</span>
              </div>
              <div className="border-t border-slate-200 pt-1.5 flex justify-between">
                <span className={`font-semibold ${pendingBalance > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {pendingBalance > 0 ? 'Queda pendiente' : 'Pagado completamente'}
                </span>
                <span className={`font-semibold ${pendingBalance > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {pendingBalance > 0 ? fmtCOP(pendingBalance) : '✓'}
                </span>
              </div>
            </div>

            {overpaid && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
                ⚠️ El total abonado supera el saldo. Revisa los montos.
              </div>
            )}

            {pendingBalance > 0 && totalPaid > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-700">
                El huésped quedará con un saldo pendiente de {fmtCOP(pendingBalance)}.
              </div>
            )}

            {paymentMutation.isError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
                Error al registrar el pago. Intenta de nuevo.
              </div>
            )}

            <button
              onClick={() => paymentMutation.mutate()}
              disabled={paymentMutation.isPending || overpaid === true || totalPaid <= 0}
              className="w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white font-medium py-3 rounded-xl text-sm"
            >
              {paymentMutation.isPending ? 'Registrando pago...' : 'Registrar pago y finalizar →'}
            </button>

            {totalPaid === 0 && (
              <button
                onClick={() => setStep('done')}
                className="w-full border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium py-2.5 rounded-xl text-sm"
              >
                Finalizar sin pago (saldo pendiente)
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── PASO 4: CONFIRMACIÓN ── */}
      {step === 'done' && billing && reservation && (
        <div className="bg-white rounded-xl border border-emerald-200 p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-3xl">
            ✓
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Check-out completado</h3>
            <p className="text-sm text-slate-500 mt-1">
              {reservation.guestName} ha salido · Hab. {reservation.roomNumber} → Sucia
            </p>
          </div>

          {/* Mini resumen final */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-5 py-4 text-sm text-left space-y-2 max-w-sm mx-auto">
            <FinRow label="Factura" value={billing.invoiceNumber} />
            <FinRow label="Total" value={fmtCOP(billing.totalAmount)} />
            <FinRow label="Pagado" value={fmtCOP(billing.amountPaid)} />
            <FinRow
              label="Saldo pendiente"
              value={billing.balanceDue > 0 ? fmtCOP(billing.balanceDue) : 'Ninguno'}
              highlight={billing.balanceDue > 0}
            />
          </div>

          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={handleReset}
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg"
            >
              Nuevo check-out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-slate-400 uppercase tracking-wide">{label}</span>
      <span className={`mt-0.5 font-medium ${highlight ? 'text-slate-800 text-base' : 'text-slate-700'}`}>
        {value}
      </span>
    </div>
  );
}

function BillingRow({
  label, value, bold, negative, highlight,
}: {
  label: string; value: string; bold?: boolean; negative?: boolean; highlight?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className={`text-slate-500 ${bold ? 'font-semibold text-slate-700' : ''}`}>{label}</span>
      <span className={`
        ${bold ? 'font-semibold' : ''}
        ${negative ? 'text-emerald-600' : ''}
        ${highlight ? 'text-slate-800 text-base' : 'text-slate-700'}
      `}>
        {value}
      </span>
    </div>
  );
}

function FinRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`font-medium ${highlight ? 'text-amber-700' : 'text-slate-700'}`}>{value}</span>
    </div>
  );
}