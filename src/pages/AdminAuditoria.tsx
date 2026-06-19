import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import { usePageTitle } from '../hooks/usePageTitle';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  oldValue: string | null;
  newValue: string | null;
  ipAddress: string | null;
  result: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  notes: string | null;
  timestamp: string;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const ACTION_META: Record<string, { label: string; icon: string; color: string }> = {
  CHECK_IN:             { label: 'Check-in',         icon: '🔑', color: 'bg-emerald-100 text-emerald-700' },
  CHECK_OUT:            { label: 'Check-out',         icon: '🚪', color: 'bg-slate-100 text-slate-600' },
  CREATE_RESERVATION:   { label: 'Reserva',           icon: '📋', color: 'bg-blue-100 text-blue-700' },
  PROCESS_PAYMENT:      { label: 'Pago',              icon: '💵', color: 'bg-green-100 text-green-700' },
  CONSUME_VITRINA:      { label: 'Vitrina',           icon: '🛒', color: 'bg-violet-100 text-violet-700' },
  ADD_VITRINA:          { label: 'Restock vitrina',   icon: '📦', color: 'bg-purple-100 text-purple-700' },
  CHANGE_PRICE:         { label: 'Cambio precio',     icon: '💲', color: 'bg-amber-100 text-amber-700' },
  AUTHORIZE_COURTESY:   { label: 'Cortesía',          icon: '🎁', color: 'bg-pink-100 text-pink-700' },
  WITHDRAW_CASH:        { label: 'Retiro caja',       icon: '💰', color: 'bg-red-100 text-red-700' },
  REGISTER_EXPENSE:     { label: 'Gasto',             icon: '🧾', color: 'bg-orange-100 text-orange-700' },
  CREATE_GUEST:         { label: 'Crear huésped',     icon: '👤', color: 'bg-teal-100 text-teal-700' },
  UPDATE_GUEST:         { label: 'Editar huésped',    icon: '✏️',  color: 'bg-teal-100 text-teal-600' },
  CHANGE_ROOM_STATUS:   { label: 'Estado hab.',       icon: '🏠', color: 'bg-indigo-100 text-indigo-700' },
  SEND_TOWELS_LAUNDRY:  { label: 'Envío lavandería',  icon: '🧺', color: 'bg-cyan-100 text-cyan-700' },
  RETURN_TOWELS_LAUNDRY:{ label: 'Retorno lavandería',icon: '✅', color: 'bg-cyan-100 text-cyan-700' },
  REGISTER_RATO:        { label: 'Rato',              icon: '⏱️',  color: 'bg-yellow-100 text-yellow-700' },
  OTHER:                { label: 'Sistema',           icon: '⚙️',  color: 'bg-slate-100 text-slate-500' },
};

