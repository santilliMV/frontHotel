import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { ReservationResponse } from '../api/reservations';
import { reservationsApi } from '../api/reservations';
import { formatCurrency, formatDate } from '../utils/format';
import NuevaReservaModal from '../components/reservas/NuevaReservaModal';
import apiClient from '../api/client';
import { usePageTitle } from '../hooks/usePageTitle';


// ─── Helpers ──────────────────────────────────────────────────────────────────

function toMonthStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(monthStr: string) {
  const [y, m] = monthStr.split('-');
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const TODAY = toDateStr(new Date());
const isToday = (s: string) => s === TODAY;
const isFuture = (s: string) => s > TODAY;
const isPast = (s: string) => s < TODAY;

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Reservas() {
  usePageTitle('Reservas');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showNueva, setShowNueva] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(toMonthStr(new Date()));
  const [busqueda, setBusqueda] = useState('');
  const [detalle, setDetalle] = useState<ReservationResponse | null>(null);

  const { data: reservas = [], isLoading } = useQuery({
    queryKey: ['reservations', 'confirmed', selectedMonth],
    queryFn: () => apiClient.get(`/reservations/confirmed?month=${selectedMonth}`).then(r => r.data),
  });

  const cancelMutation = useMutation({
    mutationFn: reservationsApi.cancel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations', 'confirmed'] }); setDetalle(null);
    },
  });

  const handleCancelar = (id: string) => {
    if (confirm('¿Cancelar esta reserva?')) cancelMutation.mutate(id);
  };

  const handleCheckin = (r: ReservationResponse) => {
    navigate('/checkin', {
      state: {
        reservationId: r.id,
        prefill: {
          roomTypeId: r.roomTypeId,
          roomId: r.roomId ?? undefined,
          checkInDate: r.checkInDate,
          checkOutDate: r.checkOutDate,
          numberOfGuests: r.numberOfGuests,
          occupantType: r.occupantType,
        },
      },
    });
  };

  // Navegación de mes
  const prevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setSelectedMonth(toMonthStr(d));
  };
  const nextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    setSelectedMonth(toMonthStr(d));
  };
  const isCurrentMonth = selectedMonth === toMonthStr(new Date());

  // Filtro texto
  const filtradas = reservas.filter((r: ReservationResponse) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return r.guestName.toLowerCase().includes(q)
      || r.guestPhone.includes(q)
      || r.reservationNumber.toLowerCase().includes(q)
      || r.roomTypeName.toLowerCase().includes(q);
  });

  // Grupos
  const llegan = filtradas.filter((r: ReservationResponse) => isToday(r.checkInDate) && (r.status === 'CONFIRMED' || r.status === 'PENDING'));
  const futuras = filtradas.filter((r: ReservationResponse) => isFuture(r.checkInDate) && (r.status === 'CONFIRMED' || r.status === 'PENDING'));
  const pasadas = filtradas.filter((r: ReservationResponse) => isPast(r.checkInDate) && (r.status === 'CONFIRMED' || r.status === 'PENDING'));
  const completadas = filtradas.filter((r: ReservationResponse) => r.status === 'CHECKED_OUT');
  const canceladas = filtradas.filter((r: ReservationResponse) => r.status === 'CANCELLED');

  return (
    <div className="p-6 space-y-5">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Reservas</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {filtradas.length} reserva{filtradas.length !== 1 ? 's' : ''} · {monthLabel(selectedMonth)}
          </p>
        </div>
        <button
          onClick={() => setShowNueva(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva reserva
        </button>
      </div>

      {/* Navegación de mes + búsqueda */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <button onClick={prevMonth}
            className="px-3 py-2 text-slate-500 hover:bg-slate-50 text-sm font-bold">
            ←
          </button>
          <span className="px-3 py-2 text-sm font-medium text-slate-700 capitalize min-w-[160px] text-center">
            {monthLabel(selectedMonth)}
          </span>
          <button onClick={nextMonth} disabled={isCurrentMonth}
            className="px-3 py-2 text-slate-500 hover:bg-slate-50 text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed">
            →
          </button>
        </div>

        {!isCurrentMonth && (
          <button onClick={() => setSelectedMonth(toMonthStr(new Date()))}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
            Hoy
          </button>
        )}

        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Nombre, teléfono, número..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">×</button>
          )}
        </div>
      </div>

      {/* Contenido */}
      {isLoading ? (
        <div className="p-16 text-center text-slate-400">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          Cargando reservas...
        </div>
      ) : filtradas.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-xl border border-slate-200">
          <p className="text-slate-500 font-medium">No hay reservas en {monthLabel(selectedMonth)}</p>
          <p className="text-slate-400 text-sm mt-1">
            {busqueda ? 'Intenta con otro término' : 'Usa las flechas para navegar entre meses'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {llegan.length > 0 && (
            <Grupo titulo="Llegan hoy" color="blue" reservas={llegan}
              onVer={setDetalle} onCheckin={handleCheckin} onCancelar={handleCancelar} />
          )}
          {futuras.length > 0 && (
            <Grupo titulo="Próximas llegadas" color="gray" reservas={futuras}
              onVer={setDetalle} onCheckin={handleCheckin} onCancelar={handleCancelar} />
          )}
          {pasadas.length > 0 && (
            <Grupo titulo="No se presentaron" color="amber" reservas={pasadas}
              onVer={setDetalle} onCheckin={handleCheckin} onCancelar={handleCancelar} />
          )}
          {completadas.length > 0 && (
            <Grupo titulo="Completadas" color="green" reservas={completadas}
              onVer={setDetalle} onCheckin={handleCheckin} onCancelar={handleCancelar} />
          )}
          {canceladas.length > 0 && (
            <Grupo titulo="Canceladas" color="red" reservas={canceladas}
              onVer={setDetalle} onCheckin={handleCheckin} onCancelar={handleCancelar} />
          )}
        </div>
      )}

      {/* Modal detalle */}
      {detalle && (
        <DetalleModal
          reserva={detalle}
          onClose={() => setDetalle(null)}
          onCheckin={() => handleCheckin(detalle)}
          onCancelar={() => handleCancelar(detalle.id)}
        />
      )}

      {showNueva && (
        <NuevaReservaModal
          onClose={() => setShowNueva(false)}
          onCreada={() => {
            setShowNueva(false);
            queryClient.invalidateQueries({ queryKey: ['reservations'] });
          }}
        />
      )}
    </div>
  );
}

