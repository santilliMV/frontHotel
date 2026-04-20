import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import { useAuthStore } from '../store/authStore'

// ─── Types ───────────────────────────────────────────────────────────────────

interface TowelInventory {
  id: string
  cleanTowels: number
  dirtyTowels: number
  inLaundry: number
  totalTowels: number
  lastUpdated: string
  updatedBy: string | null
  notes: string | null
}

interface TowelTransaction {
  id: string
  type: 'DELIVERY' | 'PICKUP_DIRTY' | 'FROM_LAUNDRY' | 'MANUAL_ADJUSTMENT'
  quantity: number
  roomNumber: string | null
  reservationNumber: string | null
  numberOfGuests: number | null
  registeredBy: string
  registeredAt: string
  cleanTowelsAfter: number | null
  notes: string | null
}

// ─── API helpers ─────────────────────────────────────────────────────────────

const fetchInventory = (): Promise<TowelInventory> =>
  apiClient.get('/towels/inventory').then(r => r.data)

const fetchTransactions = (date: string): Promise<TowelTransaction[]> =>
  apiClient.get(`/towels/transactions/${date}`).then(r => r.data)

const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const formatDateTime = (iso: string) => {
  const d = new Date(iso + (iso.includes('T') ? '' : 'T12:00:00'))
  return d.toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
}

// ─── Label helpers ────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<TowelTransaction['type'], string> = {
  DELIVERY: 'Entrega',
  PICKUP_DIRTY: 'Recogida sucias',
  FROM_LAUNDRY: 'Retorno lavandería',
  MANUAL_ADJUSTMENT: 'Ajuste manual',
}

const TYPE_COLOR: Record<TowelTransaction['type'], string> = {
  DELIVERY: 'bg-blue-50 text-blue-800 border-blue-200',
  PICKUP_DIRTY: 'bg-amber-50 text-amber-800 border-amber-200',
  FROM_LAUNDRY: 'bg-green-50 text-green-800 border-green-200',
  MANUAL_ADJUSTMENT: 'bg-slate-100 text-slate-700 border-slate-200',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className={`rounded-xl border p-5 flex flex-col gap-1 ${color}`}>
      <span className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</span>
      <span className="text-4xl font-semibold">{value}</span>
      <span className="text-xs opacity-60">toallas</span>
    </div>
  )
}

// ─── Modal: Configurar inventario inicial ─────────────────────────────────────

