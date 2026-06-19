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
import Caja from './pages/Caja';
import Gastos from './pages/Gastos';
import Rato from './pages/Rato';
import Toallas from './pages/Toallas';
import Vitrina from './pages/Vitrina';
import Observaciones from './pages/Observaciones';
import Empleados from './pages/Empleados';
import AdminPrecios from './pages/AdminPrecios';
import AdminAuditoria from './pages/AdminAuditoria';
import AdminFinanzas from "./pages/AdminFinanzas";
import MetodosPago from "./pages/MetodosPago";

const queryClient = new QueryClient();

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
            <Route path="/vitrina" element={<Vitrina />} />
            <Route path="/toallas" element={<Toallas />} />
            <Route path="/rato" element={<Rato />} />
            <Route path="caja" element={<Caja />} />
            <Route path="/gastos" element={<Gastos />} />
            <Route path="/huespedes" element={<Huespedes />} />
            <Route path="/observaciones" element={<Observaciones />} />
            <Route path="admin/empleados" element={<Empleados />} />
            <Route path="admin/precios" element={<AdminPrecios />} />
            <Route path="admin/auditoria" element={<AdminAuditoria />} />
            <Route path="/admin/finanzas" element={<AdminFinanzas />} />
            <Route path="/metodos-pago" element={<MetodosPago />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}