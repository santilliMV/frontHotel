import { useState, useEffect, useRef, useCallback } from 'react';
import { guestsApi } from '../api/hotel-api';
import type { GuestResponse, GuestRequest } from '../api/hotel-api';
import { COLOMBIA_CITIES, COUNTRIES, DOC_TYPES } from '../constants';
import apiClient from '../api/client';
import { usePageTitle } from '../hooks/usePageTitle';


// ─── Tipos ────────────────────────────────────────────────────────────────────

interface GuestHistoryEntry {
  id: string;
  reservationNumber: string | null;
  roomNumber: string | null;
  roomTypeName: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
  numberOfNights: number | null;
  totalAmount: number | null;
  paymentMethodSummary: string | null;
  notes: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const fmtCOP = (n: number | null) =>
  n != null ? '$' + Math.round(n).toLocaleString('es-CO') : '—';

const emptyForm = (): GuestRequest => ({
  firstName: '', lastName: '', phone: '',
  documentType: undefined, documentNumber: '',
  address: '', city: '', country: 'Colombia',
  occupation: '', vehiclePlate: '', observations: '',
});

// ─── GuestForm ────────────────────────────────────────────────────────────────

function GuestForm({
  initial, onSave, onCancel, saving, error,
}: {
  initial: GuestRequest;
  onSave: (d: GuestRequest) => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
}) {
  const [form, setForm] = useState<GuestRequest>(initial);

  // Fix bug: cuando cambia el initial (editar vs crear), resetear el form
  useEffect(() => {
    setForm(initial);
  }, [initial]);

  const set = (k: keyof GuestRequest, v: string) =>
    setForm((f) => ({ ...f, [k]: v || undefined }));

  const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white placeholder:text-slate-400";
  const labelCls = "block text-xs font-medium text-slate-500 mb-1";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Nombre *</label>
          <input className={inputCls} placeholder="Nombre" autoFocus
            value={form.firstName}
            onChange={(e) => set('firstName', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Apellido</label>
          <input className={inputCls} placeholder="Apellido"
            value={form.lastName ?? ''}
            onChange={(e) => set('lastName', e.target.value)} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Teléfono *</label>
        <input className={inputCls} placeholder="3101234567"
          value={form.phone}
          onChange={(e) => set('phone', e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Tipo de documento</label>
          <select className={inputCls}
            value={form.documentType ?? ''}
            onChange={(e) => set('documentType', e.target.value)}>
            <option value="">— Seleccionar —</option>
            {DOC_TYPES.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Número de documento</label>
          <input className={inputCls} placeholder="123456789"
            value={form.documentNumber ?? ''}
            onChange={(e) => set('documentNumber', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>País</label>
          <select className={inputCls}
            value={form.country ?? 'Colombia'}
            onChange={(e) => set('country', e.target.value)}>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Ciudad</label>
          {(form.country === 'Colombia' || !form.country) ? (
            <select className={inputCls}
              value={form.city ?? ''}
              onChange={(e) => set('city', e.target.value)}>
              <option value="">— Seleccionar —</option>
              {COLOMBIA_CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          ) : (
            <input className={inputCls} placeholder="Ciudad"
              value={form.city ?? ''}
              onChange={(e) => set('city', e.target.value)} />
          )}
        </div>
      </div>

      <div>
        <label className={labelCls}>Dirección</label>
        <input className={inputCls} placeholder="Calle 123 #45-67"
          value={form.address ?? ''}
          onChange={(e) => set('address', e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Ocupación</label>
          <input className={inputCls} placeholder="Comerciante"
            value={form.occupation ?? ''}
            onChange={(e) => set('occupation', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Placa vehículo</label>
          <input className={inputCls} placeholder="ABC-123"
            value={form.vehiclePlate ?? ''}
            onChange={(e) => set('vehiclePlate', e.target.value)} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Observaciones</label>
        <textarea
          className={`${inputCls} resize-none`}
          rows={3}
          placeholder="Ej: No arrendar, cliente problemático…"
          value={form.observations ?? ''}
          onChange={(e) => set('observations', e.target.value)}
        />
        {form.observations && (
          <p className="mt-1 text-xs text-amber-600">Este huésped quedará marcado con alerta</p>
        )}
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.firstName || !form.phone}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? 'Guardando...' : 'Guardar huésped'}
        </button>
      </div>
    </div>
  );
}

// ─── HistoryPanel ─────────────────────────────────────────────────────────────

function HistoryPanel({ guest, onClose }: { guest: GuestResponse; onClose: () => void }) {
  const [history, setHistory] = useState<GuestHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    apiClient.get(`/guests/${guest.id}/history`)
      .then(r => setHistory(r.data))
      .catch(() => setError('No se pudo cargar el historial.'))
      .finally(() => setLoading(false));
  }, [guest.id]);

  const totalNoches = history.reduce((acc, h) => acc + (h.numberOfNights ?? 0), 0);
  const totalGastado = history.reduce((acc, h) => acc + (h.totalAmount ?? 0), 0);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-6 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Historial de estancias</h2>
            <p className="text-xs text-slate-500 mt-0.5">{guest.fullName} · {guest.phone}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Resumen */}
        {!loading && !error && history.length > 0 && (
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex gap-8 text-sm">
            <div>
              <span className="text-slate-400 text-xs">Estadías</span>
              <p className="font-semibold text-slate-800">{history.length}</p>
            </div>
            <div>
              <span className="text-slate-400 text-xs">Noches totales</span>
              <p className="font-semibold text-slate-800">{totalNoches}</p>
            </div>
            {totalGastado > 0 && (
              <div>
                <span className="text-slate-400 text-xs">Total gastado</span>
                <p className="font-semibold text-slate-800">{fmtCOP(totalGastado)}</p>
              </div>
            )}
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {loading && (
            <p className="text-sm text-slate-400 text-center py-8">Cargando historial...</p>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && history.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">
              Este huésped no tiene estadías registradas aún.
            </p>
          )}

          {!loading && !error && history.map((h) => (
            <div key={h.id} className="border border-slate-200 rounded-xl px-4 py-3 text-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {h.roomNumber && (
                    <span className="font-semibold text-slate-800">Hab. {h.roomNumber}</span>
                  )}
                  {h.roomTypeName && (
                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      {h.roomTypeName}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  {h.totalAmount != null && h.totalAmount > 0 ? (
                    <span className="font-semibold text-slate-800">{fmtCOP(h.totalAmount)}</span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                <span>
                  Entrada: {fmt(h.checkInDate)}
                </span>
                <span>
                  Salida: {fmt(h.checkOutDate)}
                </span>
                {h.numberOfNights != null && (
                  <span>{h.numberOfNights} noche{h.numberOfNights !== 1 ? 's' : ''}</span>
                )}
                {h.reservationNumber && (
                  <span>{h.reservationNumber}</span>
                )}
                {h.paymentMethodSummary && (
                  <span>{h.paymentMethodSummary}</span>
                )}
              </div>

              {h.notes && (
                <p className="mt-2 text-xs text-slate-400 italic">{h.notes}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── GuestCard ────────────────────────────────────────────────────────────────

function GuestCard({ guest, onEdit, onHistory }: {
  guest: GuestResponse;
  onEdit: (g: GuestResponse) => void;
  onHistory: (g: GuestResponse) => void;
}) {
  const initials = (guest.firstName[0] + (guest.lastName?.[0] ?? '')).toUpperCase();

  return (
    <div className={`bg-white rounded-xl border px-4 py-3.5 flex items-start gap-4 transition-colors hover:border-slate-300 ${
      guest.hasObservations ? 'border-red-200 bg-red-50/30' : 'border-slate-200'
    }`}>
      <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-bold text-white ${
        guest.hasObservations ? 'bg-red-700' : 'bg-slate-800'
      }`}>
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-sm font-semibold text-slate-800">{guest.fullName}</span>
          {guest.hasObservations && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
              Obs.
            </span>
          )}
          {guest.autoCreated && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
              Auto
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
          <span>{guest.phone}</span>
          {guest.documentNumber && (
            <span>{guest.documentType} {guest.documentNumber}</span>
          )}
          {guest.city && (
            <span>{guest.city}{guest.country && guest.country !== 'Colombia' ? `, ${guest.country}` : ''}</span>
          )}
          {guest.lastStayDate && (
            <span>Última visita: {fmt(guest.lastStayDate)}</span>
          )}
        </div>

        {guest.hasObservations && guest.observations && (
          <div className="mt-2 text-xs text-red-600 italic bg-red-50 border border-red-100 rounded-lg px-3 py-1.5 border-l-2 border-l-red-400">
            "{guest.observations}"
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5 flex-shrink-0">
        <button
          onClick={() => onHistory(guest)}
          className="px-3 py-1.5 border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-800 text-xs font-medium rounded-lg transition-colors"
        >
          Historial
        </button>
        <button
          onClick={() => onEdit(guest)}
          className="px-3 py-1.5 border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-700 text-xs rounded-lg transition-colors"
        >
          Editar
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Modal = 'none' | 'create' | 'edit';

export default function Huespedes() {
    usePageTitle('Huespedes');

  const [query, setQuery]       = useState('');
  const [guests, setGuests]     = useState<GuestResponse[]>([]);
  const [loading, setLoading]   = useState(false);
  const [modal, setModal]       = useState<Modal>('none');
  const [editing, setEditing]   = useState<GuestResponse | null>(null);
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState('');
  const [toast, setToast]       = useState('');
  const [historyGuest, setHistoryGuest] = useState<GuestResponse | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try { setGuests(await guestsApi.findAll()); }
    catch { setGuests([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { loadAll(); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try { setGuests(await guestsApi.search(query.trim())); }
      catch { setGuests([]); }
      finally { setLoading(false); }
    }, 350);
  }, [query, loadAll]);

  const openCreate = () => {
    setEditing(null);
    setFormError('');
    setModal('create');
  };

  const openEdit = (g: GuestResponse) => {
    setEditing(g);
    setFormError('');
    setModal('edit');
  };

  const handleSave = async (data: GuestRequest) => {
    setSaving(true); setFormError('');
    try {
      if (modal === 'edit' && editing) {
        await guestsApi.update(editing.id, data);
        setToast('Huésped actualizado');
      } else {
        await guestsApi.create(data);
        setToast('Huésped registrado');
      }
      setModal('none');
      loadAll();
      setTimeout(() => setToast(''), 3000);
    } catch (e: any) {
      setFormError(e?.response?.data?.message || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const initialForm = (): GuestRequest => {
    if (modal === 'edit' && editing) {
      return {
        firstName: editing.firstName,
        lastName: editing.lastName ?? '',
        phone: editing.phone,
        documentType: editing.documentType ?? undefined,
        documentNumber: editing.documentNumber ?? '',
        address: editing.address ?? '',
        city: editing.city ?? '',
        country: editing.country ?? 'Colombia',
        occupation: editing.occupation ?? '',
        vehiclePlate: editing.vehiclePlate ?? '',
        observations: editing.observations ?? '',
      };
    }
    return emptyForm();
  };

  const withObs = guests.filter((g) => g.hasObservations);
  const normal  = guests.filter((g) => !g.hasObservations);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Huéspedes</h1>
            <p className="text-sm text-slate-500 mt-0.5">Registro y consulta de clientes</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <span className="text-base leading-none">+</span>
            Nuevo huésped
          </button>
        </div>

        <input
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
          placeholder="Buscar por nombre, teléfono o documento..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {loading && (
          <div className="text-center py-12 text-slate-400 text-sm">Cargando huéspedes...</div>
        )}

        {!loading && guests.length === 0 && (
          <div className="text-center py-16">
            <p className="text-slate-400 text-sm mb-4">
              {query ? `No se encontraron huéspedes para "${query}".` : 'No hay huéspedes registrados.'}
            </p>
            <button
              onClick={openCreate}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              + Registrar huésped
            </button>
          </div>
        )}

        {!loading && guests.length > 0 && (
          <>
            {withObs.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-red-500 flex items-center gap-2">
                  Con observaciones
                  <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-red-100 text-red-600 border border-red-200 rounded-md">
                    {withObs.length}
                  </span>
                </p>
                {withObs.map((g) => (
                  <GuestCard key={g.id} guest={g} onEdit={openEdit} onHistory={setHistoryGuest} />
                ))}
              </div>
            )}

            {normal.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  Huéspedes
                  <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 rounded-md">
                    {normal.length}
                  </span>
                </p>
                {normal.map((g) => (
                  <GuestCard key={g.id} guest={g} onEdit={openEdit} onHistory={setHistoryGuest} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal editar / crear */}
      {modal !== 'none' && (
        <div
          className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-6 overflow-y-auto"
          onClick={(e) => e.target === e.currentTarget && setModal('none')}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-800">
                {modal === 'create' ? 'Nuevo huésped' : `Editar: ${editing?.fullName}`}
              </h2>
              <button
                onClick={() => setModal('none')}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-5">
              {/* key fuerza re-mount del form cuando cambia el huésped editado */}
              <GuestForm
                key={editing?.id ?? 'create'}
                initial={initialForm()}
                onSave={handleSave}
                onCancel={() => setModal('none')}
                saving={saving}
                error={formError}
              />
            </div>
          </div>
        </div>
      )}

      {/* Panel historial */}
      {historyGuest && (
        <HistoryPanel
          guest={historyGuest}
          onClose={() => setHistoryGuest(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-emerald-800 border border-emerald-600 text-emerald-100 px-5 py-3 rounded-xl text-sm font-medium shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}