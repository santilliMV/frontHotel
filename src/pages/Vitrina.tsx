import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import { useAuthStore } from '../store/authStore'

// ─── Types ────────────────────────────────────────────────────────────────────

interface VitrinaProduct {
  id: string
  name: string
  category: 'BEVERAGE' | 'SNACK' | 'OTHER'
  categoryLabel: string
  currentStock: number
  minStock: number
  lowStock: boolean
  unitPrice: number
  supplier: string | null
  lastRestocked: string | null
  isActive: boolean
}

interface RoomByDate {
  id: string
  roomNumber: string
  status: string
  guestName: string | null
  reservationId: string | null
  reservationNumber: string | null
  rato: boolean
}

interface SystemUser {
  id: string
  username: string
  fullName: string
  role: string
}

interface VitrinaTransaction {
  id: string
  type: string
  quantity: number
  productName: string
  productCategory: string
  unitPrice: number | null
  totalAmount: number | null
  consumedBy: string | null
  annotatedToRoom: boolean
  registeredBy: string
  registeredAt: string
  stockAfter: number | null
  notes: string | null
  reservationNumber: string | null
  guestName: string
  roomNumber: string | null
}

type ConsumerType = 'GUEST' | 'ADMIN' | 'EMPLOYEE' | 'EXTERNAL'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const CONSUMER_LABEL: Record<string, string> = {
  GUEST:    'Huésped',
  EXTERNAL: 'Externo',
  EMPLOYEE: 'Empleado',
  ADMIN:    'Admin',
}

const CONSUMER_COLOR: Record<string, string> = {
  GUEST:    'bg-blue-50 text-blue-700 border-blue-200',
  EXTERNAL: 'bg-slate-100 text-slate-600 border-slate-200',
  EMPLOYEE: 'bg-amber-50 text-amber-700 border-amber-200',
  ADMIN:    'bg-violet-50 text-violet-700 border-violet-200',
}

const CATEGORY_COLOR: Record<string, string> = {
  BEVERAGE: 'bg-blue-50 text-blue-700 border-blue-200',
  SNACK:    'bg-amber-50 text-amber-700 border-amber-200',
  OTHER:    'bg-slate-100 text-slate-600 border-slate-200',
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia',
  QR: 'QR', NEQUI_SALOMON: 'Nequi Salomón', NEQUI_BRAYAN: 'Nequi Brayan',
}

const PAYMENT_METHODS = ['CASH', 'CARD', 'TRANSFER', 'QR', 'NEQUI_SALOMON', 'NEQUI_BRAYAN']

// ─── Modal: Crear / Editar producto ──────────────────────────────────────────

