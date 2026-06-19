import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import apiClient from "../api/client";
import type {
  MonthlyFinancialResponse,
  FinancialSummaryResponse,
} from "../types/financials";

// ─── helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number | undefined | null) =>
  n == null ? "—" : "$" + Math.round(n).toLocaleString("es-CO");

const pct = (part: number, total: number) =>
  total === 0 ? "0%" : ((part / total) * 100).toFixed(1) + "%";

const MONTH_NAMES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const YEARS = Array.from({ length: 4 }, (_, i) => CURRENT_YEAR - i);

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  CHECKOUT:  { label: "Checkout",   color: "bg-emerald-900/60 text-emerald-300 border-emerald-700" },
  CHECKIN:   { label: "Check-in",   color: "bg-sky-900/60 text-sky-300 border-sky-700" },
  RATO:      { label: "Rato",       color: "bg-violet-900/60 text-violet-300 border-violet-700" },
  VITRINA:   { label: "Vitrina",    color: "bg-amber-900/60 text-amber-300 border-amber-700" },
  ABONO:     { label: "Abono",      color: "bg-teal-900/60 text-teal-300 border-teal-700" },
  IVA:       { label: "IVA",        color: "bg-rose-900/60 text-rose-300 border-rose-700" },
  MULTA:     { label: "Multa",      color: "bg-orange-900/60 text-orange-300 border-orange-700" },
  EMPLEADO:  { label: "Empleado",   color: "bg-slate-700/60 text-slate-300 border-slate-600" },
};

const METHOD_LABELS: Record<string, string> = {
  CASH:           "Efectivo",
  CARD:           "Baucher",
  TRANSFER:       "Transferencia",
  QR:             "QR",
  NEQUI_SALOMON:  "Nequi Salomón",
  NEQUI_BRAYAN:   "Nequi Brayan",
};

// ─── tipos del detalle de día ─────────────────────────────────────────────────

interface DayPayment {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  processedBy: string;
  paymentDate: string;
  notes: string | null;
  type: string;
  guestName: string;
  roomNumber: string | null;
  reservationNumber: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
  numberOfNights: number | null;
}

interface DayCashFlow {
  baseAmount: number;
  totalSales: number;
  totalExpenses: number;
  totalWithdrawn: number;
  expectedBalance: number | null;
  actualBalance: number | null;
  discrepancy: number | null;
  registeredBy: string;
  closedAt: string | null;
}

interface DayExpense {
  id: string;
  date: string;
  category: string;
  subcategory: string | null;
  amount: number;
  reason: string;
  paymentMethod: string;
  registeredBy: string;
  notes: string | null;
}

// ─── API fetchers ────────────────────────────────────────────────────────────

const fetchMonthly = (year: number, month: number) =>
  apiClient
    .get<MonthlyFinancialResponse>("/admin/financials/monthly", { params: { year, month } })
    .then((r) => r.data);

const fetchSummary = (fromYear: number, fromMonth: number, toYear: number, toMonth: number) =>
  apiClient
    .get<FinancialSummaryResponse>("/admin/financials/summary", {
      params: { fromYear, fromMonth, toYear, toMonth },
    })
    .then((r) => r.data);

const fetchDayPayments = (date: string) =>
  apiClient.get<DayPayment[]>("/cash/payments", { params: { date } }).then((r) => r.data);

const fetchDayCashFlow = (date: string) =>
  apiClient.get<DayCashFlow>(`/cash/date/${date}`)
    .then((r) => r.data)
    .catch(() => null);

const fetchDayExpenses = (date: string) =>
  apiClient.get<DayExpense[]>(`/expenses/date/${date}`).then((r) => r.data);

// ─── Modal detalle del día ────────────────────────────────────────────────────