// ─── Grupo ────────────────────────────────────────────────────────────────────

function Grupo({ titulo, color, reservas, onVer, onCheckin, onCancelar }: {
  titulo: string;
  color: 'blue' | 'gray' | 'amber' | 'green' | 'red';
  reservas: ReservationResponse[];
  onVer: (r: ReservationResponse) => void;
  onCheckin: (r: ReservationResponse) => void;
  onCancelar: (id: string) => void;
}) {
  const header = {
    blue: 'bg-blue-50 border-blue-100 text-blue-800',
    gray: 'bg-slate-50 border-slate-100 text-slate-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-800',
    green: 'bg-emerald-50 border-emerald-100 text-emerald-800',
    red: 'bg-red-50 border-red-100 text-red-800',
  }[color];

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className={`px-5 py-3 border-b ${header} flex items-center justify-between`}>
        <span className="font-semibold text-sm">{titulo}</span>
        <span className="text-xs opacity-70">{reservas.length}</span>
      </div>
      <div className="divide-y divide-slate-50">
        {reservas.map(r => (
          <ReservaRow key={r.id} reserva={r}
            onVer={() => onVer(r)}
            onCheckin={() => onCheckin(r)}
            onCancelar={() => onCancelar(r.id)} />
        ))}
      </div>
    </div>
  );
}

// ─── Fila ─────────────────────────────────────────────────────────────────────