function ModalProduct({
  product,
  onClose,
  onSuccess,
}: {
  product: VitrinaProduct | null
  onClose: () => void
  onSuccess: () => void
}) {
  const isEdit = !!product
  const [name, setName] = useState(product?.name ?? '')
  const [category, setCategory] = useState(product?.category ?? 'BEVERAGE')
  const [price, setPrice] = useState(product?.unitPrice?.toString() ?? '')
  const [stock, setStock] = useState(product?.currentStock?.toString() ?? '0')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        name, category,
        unitPrice: parseFloat(price),
        currentStock: parseInt(stock),
        minStock: product?.minStock ?? 5,
        supplier: product?.supplier ?? null,
      }
      return isEdit
        ? apiClient.put(`/vitrina/products/${product!.id}`, body)
        : apiClient.post('/vitrina/products', body)
    },
    onSuccess,
    onError: (e: any) => setError(e?.response?.data?.message ?? 'Error al guardar'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-800">
            {isEdit ? 'Editar producto' : 'Nuevo producto'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="Ej: Agua 600ml" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Categoría</label>
              <select value={category} onChange={e => setCategory(e.target.value as any)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
                <option value="BEVERAGE">Bebida</option>
                <option value="SNACK">Snack</option>
                <option value="OTHER">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Precio unitario</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input type="number" min={0} value={price} onChange={e => setPrice(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  placeholder="0" />
              </div>
            </div>
          </div>

          {!isEdit && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Stock inicial</label>
              <input type="number" min={0} value={stock} onChange={e => setStock(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!name || !price || mutation.isPending}
            className="flex-1 px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">
            {mutation.isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear producto'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Reabastecer ───────────────────────────────────────────────────────

function ModalRestock({
  product,
  onClose,
  onSuccess,
}: {
  product: VitrinaProduct
  onClose: () => void
  onSuccess: () => void
}) {
  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => apiClient.post('/vitrina/restock', {
      productId: product.id,
      quantity: parseInt(qty),
      notes: notes || null,
    }),
    onSuccess,
    onError: (e: any) => setError(e?.response?.data?.message ?? 'Error'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-800">Reabastecer</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <div className="bg-slate-50 rounded-lg px-4 py-3 mb-4 flex justify-between text-sm">
          <span className="text-slate-600">{product.name}</span>
          <span className="text-slate-500">Stock actual: <strong>{product.currentStock}</strong></span>
        </div>

        <label className="block text-xs font-medium text-slate-600 mb-1">Cantidad a agregar</label>
        <input type="number" min={1} value={qty} onChange={e => setQty(e.target.value)}
          autoFocus
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 mb-3"
          placeholder="Ej: 24" />

        <label className="block text-xs font-medium text-slate-600 mb-1">Notas (opcional)</label>
        <input value={notes} onChange={e => setNotes(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          placeholder="Ej: Compra del 20 abr" />

        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!qty || parseInt(qty) < 1 || mutation.isPending}
            className="flex-1 px-4 py-2 text-sm bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-50">
            {mutation.isPending ? 'Guardando...' : 'Reabastecer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Carrito de consumo ───────────────────────────────────────────────

interface CartItem {
  product: VitrinaProduct
  quantity: number
}

function ModalConsume({
  products,
  occupiedRooms,
  employees,
  onClose,
  onSuccess,
}: {
  products: VitrinaProduct[]
  occupiedRooms: RoomByDate[]
  employees: SystemUser[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [consumerType, setConsumerType] = useState<ConsumerType>('GUEST')
  const [reservationId, setReservationId] = useState('')
  const [annotateToRoom, setAnnotateToRoom] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [employeeName, setEmployeeName] = useState('')
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [adminUsername, setAdminUsername] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [verifyingPassword, setVerifyingPassword] = useState(false)
  const [passwordVerified, setPasswordVerified] = useState(false)

  const total = cart.reduce((s, i) => s + i.product.unitPrice * i.quantity, 0)

  const addToCart = (product: VitrinaProduct) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) {
        return prev.map(i =>
          i.product.id === product.id
            ? { ...i, quantity: Math.min(i.quantity + 1, product.currentStock) }
            : i
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
  }

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(i => i.product.id !== productId))
    } else {
      setCart(prev => prev.map(i =>
        i.product.id === productId ? { ...i, quantity: qty } : i
      ))
    }
  }

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(i => i.product.id !== productId))
  }

  const filteredProducts = products.filter(p =>
    p.currentStock > 0 &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()))
  )

  const mutation = useMutation({
    mutationFn: () => {
      const body: any = {
        consumedBy: consumerType,
        notes: notes || null,
        items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity })),
      }
      if (consumerType === 'GUEST') {
        body.reservationId = reservationId
        body.annotateToRoom = annotateToRoom
        if (!annotateToRoom) body.paymentMethod = paymentMethod
      }
      if (consumerType === 'EXTERNAL') body.paymentMethod = paymentMethod
      if (consumerType === 'EMPLOYEE') body.employeeName = employeeName
      return apiClient.post('/vitrina/consume/batch', body)
    },
    onSuccess,
    onError: (e: any) => setError(e?.response?.data?.message ?? 'Error al registrar'),
  })

  const verifyAdminPassword = async () => {
    if (!adminUsername || !adminPassword) return
    setVerifyingPassword(true)
    setError('')
    try {
      const res = await apiClient.post('/admin/verify-password', {
        username: adminUsername,
        password: adminPassword,
      })
      if (res.data.valid) {
        setPasswordVerified(true)
      } else {
        setError('Contraseña incorrecta o usuario no es admin')
        setPasswordVerified(false)
      }
    } catch {
      setError('Error al verificar contraseña')
    } finally {
      setVerifyingPassword(false)
    }
  }

  const isValid = () => {
    if (cart.length === 0) return false
    if (consumerType === 'GUEST' && !reservationId) return false
    if (consumerType === 'EMPLOYEE' && !employeeName.trim()) return false
    if (consumerType === 'ADMIN' && !passwordVerified) return false
    return true
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl flex flex-col" style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Registrar consumo</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <div className="flex flex-1 overflow-hidden">

          {/* Panel izquierdo — productos */}
          <div className="w-1/2 border-r border-slate-100 flex flex-col">
            <div className="px-4 pt-4 pb-2">
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="Buscar producto..." />
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
              {filteredProducts.map(p => {
                const inCart = cart.find(i => i.product.id === p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                      inCart
                        ? 'border-slate-800 bg-slate-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-400">{fmtCOP(p.unitPrice)} · stock: {p.currentStock}</p>
                      </div>
                      {inCart
                        ? <span className="text-xs font-bold text-slate-800 bg-slate-200 w-6 h-6 rounded-full flex items-center justify-center">{inCart.quantity}</span>
                        : <span className="text-slate-300 text-lg">+</span>
                      }
                    </div>
                  </button>
                )
              })}
              {filteredProducts.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-6">Sin productos disponibles</p>
              )}
            </div>
          </div>

          {/* Panel derecho — carrito + configuración */}
          <div className="w-1/2 flex flex-col overflow-y-auto">
            <div className="flex-1 px-5 pt-4 space-y-4">

              {/* Carrito */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Seleccionados
                </p>
                {cart.length === 0 ? (
                  <p className="text-sm text-slate-400 py-3 text-center border border-dashed border-slate-200 rounded-lg">
                    Agrega productos desde la izquierda
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {cart.map(item => (
                      <div key={item.product.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-700 truncate">{item.product.name}</p>
                          <p className="text-xs text-slate-400">{fmtCOP(item.product.unitPrice * item.quantity)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateQty(item.product.id, item.quantity - 1)}
                            className="w-6 h-6 rounded border border-slate-300 text-slate-600 hover:bg-white text-xs font-bold">−</button>
                          <span className="w-6 text-center text-sm font-semibold text-slate-800">{item.quantity}</span>
                          <button onClick={() => updateQty(item.product.id, Math.min(item.quantity + 1, item.product.currentStock))}
                            className="w-6 h-6 rounded border border-slate-300 text-slate-600 hover:bg-white text-xs font-bold">+</button>
                        </div>
                        <button onClick={() => removeFromCart(item.product.id)}
                          className="text-slate-300 hover:text-red-400 text-sm ml-1">×</button>
                      </div>
                    ))}
                    <div className="flex justify-between pt-1 px-1 text-sm">
                      <span className="text-slate-500">Total</span>
                      <span className="font-bold text-slate-800">{fmtCOP(total)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Consumidor */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Consumidor</p>
                <div className="grid grid-cols-4 gap-1">
                  {([
                    { value: 'GUEST',    label: 'Huésped' },
                    { value: 'EXTERNAL', label: 'Externo' },
                    { value: 'EMPLOYEE', label: 'Empleado' },
                    { value: 'ADMIN',    label: 'Admin' },
                  ] as { value: ConsumerType; label: string }[]).map(opt => (
                    <button key={opt.value}
                      onClick={() => { setConsumerType(opt.value); setPasswordVerified(false); setAdminUsername(''); setAdminPassword('') }}
                      className={`py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        consumerType === opt.value
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Campos por tipo */}
              {consumerType === 'GUEST' && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Habitación</label>
                    <select value={reservationId} onChange={e => setReservationId(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
                      <option value="">Seleccionar...</option>
                      {occupiedRooms.map(r => (
                        <option key={r.reservationId} value={r.reservationId!}>
                          Hab. {r.roomNumber} — {r.guestName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button onClick={() => setAnnotateToRoom(true)}
                      className={`py-2 text-xs font-medium rounded-lg border transition-colors ${
                        annotateToRoom ? 'bg-amber-600 text-white border-amber-600' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}>
                      Anotar a habitación
                    </button>
                    <button onClick={() => setAnnotateToRoom(false)}
                      className={`py-2 text-xs font-medium rounded-lg border transition-colors ${
                        !annotateToRoom ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}>
                      Paga ahora
                    </button>
                  </div>
                  {!annotateToRoom && (
                    <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
                      {PAYMENT_METHODS.map(m => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
                    </select>
                  )}
                </div>
              )}

              {consumerType === 'EXTERNAL' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Método de pago</label>
                  <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
                  </select>
                </div>
              )}

              {consumerType === 'EMPLOYEE' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Empleado</label>
                  <select value={employeeName} onChange={e => setEmployeeName(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
                    <option value="">Seleccionar empleado...</option>
                    {employees.filter(u => u.role === 'RECEPCIONISTA').map(u => (
                      <option key={u.id} value={u.fullName}>{u.fullName}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">Se registrará como deuda pendiente</p>
                </div>
              )}

              {consumerType === 'ADMIN' && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Administrador</label>
                    <select
                      value={adminUsername}
                      onChange={e => { setAdminUsername(e.target.value); setPasswordVerified(false); setAdminPassword('') }}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400">
                      <option value="">Seleccionar admin...</option>
                      {employees.filter(u => u.role === 'ADMIN').map(u => (
                        <option key={u.id} value={u.username}>{u.fullName}</option>
                      ))}
                    </select>
                  </div>
                  {adminUsername && !passwordVerified && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Contraseña</label>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={adminPassword}
                          onChange={e => setAdminPassword(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && verifyAdminPassword()}
                          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                          placeholder="Contraseña del admin" />
                        <button
                          onClick={verifyAdminPassword}
                          disabled={!adminPassword || verifyingPassword}
                          className="px-3 py-2 text-xs bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">
                          {verifyingPassword ? '...' : 'Verificar'}
                        </button>
                      </div>
                    </div>
                  )}
                  {passwordVerified && (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <span className="text-green-600 text-sm">✓</span>
                      <p className="text-xs text-green-700 font-medium">Identidad verificada</p>
                    </div>
                  )}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <p className="text-xs text-amber-700">No genera gasto ni registro en caja. Solo descuenta inventario.</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notas (opcional)</label>
                <input value={notes} onChange={e => setNotes(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  placeholder="Observaciones..." />
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-100 flex gap-2">
              <button onClick={onClose}
                className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={() => mutation.mutate()}
                disabled={!isValid() || mutation.isPending}
                className="flex-1 px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">
                {mutation.isPending ? 'Registrando...' : `Registrar · ${fmtCOP(total)}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Deudas de empleados ───────────────────────────────────────────────

function ModalDebts({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()

  const { data: debts = [], isLoading } = useQuery<any[]>({
    queryKey: ['employee-debts-all'],
    queryFn: () => apiClient.get('/vitrina/debts').then(r => r.data),
    staleTime: 0,
  })

  const payMutation = useMutation({
    mutationFn: (debtId: string) => apiClient.patch(`/vitrina/debts/${debtId}/pay`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employee-debts-all'] }),
  })

  // Agrupar por empleado
  const grouped = debts.reduce((acc: Record<string, any[]>, d: any) => {
    const key = d.employeeName
    if (!acc[key]) acc[key] = []
    acc[key].push(d)
    return acc
  }, {})

  const totalGlobal = debts.reduce((s: number, d: any) => s + d.totalDebt, 0)

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl flex flex-col" style={{ maxHeight: '85vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Deudas de empleados</h2>
            {debts.length > 0 && (
              <p className="text-xs text-slate-400 mt-0.5">
                {debts.length} deuda{debts.length !== 1 ? 's' : ''} pendiente{debts.length !== 1 ? 's' : ''} ·{' '}
                <span className="font-medium text-red-600">{fmtCOP(totalGlobal)}</span> total
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <p className="text-sm text-slate-400 text-center py-8">Cargando...</p>
          ) : debts.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No hay deudas pendientes.</p>
          ) : (
            <div className="space-y-5">
              {Object.entries(grouped).map(([employeeName, employeeDebts]) => {
                const totalEmpleado = (employeeDebts as any[]).reduce((s, d) => s + d.totalDebt, 0)
                return (
                  <div key={employeeName}>
                    {/* Encabezado del empleado */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center">
                          {employeeName.charAt(0).toUpperCase()}
                        </span>
                        <span className="text-sm font-semibold text-slate-800">{employeeName}</span>
                        <span className="text-xs text-slate-400">{(employeeDebts as any[]).length} ítem{(employeeDebts as any[]).length !== 1 ? 's' : ''}</span>
                      </div>
                      <span className="text-sm font-semibold text-red-600">{fmtCOP(totalEmpleado)}</span>
                    </div>

                    {/* Tabla de deudas del empleado */}
                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                            <th className="text-left px-4 py-2 font-medium">Producto</th>
                            <th className="text-right px-4 py-2 font-medium">Cant.</th>
                            <th className="text-right px-4 py-2 font-medium">Precio unit.</th>
                            <th className="text-right px-4 py-2 font-medium">Total</th>
                            <th className="text-left px-4 py-2 font-medium">Fecha</th>
                            <th className="px-4 py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {(employeeDebts as any[]).map((d: any) => (
                            <tr key={d.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                              <td className="px-4 py-2.5 font-medium text-slate-700">
                                {d.product?.name ?? '—'}
                              </td>
                              <td className="px-4 py-2.5 text-right text-slate-600">{d.quantity}</td>
                              <td className="px-4 py-2.5 text-right text-slate-500">{fmtCOP(d.unitPrice)}</td>
                              <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{fmtCOP(d.totalDebt)}</td>
                              <td className="px-4 py-2.5 text-slate-400 text-xs whitespace-nowrap">
                                {d.createdAt ? formatDate(d.createdAt) : '—'}
                              </td>
                              <td className="px-4 py-2.5">
                                <button
                                  onClick={() => payMutation.mutate(d.id)}
                                  disabled={payMutation.isPending}
                                  className="px-3 py-1 text-xs bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-50">
                                  Pagar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100">
          <button onClick={onClose}
            className="w-full px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

type ModalState =
  | { type: 'newProduct' }
  | { type: 'editProduct'; product: VitrinaProduct }
  | { type: 'restock'; product: VitrinaProduct }
  | { type: 'consume' }
  | { type: 'debts' }
  | null

export default function Vitrina() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'
  const qc = useQueryClient()

  const [modal, setModal] = useState<ModalState>(null)
  const [historyDate, setHistoryDate] = useState(toLocalDateStr(new Date()))
  const [showHistory, setShowHistory] = useState(false)
  const [showRestock, setShowRestock] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string>('ALL')
  const [search, setSearch] = useState('')

  // Productos
  const { data: products = [], isLoading } = useQuery<VitrinaProduct[]>({
    queryKey: ['vitrina-products'],
    queryFn: () => apiClient.get('/vitrina/products').then(r => r.data),
    staleTime: 0,
  })

  // Usuarios del sistema (empleados)
  const { data: systemUsers = [] } = useQuery<SystemUser[]>({
    queryKey: ['system-users'],
    queryFn: () => apiClient.get('/users/employees').then(r => r.data),
  })

  // Habitaciones ocupadas para selector de huésped
  const { data: rooms = [] } = useQuery<RoomByDate[]>({
    queryKey: ['rooms-today'],
    queryFn: () => apiClient.get(`/rooms/by-date?date=${toLocalDateStr(new Date())}`).then(r => r.data),
  })

  const occupiedRooms = rooms.filter(r => r.status === 'OCCUPIED' && r.reservationId && !r.rato)

  const { data: transactions = [], isLoading: loadingTx, refetch: refetchTx } = useQuery<VitrinaTransaction[]>({
    queryKey: ['vitrina-transactions', historyDate],
    queryFn: () => apiClient.get(`/vitrina/transactions/${historyDate}`).then(r => r.data),
    enabled: showHistory,
    staleTime: 0,
  })

  // Restock del mes actual
  const firstOfMonth = toLocalDateStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const { data: restockTx = [], isLoading: loadingRestock } = useQuery<VitrinaTransaction[]>({
    queryKey: ['vitrina-restock-month', firstOfMonth],
    queryFn: async () => {
      const today = toLocalDateStr(new Date())
      const days: VitrinaTransaction[] = []
      const start = new Date(firstOfMonth + 'T12:00:00')
      const end = new Date(today + 'T12:00:00')
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = toLocalDateStr(d)
        const res = await apiClient.get(`/vitrina/transactions/${dateStr}`)
        days.push(...res.data.filter((t: VitrinaTransaction) => t.type === 'RESTOCK'))
      }
      return days
    },
    enabled: showRestock,
    staleTime: 0,
  })

  const handleSuccess = () => {
    qc.invalidateQueries({ queryKey: ['vitrina-products'] })
    qc.invalidateQueries({ queryKey: ['vitrina-transactions', historyDate] })
    setModal(null)
  }

  // Filtros
  const filtered = products.filter(p => {
    const matchCat = filterCategory === 'ALL' || p.category === filterCategory
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Vitrina</h1>
          <p className="text-sm text-slate-500 mt-0.5">Inventario y registro de consumos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModal({ type: 'debts' })}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">
            Deudas empleados
          </button>
          {isAdmin && (
            <button onClick={() => setModal({ type: 'newProduct' })}
              className="px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700">
              + Nuevo producto
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 w-56"
          placeholder="Buscar producto..." />
        <div className="flex gap-1.5">
          {[
            { value: 'ALL',      label: 'Todos' },
            { value: 'BEVERAGE', label: 'Bebidas' },
            { value: 'SNACK',    label: 'Snacks' },
            { value: 'OTHER',    label: 'Otros' },
          ].map(opt => (
            <button key={opt.value}
              onClick={() => setFilterCategory(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                filterCategory === opt.value
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla de productos */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">Cargando productos...</div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">
            {products.length === 0
              ? 'No hay productos registrados. Crea el primero.'
              : 'No hay productos que coincidan con los filtros.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                <th className="text-left px-5 py-3 font-medium">Producto</th>
                <th className="text-left px-4 py-3 font-medium">Categoría</th>
                <th className="text-right px-4 py-3 font-medium">Precio</th>
                <th className="text-right px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">{p.name}</span>
                      {p.lowStock && (
                        <span className="text-xs bg-red-100 text-red-600 border border-red-200 px-1.5 py-0.5 rounded">
                          Stock bajo
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded border ${CATEGORY_COLOR[p.category]}`}>
                      {p.categoryLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">
                    {fmtCOP(p.unitPrice)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold ${p.lowStock ? 'text-red-600' : 'text-slate-700'}`}>
                      {p.currentStock}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setModal({ type: 'consume' })}
                        disabled={p.currentStock === 0}
                        className="px-3 py-1.5 text-xs bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-40">
                        Vender
                      </button>
                      <button
                        onClick={() => setModal({ type: 'restock', product: p })}
                        className="px-3 py-1.5 text-xs border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50">
                        Reabastecer
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => setModal({ type: 'editProduct', product: p })}
                          className="px-3 py-1.5 text-xs border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50">
                          Editar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>


      {/* Restock del mes */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <button
            onClick={() => setShowRestock(v => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900">
            <span>{showRestock ? '▲' : '▼'}</span>
            Restock del mes
          </button>
          {showRestock && restockTx.length > 0 && (
            <span className="text-xs text-slate-400">
              {restockTx.length} entrada{restockTx.length !== 1 ? 's' : ''} ·{' '}
              <span className="font-medium text-slate-600">
                {restockTx.reduce((s, t) => s + t.quantity, 0)} unidades
              </span>
            </span>
          )}
        </div>
        {showRestock && (
          loadingRestock ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400">Cargando...</div>
          ) : restockTx.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400">No hay restock registrado este mes.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-100">
                  <th className="text-left px-5 py-3 font-medium">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium">Producto</th>
                  <th className="text-right px-4 py-3 font-medium">Cantidad</th>
                  <th className="text-right px-4 py-3 font-medium">Stock después</th>
                  <th className="text-left px-4 py-3 font-medium">Registrado por</th>
                  <th className="text-left px-4 py-3 font-medium">Notas</th>
                </tr>
              </thead>
              <tbody>
                {restockTx.map(tx => (
                  <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {new Date(tx.registeredAt).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' })}
                      {' '}
                      {new Date(tx.registeredAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{tx.productName}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700">+{tx.quantity}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{tx.stockAfter ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{tx.registeredBy}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{tx.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>

      {/* Historial de ventas */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <button
            onClick={() => setShowHistory(v => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900">
            <span>{showHistory ? '▲' : '▼'}</span>
            Historial de ventas
          </button>
          {showHistory && (
            <input
              type="date"
              value={historyDate}
              max={toLocalDateStr(new Date())}
              onChange={e => setHistoryDate(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          )}
        </div>

        {showHistory && (
          loadingTx ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400">Cargando...</div>
          ) : transactions.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400">
              No hay movimientos para esta fecha.
            </div>
          ) : (
            <>
              {/* Resumen del día */}
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-6 text-xs text-slate-500">
                {(() => {
                  const ventas = transactions.filter(t => t.consumedBy !== 'ADMIN' && !t.annotatedToRoom)
                  const anotadas = transactions.filter(t => t.annotatedToRoom)
                  const totalVentas = ventas.reduce((s, t) => s + (t.totalAmount ?? 0), 0)
                  const totalAnotadas = anotadas.reduce((s, t) => s + (t.totalAmount ?? 0), 0)
                  return (
                    <>
                      <span>{transactions.length} movimientos</span>
                      <span className="text-slate-300">|</span>
                      <span>Cobrado: <strong className="text-slate-700">{fmtCOP(totalVentas)}</strong></span>
                      {totalAnotadas > 0 && (
                        <>
                          <span className="text-slate-300">|</span>
                          <span>Anotado a hab.: <strong className="text-slate-700">{fmtCOP(totalAnotadas)}</strong></span>
                        </>
                      )}
                    </>
                  )
                })()}
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-slate-100">
                    <th className="text-left px-5 py-3 font-medium">Hora</th>
                    <th className="text-left px-4 py-3 font-medium">Producto</th>
                    <th className="text-right px-4 py-3 font-medium">Cant.</th>
                    <th className="text-right px-4 py-3 font-medium">Total</th>
                    <th className="text-left px-4 py-3 font-medium">Consumidor</th>
                    <th className="text-left px-4 py-3 font-medium">Habitación</th>
                    <th className="text-left px-4 py-3 font-medium">Forma</th>
                    <th className="text-left px-4 py-3 font-medium">Registrado por</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 text-slate-400 text-xs tabular-nums whitespace-nowrap">
                        {new Date(tx.registeredAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{tx.productName}</p>
                        {tx.guestName && tx.guestName !== 'Externo' && (
                          <p className="text-xs text-slate-400">{tx.guestName}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{tx.quantity}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        {tx.totalAmount != null ? fmtCOP(tx.totalAmount) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {tx.consumedBy && (
                          <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded border ${CONSUMER_COLOR[tx.consumedBy] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {CONSUMER_LABEL[tx.consumedBy] ?? tx.consumedBy}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {tx.roomNumber ? `Hab. ${tx.roomNumber}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {tx.annotatedToRoom ? (
                          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded">
                            Anotado
                          </span>
                        ) : tx.consumedBy === 'ADMIN' ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded">
                            Pagado
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{tx.registeredBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )
        )}
      </div>

      {/* Modales */}
      {modal?.type === 'newProduct' && (
        <ModalProduct product={null} onClose={() => setModal(null)} onSuccess={handleSuccess} />
      )}
      {modal?.type === 'editProduct' && (
        <ModalProduct product={modal.product} onClose={() => setModal(null)} onSuccess={handleSuccess} />
      )}
      {modal?.type === 'restock' && (
        <ModalRestock product={modal.product} onClose={() => setModal(null)} onSuccess={handleSuccess} />
      )}
      {modal?.type === 'consume' && (
        <ModalConsume
          products={products}
          occupiedRooms={occupiedRooms}
          employees={systemUsers}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
      {modal?.type === 'debts' && (
        <ModalDebts onClose={() => setModal(null)} />
      )}
    </div>
  )
}