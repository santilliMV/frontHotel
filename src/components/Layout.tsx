import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

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

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">

      {/* Barra lateral */}
      <aside className="w-56 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">

        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-200">
          <h1 className="text-base font-semibold text-slate-800">Hotel Santiago</h1>
          <p className="text-xs text-slate-500 mt-0.5">{user?.fullName}</p>
          <span className="inline-block mt-1 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
            {user?.role === 'ADMIN' ? 'Administrador' : 'Recepcionista'}
          </span>
        </div>

        {/* Navegacion */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white font-medium'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}

          {user?.role === 'ADMIN' && (
            <>
              <div className="pt-4 pb-1 px-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Administracion
                </p>
              </div>
              {adminItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-slate-800 text-white font-medium'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* Boton cerrar sesion */}
        <div className="px-3 py-4 border-t border-slate-200">
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            Cerrar sesion
          </button>
        </div>

      </aside>

      {/* Contenido principal */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

    </div>
  );
}