function ReservaRow({ reserva, onVer, onCheckin, onCancelar }: {
  reserva: ReservationResponse;
  onVer: () => void;
  onCheckin: () => void;
  onCancelar: () => void;
}) {
  return (
    <div className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-900 text-sm">{reserva.guestName}</span>
          {reserva.guestHasObservations && (
            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Obs.</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 flex-wrap">
          <span>{reserva.guestPhone}</span>
          <span>·</span>
          <span>{reserva.roomTypeName}</span>
          {reserva.roomNumber
            ? <span className="bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded">Hab. {reserva.roomNumber}</span>
            : <span className="text-slate-400 italic">Sin hab. asignada</span>
          }
          <span>·</span>
          <span>{formatDate(reserva.checkInDate)} → {formatDate(reserva.checkOutDate)}</span>
          <span>·</span>
          <span>{reserva.numberOfNights}n · {reserva.numberOfGuests}p</span>
          {reserva.approximateArrivalTime && (
            <><span>·</span><span>{reserva.approximateArrivalTime}</span></>
          )}
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="font-semibold text-slate-900 text-sm">{formatCurrency(reserva.estimatedTotal)}</div>
        <div className="text-xs text-slate-400">{reserva.reservationNumber}</div>
        {reserva.depositAmount && (
          <div className="text-xs text-emerald-600">Dep: {formatCurrency(reserva.depositAmount)}</div>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button onClick={onVer}
          className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100">
          Ver
        </button>
        {(reserva.status === 'CONFIRMED' || reserva.status === 'PENDING') && (
          <>
            <button onClick={onCheckin}
              className="px-2.5 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
              Check-in
            </button>
            <button onClick={onCancelar}
              className="px-2.5 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
              ✕
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Modal detalle ────────────────────────────────────────────────────────────

function DetalleModal({ reserva, onClose, onCheckin, onCancelar }: {
  reserva: ReservationResponse;
  onClose: () => void;
  onCheckin: () => void;
  onCancelar: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-slate-900">Detalle de reserva</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="p-6 space-y-4">
          {reserva.guestHasObservations && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 font-medium">
              Este huésped tiene observaciones. Revise antes de proceder.
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Número" value={reserva.reservationNumber} />
            <Field label="Huésped" value={reserva.guestName} />
            <Field label="Teléfono" value={reserva.guestPhone} />
            <Field label="Tipo hab." value={reserva.roomTypeName} />
            {reserva.roomNumber && <Field label="Habitación" value={`Hab. ${reserva.roomNumber}`} />}
            <Field label="Ocupantes" value={String(reserva.numberOfGuests)} />
            <Field label="Check-in" value={formatDate(reserva.checkInDate)} />
            <Field label="Check-out" value={formatDate(reserva.checkOutDate)} />
            <Field label="Noches" value={String(reserva.numberOfNights)} />
            <Field label="Total estimado" value={formatCurrency(reserva.estimatedTotal)} />
            {reserva.depositAmount && <Field label="Depósito" value={formatCurrency(reserva.depositAmount)} />}
            {reserva.approximateArrivalTime && <Field label="Llegada aprox." value={reserva.approximateArrivalTime} />}
          </div>

          {reserva.specialRequests && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Solicitudes especiales</p>
              <p className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2">{reserva.specialRequests}</p>
            </div>
          )}

          {reserva.companions.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2">Acompañantes</p>
              <div className="space-y-1">
                {reserva.companions.map((c, i) => (
                  <div key={i} className="text-sm bg-slate-50 rounded px-3 py-2 text-slate-700">
                    {c.name}{c.documentNumber ? ` · ${c.documentNumber}` : ''}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            Cerrar
          </button>
          {(reserva.status === 'CONFIRMED' || reserva.status === 'PENDING') && (
            <>
              <button onClick={onCancelar}
                className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50">
                Cancelar reserva
              </button>
              <button onClick={onCheckin}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                Hacer check-in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-medium text-slate-900">{value}</p>
    </div>
  );
}