function ModalInit({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [total, setTotal] = useState('')
  const mutation = useMutation({
    mutationFn: (t: number) =>
      apiClient.post(`/towels/inventory/init?total=${t}`).then(r => r.data),
    onSuccess,
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-4">Configurar inventario inicial</h2>
        <p className="text-sm text-slate-500 mb-4">
          Ingresa el total de toallas que hay en el hotel. Este valor reemplaza el inventario actual.
        </p>
        <label className="block text-sm font-medium text-slate-700 mb-1">Total de toallas</label>
        <input
          type="number"
          min={0}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          placeholder="Ej: 80"
          value={total}
          onChange={e => setTotal(e.target.value)}
        />
        {mutation.isError && (
          <p className="text-xs text-red-600 mt-2">Error al guardar. Intenta de nuevo.</p>
        )}
        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate(parseInt(total))}
            disabled={!total || mutation.isPending}
            className="flex-1 px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Enviar a lavandería ───────────────────────────────────────────────

function ModalSendLaundry({
  maxDirty,
  onClose,
  onSuccess,
}: {
  maxDirty: number
  onClose: () => void
  onSuccess: () => void
}) {
  const [qty, setQty] = useState('')
  const mutation = useMutation({
    mutationFn: (q: number) =>
      apiClient.post(`/towels/send-laundry?quantity=${q}`).then(r => r.data),
    onSuccess,
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-1">Enviar a lavandería</h2>
        <p className="text-sm text-slate-500 mb-4">
          Toallas sucias disponibles: <strong>{maxDirty}</strong>
        </p>
        <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad a enviar</label>
        <input
          type="number"
          min={1}
          max={maxDirty}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          placeholder={`Máx ${maxDirty}`}
          value={qty}
          onChange={e => setQty(e.target.value)}
        />
        {mutation.isError && (
          <p className="text-xs text-red-600 mt-2">
            {(mutation.error as Error)?.message || 'Error al registrar.'}
          </p>
        )}
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate(parseInt(qty))}
            disabled={!qty || parseInt(qty) < 1 || parseInt(qty) > maxDirty || mutation.isPending}
            className="flex-1 px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Registrando...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Retorno de lavandería ─────────────────────────────────────────────

function ModalReturnLaundry({
  maxInLaundry,
  onClose,
  onSuccess,
}: {
  maxInLaundry: number
  onClose: () => void
  onSuccess: () => void
}) {
  const [qty, setQty] = useState('')
  const mutation = useMutation({
    mutationFn: (q: number) =>
      apiClient.post(`/towels/return-laundry?quantity=${q}`).then(r => r.data),
    onSuccess,
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-1">Retorno de lavandería</h2>
        <p className="text-sm text-slate-500 mb-4">
          En lavandería actualmente: <strong>{maxInLaundry}</strong>
        </p>
        <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad que regresan</label>
        <input
          type="number"
          min={1}
          max={maxInLaundry}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          placeholder={`Máx ${maxInLaundry}`}
          value={qty}
          onChange={e => setQty(e.target.value)}
        />
        {mutation.isError && (
          <p className="text-xs text-red-600 mt-2">Error al registrar.</p>
        )}
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate(parseInt(qty))}
            disabled={!qty || parseInt(qty) < 1 || parseInt(qty) > maxInLaundry || mutation.isPending}
            className="flex-1 px-4 py-2 text-sm bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-50"
          >
            {mutation.isPending ? 'Registrando...' : 'Confirmar retorno'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Ajuste manual (solo admin) ───────────────────────────────────────

function ModalAdjust({
  current,
  onClose,
  onSuccess,
}: {
  current: TowelInventory
  onClose: () => void
  onSuccess: () => void
}) {
  const [clean, setClean] = useState(String(current.cleanTowels))
  const [dirty, setDirty] = useState(String(current.dirtyTowels))
  const [inLaundry, setInLaundry] = useState(String(current.inLaundry))
  const [reason, setReason] = useState('')

  const total = (parseInt(clean) || 0) + (parseInt(dirty) || 0) + (parseInt(inLaundry) || 0)

  const mutation = useMutation({
    mutationFn: () =>
      apiClient
        .post(
          `/towels/adjust?clean=${clean}&dirty=${dirty}&inLaundry=${inLaundry}&reason=${encodeURIComponent(reason)}`
        )
        .then(r => r.data),
    onSuccess,
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-1">Ajuste manual de inventario</h2>
        <p className="text-sm text-slate-500 mb-4">Corrige los conteos si hubo un error de registro.</p>

        {[
          { label: 'Toallas limpias', val: clean, set: setClean },
          { label: 'Toallas sucias', val: dirty, set: setDirty },
          { label: 'En lavandería', val: inLaundry, set: setInLaundry },
        ].map(({ label, val, set }) => (
          <div key={label} className="mb-3">
            <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
            <input
              type="number"
              min={0}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              value={val}
              onChange={e => set(e.target.value)}
            />
          </div>
        ))}

        <div className="bg-slate-50 rounded-lg px-4 py-2 mb-3 flex justify-between text-sm">
          <span className="text-slate-500">Nuevo total</span>
          <span className="font-semibold text-slate-800">{total} toallas</span>
        </div>

        <label className="block text-sm font-medium text-slate-700 mb-1">Motivo del ajuste</label>
        <input
          type="text"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          placeholder="Ej: Corrección de conteo inicial"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />

        {mutation.isError && (
          <p className="text-xs text-red-600 mt-2">Error al guardar.</p>
        )}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!reason || mutation.isPending}
            className="flex-1 px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Guardando...' : 'Guardar ajuste'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type ModalType = 'init' | 'sendLaundry' | 'returnLaundry' | 'adjust' | null

export default function Toallas() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'
  const qc = useQueryClient()

  const today = toLocalDateStr(new Date())
  const [selectedDate, setSelectedDate] = useState(today)
  const [modal, setModal] = useState<ModalType>(null)

  const { data: inventory, isLoading: loadingInv } = useQuery({
    queryKey: ['towels-inventory'],
    queryFn: fetchInventory,
    refetchInterval: 30_000,
  })

  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ['towels-transactions', selectedDate],
    queryFn: () => fetchTransactions(selectedDate),
  })

  const handleSuccess = () => {
    qc.invalidateQueries({ queryKey: ['towels-inventory'] })
    qc.invalidateQueries({ queryKey: ['towels-transactions'] })
    setModal(null)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Toallas</h1>
          <p className="text-sm text-slate-500 mt-0.5">Control de inventario y movimientos</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <>
              <button
                onClick={() => setModal('init')}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Configurar inventario
              </button>
              <button
                onClick={() => setModal('adjust')}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Ajuste manual
              </button>
            </>
          )}
          <button
            onClick={() => setModal('sendLaundry')}
            disabled={!inventory || inventory.dirtyTowels === 0}
            className="px-3 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-40"
          >
            Enviar a lavandería
          </button>
          <button
            onClick={() => setModal('returnLaundry')}
            disabled={!inventory || inventory.inLaundry === 0}
            className="px-3 py-2 text-sm bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-40"
          >
            Retorno de lavandería
          </button>
        </div>
      </div>

      {/* Inventario */}
      {loadingInv ? (
        <div className="text-sm text-slate-400 mb-6">Cargando inventario...</div>
      ) : inventory ? (
        <div className="mb-6">
          {(() => {
            const inRooms = Math.max(0, inventory.totalTowels - inventory.cleanTowels - inventory.dirtyTowels - inventory.inLaundry)
            return (
              <>
                <div className="grid grid-cols-5 gap-4 mb-3">
                  <StatCard
                    label="Limpias"
                    value={inventory.cleanTowels}
                    color="bg-blue-50 border-blue-200 text-blue-900"
                  />
                  <StatCard
                    label="En habitaciones"
                    value={inRooms}
                    color="bg-teal-50 border-teal-200 text-teal-900"
                  />
                  <StatCard
                    label="Sucias"
                    value={inventory.dirtyTowels}
                    color="bg-amber-50 border-amber-200 text-amber-900"
                  />
                  <StatCard
                    label="En lavandería"
                    value={inventory.inLaundry}
                    color="bg-violet-50 border-violet-200 text-violet-900"
                  />
                  <StatCard
                    label="Total"
                    value={inventory.totalTowels}
                    color="bg-slate-100 border-slate-200 text-slate-800"
                  />
                </div>

                {/* Barra de progreso visual */}
                {inventory.totalTowels > 0 && (
                  <div className="flex rounded-full overflow-hidden h-2.5 mb-2">
                    <div
                      className="bg-blue-400 transition-all"
                      style={{ width: `${(inventory.cleanTowels / inventory.totalTowels) * 100}%` }}
                    />
                    <div
                      className="bg-teal-400 transition-all"
                      style={{ width: `${(inRooms / inventory.totalTowels) * 100}%` }}
                    />
                    <div
                      className="bg-amber-400 transition-all"
                      style={{ width: `${(inventory.dirtyTowels / inventory.totalTowels) * 100}%` }}
                    />
                    <div
                      className="bg-violet-400 transition-all"
                      style={{ width: `${(inventory.inLaundry / inventory.totalTowels) * 100}%` }}
                    />
                  </div>
                )}

                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" /> Limpias
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-400 inline-block" /> En habitaciones
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Sucias
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-violet-400 inline-block" /> En lavandería
                  </span>
                  {inventory.lastUpdated && (
                    <span className="ml-auto">
                      Actualizado: {formatDateTime(inventory.lastUpdated)}
                      {inventory.updatedBy && ` por ${inventory.updatedBy}`}
                    </span>
                  )}
                </div>
              </>
            )
          })()}
        </div>
      ) : null}

      {/* Historial */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Movimientos</h2>
          <input
            type="date"
            value={selectedDate}
            max={today}
            onChange={e => setSelectedDate(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>

        {loadingTx ? (
          <div className="px-5 py-8 text-sm text-slate-400 text-center">Cargando...</div>
        ) : transactions.length === 0 ? (
          <div className="px-5 py-8 text-sm text-slate-400 text-center">
            No hay movimientos registrados para esta fecha.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-100">
                <th className="text-left px-5 py-3 font-medium">Hora</th>
                <th className="text-left px-5 py-3 font-medium">Tipo</th>
                <th className="text-right px-5 py-3 font-medium">Cantidad</th>
                <th className="text-left px-5 py-3 font-medium">Habitación</th>
                <th className="text-left px-5 py-3 font-medium">Reserva</th>
                <th className="text-right px-5 py-3 font-medium">Limpias después</th>
                <th className="text-left px-5 py-3 font-medium">Registrado por</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                    {new Date(tx.registeredAt).toLocaleTimeString('es-CO', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block text-xs font-medium px-2 py-0.5 rounded border ${
                        TYPE_COLOR[tx.type]
                      }`}
                    >
                      {TYPE_LABEL[tx.type]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-slate-800">
                    {tx.quantity}
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {tx.roomNumber ? `Hab. ${tx.roomNumber}` : '—'}
                  </td>
                  <td className="px-5 py-3 text-slate-500 text-xs">
                    {tx.reservationNumber ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-600">
                    {tx.cleanTowelsAfter ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-slate-500">{tx.registeredBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modales */}
      {modal === 'init' && (
        <ModalInit onClose={() => setModal(null)} onSuccess={handleSuccess} />
      )}
      {modal === 'sendLaundry' && inventory && (
        <ModalSendLaundry
          maxDirty={inventory.dirtyTowels}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
      {modal === 'returnLaundry' && inventory && (
        <ModalReturnLaundry
          maxInLaundry={inventory.inLaundry}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
      {modal === 'adjust' && inventory && (
        <ModalAdjust
          current={inventory}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}