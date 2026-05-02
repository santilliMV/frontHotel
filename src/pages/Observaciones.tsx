import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import { usePageTitle } from '../hooks/usePageTitle';


// ─── Types ────────────────────────────────────────────────────────────────────

interface DailyObservation {
  id: string
  date: string
  observationFor: string
  content: string
  createdBy: string
  type: 'GENERAL' | 'MAINTENANCE' | 'WARNING' | 'NOTE'
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  resolved: boolean
  createdAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const formatDate = (iso: string) => {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
}

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })

const TYPE_LABEL: Record<string, string> = {
  GENERAL:     'General',
  MAINTENANCE: 'Mantenimiento',
  WARNING:     'Advertencia',
  NOTE:        'Nota',
}

const TYPE_COLOR: Record<string, string> = {
  GENERAL:     'bg-slate-100 text-slate-600 border-slate-200',
  MAINTENANCE: 'bg-blue-50 text-blue-700 border-blue-200',
  WARNING:     'bg-red-50 text-red-700 border-red-200',
  NOTE:        'bg-amber-50 text-amber-700 border-amber-200',
}

const PRIORITY_LABEL: Record<string, string> = {
  LOW:    'Baja',
  MEDIUM: 'Media',
  HIGH:   'Alta',
}

const PRIORITY_COLOR: Record<string, string> = {
  LOW:    'bg-slate-100 text-slate-500',
  MEDIUM: 'bg-amber-100 text-amber-700',
  HIGH:   'bg-red-100 text-red-700',
}

const PRIORITY_DOT: Record<string, string> = {
  LOW:    'bg-slate-400',
  MEDIUM: 'bg-amber-500',
  HIGH:   'bg-red-500',
}

// ─── Modal: Nueva observación ─────────────────────────────────────────────────