const RESULT_CONFIG = {
  SUCCESS: { label: 'OK',      cls: 'bg-emerald-100 text-emerald-700' },
  FAILURE: { label: 'Error',   cls: 'bg-red-100 text-red-700' },
  PARTIAL: { label: 'Parcial', cls: 'bg-amber-100 text-amber-700' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Agrupar logs por fecha para mostrar separadores de día
function groupByDate(logs: AuditLog[]): { date: string; entries: AuditLog[] }[] {
  const map = new Map<string, AuditLog[]>();
  for (const log of logs) {
    const d = toLocalDateStr(new Date(log.timestamp));
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(log);
  }
  return [...map.entries()].map(([date, entries]) => ({ date, entries }));
}

// ── Modal detalle ─────────────────────────────────────────────────────────────

function LogDetailModal({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  const meta = ACTION_META[log.action] ?? ACTION_META['OTHER'];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-lg">{meta.icon}</span>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">{meta.label}</h2>
              <p className="text-xs text-slate-400">{fmtDate(log.timestamp)} · {fmtTime(log.timestamp)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {/* Usuario y resultado */}
          <div className="flex items-center gap-2">
            <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-medium">
              👤 {log.userId}
            </span>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${RESULT_CONFIG[log.result]?.cls}`}>
              {RESULT_CONFIG[log.result]?.label}
            </span>
          </div>

          {/* Notas — la parte más importante */}
          {log.notes && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
              <p className="text-xs text-slate-400 mb-1">Detalle</p>
              <p className="text-sm text-slate-800 leading-relaxed">{log.notes}</p>
            </div>
          )}

          {/* Metadata secundaria */}
          <div className="bg-slate-50 border border-slate-100 rounded-lg divide-y divide-slate-100 text-xs">
            {[
              ['Acción', log.action],
              ['Entidad', log.entityType ?? '—'],
              ['IP', log.ipAddress ?? '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center px-4 py-2 gap-4">
                <span className="text-slate-400 w-20 shrink-0">{k}</span>
                <span className="text-slate-600 break-all">{v}</span>
              </div>
            ))}
          </div>

          {/* Valores antes/después si los hay */}
          {log.oldValue && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Antes</p>
              <pre className="text-xs text-slate-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 overflow-x-auto whitespace-pre-wrap">
                {log.oldValue}
              </pre>
            </div>
          )}
          {log.newValue && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Después</p>
              <pre className="text-xs text-slate-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2.5 overflow-x-auto whitespace-pre-wrap">
                {log.newValue}
              </pre>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200">
          <button onClick={onClose} className="w-full text-sm text-slate-500 hover:text-slate-700 py-1">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

type ViewMode = 'all' | 'mine';

export default function AdminAuditoria() {
  usePageTitle('Auditoría — Admin');
  const today = toLocalDateStr(new Date());

  const [viewMode, setViewMode]       = useState<ViewMode>('all');
  const [filterAction, setFilterAction] = useState('');
  const [filterUser, setFilterUser]   = useState('');
  const [filterResult, setFilterResult] = useState('');
  const [search, setSearch]           = useState('');
  const [dateFrom, setDateFrom]       = useState(today);
  const [dateTo, setDateTo]           = useState(today);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data: logs = [], isLoading, isError, refetch } = useQuery<AuditLog[]>({
    queryKey: ['audit', viewMode, filterAction, filterUser, filterResult, dateFrom, dateTo],
    queryFn: async () => {
      const url = viewMode === 'all' ? '/audit/all' : '/audit/my';
      const res = await apiClient.get(url);
      return res.data;
    },
  });

  // Filtrado local sobre los datos descargados
  const filtered = logs.filter(log => {
    if (filterAction && log.action !== filterAction) return false;
    if (filterResult && log.result !== filterResult) return false;
    if (filterUser && !log.userId.toLowerCase().includes(filterUser.toLowerCase())) return false;
    if (dateFrom) {
      if (toLocalDateStr(new Date(log.timestamp)) < dateFrom) return false;
    }
    if (dateTo) {
      if (toLocalDateStr(new Date(log.timestamp)) > dateTo) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (
        !log.notes?.toLowerCase().includes(q) &&
        !log.userId.toLowerCase().includes(q) &&
        !(ACTION_META[log.action]?.label ?? log.action).toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const groups = groupByDate(filtered);
  const uniqueUsers = [...new Set(logs.map(l => l.userId))].sort();
  const hasFilters = !!(filterAction || filterUser || filterResult || search
    || dateFrom !== today || dateTo !== today);

  const setToday = () => { setDateFrom(today); setDateTo(today); };
  const setWeek = () => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    setDateFrom(toLocalDateStr(d)); setDateTo(today);
  };
  const setAll = () => { setDateFrom(''); setDateTo(''); };

  const clearFilters = () => {
    setFilterAction(''); setFilterUser(''); setFilterResult('');
    setSearch(''); setDateFrom(today); setDateTo(today);
  };

  // Stats rápidas
  const totalSuccess = filtered.filter(l => l.result === 'SUCCESS').length;
  const totalFailure = filtered.filter(l => l.result === 'FAILURE').length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* Encabezado */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Auditoría</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Registro completo de todas las acciones del sistema.
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="text-xs px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-slate-600 hover:bg-slate-50"
          >
            ↻ Actualizar
          </button>
        </div>

        {/* Tabs: todos vs mis acciones */}
        <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg w-fit">
          {(['all', 'mine'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === mode ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {mode === 'all' ? 'Todos los registros' : 'Mis acciones'}
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          {/* Búsqueda */}
          <input
            type="text"
            placeholder="Buscar en notas, usuario, acción..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />

          {/* Filtros en grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Acción */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Acción</label>
              <select
                value={filterAction}
                onChange={e => setFilterAction(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
              >
                <option value="">Todas</option>
                {Object.entries(ACTION_META).map(([value, { label, icon }]) => (
                  <option key={value} value={value}>{icon} {label}</option>
                ))}
              </select>
            </div>

            {/* Usuario (solo en modo all) */}
            {viewMode === 'all' && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">Empleado</label>
                <select
                  value={filterUser}
                  onChange={e => setFilterUser(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
                >
                  <option value="">Todos</option>
                  {uniqueUsers.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Resultado */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Resultado</label>
              <select
                value={filterResult}
                onChange={e => setFilterResult(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
              >
                <option value="">Todos</option>
                <option value="SUCCESS">✅ OK</option>
                <option value="FAILURE">❌ Error</option>
                <option value="PARTIAL">⚠️ Parcial</option>
              </select>
            </div>
          </div>

          {/* Rango de fechas */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500">Período:</span>
            <div className="flex items-center gap-2">
              <input
                type="date" value={dateFrom} max={dateTo || today}
                onChange={e => setDateFrom(e.target.value)}
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
              />
              <span className="text-xs text-slate-400">→</span>
              <input
                type="date" value={dateTo} max={today}
                onChange={e => setDateTo(e.target.value)}
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
              />
            </div>
            <div className="flex gap-1">
              {[
                { label: 'Hoy', fn: setToday },
                { label: '7 días', fn: setWeek },
                { label: 'Todo', fn: setAll },
              ].map(({ label, fn }) => (
                <button key={label} onClick={fn}
                  className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700">
                  {label}
                </button>
              ))}
            </div>
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-slate-400 hover:text-slate-600 underline ml-1">
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* Stats rápidas */}
        {!isLoading && filtered.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-400 uppercase font-medium">Registros</p>
              <p className="text-xl font-bold text-slate-800 mt-0.5">{filtered.length}</p>
              {hasFilters && <p className="text-xs text-slate-400">de {logs.length} totales</p>}
            </div>
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-400 uppercase font-medium">Exitosos</p>
              <p className="text-xl font-bold text-emerald-600 mt-0.5">{totalSuccess}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-400 uppercase font-medium">Errores</p>
              <p className={`text-xl font-bold mt-0.5 ${totalFailure > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                {totalFailure}
              </p>
            </div>
          </div>
        )}

        {/* Estados */}
        {isLoading && <div className="text-center py-12 text-slate-400 text-sm">Cargando registros...</div>}
        {isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
            No se pudo cargar la auditoría.
          </div>
        )}
        {!isLoading && !isError && filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400 text-sm">
            {logs.length === 0 ? 'No hay registros todavía.' : 'Sin registros con los filtros aplicados.'}
          </div>
        )}

        {/* Timeline agrupado por fecha */}
        {!isLoading && !isError && groups.length > 0 && (
          <div className="space-y-6">
            {groups.map(({ date, entries }) => (
              <div key={date}>
                {/* Separador de día */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    {fmtDate(date + 'T12:00:00')}
                  </span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                {/* Logs del día */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-50">
                  {entries.map(log => {
                    const meta = ACTION_META[log.action] ?? ACTION_META['OTHER'];
                    return (
                      <div
                        key={log.id}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => setSelectedLog(log)}
                      >
                        {/* Icono */}
                        <span className="text-base mt-0.5 shrink-0">{meta.icon}</span>

                        {/* Contenido principal */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${meta.color}`}>
                              {meta.label}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">{log.userId}</span>
                            {log.result !== 'SUCCESS' && (
                              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${RESULT_CONFIG[log.result]?.cls}`}>
                                {RESULT_CONFIG[log.result]?.label}
                              </span>
                            )}
                          </div>
                          {log.notes && (
                            <p className="text-xs text-slate-600 truncate max-w-xl">{log.notes}</p>
                          )}
                        </div>

                        {/* Hora */}
                        <span className="text-xs text-slate-400 shrink-0 mt-0.5">
                          {fmtTime(log.timestamp)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {selectedLog && (
        <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}