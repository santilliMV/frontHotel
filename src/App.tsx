import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import Planilla from './pages/Planilla';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Reservas from './pages/Reservas';
import CheckIn from './pages/CheckIn';
import Huespedes from './pages/Huespedes';
import CheckOut from './pages/CheckOut';

const queryClient = new QueryClient();

// Paginas temporales para que no rompa mientras las construimos
function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-8">
      <h2 className="text-xl font-semibold text-slate-700">{title}</h2>
      <p className="text-slate-500 mt-1 text-sm">Modulo en construccion.</p>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>

          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Planilla />} />
            <Route path="reservas" element={<Reservas />} />
            <Route path="/checkin" element={<CheckIn />} />
            <Route path="/checkout" element={<CheckOut />} />
            <Route path="vitrina" element={<Placeholder title="Vitrina" />} />
            <Route path="toallas" element={<Placeholder title="Toallas" />} />
            <Route path="rato" element={<Placeholder title="Servicio Rato" />} />
            <Route path="caja" element={<Placeholder title="Caja Diaria" />} />
            <Route path="gastos" element={<Placeholder title="Gastos" />} />
            <Route path="/huespedes" element={<Huespedes />} />
            <Route path="observaciones" element={<Placeholder title="Observaciones" />} />
            <Route path="admin/precios" element={<Placeholder title="Precios" />} />
            <Route path="admin/cortesias" element={<Placeholder title="Cortesias" />} />
            <Route path="admin/auditoria" element={<Placeholder title="Auditoria" />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}