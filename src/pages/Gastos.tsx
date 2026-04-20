import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Expense {
  id: string;
  date: string;
  category: string;
  subcategory: string | null;
  amount: number;
  reason: string;
  paymentMethod: string;
  reference: string | null;
  registeredBy: string;
  registeredAt: string;
  notes: string | null;
}

interface TodayResponse {
  expenses: Expense[];
  total: number;
}

interface ExpenseRequest {
  date: string;
  category: string;
  subcategory?: string;
  amount: number;
  reason: string;
  paymentMethod: string;
  reference?: string;
  notes?: string;
}

// ── Constantes ───────────────────────────────────────────────────────────────

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'VARIOS',        label: 'Varios' },
  { value: 'COMPRA_VITRINA',label: 'Compra Vitrina' },
  { value: 'ASEO',          label: 'Aseo' },
  { value: 'MANTENIMIENTO', label: 'Mantenimiento' },
  { value: 'SERVICIOS',     label: 'Servicios' },
  { value: 'SUELDOS',       label: 'Sueldos' },
  { value: 'CORTESIA',      label: 'Cortesía' },
  { value: 'OTRO',          label: 'Otro' },
];

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'CASH',     label: 'Efectivo' },
  { value: 'CARD',     label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'OTHER',    label: 'Otro' },
];

