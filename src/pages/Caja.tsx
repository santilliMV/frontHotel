import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import { useAuthStore } from '../store/authStore';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface DailyCashFlow {
  id: string;
  date: string;
  baseAmount: number;
  totalSales: number;
  totalExpenses: number;
  totalWithdrawn: number;
  expectedBalance: number | null;
  actualBalance: number | null;
  discrepancy: number | null;
  registeredBy: string;
  closedAt: string | null;
  notes: string | null;
  discrepancyNotes: string | null;
}

interface Shift {
  id: string;
  openedBy: string;
  openedAt: string;
  closedAt: string | null;
  baseAmount: number;
  totalSales: number;
  totalExpenses: number;
  totalWithdrawn: number;
  expectedCashAmount: number | null;
  actualCashAmount: number | null;
  discrepancy: number | null;
  notes: string | null;
  discrepancyNotes: string | null;
}

interface CashWithdrawal {
  id: string;
  amount: number;
  withdrawnBy: string;
  withdrawnAt: string;
  notes: string | null;
}

interface PaymentBreakdown {
  id: string;
  method: string;
  totalAmount: number;
  numberOfTransactions: number;
}

interface PaymentTransaction {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  processedBy: string;
  paymentDate: string;
  notes: string | null;
  isPartialPayment: boolean;
  type: 'CHECKIN' | 'CHECKOUT' | 'RATO' | 'VITRINA';
  guestName: string;
  roomNumber: string | null;
  reservationNumber: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
  numberOfNights: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');

const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia',
  QR: 'QR', NEQUI_SALOMON: 'Nequi Salomón', NEQUI_BRAYAN: 'Nequi Brayan',
};

const METHOD_COLORS: Record<string, string> = {
  CASH: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  CARD: 'bg-blue-100 text-blue-700 border-blue-200',
  TRANSFER: 'bg-violet-100 text-violet-700 border-violet-200',
  QR: 'bg-amber-100 text-amber-700 border-amber-200',
  NEQUI_SALOMON: 'bg-pink-100 text-pink-700 border-pink-200',
  NEQUI_BRAYAN: 'bg-orange-100 text-orange-700 border-orange-200',
};