function DayDetailModal({
  date,
  dayLabel,
  onClose,
}: {
  date: string;
  dayLabel: string;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"ingresos" | "gastos">("ingresos");

  const paymentsQ = useQuery({
    queryKey: ["day-payments", date],
    queryFn: () => fetchDayPayments(date),
  });

  const cashFlowQ = useQuery({
    queryKey: ["day-cashflow", date],
    queryFn: () => fetchDayCashFlow(date),
  });

  const expensesQ = useQuery({
    queryKey: ["day-expenses", date],
    queryFn: () => fetchDayExpenses(date),
  });

  const payments = paymentsQ.data ?? [];
  const expenses = expensesQ.data ?? [];
  const cf = cashFlowQ.data ?? null;

  const totalIngresos = payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalGastos   = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const fmtTime = (dt: string) =>
    new Date(dt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-white">{dayLabel}</h2>
            {cf && (
              <p className="text-xs text-slate-400 mt-0.5">
                Turno abierto por {cf.registeredBy}
                {cf.closedAt ? " · cerrado" : " · abierto"}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 transition-colors"
          >
            ×
          </button>
        </div>

        {/* KPIs rápidos */}
        <div className="grid grid-cols-3 gap-3 px-6 py-4 border-b border-slate-700">
          <div className="bg-slate-800 rounded-xl p-3 text-center">
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Ingresos</p>
            <p className="text-xl font-bold text-emerald-400">{fmt(totalIngresos)}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-3 text-center">
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Gastos</p>
            <p className="text-xl font-bold text-rose-400">{fmt(totalGastos)}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-3 text-center">
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Neto</p>
            <p className={`text-xl font-bold ${totalIngresos - totalGastos >= 0 ? "text-sky-400" : "text-rose-400"}`}>
              {fmt(totalIngresos - totalGastos)}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          <button
            onClick={() => setActiveTab("ingresos")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "ingresos"
                ? "bg-slate-700 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            💰 Ingresos ({payments.length})
          </button>
          <button
            onClick={() => setActiveTab("gastos")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "gastos"
                ? "bg-slate-700 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            📤 Gastos ({expenses.length})
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* ── Tab ingresos ── */}
          {activeTab === "ingresos" && (
            <>
              {paymentsQ.isLoading && (
                <p className="text-slate-500 text-sm text-center py-8">Cargando pagos…</p>
              )}
              {payments.length === 0 && !paymentsQ.isLoading && (
                <p className="text-slate-500 text-sm text-center py-8">Sin pagos registrados este día</p>
              )}
              {/* Agrupado por tipo de ingreso */}
              <div className="flex flex-col gap-4">
                {(() => {
                  const TYPE_CONFIG: Record<string, { label: string; color: string; border: string }> = {
                    CHECKOUT: { label: "Planilla — Checkout",  color: "text-emerald-300", border: "border-emerald-700" },
                    CHECKIN:  { label: "Abono — Check-in",     color: "text-sky-300",     border: "border-sky-700" },
                    ABONO:    { label: "Abono",                color: "text-teal-300",    border: "border-teal-700" },
                    RATO:     { label: "Servicio Rato",        color: "text-violet-300",  border: "border-violet-700" },
                    VITRINA:  { label: "Vitrina",              color: "text-amber-300",   border: "border-amber-700" },
                    IVA:      { label: "IVA",                  color: "text-rose-300",    border: "border-rose-700" },
                    MULTA:    { label: "Multa",                color: "text-orange-300",  border: "border-orange-700" },
                    EMPLEADO: { label: "Pago deuda empleado",  color: "text-slate-300",   border: "border-slate-600" },
                  };

                  // Agrupar por tipo
                  const byType = payments.reduce((acc, p) => {
                    const t = p.type ?? "CHECKOUT";
                    if (!acc[t]) acc[t] = [];
                    acc[t].push(p);
                    return acc;
                  }, {} as Record<string, DayPayment[]>);

                  return Object.entries(byType).map(([type, items]) => {
                    const cfg = TYPE_CONFIG[type] ?? { label: type, color: "text-slate-300", border: "border-slate-600" };
                    const typeTotal = items.reduce((s, p) => s + Number(p.amount), 0);

                    // Sub-agrupar por reserva dentro del tipo
                    const byRes = items.reduce((acc, p) => {
                      const key = p.reservationNumber ?? `ext-${p.id}`;
                      if (!acc[key]) acc[key] = [];
                      acc[key].push(p);
                      return acc;
                    }, {} as Record<string, DayPayment[]>);

                    return (
                      <div key={type} className="bg-slate-800 rounded-xl overflow-hidden">
                        {/* Cabecera tipo */}
                        <div className={`flex items-center justify-between px-4 py-3 border-b ${cfg.border} border-opacity-40`}>
                          <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
                          <span className={`text-sm font-bold font-mono ${cfg.color}`}>{fmt(typeTotal)}</span>
                        </div>

                        {/* Sub-grupos por reserva/huésped */}
                        <div className="divide-y divide-slate-700/40">
                          {Object.entries(byRes).map(([resKey, resItems]) => {
                            const first = resItems[0];
                            const resTotal = resItems.reduce((s, p) => s + Number(p.amount), 0);
                            return (
                              <div key={resKey} className="px-4 py-3">
                                {/* Línea huésped */}
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <p className="text-sm font-medium text-slate-200">{first.guestName}</p>
                                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                      {first.roomNumber && (
                                        <span className="text-xs text-slate-400">Hab. {first.roomNumber}</span>
                                      )}
                                      {first.reservationNumber && (
                                        <span className="text-xs text-slate-500 font-mono">{first.reservationNumber}</span>
                                      )}
                                      {first.numberOfNights != null && first.numberOfNights > 0 && (
                                        <span className="text-xs text-slate-500">
                                          {first.numberOfNights} noche{first.numberOfNights !== 1 ? "s" : ""}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-sm font-bold font-mono text-slate-200">{fmt(resTotal)}</p>
                                </div>

                                {/* Líneas de pago individuales */}
                                <div className="flex flex-col gap-1.5 pl-2">
                                  {resItems.map((p) => (
                                    <div key={p.id} className="flex items-center justify-between bg-slate-700/40 rounded-lg px-3 py-1.5">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs text-slate-400">
                                          {METHOD_LABELS[p.method] ?? p.method}
                                        </span>
                                        <span className="text-xs text-slate-600">{fmtTime(p.paymentDate)}</span>
                                        {p.processedBy && (
                                          <span className="text-xs text-slate-600">· {p.processedBy}</span>
                                        )}
                                        {p.notes && !["VITRINA","IVA","MULTA","RATO","ABONO"].includes(p.notes) && (
                                          <span className="text-xs text-slate-500 italic">{p.notes}</span>
                                        )}
                                      </div>
                                      <span className="text-xs font-mono font-semibold text-slate-300">
                                        {fmt(Number(p.amount))}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </>
          )}

          {/* ── Tab gastos ── */}
          {activeTab === "gastos" && (
            <>
              {expensesQ.isLoading && (
                <p className="text-slate-500 text-sm text-center py-8">Cargando gastos…</p>
              )}
              {expenses.length === 0 && !expensesQ.isLoading && (
                <p className="text-slate-500 text-sm text-center py-8">Sin gastos registrados este día</p>
              )}
              {/* Agrupado por categoría */}
              <div className="flex flex-col gap-4">
                {(() => {
                  const CAT_CONFIG: Record<string, { label: string; color: string; border: string }> = {
                    VARIOS:         { label: "Gastos varios",   color: "text-slate-300",  border: "border-slate-600" },
                    COMPRA_VITRINA: { label: "Compra vitrina",  color: "text-violet-300", border: "border-violet-700" },
                    ASEO:           { label: "Aseo",            color: "text-teal-300",   border: "border-teal-700" },
                    MANTENIMIENTO:  { label: "Mantenimiento",   color: "text-orange-300", border: "border-orange-700" },
                    SERVICIOS:      { label: "Servicios",       color: "text-amber-300",  border: "border-amber-700" },
                    SUELDOS:        { label: "Nómina",          color: "text-rose-300",   border: "border-rose-700" },
                    CORTESIA:       { label: "Cortesía",        color: "text-sky-300",    border: "border-sky-700" },
                    OTRO:           { label: "Otro",            color: "text-slate-400",  border: "border-slate-600" },
                  };

                  // Agrupar por categoría
                  const grouped = expenses.reduce((acc, e) => {
                    const cat = e.category ?? "OTRO";
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(e);
                    return acc;
                  }, {} as Record<string, DayExpense[]>);

                  return Object.entries(grouped).map(([cat, items]) => {
                    const cfg = CAT_CONFIG[cat] ?? { label: cat, color: "text-slate-300", border: "border-slate-600" };
                    const catTotal = items.reduce((s, e) => s + Number(e.amount), 0);
                    return (
                      <div key={cat} className="bg-slate-800 rounded-xl overflow-hidden">
                        {/* Cabecera categoría */}
                        <div className={`flex items-center justify-between px-4 py-3 border-b ${cfg.border} border-opacity-40`}>
                          <span className={`text-sm font-semibold ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          <span className={`text-sm font-bold font-mono ${cfg.color}`}>
                            {fmt(catTotal)}
                          </span>
                        </div>
                        {/* Items de la categoría */}
                        <div className="divide-y divide-slate-700/50">
                          {items.map((e) => (
                            <div key={e.id} className="flex items-start justify-between px-4 py-3 gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-200">{e.reason}</p>
                                <div className="flex items-center gap-2 flex-wrap mt-1">
                                  {e.subcategory && (
                                    <span className="text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded">
                                      {e.subcategory}
                                    </span>
                                  )}
                                  <span className="text-xs text-slate-500">
                                    {METHOD_LABELS[e.paymentMethod] ?? e.paymentMethod}
                                  </span>
                                  <span className="text-xs text-slate-600">· {e.registeredBy}</span>
                                  {e.notes && (
                                    <span className="text-xs text-slate-500 italic">{e.notes}</span>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm font-mono font-semibold text-slate-300 shrink-0">
                                {fmt(Number(e.amount))}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </>
          )}
        </div>

        {/* Footer con resumen de caja */}
        {cf && (
          <div className="px-6 py-3 border-t border-slate-700 bg-slate-800/50 rounded-b-2xl">
            <div className="flex gap-4 text-xs text-slate-500 flex-wrap">
              <span>Base: <span className="text-slate-300 font-mono">{fmt(cf.baseAmount)}</span></span>
              <span>Ventas: <span className="text-slate-300 font-mono">{fmt(cf.totalSales)}</span></span>
              {cf.totalWithdrawn > 0 && (
                <span>Retirado: <span className="text-amber-300 font-mono">{fmt(cf.totalWithdrawn)}</span></span>
              )}
              {cf.discrepancy != null && Math.abs(cf.discrepancy) > 0 && (
                <span>Descuadre: <span className="text-rose-300 font-mono">{fmt(cf.discrepancy)}</span></span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── sub-components ──────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, color,
}: {
  label: string; value: string; sub?: string;
  color: "green" | "red" | "blue" | "amber" | "slate";
}) {
  const colors = {
    green: "border-emerald-500 text-emerald-400",
    red:   "border-rose-500   text-rose-400",
    blue:  "border-sky-500    text-sky-400",
    amber: "border-amber-500  text-amber-400",
    slate: "border-slate-500  text-slate-400",
  };
  return (
    <div className={`bg-slate-800 border-l-4 ${colors[color]} rounded-lg p-4 flex flex-col gap-1`}>
      <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</span>
      <span className={`text-2xl font-bold ${colors[color].split(" ")[1]}`}>{value}</span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
    </div>
  );
}

function MiniBar({ label, value, max, color }: {
  label: string; value: number; max: number; color: string;
}) {
  const w = max === 0 ? 0 : Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-xs text-slate-400 truncate">{label}</span>
      <div className="flex-1 bg-slate-700 rounded-full h-2">
        <div className={`h-2 rounded-full ${color} transition-all duration-500`} style={{ width: `${w}%` }} />
      </div>
      <span className="w-28 text-right text-xs font-mono text-slate-300">{fmt(value)}</span>
    </div>
  );
}

function SparkLine({ data, color, height = 40 }: { data: number[]; color: string; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 200; const h = height;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

type Tab = "mensual" | "comparativo";

export default function AdminFinanzas() {
  const [tab, setTab] = useState<Tab>("mensual");
  const [year, setYear]   = useState(CURRENT_YEAR);
  const [month, setMonth] = useState(CURRENT_MONTH);

  // Modal detalle día
  const [selectedDay, setSelectedDay] = useState<{ date: string; label: string } | null>(null);

  const defaultFrom = useMemo(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 5);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }, []);
  const [fromYear,  setFromYear]  = useState(defaultFrom.year);
  const [fromMonth, setFromMonth] = useState(defaultFrom.month);
  const [toYear,    setToYear]    = useState(CURRENT_YEAR);
  const [toMonth,   setToMonth]   = useState(CURRENT_MONTH);

  const monthlyQ = useQuery({
    queryKey: ["financials-monthly", year, month],
    queryFn:  () => fetchMonthly(year, month),
    enabled:  tab === "mensual",
  });

  const summaryQ = useQuery({
    queryKey: ["financials-summary", fromYear, fromMonth, toYear, toMonth],
    queryFn:  () => fetchSummary(fromYear, fromMonth, toYear, toMonth),
    enabled:  tab === "comparativo",
  });

  const d = monthlyQ.data;

  const maxDayIncome = useMemo(
    () => Math.max(...(d?.dias?.map((r) => Number(r.totalIngresos ?? 0)) ?? [0])),
    [d]
  );

  const openDayDetail = (day: number) => {
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const date = `${year}-${mm}-${dd}`;
    const label = `${dd} de ${MONTH_NAMES[month]} ${year}`;
    setSelectedDay({ date, label });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">Finanzas del Hotel</h1>
        <p className="text-sm text-slate-400 mt-1">Vista financiera mensual y comparativa — solo ADMIN</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-800 p-1 rounded-lg w-fit">
        {(["mensual", "comparativo"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-md text-sm font-semibold transition-all capitalize ${
              tab === t ? "bg-slate-600 text-white shadow" : "text-slate-400 hover:text-white"
            }`}>
            {t === "mensual" ? "📊 Mensual" : "📈 Comparativo"}
          </button>
        ))}
      </div>

      {/* ══════════════ TAB MENSUAL ══════════════ */}
      {tab === "mensual" && (
        <>
          <div className="flex flex-wrap gap-3 mb-6 items-center">
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}
              className="bg-slate-800 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm">
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
              className="bg-slate-800 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm">
              {MONTH_NAMES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
            {monthlyQ.isFetching && <span className="text-xs text-slate-500 animate-pulse">Cargando…</span>}
          </div>

          {monthlyQ.isError && (
            <div className="bg-rose-900/40 border border-rose-700 rounded-lg p-4 text-rose-300 text-sm mb-6">
              Error cargando datos. Verifica que el backend esté corriendo.
            </div>
          )}

          {d && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard label="Ingresos totales" value={fmt(Number(d.totalIngresos))}
                  sub={`Planilla ${fmt(Number(d.totalPlanilla))} + Venta ${fmt(Number(d.totalVenta))}`} color="green" />
                <StatCard label="Egresos totales" value={fmt(Number(d.totalEgresos))}
                  sub="Gastos + Nómina + Servicios" color="red" />
                <StatCard label="Utilidad neta" value={fmt(Number(d.utilidadNeta))}
                  sub={pct(Number(d.utilidadNeta), Number(d.totalIngresos)) + " margen"}
                  color={Number(d.utilidadNeta) >= 0 ? "green" : "red"} />
                <StatCard label="IVA generado" value={fmt(Number(d.totalIva))} color="amber" />
              </div>

              {/* Métodos + desglose */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-800 rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest mb-4">Métodos de pago</h2>
                  <div className="flex flex-col gap-3">
                    {[
                      { label: "Efectivo",      value: Number(d.totalEfectivo),      color: "bg-emerald-500" },
                      { label: "Baucher/Tarjeta",value: Number(d.totalBaucher),      color: "bg-sky-500" },
                      { label: "Nequi",         value: Number(d.totalNequi),         color: "bg-violet-500" },
                      { label: "Transferencia", value: Number(d.totalTransferencia), color: "bg-amber-500" },
                      { label: "QR",            value: Number(d.totalQr),            color: "bg-rose-500" },
                    ].map((item) => (
                      <MiniBar key={item.label} label={item.label} value={item.value}
                        max={Number(d.totalIngresos)} color={item.color} />
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800 rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest mb-4">Desglose egresos</h2>
                  <div className="flex flex-col gap-3">
                    {[
                      { label: "Gastos varios",  value: Number(d.totalGastos),        color: "bg-slate-500" },
                      { label: "Nómina",         value: Number(d.totalEmpleados),     color: "bg-rose-500" },
                      { label: "Servicios",      value: Number(d.totalServicios),     color: "bg-amber-500" },
                      { label: "Aseo",           value: Number(d.totalAseo),          color: "bg-teal-500" },
                      { label: "Mantenimiento",  value: Number(d.totalMantenimiento), color: "bg-orange-500" },
                      { label: "Compra vitrina", value: Number(d.totalCompraVitrina), color: "bg-violet-500" },
                    ].map((item) => (
                      <MiniBar key={item.label} label={item.label} value={item.value}
                        max={Number(d.totalEgresos) || 1} color={item.color} />
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  {d.nomina && d.nomina.length > 0 && (
                    <div className="bg-slate-800 rounded-xl p-5 flex-1">
                      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest mb-3">Nómina</h2>
                      <div className="flex flex-col gap-2">
                        {d.nomina.map((n) => (
                          <div key={n.employeeName} className="flex justify-between text-sm">
                            <span className="text-slate-300">{n.employeeName}</span>
                            <span className="font-mono text-rose-300">{fmt(Number(n.total))}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {d.servicios && d.servicios.length > 0 && (
                    <div className="bg-slate-800 rounded-xl p-5 flex-1">
                      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest mb-3">Servicios públicos</h2>
                      <div className="flex flex-col gap-2">
                        {d.servicios.map((s) => (
                          <div key={s.motivo} className="flex justify-between text-sm">
                            <span className="text-slate-300">{s.motivo}</span>
                            <span className="font-mono text-amber-300">{fmt(Number(s.total))}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tabla día a día */}
              <div className="bg-slate-800 rounded-xl p-5 mb-6">
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest mb-1">
                  Detalle día a día — {MONTH_NAMES[month]} {year}
                </h2>
                <p className="text-xs text-slate-500 mb-4">
                  Haz clic en cualquier día con actividad para ver el detalle completo
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-700">
                        <th className="text-left py-2 pr-3 font-semibold">Día</th>
                        <th className="text-right py-2 px-2 font-semibold text-emerald-400">Planilla</th>
                        <th className="text-right py-2 px-2 font-semibold text-teal-400">Venta</th>
                        <th className="text-right py-2 px-2 font-semibold text-slate-400">Gastos</th>
                        <th className="text-right py-2 px-2 font-semibold text-slate-400">Cmp.Vit</th>
                        <th className="text-right py-2 px-2 font-semibold text-slate-400">Aseo</th>
                        <th className="text-right py-2 px-2 font-semibold text-slate-400">Manten.</th>
                        <th className="text-right py-2 px-2 font-semibold text-amber-400">Servicios</th>
                        <th className="text-right py-2 px-2 font-semibold text-rose-400">Empleados</th>
                        <th className="text-right py-2 px-2 font-semibold text-violet-400">IVA</th>
                        <th className="text-right py-2 px-2 font-semibold text-sky-400">Baucher</th>
                        <th className="text-right py-2 px-2 font-semibold text-violet-300">Nequi</th>
                        <th className="text-right py-2 pl-2 font-semibold text-slate-300">Ingreso día</th>
                        <th className="py-2 pl-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.dias.map((row) => {
                        const ingreso = Number(row.totalIngresos ?? 0);
                        const egreso  = Number(row.totalEgresos ?? 0);
                        const isActive = ingreso > 0 || egreso > 0;
                        return (
                          <tr
                            key={row.day}
                            onClick={() => isActive && openDayDetail(row.day)}
                            className={`border-b border-slate-700/50 transition-colors ${
                              isActive
                                ? "hover:bg-slate-700/50 cursor-pointer"
                                : "opacity-30 cursor-default"
                            }`}
                          >
                            <td className="py-2 pr-3 font-bold text-slate-300">
                              {String(row.day).padStart(2, "0")}
                            </td>
                            <td className="text-right px-2 text-emerald-300 font-mono">
                              {Number(row.planilla) > 0 ? fmt(Number(row.planilla)) : "—"}
                            </td>
                            <td className="text-right px-2 text-teal-300 font-mono">
                              {Number(row.venta) > 0 ? fmt(Number(row.venta)) : "—"}
                            </td>
                            <td className="text-right px-2 text-slate-400 font-mono">
                              {Number(row.gastos) > 0 ? fmt(Number(row.gastos)) : "—"}
                            </td>
                            <td className="text-right px-2 text-slate-400 font-mono">
                              {Number(row.compraVitrina) > 0 ? fmt(Number(row.compraVitrina)) : "—"}
                            </td>
                            <td className="text-right px-2 text-slate-400 font-mono">
                              {Number(row.aseo) > 0 ? fmt(Number(row.aseo)) : "—"}
                            </td>
                            <td className="text-right px-2 text-slate-400 font-mono">
                              {Number(row.mantenimiento) > 0 ? fmt(Number(row.mantenimiento)) : "—"}
                            </td>
                            <td className="text-right px-2 text-amber-300 font-mono">
                              {Number(row.servicios) > 0 ? fmt(Number(row.servicios)) : "—"}
                            </td>
                            <td className="text-right px-2 text-rose-300 font-mono">
                              {Number(row.empleados) > 0 ? fmt(Number(row.empleados)) : "—"}
                            </td>
                            <td className="text-right px-2 text-violet-300 font-mono">
                              {Number(row.iva) > 0 ? fmt(Number(row.iva)) : "—"}
                            </td>
                            <td className="text-right px-2 text-sky-300 font-mono">
                              {Number(row.baucher) > 0 ? fmt(Number(row.baucher)) : "—"}
                            </td>
                            <td className="text-right px-2 text-violet-300 font-mono">
                              {Number(row.nequi) > 0 ? fmt(Number(row.nequi)) : "—"}
                            </td>
                            <td className="text-right pl-2 font-bold font-mono">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 bg-slate-700 rounded-full h-1.5">
                                  <div className="h-1.5 rounded-full bg-emerald-500"
                                    style={{ width: maxDayIncome === 0 ? "0%" : `${Math.min(100, (ingreso / maxDayIncome) * 100)}%` }} />
                                </div>
                                <span className={ingreso > 0 ? "text-emerald-300" : "text-slate-600"}>
                                  {ingreso > 0 ? fmt(ingreso) : "—"}
                                </span>
                              </div>
                            </td>
                            <td className="pl-2">
                              {isActive && (
                                <span className="text-slate-500 hover:text-slate-300 text-base leading-none">
                                  ↗
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-500 font-bold text-sm">
                        <td className="py-3 pr-3 text-slate-300">TOTAL</td>
                        <td className="text-right px-2 text-emerald-300 font-mono">{fmt(Number(d.totalPlanilla))}</td>
                        <td className="text-right px-2 text-teal-300 font-mono">{fmt(Number(d.totalVenta))}</td>
                        <td className="text-right px-2 text-slate-300 font-mono">{fmt(Number(d.totalGastos))}</td>
                        <td className="text-right px-2 text-slate-300 font-mono">{fmt(Number(d.totalCompraVitrina))}</td>
                        <td className="text-right px-2 text-slate-300 font-mono">{fmt(Number(d.totalAseo))}</td>
                        <td className="text-right px-2 text-slate-300 font-mono">{fmt(Number(d.totalMantenimiento))}</td>
                        <td className="text-right px-2 text-amber-300 font-mono">{fmt(Number(d.totalServicios))}</td>
                        <td className="text-right px-2 text-rose-300 font-mono">{fmt(Number(d.totalEmpleados))}</td>
                        <td className="text-right px-2 text-violet-300 font-mono">{fmt(Number(d.totalIva))}</td>
                        <td className="text-right px-2 text-sky-300 font-mono">{fmt(Number(d.totalBaucher))}</td>
                        <td className="text-right px-2 text-violet-300 font-mono">{fmt(Number(d.totalNequi))}</td>
                        <td className="text-right pl-2 text-emerald-300 font-mono">{fmt(Number(d.totalIngresos))}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ══════════════ TAB COMPARATIVO ══════════════ */}
      {tab === "comparativo" && (
        <>
          <div className="flex flex-wrap gap-3 mb-6 items-center">
            <span className="text-xs text-slate-400 uppercase tracking-widest">Desde</span>
            <select value={fromMonth} onChange={(e) => setFromMonth(Number(e.target.value))}
              className="bg-slate-800 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm">
              {MONTH_NAMES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
            <select value={fromYear} onChange={(e) => setFromYear(Number(e.target.value))}
              className="bg-slate-800 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm">
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <span className="text-xs text-slate-400 uppercase tracking-widest">Hasta</span>
            <select value={toMonth} onChange={(e) => setToMonth(Number(e.target.value))}
              className="bg-slate-800 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm">
              {MONTH_NAMES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
            <select value={toYear} onChange={(e) => setToYear(Number(e.target.value))}
              className="bg-slate-800 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm">
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            {summaryQ.isFetching && <span className="text-xs text-slate-500 animate-pulse">Cargando…</span>}
          </div>

          {summaryQ.isError && (
            <div className="bg-rose-900/40 border border-rose-700 rounded-lg p-4 text-rose-300 text-sm mb-6">
              Error cargando resumen comparativo.
            </div>
          )}

          {summaryQ.data && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {[
                  { label: "Ingresos", key: "totalIngresos" as const, color: "#10b981" },
                  { label: "Egresos",  key: "totalEgresos"  as const, color: "#f43f5e" },
                  { label: "Utilidad", key: "utilidadNeta"  as const, color: "#60a5fa" },
                ].map(({ label, key, color }) => {
                  const vals = summaryQ.data!.meses.map((m) => Number(m[key] ?? 0));
                  const total = vals.reduce((a, b) => a + b, 0);
                  return (
                    <div key={label} className="bg-slate-800 rounded-xl p-5">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</span>
                        <span className="text-sm font-bold font-mono" style={{ color }}>{fmt(total)}</span>
                      </div>
                      <SparkLine data={vals} color={color} />
                      <div className="flex justify-between mt-1">
                        <span className="text-xs text-slate-600">{summaryQ.data!.meses[0]?.monthLabel}</span>
                        <span className="text-xs text-slate-600">{summaryQ.data!.meses[summaryQ.data!.meses.length - 1]?.monthLabel}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-slate-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest mb-4">Comparativo mensual</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-700 text-xs uppercase tracking-widest">
                        <th className="text-left py-2 pr-4">Mes</th>
                        <th className="text-right px-3 text-emerald-400">Planilla</th>
                        <th className="text-right px-3 text-teal-400">Venta</th>
                        <th className="text-right px-3 text-emerald-300">Total Ing.</th>
                        <th className="text-right px-3 text-rose-400">Nómina</th>
                        <th className="text-right px-3 text-amber-400">Servicios</th>
                        <th className="text-right px-3 text-slate-400">Otros Eg.</th>
                        <th className="text-right px-3 text-rose-300">Total Eg.</th>
                        <th className="text-right pl-3 text-sky-400">Utilidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryQ.data.meses.map((m) => {
                        const util = Number(m.utilidadNeta ?? 0);
                        return (
                          <tr key={`${m.year}-${m.month}`}
                            className="border-b border-slate-700/40 hover:bg-slate-700/40 transition-colors cursor-pointer"
                            onClick={() => { setYear(m.year); setMonth(m.month); setTab("mensual"); }}
                            title="Click para ver detalle mensual">
                            <td className="py-3 pr-4 font-semibold text-slate-200">{m.monthLabel}</td>
                            <td className="text-right px-3 font-mono text-emerald-300">{fmt(Number(m.totalPlanilla ?? 0))}</td>
                            <td className="text-right px-3 font-mono text-teal-300">{fmt(Number(m.totalVenta ?? 0))}</td>
                            <td className="text-right px-3 font-mono font-bold text-emerald-200">{fmt(Number(m.totalIngresos ?? 0))}</td>
                            <td className="text-right px-3 font-mono text-rose-300">{fmt(Number(m.totalEmpleados ?? 0))}</td>
                            <td className="text-right px-3 font-mono text-amber-300">{fmt(Number(m.totalServicios ?? 0))}</td>
                            <td className="text-right px-3 font-mono text-slate-400">{fmt(Number(m.totalGastos ?? 0))}</td>
                            <td className="text-right px-3 font-mono font-bold text-rose-200">{fmt(Number(m.totalEgresos ?? 0))}</td>
                            <td className={`text-right pl-3 font-mono font-bold ${util >= 0 ? "text-sky-300" : "text-rose-400"}`}>
                              {fmt(util)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-600 mt-3">💡 Haz click en cualquier fila para ver el detalle mensual completo</p>
              </div>
            </>
          )}
        </>
      )}

      {/* Modal detalle del día */}
      {selectedDay && (
        <DayDetailModal
          date={selectedDay.date}
          dayLabel={selectedDay.label}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}