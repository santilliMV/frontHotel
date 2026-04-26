import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import apiClient from '../api/client';


const navItems = [
  { path: '/', label: 'Planilla', exact: true },
  { path: '/reservas', label: 'Reservas' },
  { path: '/checkin', label: 'Check-in' },
  { path: '/checkout', label: 'Check-out' },
  { path: '/vitrina', label: 'Vitrina' },
  { path: '/toallas', label: 'Toallas' },
  { path: '/rato', label: 'Servicio Rato' },
  { path: '/caja', label: 'Caja Diaria' },
  { path: '/gastos', label: 'Gastos' },
  { path: '/huespedes', label: 'Huespedes' },
  { path: '/observaciones', label: 'Observaciones' },
];

const adminItems = [
  { path: '/admin/precios', label: 'Precios' },
  { path: '/admin/cortesias', label: 'Cortesias' },
  { path: '/admin/auditoria', label: 'Auditoria' },
];

const fmtCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');

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
}

// ─── Modal: Abrir turno ───────────────────────────────────────────────────────

function AbrirTurnoModal({ username, onSuccess }: {
  username: string;
  onSuccess: (shift: Shift) => void;
}) {
  const [amount,   setAmount]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [expected, setExpected] = useState<number | null>(null);
  const [loadingExpected, setLoadingExpected] = useState(true);

  useEffect(() => {
    const fetchExpected = async () => {
      try {
        const r = await apiClient.get('/shifts/today');
        const shifts: Shift[] = r.data;
        const lastClosed = shifts
          .filter(s => s.closedAt !== null && s.actualCashAmount !== null)
          .sort((a, b) => new Date(b.closedAt!).getTime() - new Date(a.closedAt!).getTime())[0];

        if (lastClosed) {
          setExpected(lastClosed.actualCashAmount!);
          setAmount(String(Math.round(lastClosed.actualCashAmount!)));
        } else {
          try {
            const c = await apiClient.get('/cash/today');
            setExpected(c.data.baseAmount);
            setAmount(String(Math.round(c.data.baseAmount)));
          } catch {
            setExpected(null);
          }
        }
      } catch {
        setExpected(null);
      } finally {
        setLoadingExpected(false);
      }
    };
    fetchExpected();
  }, []);

  const handleOpen = async () => {
    if (!amount || parseFloat(amount) < 0) return;
    setLoading(true); setError('');
    try {
      const r = await apiClient.post('/shifts/open', { baseAmount: parseFloat(amount) });
      onSuccess(r.data);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al abrir el turno');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">
            🏨
          </div>
          <h2 className="text-lg font-semibold text-slate-800">Abrir turno</h2>
          <p className="text-sm text-slate-500 mt-1">
            {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Bienvenido, {username}</p>
        </div>

        {loadingExpected ? (
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-4 text-sm text-slate-400">
            Consultando turno anterior...
          </div>
        ) : expected !== null ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4">
            <p className="text-xs text-blue-500 mb-0.5">Efectivo esperado del turno anterior</p>
            <p className="text-xl font-bold text-blue-800">{fmtCOP(expected)}</p>
            <p className="text-xs text-blue-400 mt-1">Verifica que coincida con lo que recibiste</p>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-4 text-sm text-slate-500">
            Primer turno del día — ingresa el efectivo disponible
          </div>
        )}

        <p className="text-sm text-slate-600 mb-3">
          ¿Cuánto efectivo recibes para este turno?
        </p>

        <label className="text-xs text-slate-500 mb-1 block">Monto base recibido</label>
        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
          <input
            type="number" min="0" step="1000" autoFocus placeholder="0"
            value={amount} onChange={e => setAmount(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && amount && handleOpen()}
            className="w-full border border-slate-200 rounded-lg pl-7 pr-4 py-3 text-lg font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>

        {expected !== null && amount && Math.abs(parseFloat(amount) - expected) > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 mb-4 text-sm text-amber-700">
            ⚠ Diferencia de {fmtCOP(Math.abs(parseFloat(amount) - expected))} con el turno anterior
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <button
          onClick={handleOpen}
          disabled={!amount || loading}
          className="w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg py-3"
        >
          {loading ? 'Abriendo turno...' : 'Iniciar turno'}
        </button>

        <p className="text-xs text-slate-400 text-center mt-3">
          No puedes usar el sistema sin abrir un turno
        </p>
      </div>
    </div>
  );
}

// ─── Modal: Cerrar turno ──────────────────────────────────────────────────────

function CerrarTurnoModal({ shift, onSuccess, onCancel }: {
  shift: Shift;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [actualCash,       setActual]    = useState('');
  const [notes,            setNotes]     = useState('');
  const [discrepancyNotes, setDiscNotes] = useState('');
  const [loading,          setLoading]   = useState(false);
  const [error,            setError]     = useState('');

  const expected    = shift.baseAmount + shift.totalSales - shift.totalExpenses - shift.totalWithdrawn;
  const actual      = parseFloat(actualCash) || 0;
  const discrepancy = actual - expected;
  const hasDisc     = actualCash !== '' && Math.abs(discrepancy) > 0;

  const handleClose = async () => {
    if (!actualCash) return;
    setLoading(true); setError('');
    try {
      await apiClient.post('/shifts/close', {
        actualCashAmount:  actual,
        notes:             notes            || null,
        discrepancyNotes:  discrepancyNotes || null,
      });
      onSuccess();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al cerrar el turno');
    } finally {
      setLoading(false);
    }
  };

  const duration = () => {
    const start = new Date(shift.openedAt);
    const now   = new Date();
    const mins  = Math.floor((now.getTime() - start.getTime()) / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Cerrar turno</h2>
        <p className="text-sm text-slate-400 mb-5">Duración: {duration()}</p>

        <div className="bg-slate-50 border border-slate-100 rounded-xl divide-y divide-slate-100 mb-5 text-sm">
          {[
            ['Monto base recibido', fmtCOP(shift.baseAmount)],
            ['Ventas registradas',  fmtCOP(shift.totalSales)],
            ...(shift.totalExpenses  > 0 ? [['Gastos',             fmtCOP(shift.totalExpenses)]]  : []),
            ...(shift.totalWithdrawn > 0 ? [['Retirado por admin', fmtCOP(shift.totalWithdrawn)]] : []),
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between px-4 py-2.5">
              <span className="text-slate-500">{k}</span>
              <span className="font-medium text-slate-700">{v}</span>
            </div>
          ))}
          <div className="flex justify-between px-4 py-2.5 bg-slate-100 rounded-b-xl">
            <span className="font-semibold text-slate-700">Efectivo esperado</span>
            <span className="font-bold text-slate-800">{fmtCOP(expected)}</span>
          </div>
        </div>

        <label className="text-xs text-slate-500 mb-1 block">Efectivo real en caja</label>
        <div className="relative mb-3">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
          <input
            type="number" min="0" step="1000" autoFocus placeholder="0"
            value={actualCash} onChange={e => setActual(e.target.value)}
            className="w-full border border-slate-200 rounded-lg pl-7 pr-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>

        {actualCash !== '' && (
          <div className={`rounded-lg px-4 py-2.5 text-sm mb-3 ${
            Math.abs(discrepancy) === 0
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {Math.abs(discrepancy) === 0
              ? '✓ Caja cuadrada'
              : `${discrepancy > 0 ? 'Sobran' : 'Faltan'} ${fmtCOP(Math.abs(discrepancy))}`}
          </div>
        )}

        {hasDisc && (
          <>
            <label className="text-xs text-slate-500 mb-1 block">Explicación de la diferencia</label>
            <input type="text" placeholder="¿Por qué hay diferencia?" value={discrepancyNotes}
              onChange={e => setDiscNotes(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 mb-3" />
          </>
        )}

        <label className="text-xs text-slate-500 mb-1 block">Notas del turno (opcional)</label>
        <input type="text" placeholder="Observaciones..." value={notes} onChange={e => setNotes(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 mb-4" />

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 border border-slate-200 rounded-lg py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={handleClose} disabled={!actualCash || loading}
            className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg py-2.5">
            {loading ? 'Cerrando...' : 'Cerrar turno y salir'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Layout principal ─────────────────────────────────────────────────────────

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN';

  const [activeShift,    setActiveShift]    = useState<Shift | null>(null);
  const [shiftChecked,   setShiftChecked]   = useState(false);
  const [showOpenShift,  setShowOpenShift]  = useState(false);
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [showShiftToast, setShowShiftToast] = useState(false);

  useEffect(() => {
    if (isAdmin) { setShiftChecked(true); return; }
    const checkShift = async () => {
      try {
        const r = await apiClient.get('/shifts/my');
        setActiveShift(r.data);
      } catch {
        setShowOpenShift(true);
      } finally {
        setShiftChecked(true);
      }
    };
    checkShift();
  }, [isAdmin]);

  const handleShiftOpened = (shift: Shift) => {
    setActiveShift(shift);
    setShowOpenShift(false);
    setShowShiftToast(true);
    setTimeout(() => setShowShiftToast(false), 4000);
  };

  const handleLogout = () => {
    if (!isAdmin && activeShift) {
      setShowCloseShift(true);
    } else {
      logout();
      navigate('/login');
    }
  };

  const handleShiftClosed = () => {
    setActiveShift(null);
    setShowCloseShift(false);
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">

      {/* ── Sidebar oscuro ── */}
      <aside className="w-56 bg-[#1e1e1c] border-r border-[#323230] flex flex-col flex-shrink-0">

        <div className="px-5 py-5 border-b border-[#323230]">
          <h1 className="text-base font-semibold text-white">Hotel Santiago</h1>
          <p className="text-xs text-[#a8a79f] mt-0.5">{user?.fullName}</p>
          <span className="inline-block mt-1 text-xs bg-[#2c2c2a] text-[#a8a79f] px-2 py-0.5 rounded font-medium">
            {isAdmin ? 'Administrador' : 'Recepcionista'}
          </span>
          {!isAdmin && activeShift && (
            <div className="flex items-center gap-1.5 mt-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs text-emerald-400 font-medium">Turno activo</span>
            </div>
          )}
          {!isAdmin && !activeShift && shiftChecked && (
            <div className="flex items-center gap-1.5 mt-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span className="text-xs text-red-400 font-medium">Sin turno</span>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {navItems.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.exact}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-[#383836] text-white font-medium'
                    : 'text-[#a8a79f] hover:bg-[#2a2a28] hover:text-white'
                }`}>
              {item.label}
            </NavLink>
          ))}

          {isAdmin && (
            <>
              <div className="pt-4 pb-1 px-3">
                <p className="text-xs font-semibold text-[#636360] uppercase tracking-wider">Administracion</p>
              </div>
              {adminItems.map((item) => (
                <NavLink key={item.path} to={item.path}
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-[#383836] text-white font-medium'
                        : 'text-[#a8a79f] hover:bg-[#2a2a28] hover:text-white'
                    }`}>
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div className="px-3 py-4 border-t border-[#323230] space-y-1">
          {!isAdmin && activeShift && (
            <div className="px-3 py-2 text-xs text-[#a8a79f] bg-[#2a2a28] rounded-lg">
              Turno desde{' '}
              {new Date(activeShift.openedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
          <button onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-[#a8a79f] hover:bg-[#2a2a28] hover:text-red-400 transition-colors">
            {!isAdmin && activeShift ? 'Cerrar turno y salir' : 'Cerrar sesión'}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {showOpenShift && !isAdmin && (
        <AbrirTurnoModal
          username={user?.fullName ?? ''}
          onSuccess={handleShiftOpened}
        />
      )}

      {showCloseShift && activeShift && (
        <CerrarTurnoModal
          shift={activeShift}
          onSuccess={handleShiftClosed}
          onCancel={() => setShowCloseShift(false)}
        />
      )}

      {showShiftToast && activeShift && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-800 text-white px-5 py-3.5 rounded-xl shadow-lg flex items-center gap-3">
          <span className="text-emerald-400 text-lg">✓</span>
          <div>
            <p className="text-sm font-medium">Turno abierto</p>
            <p className="text-xs text-slate-300 mt-0.5">Base: {fmtCOP(activeShift.baseAmount)}</p>
          </div>
          <button onClick={() => setShowShiftToast(false)} className="ml-2 text-slate-400 hover:text-white text-lg leading-none">×</button>
        </div>
      )}
    </div>
  );
}