function ModalNewObservation({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const today = toLocalDateStr(new Date())
  const [content, setContent] = useState('')
  const [observationFor, setObservationFor] = useState(today)
  const [type, setType] = useState('GENERAL')
  const [priority, setPriority] = useState('LOW')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => apiClient.post('/observations', {
      content,
      observationFor,
      type,
      priority,
    }),
    onSuccess,
    onError: (e: any) => setError(e?.response?.data?.message ?? 'Error al guardar'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-800">Nueva observación</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <div className="space-y-4">
          {/* Contenido */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              autoFocus
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
              placeholder="Ej: Hab 204 falta foco en el baño" />
          </div>

          {/* Fecha para */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha para la que aplica</label>
            <input
              type="date"
              value={observationFor}
              min={today}
              onChange={e => setObservationFor(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            {observationFor > today && (
              <p className="text-xs text-blue-600 mt-1">Esta observación aparecerá en la lista de próximas</p>
            )}
          </div>

          {/* Tipo y Prioridad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
              <select value={type} onChange={e => setType(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
                <option value="GENERAL">General</option>
                <option value="MAINTENANCE">Mantenimiento</option>
                <option value="WARNING">Advertencia</option>
                <option value="NOTE">Nota</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Prioridad</label>
              <select value={priority} onChange={e => setPriority(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
                <option value="LOW">Baja</option>
                <option value="MEDIUM">Media</option>
                <option value="HIGH">Alta</option>
              </select>
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!content.trim() || !observationFor || mutation.isPending}
            className="flex-1 px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">
            {mutation.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Tarjeta de observación ───────────────────────────────────────────────────

function ObservationCard({
  obs,
  onResolve,
  resolving,
}: {
  obs: DailyObservation
  onResolve: (id: string) => void
  resolving: boolean
}) {
  return (
    <div className={`rounded-xl border p-4 transition-opacity ${obs.resolved ? 'opacity-50' : ''} bg-white border-slate-200`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Dot de prioridad */}
          <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${PRIORITY_DOT[obs.priority]}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-800 leading-relaxed">{obs.content}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded border ${TYPE_COLOR[obs.type]}`}>
                {TYPE_LABEL[obs.type]}
              </span>
              <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${PRIORITY_COLOR[obs.priority]}`}>
                {PRIORITY_LABEL[obs.priority]}
              </span>
              <span className="text-xs text-slate-400">
                {obs.createdBy} · {formatDateTime(obs.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Acción */}
        {!obs.resolved ? (
          <button
            onClick={() => onResolve(obs.id)}
            disabled={resolving}
            className="flex-shrink-0 px-3 py-1.5 text-xs border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50">
            Resolver
          </button>
        ) : (
          <span className="flex-shrink-0 text-xs text-green-600 font-medium px-2 py-1">
            Resuelta
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Observaciones() {
    usePageTitle('Observaciones');
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [showResolved, setShowResolved] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [historyDate, setHistoryDate] = useState(toLocalDateStr(new Date()))

  const { data: todayObs = [], isLoading: loadingToday } = useQuery<DailyObservation[]>({
    queryKey: ['observations-today'],
    queryFn: () => apiClient.get('/observations/today').then(r => r.data),
    refetchInterval: 60_000,
    staleTime: 0,
  })

  const { data: upcomingObs = [], isLoading: loadingUpcoming } = useQuery<DailyObservation[]>({
    queryKey: ['observations-upcoming'],
    queryFn: () => apiClient.get('/observations/upcoming').then(r => r.data),
    staleTime: 0,
  })

  const today = toLocalDateStr(new Date())

  const { data: historyObs = [], isLoading: loadingHistory } = useQuery<DailyObservation[]>({
    queryKey: ['observations-history', historyDate],
    queryFn: () => apiClient.get(`/observations/date/${historyDate}`).then(r => r.data),
    enabled: showHistory,
    staleTime: 0,
  })

  const resolveMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/observations/${id}/resolve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['observations-today'] })
      qc.invalidateQueries({ queryKey: ['observations-upcoming'] })
    },
  })

  const handleSuccess = () => {
    qc.invalidateQueries({ queryKey: ['observations-today'] })
    qc.invalidateQueries({ queryKey: ['observations-upcoming'] })
    setShowModal(false)
  }

  const pendingToday = todayObs.filter(o => !o.resolved)
  const resolvedToday = todayObs.filter(o => o.resolved)

  // Agrupar upcoming por fecha
  const upcomingGrouped = upcomingObs.reduce((acc: Record<string, DailyObservation[]>, o) => {
    const key = o.observationFor
    if (!acc[key]) acc[key] = []
    acc[key].push(o)
    return acc
  }, {})

  const highCount = pendingToday.filter(o => o.priority === 'HIGH').length

  return (
    <div className="p-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Observaciones</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {pendingToday.length > 0
              ? `${pendingToday.length} pendiente${pendingToday.length !== 1 ? 's' : ''} hoy${highCount > 0 ? ` · ${highCount} de alta prioridad` : ''}`
              : 'Sin observaciones pendientes hoy'}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700">
          + Nueva observación
        </button>
      </div>

      {/* Alerta de alta prioridad */}
      {highCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-5">
          <p className="text-sm font-semibold text-red-700">
            {highCount} observación{highCount !== 1 ? 'es' : ''} de alta prioridad sin resolver
          </p>
          <div className="mt-2 space-y-1">
            {pendingToday.filter(o => o.priority === 'HIGH').map(o => (
              <p key={o.id} className="text-sm text-red-600">· {o.content}</p>
            ))}
          </div>
        </div>
      )}

      {/* Observaciones de hoy */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
          Hoy — {new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}
        </h2>

        {loadingToday ? (
          <p className="text-sm text-slate-400 py-4">Cargando...</p>
        ) : pendingToday.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-5 py-8 text-center">
            <p className="text-sm text-slate-400">Sin observaciones pendientes para hoy</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {pendingToday
              .sort((a, b) => {
                const order = { HIGH: 0, MEDIUM: 1, LOW: 2 }
                return order[a.priority] - order[b.priority]
              })
              .map(obs => (
                <ObservationCard
                  key={obs.id}
                  obs={obs}
                  onResolve={id => resolveMutation.mutate(id)}
                  resolving={resolveMutation.isPending}
                />
              ))}
          </div>
        )}

        {/* Resueltas de hoy (colapsable) */}
        {resolvedToday.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowResolved(v => !v)}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
              <span>{showResolved ? '▲' : '▼'}</span>
              {resolvedToday.length} resuelta{resolvedToday.length !== 1 ? 's' : ''} hoy
            </button>
            {showResolved && (
              <div className="mt-2 space-y-2">
                {resolvedToday.map(obs => (
                  <ObservationCard
                    key={obs.id}
                    obs={obs}
                    onResolve={id => resolveMutation.mutate(id)}
                    resolving={resolveMutation.isPending}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Próximas observaciones */}
      <div>
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
          Próximas
        </h2>

        {loadingUpcoming ? (
          <p className="text-sm text-slate-400 py-4">Cargando...</p>
        ) : upcomingObs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-5 py-8 text-center">
            <p className="text-sm text-slate-400">No hay observaciones para días futuros</p>
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(upcomingGrouped)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, obs]) => (
                <div key={date}>
                  <p className="text-xs font-semibold text-slate-500 mb-2 capitalize">
                    {formatDate(date)}
                  </p>
                  <div className="space-y-2">
                    {(obs as DailyObservation[])
                      .sort((a, b) => {
                        const order = { HIGH: 0, MEDIUM: 1, LOW: 2 }
                        return order[a.priority] - order[b.priority]
                      })
                      .map(o => (
                        <ObservationCard
                          key={o.id}
                          obs={o}
                          onResolve={id => resolveMutation.mutate(id)}
                          resolving={resolveMutation.isPending}
                        />
                      ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Historial */}
      <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <button
            onClick={() => setShowHistory(v => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900">
            <span>{showHistory ? '▲' : '▼'}</span>
            Historial
          </button>
          {showHistory && (
            <input
              type="date"
              value={historyDate}
              max={today}
              onChange={e => setHistoryDate(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          )}
        </div>
        {showHistory && (
          loadingHistory ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400">Cargando...</div>
          ) : historyObs.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400">
              No hay observaciones para esta fecha.
            </div>
          ) : (
            <div className="p-5 space-y-2.5">
              {historyObs.map(obs => (
                <ObservationCard
                  key={obs.id}
                  obs={obs}
                  onResolve={id => resolveMutation.mutate(id)}
                  resolving={resolveMutation.isPending}
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <ModalNewObservation
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}