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
  type: 'CHECKIN' | 'CHECKOUT' | 'RATO';
  guestName: string;
  roomNumber: string | null;
  reservationNumber: string | null;
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

const isToday = (dateStr: string) => dateStr === toLocalDateStr(new Date());

// Agrupa transacciones por turno
function groupByShift(transactions: PaymentTransaction[], shifts: Shift[]) {
  const groups: { shift: Shift | null; transactions: PaymentTransaction[] }[] = [];

  // Ordenar turnos cronológicamente
  const sortedShifts = [...shifts].sort(
    (a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime()
  );

  // Para cada transacción, determinar a qué turno pertenece
  const assigned = new Map<string, string>(); // txId -> shiftId

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

  // Construir grupos
  const shiftGroups = new Map<string, PaymentTransaction[]>();
  shiftGroups.set('sin-turno', []);
  for (const shift of sortedShifts) shiftGroups.set(shift.id, []);

  for (const tx of transactions) {
    const shiftId = assigned.get(tx.id) ?? 'sin-turno';
    shiftGroups.get(shiftId)?.push(tx);
  }

  // Convertir a array de grupos (solo los que tienen transacciones)
  for (const shift of sortedShifts) {
    const txs = shiftGroups.get(shift.id) ?? [];
    if (txs.length > 0) groups.push({ shift, transactions: txs });
  }
  const sinTurno = shiftGroups.get('sin-turno') ?? [];
  if (sinTurno.length > 0) groups.push({ shift: null, transactions: sinTurno });

  return groups;
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
    staleTime: 0,                              // ← fuerza refetch siempre
    refetchInterval: viewingToday ? 15000 : false,  // ← de 30s a 15s
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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['cash-date'] });          // ← sin selectedDate para invalidar todo
    queryClient.invalidateQueries({ queryKey: ['cash-withdrawals'] });
    queryClient.invalidateQueries({ queryKey: ['cash-breakdown'] });
    queryClient.invalidateQueries({ queryKey: ['cash-transactions'] });  // ← sin selectedDate
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
          {/* Selector de fecha */}
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
          {viewingToday && cajaAbierta && !cajaCerrada && isAdmin && (
            <button onClick={() => setShowWithdrawModal(true)}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg">
              Retirar
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
          <p className="text-2xl mb-2">🔒</p>
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
          {/* ── Fila superior ── */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1 rounded-xl bg-slate-800 p-5 flex flex-col justify-between">
              <div>
                <p className="text-xs text-slate-300 uppercase tracking-wider mb-1">Efectivo esperado</p>
                <p className="text-3xl font-bold text-white mt-1">{fmtCOP(expectedCashBalance)}</p>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Base {fmtCOP(caja.baseAmount)}
                  {totalCash > 0 && ` + Efectivo ${fmtCOP(totalCash)}`}
                  {caja.totalExpenses > 0 && ` − Gastos ${fmtCOP(caja.totalExpenses)}`}
                  {caja.totalWithdrawn > 0 && ` − Retirado ${fmtCOP(caja.totalWithdrawn)}`}
                </p>
              </div>
              {!cajaCerrada && viewingToday && (
                <div className="flex items-center gap-1.5 text-emerald-400 mt-4">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-medium">Caja abierta</span>
                </div>
              )}
              {cajaCerrada && caja.actualBalance != null && (
                <div className="mt-4 pt-3 border-t border-slate-600">
                  <p className="text-xs text-slate-400">Contado al cierre</p>
                  <p className="text-xl font-bold text-white">{fmtCOP(caja.actualBalance)}</p>
                  {caja.discrepancy != null && (
                    <p className={`text-sm font-semibold mt-1 ${Math.abs(caja.discrepancy) === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {Math.abs(caja.discrepancy) === 0 ? '✓ Sin diferencia'
                        : `${caja.discrepancy > 0 ? 'Sobran' : 'Faltan'} ${fmtCOP(Math.abs(caja.discrepancy))}`}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Ventas por método de pago
              </p>
              {breakdown.length === 0 ? (
                <p className="text-sm text-slate-400 py-2">Sin ventas registradas.</p>
              ) : (
                <div className="space-y-2.5">
                  {breakdown.map(b => (
                    <div key={b.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium border ${METHOD_COLORS[b.method] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {METHOD_LABELS[b.method] ?? b.method}
                        </span>
                        <span className="text-xs text-slate-400">{b.numberOfTransactions} transacción{b.numberOfTransactions !== 1 ? 'es' : ''}</span>
                      </div>
                      <span className="font-semibold text-slate-700">{fmtCOP(b.totalAmount)}</span>
                    </div>
                  ))}
                  <div className="border-t border-slate-100 pt-2.5 flex justify-between items-end">
                    <div className="text-xs text-slate-500 space-y-0.5">
                      <p>Efectivo: <span className="font-semibold text-slate-700">{fmtCOP(totalCash)}</span></p>
                      {totalNoCash > 0 && <p>Otros: <span className="font-semibold text-slate-700">{fmtCOP(totalNoCash)}</span></p>}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Total vendido</p>
                      <p className="text-lg font-bold text-slate-800">{fmtCOP(caja.totalSales)}</p>
                    </div>
                  </div>
                </div>
              )}
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
                                  : Math.abs(shift.discrepancy) === 0 ? '✓'
                                    : `${shift.discrepancy > 0 ? '+' : ''}${fmtCOP(shift.discrepancy)}`}
                              </p>
                            </div>
                          )}
                          <span className="text-slate-300 text-sm">{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-5 pb-4 bg-slate-50 border-t border-slate-100">
                          <div className="grid grid-cols-3 gap-3 pt-3 text-sm">
                            {[
                              ['Base recibido', fmtCOP(shift.baseAmount)],
                              ['Ventas', fmtCOP(shift.totalSales)],
                              ['Gastos', fmtCOP(shift.totalExpenses)],
                              ['Retirado admin', fmtCOP(shift.totalWithdrawn)],
                              ['Efectivo esperado', fmtCOP(shiftExpected)],
                              ...(shift.actualCashAmount != null ? [['Contado al cierre', fmtCOP(shift.actualCashAmount)]] : []),
                            ].map(([k, v]) => (
                              <div key={k}>
                                <p className="text-xs text-slate-400">{k}</p>
                                <p className="font-semibold text-slate-700">{v}</p>
                              </div>
                            ))}
                          </div>
                          {shift.notes && (
                            <p className="mt-3 text-xs text-slate-500 bg-white border border-slate-100 rounded-lg px-3 py-2">{shift.notes}</p>
                          )}
                          {shift.discrepancyNotes && (
                            <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">⚠ {shift.discrepancyNotes}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Transacciones agrupadas por turno ── */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-700">
                Transacciones del día
                {transactions.length > 0 && <span className="ml-2 text-xs font-normal text-slate-400">({transactions.length})</span>}
              </h3>
              {transactions.length > 0 && (
                <span className="text-xs text-slate-400">
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
                        {group.transactions.map(tx => (
                          <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-slate-400 text-xs tabular-nums w-16">
                              {formatTime(tx.paymentDate)}
                            </td>
                            <td className="px-4 py-3 text-slate-700 font-medium">
                              {tx.guestName.trim() || '—'}
                              {tx.isPartialPayment && (
                                <span className="ml-1.5 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">parcial</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-600 w-20">
                              {tx.roomNumber ? `#${tx.roomNumber}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-slate-400 text-xs">
                              {tx.reservationNumber ?? '—'}
                            </td>
                            <td className="px-4 py-3 w-28">
                              <div className="flex items-center gap-1.5">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${METHOD_COLORS[tx.method] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                  {METHOD_LABELS[tx.method] ?? tx.method}
                                </span>
                                <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded ${tx.type === 'CHECKIN' ? 'bg-blue-100 text-blue-700'
                                  : tx.type === 'RATO' ? 'bg-purple-100 text-purple-700'
                                    : 'bg-slate-100 text-slate-600'
                                  }`}>
                                  {tx.type === 'CHECKIN' ? 'N' : tx.type === 'RATO' ? 'R' : 'S'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-800 w-28">
                              {fmtCOP(tx.amount)}
                            </td>
                          </tr>
                        ))}
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
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">⚠ {caja.discrepancyNotes}</p>
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
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const mutation = useMutation({
    mutationFn: () => apiClient.post('/cash/withdraw', { amount: parseFloat(amount), notes: notes || null }),
    onSuccess, onError: (e: any) => setError(e?.response?.data?.message ?? 'Error'),
  });
  return (
    <>
      <p className="text-sm text-slate-500 mb-4">Solo administradores.</p>
      <label className="text-xs text-slate-500 mb-1 block">Monto</label>
      <div className="relative mb-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
        <input type="number" min="0" step="1000" autoFocus placeholder="0" value={amount}
          onChange={e => setAmount(e.target.value)}
          className="w-full border border-slate-200 rounded-lg pl-7 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
      </div>
      <label className="text-xs text-slate-500 mb-1 block">Notas</label>
      <input type="text" placeholder="Motivo..." value={notes} onChange={e => setNotes(e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 mb-4" />
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 border border-slate-200 rounded-lg py-2.5 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
        <button onClick={() => mutation.mutate()} disabled={!amount || mutation.isPending}
          className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg py-2.5">
          {mutation.isPending ? 'Registrando...' : 'Confirmar'}
        </button>
      </div>
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
          {Math.abs(disc) === 0 ? '✓ Caja cuadrada' : `${disc > 0 ? 'Sobran' : 'Faltan'} ${fmtCOP(Math.abs(disc))}`}
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