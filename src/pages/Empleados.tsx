import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Employee {
  id: string
  username: string
  fullName: string
  role: 'ADMIN' | 'RECEPCIONISTA' | 'CAMARERA'
  isActive: boolean
  createdAt?: string
}

interface CreateUserBody {
  username: string
  password: string
  fullName: string
  role: string
}

interface UpdateUserBody {
  fullName?: string
  role?: string
  password?: string
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const ROLES: { value: string; label: string }[] = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'RECEPCIONISTA', label: 'Recepcionista' },
  { value: 'CAMARERA', label: 'Camarera' },
]

const ROLE_STYLES: Record<string, string> = {
  ADMIN: 'bg-slate-800 text-white',
  RECEPCIONISTA: 'bg-blue-100 text-blue-800',
  CAMARERA: 'bg-emerald-100 text-emerald-800',
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  RECEPCIONISTA: 'Recepcionista',
  CAMARERA: 'Camarera',
}

// ─── API ──────────────────────────────────────────────────────────────────────

const fetchEmployees = async (): Promise<Employee[]> => {
  const { data } = await apiClient.get('/admin/users')
  return data
}

const createEmployee = async (body: CreateUserBody) => {
  const { data } = await apiClient.post('/admin/users', body)
  return data
}

const updateEmployee = async ({ id, body }: { id: string; body: UpdateUserBody }) => {
  const { data } = await apiClient.put(`/admin/users/${id}`, body)
  return data
}

const toggleEmployee = async (id: string) => {
  const { data } = await apiClient.patch(`/admin/users/${id}/toggle`)
  return data
}

// ─── Modal de Crear / Editar ───────────────────────────────────────────────────

interface ModalProps {
  employee: Employee | null   // null = crear nuevo
  onClose: () => void
  onSuccess: () => void
}

function EmployeeModal({ employee, onClose, onSuccess }: ModalProps) {
  const isEditing = employee !== null
  const queryClient = useQueryClient()

  const [fullName, setFullName] = useState(employee?.fullName ?? '')
  const [username, setUsername] = useState(employee?.username ?? '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(employee?.role ?? 'RECEPCIONISTA')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const createMutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      onSuccess()
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message ?? 'Error al crear el empleado')
    },
  })

  const updateMutation = useMutation({
    mutationFn: updateEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      onSuccess()
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message ?? 'Error al actualizar el empleado')
    },
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const handleSubmit = () => {
    setError('')

    if (!fullName.trim()) { setError('El nombre completo es obligatorio'); return }
    if (!isEditing && !username.trim()) { setError('El usuario es obligatorio'); return }
    if (!isEditing && password.length < 4) { setError('La contraseña debe tener al menos 4 caracteres'); return }
    if (isEditing && password && password.length < 4) { setError('La contraseña debe tener al menos 4 caracteres'); return }

    if (isEditing) {
      const body: UpdateUserBody = { fullName: fullName.trim(), role }
      if (password) body.password = password
      updateMutation.mutate({ id: employee!.id, body })
    } else {
      createMutation.mutate({
        username: username.trim().toLowerCase(),
        password,
        fullName: fullName.trim(),
        role,
      })
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">
            {isEditing ? 'Editar empleado' : 'Nuevo empleado'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Nombre completo */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Nombre completo</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Ej: María López"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          {/* Usuario — solo en creación */}
          {!isEditing && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Usuario</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Ej: mlopez"
                autoComplete="off"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
              <p className="text-xs text-slate-400 mt-1">Se guardará en minúsculas, sin espacios</p>
            </div>
          )}

          {/* Contraseña */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Contraseña {isEditing && <span className="text-slate-400 font-normal">(dejar en blanco para no cambiar)</span>}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={isEditing ? '••••••••' : 'Mínimo 4 caracteres'}
                autoComplete="new-password"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-10 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                {showPassword ? 'Ocultar' : 'Ver'}
              </button>
            </div>
          </div>

          {/* Rol */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Rol</label>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value as any)}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                    role === r.value
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="flex-1 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-60 transition-colors"
          >
            {isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear empleado'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Empleados() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('active')

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: fetchEmployees,
  })

  const toggleMutation = useMutation({
    mutationFn: toggleEmployee,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  })

  const filtered = employees.filter(e => {
    if (filterActive === 'active') return e.isActive
    if (filterActive === 'inactive') return !e.isActive
    return true
  })

  const openCreate = () => { setEditing(null); setModalOpen(true) }
  const openEdit = (emp: Employee) => { setEditing(emp); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditing(null) }

  const activeCount = employees.filter(e => e.isActive).length
  const inactiveCount = employees.filter(e => !e.isActive).length

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Empleados</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {activeCount} activo{activeCount !== 1 ? 's' : ''} · {inactiveCount} inactivo{inactiveCount !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={openCreate}
            className="bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
          >
            + Nuevo empleado
          </button>
        </div>

        {/* Filtros */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1 w-fit">
          {(['active', 'all', 'inactive'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterActive(f)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filterActive === f
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {f === 'active' ? 'Activos' : f === 'inactive' ? 'Inactivos' : 'Todos'}
            </button>
          ))}
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {isLoading ? (
            <div className="py-16 text-center text-sm text-slate-400">Cargando...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">No hay empleados</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">Nombre</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">Usuario</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">Rol</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">Estado</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(emp => (
                  <tr key={emp.id} className={`hover:bg-slate-50/60 transition-colors ${!emp.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-slate-800">{emp.fullName}</span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 font-mono text-xs">{emp.username}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_STYLES[emp.role] ?? 'bg-slate-100 text-slate-600'}`}>
                        {ROLE_LABELS[emp.role] ?? emp.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${emp.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {emp.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(emp)}
                          className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => toggleMutation.mutate(emp.id)}
                          disabled={toggleMutation.isPending}
                          className={`text-xs px-2 py-1 rounded transition-colors ${
                            emp.isActive
                              ? 'text-red-500 hover:text-red-700 hover:bg-red-50'
                              : 'text-green-600 hover:text-green-800 hover:bg-green-50'
                          }`}
                        >
                          {emp.isActive ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* Modal */}
      {modalOpen && (
        <EmployeeModal
          employee={editing}
          onClose={closeModal}
          onSuccess={closeModal}
        />
      )}
    </div>
  )
}