const formatTime = (dt: string) =>
  new Date(dt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

const formatTimeRange = (open: string, close: string | null) => {
  const o = new Date(open).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  if (!close) return `${o} — en curso`;
  const c = new Date(close).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  return `${o} — ${c}`;
};

const fmtShortDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

const isToday = (dateStr: string) => dateStr === toLocalDateStr(new Date());

// Un pago es "abono" si su notes empieza con "ABONO"
const isAbono = (tx: PaymentTransaction) =>
  tx.type === 'CHECKIN' && (tx.notes?.startsWith('ABONO') ?? false);

// Descripción de noches para mostrar en la tabla
function nightsLabel(tx: PaymentTransaction): string | null {
  if (tx.type === 'VITRINA' || tx.type === 'RATO') return null;
  if (!tx.checkInDate || !tx.checkOutDate || !tx.numberOfNights) return null;
  const checkIn  = new Date(tx.checkInDate  + 'T12:00:00');
  const checkOut = new Date(tx.checkOutDate + 'T12:00:00');
  const sameMonth = checkIn.getMonth() === checkOut.getMonth() &&
                    checkIn.getFullYear() === checkOut.getFullYear();
  const inDay  = checkIn.getDate();
  const outDay = checkOut.getDate();
  const month  = checkIn.toLocaleDateString('es-CO', { month: 'short' });
  const nights = tx.numberOfNights;
  if (sameMonth) {
    return `${inDay}–${outDay} ${month} · ${nights} noche${nights !== 1 ? 's' : ''}`;
  }
  return `${fmtShortDate(tx.checkInDate)} – ${fmtShortDate(tx.checkOutDate)} · ${nights} noche${nights !== 1 ? 's' : ''}`;
}

// Devuelve el tipo efectivo para agrupar: abonos van como 'ABONO', no como 'CHECKIN'
function effectiveType(tx: PaymentTransaction): string {
  if (isAbono(tx)) return 'ABONO';
  return tx.type;
}

// Calcula breakdown de métodos y tipos para un turno
function calcShiftBreakdown(shift: Shift, transactions: PaymentTransaction[]) {
  const start = new Date(shift.openedAt).getTime();
  const end   = shift.closedAt ? new Date(shift.closedAt).getTime() : Infinity;

  const shiftTxs = transactions.filter(tx => {
    const t = new Date(tx.paymentDate).getTime();
    return t >= start && t <= end;
  });

  const byMethod: Record<string, { total: number; count: number }> = {};
  for (const tx of shiftTxs) {
    const m = tx.method ?? 'DESCONOCIDO';
    if (!byMethod[m]) byMethod[m] = { total: 0, count: 0 };
    byMethod[m].total += tx.amount;
    byMethod[m].count += 1;
  }

  // Usar effectiveType para separar abonos de habitaciones
  const byType: Record<string, number> = {};
  for (const tx of shiftTxs) {
    const t = effectiveType(tx);
    byType[t] = (byType[t] ?? 0) + tx.amount;
  }

  return {
    byMethod,
    byType,
    totalIngresos: shiftTxs.reduce((s, t) => s + t.amount, 0),
    txCount: shiftTxs.length,
  };
}

// Agrupa transacciones por turno
function groupByShift(transactions: PaymentTransaction[], shifts: Shift[]) {
  const groups: { shift: Shift | null; transactions: PaymentTransaction[] }[] = [];

  const sortedShifts = [...shifts].sort(
    (a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime()
  );

  const assigned = new Map<string, string>();

  for (const tx of transactions) {
    const txTime = new Date(tx.paymentDate).getTime();
    let assignedShift: Shift | null = null;
    for (const shift of sortedShifts) {
      const shiftStart = new Date(shift.openedAt).getTime();
      const shiftEnd = shift.closedAt ? new Date(shift.closedAt).getTime() : Infinity;
      if (txTime >= shiftStart && txTime <= shiftEnd) {
        assignedShift = shift;
        break;
      }
    }
    assigned.set(tx.id, assignedShift?.id ?? 'sin-turno');
  }

  const shiftGroups = new Map<string, PaymentTransaction[]>();
  shiftGroups.set('sin-turno', []);
  for (const shift of sortedShifts) shiftGroups.set(shift.id, []);

  for (const tx of transactions) {
    const shiftId = assigned.get(tx.id) ?? 'sin-turno';
    shiftGroups.get(shiftId)?.push(tx);
  }

  for (const shift of sortedShifts) {
    const txs = shiftGroups.get(shift.id) ?? [];
    if (txs.length > 0) groups.push({ shift, transactions: txs });
  }
  const sinTurno = shiftGroups.get('sin-turno') ?? [];
  if (sinTurno.length > 0) groups.push({ shift: null, transactions: sinTurno });

  return groups;
}

// ─── Config de tipos de ingreso ───────────────────────────────────────────────
// Centralizada para no repetir en 4 lugares distintos

const TYPE_CONFIG: Record<string, { label: string; code: string; color: string }> = {
  CHECKIN: { label: 'Habitaciones', code: 'N', color: 'bg-blue-100 text-blue-700' },
  ABONO:   { label: 'Abonos',       code: 'A', color: 'bg-amber-100 text-amber-700' },
  CHECKOUT: { label: 'Checkout',    code: 'S', color: 'bg-slate-100 text-slate-600' },
  RATO:    { label: 'Rato',         code: 'R', color: 'bg-purple-100 text-purple-700' },
  VITRINA: { label: 'Vitrina',      code: 'V', color: 'bg-green-100 text-green-700' },
};

function TypeBadge({ type, notes }: { type: string; notes?: string | null }) {
  const key = type === 'CHECKIN' && notes?.startsWith('ABONO') ? 'ABONO' : type;
  const cfg = TYPE_CONFIG[key] ?? { label: key, code: '?', color: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded ${cfg.color}`}>
      {cfg.code}
    </span>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Caja() {
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [selectedDate, setSelectedDate] = useState(toLocalDateStr(new Date()));
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [expandedShift, setExpandedShift] = useState<string | null>(null);

  const viewingToday = isToday(selectedDate);

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: caja, isLoading } = useQuery<DailyCashFlow>({
    queryKey: ['cash-date', selectedDate],
    queryFn: () => viewingToday
      ? apiClient.get('/cash/today').then(r => r.data)
      : apiClient.get(`/cash/date/${selectedDate}`).then(r => r.data),
    retry: false,
    refetchInterval: viewingToday ? 30000 : false,
  });

  const { data: shifts = [] } = useQuery<Shift[]>({
    queryKey: ['shifts-date', selectedDate],
    queryFn: () => apiClient.get(`/shifts/date/${selectedDate}`).then(r => r.data),
    refetchInterval: viewingToday ? 30000 : false,
  });

  const { data: withdrawals = [] } = useQuery<CashWithdrawal[]>({
    queryKey: ['cash-withdrawals', caja?.id],
    queryFn: () => apiClient.get(`/cash/${caja!.id}/withdrawals`).then(r => r.data),
    enabled: !!caja?.id,
  });

  const { data: breakdown = [] } = useQuery<PaymentBreakdown[]>({
    queryKey: ['cash-breakdown', caja?.id],
    queryFn: () => apiClient.get(`/cash/${caja!.id}/breakdown`).then(r => r.data),
    enabled: !!caja?.id,
  });

  const { data: transactions = [], refetch: refetchTx } = useQuery<PaymentTransaction[]>({
    queryKey: ['cash-transactions', selectedDate],
    queryFn: () => apiClient.get(`/cash/payments?date=${selectedDate}`).then(r => r.data),
    enabled: !!caja?.id,
    staleTime: 0,
    refetchInterval: viewingToday ? 15000 : false,
  });

  // ── Cálculos ──────────────────────────────────────────────────────────────

  const cajaAbierta = !!caja;
  const cajaCerrada = !!caja?.closedAt;
  const totalCash = breakdown.find(b => b.method === 'CASH')?.totalAmount ?? 0;
  const expectedCashBalance = caja
    ? caja.baseAmount + totalCash - caja.totalExpenses - caja.totalWithdrawn
    : 0;
  const totalNoCash = breakdown.filter(b => b.method !== 'CASH').reduce((s, b) => s + b.totalAmount, 0);

  const txGroups = groupByShift(transactions, shifts);

  // Desglose por tipo efectivo para el resumen del día
  const byTypeTotals: Record<string, number> = {};
  for (const tx of transactions) {
    const t = effectiveType(tx);
    byTypeTotals[t] = (byTypeTotals[t] ?? 0) + tx.amount;
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['cash-date'] });
    queryClient.invalidateQueries({ queryKey: ['cash-withdrawals'] });
    queryClient.invalidateQueries({ queryKey: ['cash-breakdown'] });
    queryClient.invalidateQueries({ queryKey: ['cash-transactions'] });
    queryClient.invalidateQueries({ queryKey: ['shifts-date'] });
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-slate-500 text-sm">Cargando caja...</p>
    </div>
  );

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Caja diaria</h2>
          <p className="text-sm text-slate-500 mt-0.5 capitalize">
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            })}
            {!viewingToday && (
              <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                Histórico
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            max={toLocalDateStr(new Date())}
            onChange={e => { if (e.target.value) setSelectedDate(e.target.value); }}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          {!viewingToday && (
            <button
              onClick={() => setSelectedDate(toLocalDateStr(new Date()))}
              className="px-3 py-1.5 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
            >
              Hoy
            </button>
          )}
          <button
            onClick={() => { refetchTx(); invalidate(); }}
            className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 text-sm rounded-lg"
          >
            ↻
          </button>
          {viewingToday && !cajaAbierta && (
            <button onClick={() => setShowOpenModal(true)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg">
              Abrir caja
            </button>
          )}
          {viewingToday && cajaAbierta && !cajaCerrada && (
            <button onClick={() => setShowWithdrawModal(true)}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg">
              Retirar efectivo
            </button>
          )}
          {viewingToday && cajaAbierta && !cajaCerrada && isAdmin && (
            <button onClick={() => setShowCloseModal(true)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg">
              Cerrar caja
            </button>
          )}
          {cajaCerrada && (
            <span className="px-3 py-2 bg-slate-100 text-slate-500 text-sm rounded-lg border border-slate-200">
              Cerrada
            </span>
          )}
        </div>
      </div>

      {/* Sin caja */}
      {!cajaAbierta && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-8 text-center">
          <p className="font-semibold text-amber-800">
            {viewingToday ? 'La caja de hoy no ha sido abierta' : 'No hay caja registrada para este día'}
          </p>
          {viewingToday && (
            <button onClick={() => setShowOpenModal(true)}
              className="mt-4 px-6 py-2.5 bg-amber-700 hover:bg-amber-600 text-white text-sm font-medium rounded-lg">
              Abrir caja
            </button>
          )}
        </div>
      )}

      {cajaAbierta && caja && (
        <>
          {/* ── Resumen total del día ── */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-700">Resumen total del día</h3>
                {!cajaCerrada && viewingToday && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs text-emerald-600 font-medium">En curso</span>
                  </div>
                )}
              </div>
              <span className="text-xs text-slate-400">
                Total vendido: <span className="font-semibold text-slate-700">{fmtCOP(caja.totalSales)}</span>
              </span>
            </div>
            <div className="p-5 grid grid-cols-3 gap-4">

              {/* Columna 1: Movimientos de caja */}
              <div className="space-y-2.5 text-sm">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Caja</p>
                <div className="flex justify-between">
                  <span className="text-slate-500">Base efectivo</span>
                  <span className="font-medium text-slate-700">{fmtCOP(caja.baseAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ventas totales</span>
                  <span className="font-medium text-emerald-700">{fmtCOP(caja.totalSales)}</span>
                </div>
                {caja.totalExpenses > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Gastos</span>
                    <span className="font-medium text-red-600">− {fmtCOP(caja.totalExpenses)}</span>
                  </div>
                )}
                {caja.totalWithdrawn > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Recogido admin</span>
                    <span className="font-medium text-amber-600">− {fmtCOP(caja.totalWithdrawn)}</span>
                  </div>
                )}
                <div className="border-t border-slate-100 pt-2.5 flex justify-between">
                  <span className="font-semibold text-slate-700">Efectivo esperado</span>
                  <span className="font-bold text-slate-800">{fmtCOP(expectedCashBalance)}</span>
                </div>
                {cajaCerrada && caja.actualBalance != null && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Contado al cierre</span>
                      <span className="font-medium text-slate-700">{fmtCOP(caja.actualBalance)}</span>
                    </div>
                    {caja.discrepancy != null && (
                      <div className="flex justify-between">
                        <span className={Math.abs(caja.discrepancy) === 0 ? 'text-emerald-600' : 'text-red-600'}>
                          Diferencia
                        </span>
                        <span className={`font-semibold ${Math.abs(caja.discrepancy) === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {Math.abs(caja.discrepancy) === 0
                            ? 'Cuadrada'
                            : `${caja.discrepancy > 0 ? '+' : ''}${fmtCOP(caja.discrepancy)}`}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Columna 2: Por tipo de ingreso — usando effectiveType */}
              <div className="space-y-2.5 text-sm border-l border-slate-100 pl-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Por tipo de ingreso</p>
                {Object.keys(byTypeTotals).length === 0 ? (
                  <p className="text-slate-400 text-xs">Sin ingresos registrados</p>
                ) : (
                  <>
                    {Object.entries(byTypeTotals).map(([type, amt]) => {
                      const cfg = TYPE_CONFIG[type] ?? { label: type, code: '?', color: 'bg-slate-100 text-slate-600' };
                      return (
                        <div key={type} className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded ${cfg.color}`}>
                              {cfg.code}
                            </span>
                            <span className="text-slate-500">{cfg.label}</span>
                          </div>
                          <span className="font-medium text-slate-700">{fmtCOP(amt)}</span>
                        </div>
                      );
                    })}
                    <div className="border-t border-slate-100 pt-2 flex justify-between">
                      <span className="font-semibold text-slate-700">Total</span>
                      <span className="font-bold text-slate-800">{fmtCOP(transactions.reduce((s, t) => s + t.amount, 0))}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Columna 3: Por método de pago */}
              <div className="space-y-2.5 text-sm border-l border-slate-100 pl-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Por método de pago</p>
                {breakdown.length === 0 ? (
                  <p className="text-slate-400 text-xs">Sin ventas registradas</p>
                ) : (
                  <>
                    {breakdown.map(b => (
                      <div key={b.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${METHOD_COLORS[b.method] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {METHOD_LABELS[b.method] ?? b.method}
                          </span>
                          <span className="text-xs text-slate-400">{b.numberOfTransactions} pago{b.numberOfTransactions !== 1 ? 's' : ''}</span>
                        </div>
                        <span className="font-medium text-slate-700">{fmtCOP(b.totalAmount)}</span>
                      </div>
                    ))}
                    <div className="border-t border-slate-100 pt-2 space-y-1 text-xs text-slate-500">
                      <div className="flex justify-between">
                        <span>Efectivo</span>
                        <span className="font-semibold text-slate-700">{fmtCOP(totalCash)}</span>
                      </div>
                      {totalNoCash > 0 && (
                        <div className="flex justify-between">
                          <span>Otros métodos</span>
                          <span className="font-semibold text-slate-700">{fmtCOP(totalNoCash)}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Turnos del día ── */}
          {shifts.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-700">
                  Turnos del día
                  <span className="ml-2 text-xs font-normal text-slate-400">({shifts.length})</span>
                </h3>
              </div>
              <div className="divide-y divide-slate-50">
                {shifts.map(shift => {
                  const shiftExpected = shift.baseAmount + shift.totalSales - shift.totalExpenses - shift.totalWithdrawn;
                  const isExpanded = expandedShift === shift.id;
                  const isOpen = !shift.closedAt;
                  return (
                    <div key={shift.id}>
                      <button
                        onClick={() => setExpandedShift(isExpanded ? null : shift.id)}
                        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                          <div>
                            <p className="text-sm font-medium text-slate-700">{shift.openedBy}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{formatTimeRange(shift.openedAt, shift.closedAt)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-xs text-slate-400">Ventas</p>
                            <p className="text-sm font-semibold text-slate-700">{fmtCOP(shift.totalSales)}</p>
                          </div>
                          {shift.closedAt && (
                            <div className="text-right">
                              <p className="text-xs text-slate-400">Diferencia</p>
                              <p className={`text-sm font-semibold ${shift.discrepancy === null ? 'text-slate-400'
                                : Math.abs(shift.discrepancy) === 0 ? 'text-emerald-600'
                                  : 'text-red-600'
                                }`}>
                                {shift.discrepancy === null ? '—'
                                  : Math.abs(shift.discrepancy) === 0 ? 'OK'
                                    : `${shift.discrepancy > 0 ? '+' : ''}${fmtCOP(shift.discrepancy)}`}
                              </p>
                            </div>
                          )}
                          <span className="text-slate-300 text-sm">{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </button>
                      {isExpanded && (() => {
                        const bd = calcShiftBreakdown(shift, transactions);
                        const cashTotal = bd.byMethod['CASH']?.total ?? 0;
                        const nonCashTotal = bd.totalIngresos - cashTotal;
                        return (
                          <div className="px-5 pb-5 bg-slate-50 border-t border-slate-100 space-y-4">

                            {/* ── Resumen financiero ── */}
                            <div className="pt-4 grid grid-cols-2 gap-3">
                              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5 text-sm">
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Resumen del turno</p>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Base recibida</span>
                                  <span className="font-medium text-slate-700">{fmtCOP(shift.baseAmount)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Ventas registradas</span>
                                  <span className="font-medium text-emerald-700">{fmtCOP(shift.totalSales)}</span>
                                </div>
                                {shift.totalExpenses > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">Gastos</span>
                                    <span className="font-medium text-red-600">− {fmtCOP(shift.totalExpenses)}</span>
                                  </div>
                                )}
                                {shift.totalWithdrawn > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">Retirado admin</span>
                                    <span className="font-medium text-amber-600">− {fmtCOP(shift.totalWithdrawn)}</span>
                                  </div>
                                )}
                                <div className="border-t border-slate-100 pt-2.5 flex justify-between">
                                  <span className="font-semibold text-slate-700">Efectivo esperado</span>
                                  <span className="font-bold text-slate-800">{fmtCOP(shiftExpected)}</span>
                                </div>
                                {shift.actualCashAmount != null && (
                                  <>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Contado al cierre</span>
                                      <span className="font-medium text-slate-700">{fmtCOP(shift.actualCashAmount)}</span>
                                    </div>
                                    {shift.discrepancy != null && Math.abs(shift.discrepancy) > 0 && (
                                      <div className="flex justify-between">
                                        <span className="text-red-600">Diferencia</span>
                                        <span className="font-semibold text-red-600">
                                          {shift.discrepancy > 0 ? '+' : ''}{fmtCOP(shift.discrepancy)}
                                        </span>
                                      </div>
                                    )}
                                    {shift.discrepancy != null && Math.abs(shift.discrepancy) === 0 && (
                                      <div className="flex justify-between">
                                        <span className="text-emerald-600">Diferencia</span>
                                        <span className="font-semibold text-emerald-600">Cuadrada</span>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>

                              <div className="space-y-3">
                                {/* Por tipo de ingreso — usando bd.byType que ya usa effectiveType */}
                                {bd.txCount > 0 && (
                                  <div className="bg-white rounded-xl border border-slate-200 p-4 text-sm">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Por tipo</p>
                                    <div className="space-y-1.5">
                                      {Object.entries(bd.byType).map(([type, amt]) => {
                                        const cfg = TYPE_CONFIG[type] ?? { label: type, code: '?', color: 'bg-slate-100 text-slate-600' };
                                        return (
                                          <div key={type} className="flex justify-between items-center">
                                            <div className="flex items-center gap-1.5">
                                              <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded ${cfg.color}`}>
                                                {cfg.code}
                                              </span>
                                              <span className="text-slate-500">{cfg.label}</span>
                                            </div>
                                            <span className="font-medium text-slate-700">{fmtCOP(amt)}</span>
                                          </div>
                                        );
                                      })}
                                      <div className="border-t border-slate-100 pt-1.5 flex justify-between">
                                        <span className="font-semibold text-slate-700">Total ingresos</span>
                                        <span className="font-bold text-slate-800">{fmtCOP(bd.totalIngresos)}</span>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Por método de pago */}
                                {bd.txCount > 0 && (
                                  <div className="bg-white rounded-xl border border-slate-200 p-4 text-sm">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Por método de pago</p>
                                    <div className="space-y-1.5">
                                      {Object.entries(bd.byMethod).map(([method, { total, count }]) => (
                                        <div key={method} className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${METHOD_COLORS[method] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                              {METHOD_LABELS[method] ?? method}
                                            </span>
                                            <span className="text-xs text-slate-400">{count} pago{count !== 1 ? 's' : ''}</span>
                                          </div>
                                          <span className="font-medium text-slate-700">{fmtCOP(total)}</span>
                                        </div>
                                      ))}
                                      <div className="border-t border-slate-100 pt-1.5 text-xs text-slate-500 space-y-0.5">
                                        <div className="flex justify-between">
                                          <span>Efectivo</span>
                                          <span className="font-medium text-slate-700">{fmtCOP(cashTotal)}</span>
                                        </div>
                                        {nonCashTotal > 0 && (
                                          <div className="flex justify-between">
                                            <span>Otros métodos</span>
                                            <span className="font-medium text-slate-700">{fmtCOP(nonCashTotal)}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {bd.txCount === 0 && (
                                  <div className="bg-white rounded-xl border border-slate-200 p-4 text-sm text-slate-400 text-center">
                                    Sin transacciones en este turno
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* ── Tabla resumen: cálculo de efectivo esperado ── */}
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cálculo de efectivo en caja</p>
                              </div>
                              <table className="w-full text-sm">
                                <tbody className="divide-y divide-slate-50">
                                  <tr className="hover:bg-slate-50">
                                    <td className="px-4 py-2.5 text-slate-500">Base efectivo recibida</td>
                                    <td className="px-4 py-2.5 text-right font-medium text-slate-700">{fmtCOP(shift.baseAmount)}</td>
                                  </tr>
                                  {/* Tipos de ingreso usando TYPE_CONFIG */}
                                  {Object.entries(bd.byType).map(([type, amt]) => {
                                    if (amt === 0) return null;
                                    const cfg = TYPE_CONFIG[type] ?? { label: type, code: '?', color: 'bg-slate-100 text-slate-600' };
                                    return (
                                      <tr key={type} className="hover:bg-slate-50">
                                        <td className="px-4 py-2.5 text-slate-500">
                                          <span className="flex items-center gap-2">
                                            <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded ${cfg.color}`}>
                                              {cfg.code}
                                            </span>
                                            {cfg.label}
                                          </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-medium text-emerald-700">+ {fmtCOP(amt)}</td>
                                      </tr>
                                    );
                                  })}
                                  {shift.totalExpenses > 0 && (
                                    <tr className="hover:bg-slate-50">
                                      <td className="px-4 py-2.5 text-slate-500">Gastos</td>
                                      <td className="px-4 py-2.5 text-right font-medium text-red-600">− {fmtCOP(shift.totalExpenses)}</td>
                                    </tr>
                                  )}
                                  {shift.totalWithdrawn > 0 && (
                                    <tr className="hover:bg-slate-50">
                                      <td className="px-4 py-2.5 text-slate-500">Recogido por admin</td>
                                      <td className="px-4 py-2.5 text-right font-medium text-amber-600">− {fmtCOP(shift.totalWithdrawn)}</td>
                                    </tr>
                                  )}
                                  {Object.keys(bd.byMethod).length > 0 && (
                                    <tr>
                                      <td colSpan={2} className="px-4 py-2 bg-slate-50">
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Por método de pago</p>
                                      </td>
                                    </tr>
                                  )}
                                  {Object.entries(bd.byMethod).map(([method, { total, count }]) => (
                                    <tr key={method} className="hover:bg-slate-50">
                                      <td className="px-4 py-2.5 text-slate-500 flex items-center gap-2">
                                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${METHOD_COLORS[method] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                          {METHOD_LABELS[method] ?? method}
                                        </span>
                                        <span className="text-xs text-slate-400">{count} pago{count !== 1 ? 's' : ''}</span>
                                      </td>
                                      <td className="px-4 py-2.5 text-right font-medium text-slate-700">{fmtCOP(total)}</td>
                                    </tr>
                                  ))}
                                  <tr className="bg-slate-800">
                                    <td className="px-4 py-3 font-semibold text-white">Efectivo esperado en caja</td>
                                    <td className="px-4 py-3 text-right font-bold text-white text-base">{fmtCOP(shiftExpected)}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>

                            {shift.notes && (
                              <p className="text-xs text-slate-500 bg-white border border-slate-100 rounded-lg px-3 py-2">{shift.notes}</p>
                            )}
                            {shift.discrepancyNotes && (
                              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{shift.discrepancyNotes}</p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Transacciones agrupadas por turno ── */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-700">
                  Transacciones del día
                  {transactions.length > 0 && <span className="ml-2 text-xs font-normal text-slate-400">({transactions.length})</span>}
                </h3>
                {/* Leyenda de letras */}
                {transactions.length > 0 && (
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {Object.entries(TYPE_CONFIG).map(([, cfg]) => (
                      <div key={cfg.code} className="flex items-center gap-1">
                        <span className={`text-xs font-bold w-4 h-4 flex items-center justify-center rounded ${cfg.color}`}>
                          {cfg.code}
                        </span>
                        <span className="text-xs text-slate-400">{cfg.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {transactions.length > 0 && (
                <span className="text-xs text-slate-400 self-start">
                  Total: <span className="font-semibold text-slate-700">{fmtCOP(transactions.reduce((s, t) => s + t.amount, 0))}</span>
                </span>
              )}
            </div>

            {transactions.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-400 text-sm">No hay transacciones registradas.</div>
            ) : (
              <div>
                {txGroups.map((group, gi) => (
                  <div key={gi}>
                    {/* Encabezado de turno */}
                    <div className="px-5 py-2.5 bg-slate-50 border-y border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${group.shift && !group.shift.closedAt ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        <span className="text-xs font-semibold text-slate-600">
                          {group.shift
                            ? `Turno — ${group.shift.openedBy} · ${formatTimeRange(group.shift.openedAt, group.shift.closedAt)}`
                            : 'Sin turno asignado'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">
                        {group.transactions.length} pago{group.transactions.length !== 1 ? 's' : ''} ·{' '}
                        <span className="font-medium text-slate-600">
                          {fmtCOP(group.transactions.reduce((s, t) => s + t.amount, 0))}
                        </span>
                      </span>
                    </div>

                    {/* Tabla de transacciones del turno */}
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-50">
                        {group.transactions.map(tx => {
                          const label = nightsLabel(tx);
                          // Mostrar notes solo si no es el valor genérico "ABONO"
                          const notesDisplay = tx.notes && tx.notes !== 'ABONO' ? tx.notes : null;
                          return (
                            <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                              {/* Hora */}
                              <td className="px-4 py-3 text-slate-400 text-xs tabular-nums w-14 align-top">
                                {formatTime(tx.paymentDate)}
                              </td>
                              {/* Huésped + detalle noches + observación */}
                              <td className="px-4 py-3 align-top">
                                <p className="text-slate-700 font-medium leading-tight">
                                  {tx.guestName.trim() || '—'}
                                  {tx.isPartialPayment && (
                                    <span className="ml-1.5 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">parcial</span>
                                  )}
                                </p>
                                {label && (
                                  <p className="text-xs text-slate-400 mt-0.5">{label}</p>
                                )}
                                {notesDisplay && (
                                  <p className="text-xs text-slate-500 italic mt-0.5">{notesDisplay}</p>
                                )}
                              </td>
                              {/* Habitación */}
                              <td className="px-4 py-3 text-slate-500 text-sm w-16 align-top">
                                {tx.roomNumber ? `#${tx.roomNumber}` : '—'}
                              </td>
                              {/* Número reserva */}
                              <td className="px-4 py-3 text-slate-400 text-xs w-36 align-top">
                                {tx.reservationNumber ?? '—'}
                              </td>
                              {/* Método + tipo — usando TypeBadge */}
                              <td className="px-4 py-3 w-28 align-top">
                                <div className="flex items-center gap-1.5">
                                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${METHOD_COLORS[tx.method] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                    {METHOD_LABELS[tx.method] ?? tx.method}
                                  </span>
                                  <TypeBadge type={tx.type} notes={tx.notes} />
                                </div>
                              </td>
                              {/* Monto */}
                              <td className="px-4 py-3 text-right font-semibold text-slate-800 w-28 align-top">
                                {fmtCOP(tx.amount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Retiros ── */}
          {withdrawals.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-700 mb-4">
                Retiros del día
                <span className="ml-2 text-xs font-normal text-slate-400">({withdrawals.length})</span>
              </h3>
              <div className="space-y-2">
                {withdrawals.map(w => (
                  <div key={w.id} className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{w.withdrawnBy}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatTime(w.withdrawnAt)}{w.notes && ` · ${w.notes}`}</p>
                    </div>
                    <span className="font-semibold text-amber-700">{fmtCOP(w.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-1 px-1">
                  <span className="text-xs text-slate-500">Total retirado</span>
                  <span className="text-sm font-semibold text-amber-700">{fmtCOP(caja.totalWithdrawn)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Notas de cierre */}
          {cajaCerrada && (caja.notes || caja.discrepancyNotes) && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-2">
              <h3 className="font-semibold text-slate-700 text-sm">Notas de cierre</h3>
              {caja.notes && <p className="text-sm text-slate-600">{caja.notes}</p>}
              {caja.discrepancyNotes && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{caja.discrepancyNotes}</p>
              )}
            </div>
          )}
        </>
      )}

      {/* Modales */}
      {showOpenModal && (
        <CajaModal title="Abrir caja del día" onClose={() => setShowOpenModal(false)}>
          <OpenCajaForm onSuccess={() => { setShowOpenModal(false); invalidate(); }} onCancel={() => setShowOpenModal(false)} />
        </CajaModal>
      )}
      {showWithdrawModal && (
        <CajaModal title="Retirar dinero" onClose={() => setShowWithdrawModal(false)}>
          <WithdrawForm onSuccess={() => { setShowWithdrawModal(false); invalidate(); }} onCancel={() => setShowWithdrawModal(false)} />
        </CajaModal>
      )}
      {showCloseModal && caja && (
        <CajaModal title="Cerrar caja del día" onClose={() => setShowCloseModal(false)}>
          <CloseCajaForm expectedBalance={expectedCashBalance}
            onSuccess={() => { setShowCloseModal(false); invalidate(); }}
            onCancel={() => setShowCloseModal(false)} />
        </CajaModal>
      )}
    </div>
  );
}

// ─── Modal base ───────────────────────────────────────────────────────────────

function CajaModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function OpenCajaForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const mutation = useMutation({
    mutationFn: () => apiClient.post('/cash/open', { baseAmount: parseFloat(amount) }),
    onSuccess, onError: (e: any) => setError(e?.response?.data?.message ?? 'Error'),
  });
  return (
    <>
      <p className="text-sm text-slate-500 mb-4">Ingresa el efectivo disponible al inicio del día.</p>
      <label className="text-xs text-slate-500 mb-1 block">Monto base</label>
      <div className="relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
        <input type="number" min="0" step="1000" autoFocus placeholder="0" value={amount}
          onChange={e => setAmount(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && amount && mutation.mutate()}
          className="w-full border border-slate-200 rounded-lg pl-7 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
      </div>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 border border-slate-200 rounded-lg py-2.5 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
        <button onClick={() => mutation.mutate()} disabled={!amount || mutation.isPending}
          className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg py-2.5">
          {mutation.isPending ? 'Abriendo...' : 'Abrir caja'}
        </button>
      </div>
    </>
  );
}

function WithdrawForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [amount, setAmount]     = useState('');
  const [notes, setNotes]       = useState('');
  const [password, setPassword] = useState('');
  const [verified, setVerified] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async () => {
    if (!password) return;
    setVerifying(true);
    setVerifyError('');
    try {
      await apiClient.post('/admin/verify-password', { password });
      setVerified(true);
    } catch {
      setVerifyError('Contraseña incorrecta');
    } finally {
      setVerifying(false);
    }
  };

  const mutation = useMutation({
    mutationFn: () => apiClient.post('/cash/withdraw', { amount: parseFloat(amount), notes: notes || null }),
    onSuccess, onError: (e: any) => setError(e?.response?.data?.message ?? 'Error'),
  });

  return (
    <>
      {!verified ? (
        <>
          <p className="text-sm text-slate-500 mb-4">Ingresa la contraseña de administrador para continuar.</p>
          <label className="text-xs text-slate-500 mb-1 block">Contraseña admin</label>
          <input
            type="password" autoFocus placeholder="••••••••" value={password}
            onChange={e => { setPassword(e.target.value); setVerifyError(''); }}
            onKeyDown={e => e.key === 'Enter' && password && handleVerify()}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 mb-4"
          />
          {verifyError && <p className="text-sm text-red-600 mb-3">{verifyError}</p>}
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 border border-slate-200 rounded-lg py-2.5 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button onClick={handleVerify} disabled={!password || verifying}
              className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg py-2.5">
              {verifying ? 'Verificando...' : 'Verificar'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <span>✓</span><span>Identidad verificada</span>
          </div>
          <label className="text-xs text-slate-500 mb-1 block">Monto a retirar</label>
          <div className="relative mb-3">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input type="number" min="0" step="1000" autoFocus placeholder="0" value={amount}
              onChange={e => setAmount(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && amount && mutation.mutate()}
              className="w-full border border-slate-200 rounded-lg pl-7 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
          </div>
          <label className="text-xs text-slate-500 mb-1 block">Notas</label>
          <input type="text" placeholder="Motivo del retiro..." value={notes} onChange={e => setNotes(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 mb-4" />
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 border border-slate-200 rounded-lg py-2.5 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button onClick={() => mutation.mutate()} disabled={!amount || mutation.isPending}
              className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg py-2.5">
              {mutation.isPending ? 'Registrando...' : 'Confirmar retiro'}
            </button>
          </div>
        </>
      )}
    </>
  );
}

function CloseCajaForm({ expectedBalance, onSuccess, onCancel }: {
  expectedBalance: number; onSuccess: () => void; onCancel: () => void;
}) {
  const [actual, setActual] = useState('');
  const [notes, setNotes] = useState('');
  const [discNotes, setDiscNotes] = useState('');
  const [error, setError] = useState('');
  const actualN = parseFloat(actual) || 0;
  const disc = actualN - expectedBalance;
  const hasDisc = actual !== '' && Math.abs(disc) > 0;
  const mutation = useMutation({
    mutationFn: () => apiClient.post('/cash/close', { actualBalance: actualN, notes: notes || null, discrepancyNotes: discNotes || null }),
    onSuccess, onError: (e: any) => setError(e?.response?.data?.message ?? 'Error'),
  });
  return (
    <>
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-4 flex justify-between text-sm">
        <span className="text-slate-500">Efectivo esperado</span>
        <span className="font-semibold text-slate-800">{fmtCOP(expectedBalance)}</span>
      </div>
      <label className="text-xs text-slate-500 mb-1 block">Efectivo real contado</label>
      <div className="relative mb-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
        <input type="number" min="0" step="1000" autoFocus placeholder="0" value={actual}
          onChange={e => setActual(e.target.value)}
          className="w-full border border-slate-200 rounded-lg pl-7 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
      </div>
      {actual !== '' && (
        <div className={`rounded-lg px-4 py-2.5 text-sm mb-3 ${Math.abs(disc) === 0 ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {Math.abs(disc) === 0 ? 'Caja cuadrada' : `${disc > 0 ? 'Sobran' : 'Faltan'} ${fmtCOP(Math.abs(disc))}`}
        </div>
      )}
      {hasDisc && (
        <input type="text" placeholder="Explicación de la diferencia..." value={discNotes} onChange={e => setDiscNotes(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 mb-3" />
      )}
      <input type="text" placeholder="Notas generales (opcional)..." value={notes} onChange={e => setNotes(e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 mb-4" />
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 border border-slate-200 rounded-lg py-2.5 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
        <button onClick={() => mutation.mutate()} disabled={!actual || mutation.isPending}
          className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg py-2.5">
          {mutation.isPending ? 'Cerrando...' : 'Cerrar caja'}
        </button>
      </div>
    </>
  );
}