const CATEGORY_COLORS: Record<string, string> = {
  VARIOS:         'bg-slate-100 text-slate-700',
  COMPRA_VITRINA: 'bg-blue-100 text-blue-700',
  ASEO:           'bg-teal-100 text-teal-700',
  MANTENIMIENTO:  'bg-orange-100 text-orange-700',
  SERVICIOS:      'bg-purple-100 text-purple-700',
  SUELDOS:        'bg-green-100 text-green-700',
  CORTESIA:       'bg-pink-100 text-pink-700',
  OTRO:           'bg-yellow-100 text-yellow-700',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

const formatDate = (str: string) =>
  new Date(str + 'T12:00:00').toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

const categoryLabel = (v: string) => CATEGORIES.find(c => c.value === v)?.label ?? v;
const methodLabel   = (v: string) => PAYMENT_METHODS.find(m => m.value === v)?.label ?? v;

// ── API calls ─────────────────────────────────────────────────────────────────

const fetchExpenses = async (date: string): Promise<TodayResponse> => {
  const today = toLocalDateStr(new Date());
  const url = date === today
    ? '/expenses/today'
    : `/expenses/date/${date}`;
  const res = await apiClient.get(url);
  if (Array.isArray(res.data)) {
    const expenses: Expense[] = res.data;
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    return { expenses, total };
  }
  return res.data as TodayResponse;
};

const createExpense = async (body: ExpenseRequest): Promise<Expense> => {
  const res = await apiClient.post('/expenses', body);
  return res.data as Expense;
};

// ── Formulario modal ──────────────────────────────────────────────────────────

interface FormState {
  date: string;
  category: string;
  subcategory: string;
  amount: string;
  reason: string;
  paymentMethod: string;
  reference: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  date: toLocalDateStr(new Date()),
  category: 'VARIOS',
  subcategory: '',
  amount: '',
  reason: '',
  paymentMethod: 'CASH',
  reference: '',
  notes: '',
};

interface ModalProps {
  onClose: () => void;
  onSaved: () => void;
}

function NuevoGastoModal({ onClose, onSaved }: ModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: createExpense,
    onSuccess: () => { onSaved(); onClose(); },
    onError: () => setError('No se pudo registrar el gasto. Intenta de nuevo.'),
  });

  const set = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = () => {
    setError('');
    const amountNum = parseFloat(form.amount.replace(/\./g, '').replace(',', '.'));
    if (!form.reason.trim()) { setError('El motivo es obligatorio.'); return; }
    if (!form.amount || isNaN(amountNum) || amountNum <= 0) { setError('Ingresa un monto válido.'); return; }

    const body: ExpenseRequest = {
      date: form.date,
      category: form.category,
      amount: amountNum,
      reason: form.reason.trim(),
      paymentMethod: form.paymentMethod,
    };
    if (form.subcategory.trim()) body.subcategory = form.subcategory.trim();
    if (form.reference.trim())   body.reference   = form.reference.trim();
    if (form.notes.trim())       body.notes        = form.notes.trim();

    mutation.mutate(body);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-800">Registrar gasto</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          {/* Fecha y método */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
              <input
                type="date"
                value={form.date}
                onChange={set('date')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Método de pago</label>
              <select
                value={form.paymentMethod}
                onChange={set('paymentMethod')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                {PAYMENT_METHODS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Categoría y subcategoría */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Categoría</label>
              <select
                value={form.category}
                onChange={set('category')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Subcategoría <span className="text-slate-400">(opcional)</span></label>
              <input
                type="text"
                value={form.subcategory}
                onChange={set('subcategory')}
                placeholder="Ej: Limpieza baños"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Motivo <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.reason}
              onChange={set('reason')}
              placeholder="Descripción del gasto"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

          {/* Monto y referencia */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Monto <span className="text-red-500">*</span></label>
              <input
                type="number"
                value={form.amount}
                onChange={set('amount')}
                placeholder="0"
                min="0"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Referencia <span className="text-slate-400">(opcional)</span></label>
              <input
                type="text"
                value={form.reference}
                onChange={set('reference')}
                placeholder="No. factura, recibo..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notas <span className="text-slate-400">(opcional)</span></label>
            <textarea
              value={form.notes}
              onChange={set('notes')}
              rows={2}
              placeholder="Observaciones adicionales"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="px-5 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {mutation.isPending ? 'Guardando...' : 'Registrar gasto'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente por categoría (resumen) ────────────────────────────────────────

function CategorySummary({ expenses }: { expenses: Expense[] }) {
  const totals = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {});

  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {sorted.map(([cat, total]) => (
        <div key={cat} className="bg-white border border-slate-200 rounded-lg px-3 py-2">
          <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-1 ${CATEGORY_COLORS[cat] ?? 'bg-slate-100 text-slate-700'}`}>
            {categoryLabel(cat)}
          </span>
          <p className="text-sm font-semibold text-slate-800">{formatCOP(total)}</p>
        </div>
      ))}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function Gastos() {
  const today = toLocalDateStr(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [showModal, setShowModal] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<TodayResponse>({
    queryKey: ['expenses', selectedDate],
    queryFn: () => fetchExpenses(selectedDate),
  });

  const expenses = data?.expenses ?? [];
  const totalGeneral = data?.total ?? 0;

  const filtered = filterCategory
    ? expenses.filter(e => e.category === filterCategory)
    : expenses;

  const isToday = selectedDate === today;

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['expenses', selectedDate] });
  };

  // Navegar fecha
  const changeDate = (delta: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    setSelectedDate(toLocalDateStr(d));
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* ── Encabezado ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Gastos</h1>
            <p className="text-sm text-slate-500 mt-0.5 capitalize">{formatDate(selectedDate)}</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
          >
            <span className="text-base leading-none">+</span>
            Registrar gasto
          </button>
        </div>

        {/* ── Selector de fecha ── */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeDate(-1)}
            className="p-1.5 rounded-lg border border-slate-300 hover:bg-white text-slate-600 text-sm"
          >
            &#8592;
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
          />
          <button
            onClick={() => changeDate(1)}
            disabled={selectedDate >= today}
            className="p-1.5 rounded-lg border border-slate-300 hover:bg-white text-slate-600 text-sm disabled:opacity-40"
          >
            &#8594;
          </button>
          {selectedDate !== today && (
            <button
              onClick={() => setSelectedDate(today)}
              className="text-xs text-slate-500 hover:text-slate-700 underline ml-1"
            >
              Hoy
            </button>
          )}
        </div>

        {/* ── Tarjeta resumen total ── */}
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Total gastos</p>
            <p className="text-2xl font-bold text-slate-800 mt-0.5">{formatCOP(totalGeneral)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">{expenses.length} registro{expenses.length !== 1 ? 's' : ''}</p>
            {!isToday && (
              <p className="text-xs text-amber-600 mt-0.5">Historial — solo lectura</p>
            )}
          </div>
        </div>

        {/* ── Resumen por categoría ── */}
        {expenses.length > 0 && <CategorySummary expenses={expenses} />}

        {/* ── Filtro por categoría ── */}
        {expenses.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500">Filtrar:</span>
            <button
              onClick={() => setFilterCategory('')}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                filterCategory === ''
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'border-slate-300 text-slate-600 hover:border-slate-400'
              }`}
            >
              Todos
            </button>
            {[...new Set(expenses.map(e => e.category))].map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(filterCategory === cat ? '' : cat)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  filterCategory === cat
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'border-slate-300 text-slate-600 hover:border-slate-400'
                }`}
              >
                {categoryLabel(cat)}
              </button>
            ))}
          </div>
        )}

        {/* ── Lista de gastos ── */}
        {isLoading && (
          <div className="text-center py-12 text-slate-400 text-sm">Cargando gastos...</div>
        )}

        {isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
            No se pudieron cargar los gastos.
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-slate-400 text-sm">
              {expenses.length === 0
                ? 'No hay gastos registrados para este día.'
                : 'No hay gastos en esta categoría.'}
            </p>
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map(expense => (
              <div
                key={expense.id}
                className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-start justify-between gap-4"
              >
                {/* Izquierda */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[expense.category] ?? 'bg-slate-100 text-slate-700'}`}>
                      {categoryLabel(expense.category)}
                    </span>
                    {expense.subcategory && (
                      <span className="text-xs text-slate-500">{expense.subcategory}</span>
                    )}
                    <span className="text-xs text-slate-400">&middot;</span>
                    <span className="text-xs text-slate-500">{methodLabel(expense.paymentMethod)}</span>
                  </div>
                  <p className="text-sm text-slate-800 font-medium truncate">{expense.reason}</p>
                  {expense.notes && (
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{expense.notes}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-slate-400">{formatTime(expense.registeredAt)}</span>
                    {expense.registeredBy && (
                      <span className="text-xs text-slate-400">por {expense.registeredBy}</span>
                    )}
                    {expense.reference && (
                      <span className="text-xs text-slate-400">ref: {expense.reference}</span>
                    )}
                  </div>
                </div>

                {/* Derecha: monto */}
                <div className="text-right shrink-0">
                  <p className="text-base font-semibold text-slate-800">{formatCOP(expense.amount)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Modal */}
      {showModal && (
        <NuevoGastoModal
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}