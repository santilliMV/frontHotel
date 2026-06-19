import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import { usePageTitle } from '../hooks/usePageTitle';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface PaymentMethodResponse {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  createdBy: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getErrorMsg(e: unknown): string {
  return (e as { response?: { data?: { error?: string; message?: string } } })
    ?.response?.data?.error
    ?? (e as { response?: { data?: { message?: string } } })?.response?.data?.message
    ?? 'Ocurrió un error. Intenta de nuevo.';
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

// ─── Modal: Crear / Editar método ────────────────────────────────────────────

function MethodModal({
  method, onClose, onSuccess,
}: {
  method: PaymentMethodResponse | null; // null = crear
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!method;
  const [code,      setCode]      = useState(method?.code ?? '');
  const [label,     setLabel]     = useState(method?.label ?? '');
  const [sortOrder, setSortOrder] = useState(method?.sortOrder?.toString() ?? '99');
  const [error,     setError]     = useState('');

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        code: isEdit ? method!.code : code.trim().toUpperCase().replace(/\s+/g, '_'),
        label: label.trim(),
        sortOrder: parseInt(sortOrder) || 99,
      };
      return isEdit
        ? apiClient.put(`/payment-methods/${method!.id}`, body)
        : apiClient.post('/payment-methods', body);
    },
    onSuccess,
    onError: (e: unknown) => setError(getErrorMsg(e)),
  });

  const isValid = isEdit
    ? label.trim().length > 0
    : code.trim().length > 0 && label.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-800">
            {isEdit ? 'Editar método de pago' : 'Nuevo método de pago'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <div className="space-y-3">
          {!isEdit && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Código <span className="text-red-500">*</span>
              </label>
              <input
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_ ]/g, ''))}
                placeholder="Ej: NEQUI_JUAN"
                autoFocus
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 uppercase"
              />
              <p className="text-xs text-slate-400 mt-1">
                Identificador interno. Solo mayúsculas, números y guion bajo. No se podrá cambiar después.
              </p>
            </div>
          )}

          {isEdit && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Código</label>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 font-mono">
                {method!.code}
              </div>
              <p className="text-xs text-slate-400 mt-1">El código no se puede modificar.</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Nombre visible <span className="text-red-500">*</span>
            </label>
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Ej: Nequi Juan"
              autoFocus={isEdit}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <p className="text-xs text-slate-400 mt-1">Así aparecerá en los selectores de pago.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Orden</label>
            <input
              type="number" min={0}
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
            <p className="text-xs text-slate-400 mt-1">Define el orden de aparición (menor primero).</p>
          </div>
        </div>

        {error && <p className="text-xs text-red-600 mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!isValid || mutation.isPending}
            className="flex-1 px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear método'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function MetodosPago() {
  usePageTitle('Métodos de pago');
  const qc = useQueryClient();

  const [modal, setModal] = useState<{ open: boolean; method: PaymentMethodResponse | null }>({
    open: false, method: null,
  });
  const [toggleError, setToggleError] = useState('');

  const { data: methods = [], isLoading, isError } = useQuery<PaymentMethodResponse[]>({
    queryKey: ['payment-methods-all'],
    queryFn: () => apiClient.get('/payment-methods').then(r => r.data),
    staleTime: 0,
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/payment-methods/${id}/toggle`),
    onSuccess: () => {
      setToggleError('');
      qc.invalidateQueries({ queryKey: ['payment-methods-all'] });
      qc.invalidateQueries({ queryKey: ['payment-methods'] }); // cache del hook usePaymentMethods
    },
    onError: (e: unknown) => setToggleError(getErrorMsg(e)),
  });

  const handleSuccess = () => {
    qc.invalidateQueries({ queryKey: ['payment-methods-all'] });
    qc.invalidateQueries({ queryKey: ['payment-methods'] });
    setModal({ open: false, method: null });
  };

  const sorted = [...methods].sort((a, b) => a.sortOrder - b.sortOrder);
  const activeCount = methods.filter(m => m.isActive).length;

  return (
    <div className="p-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Métodos de pago</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Gestiona los métodos disponibles en caja, checkout, vitrina y rato
          </p>
        </div>
        <button
          onClick={() => setModal({ open: true, method: null })}
          className="px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700"
        >
          + Nuevo método
        </button>
      </div>

      {toggleError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
          {toggleError}
        </div>
      )}

      {/* Resumen */}
      {!isLoading && !isError && (
        <div className="mb-4 text-xs text-slate-400">
          {methods.length} método{methods.length !== 1 ? 's' : ''} registrado{methods.length !== 1 ? 's' : ''} ·{' '}
          <span className="font-medium text-slate-600">{activeCount} activo{activeCount !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">Cargando métodos de pago...</div>
        ) : isError ? (
          <div className="px-5 py-10 text-center text-sm text-red-500">No se pudieron cargar los métodos de pago.</div>
        ) : sorted.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">No hay métodos de pago registrados.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                <th className="text-left px-5 py-3 font-medium">Nombre visible</th>
                <th className="text-left px-4 py-3 font-medium">Código</th>
                <th className="text-center px-4 py-3 font-medium">Orden</th>
                <th className="text-center px-4 py-3 font-medium">Estado</th>
                <th className="text-left px-4 py-3 font-medium">Creado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sorted.map(m => (
                <tr key={m.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${!m.isActive ? 'opacity-60' : ''}`}>
                  <td className="px-5 py-3 font-medium text-slate-800">{m.label}</td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{m.code}</td>
                  <td className="px-4 py-3 text-center text-slate-500">{m.sortOrder}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block text-xs font-medium px-2.5 py-0.5 rounded-full border ${
                      m.isActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {m.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {formatDate(m.createdAt)}
                    {m.createdBy && <span className="block text-slate-300">{m.createdBy}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setModal({ open: true, method: m })}
                        className="px-3 py-1.5 text-xs border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => toggleMutation.mutate(m.id)}
                        disabled={toggleMutation.isPending}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-colors disabled:opacity-50 ${
                          m.isActive
                            ? 'border-red-200 text-red-600 hover:bg-red-50'
                            : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        {m.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 text-xs text-slate-400">
        Al desactivar un método deja de aparecer en los selectores de pago, pero los pagos ya
        registrados con ese método siguen mostrándose correctamente en el historial y la caja.
      </div>

      {modal.open && (
        <MethodModal
          method={modal.method}
          onClose={() => setModal({ open: false, method: null })}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}