import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { reservationsApi } from '../api/reservations';
import type { ReservationResponse, ReservationStatus } from '../api/reservations';
import { formatCurrency, formatDate } from '../utils/format';
import NuevaReservaModal from '../components/reservas/NuevaReservaModal';
import BuscarReservaModal from '../components/reservas/BuscarReservaModal';

// ─── Estilos ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: 'bg-blue-100 text-blue-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  CHECKED_IN: 'bg-green-100 text-green-700',
  CHECKED_OUT: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: 'Confirmada',
  PENDING: 'Pendiente',
  CHECKED_IN: 'En hotel',
  CHECKED_OUT: 'Completada',
  CANCELLED: 'Cancelada',
};

const FILTER_OPTIONS: { value: ReservationStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todas' },
  { value: 'CONFIRMED', label: 'Reservadas' },
  { value: 'CHECKED_IN', label: 'En hotel' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const TODAY = toDateStr(new Date());

function isToday(dateStr: string) { return dateStr === TODAY; }
function isFuture(dateStr: string) { return dateStr > TODAY; }
function isPast(dateStr: string) { return dateStr < TODAY; }

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Reservas() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showNueva, setShowNueva] = useState(false);
  const [showBuscar, setShowBuscar] = useState(false);
  const [reservaSeleccionada, setReservaSeleccionada] = useState<ReservationResponse | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<ReservationStatus | 'ALL'>('ALL');
  const [busquedaTexto, setBusquedaTexto] = useState('');

  // Todas las reservas activas
  const { data: todas = [], isLoading } = useQuery({
    queryKey: ['reservations', 'all'],
    queryFn: reservationsApi.getAll,
    refetchInterval: 60_000,
  });

  const cancelMutation = useMutation({
    mutationFn: reservationsApi.cancel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      setReservaSeleccionada(null);
    },
  });

  const handleCancelar = (id: string) => {
    if (confirm('¿Cancelar esta reserva?')) cancelMutation.mutate(id);
  };

  // Filtrado
  const filtradas = todas.filter(r => {
    const matchEstado = filtroEstado === 'ALL' || r.status === filtroEstado;
    const q = busquedaTexto.toLowerCase().trim();
    const matchTexto = !q
      || r.guestName.toLowerCase().includes(q)
      || r.guestPhone.includes(q)
      || r.reservationNumber.toLowerCase().includes(q)
      || r.roomTypeName.toLowerCase().includes(q);
    return matchEstado && matchTexto;
  });

  // Separar en grupos
  const hoy = filtradas.filter(r => isToday(r.checkInDate) && (r.status === 'CONFIRMED' || r.status === 'PENDING'));
  const enHotel = filtradas.filter(r => r.status === 'CHECKED_IN');
  const futuras = filtradas.filter(r => isFuture(r.checkInDate) && (r.status === 'CONFIRMED' || r.status === 'PENDING'));
  const resto = filtradas.filter(r =>
    !hoy.find(x => x.id === r.id) &&
    !enHotel.find(x => x.id === r.id) &&
    !futuras.find(x => x.id === r.id)
  );

  // Contadores para los filtros
  const counts = todas.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-5">

      {/* ── Encabezado ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Reservas</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {todas.length} reserva{todas.length !== 1 ? 's' : ''} activa{todas.length !== 1 ? 's' : ''}
            {hoy.length > 0 && (
              <span className="ml-2 text-blue-600 font-medium">· {hoy.length} llegan hoy</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBuscar(true)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Buscar
          </button>
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
      </div>

      {/* ── Filtros ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Filtro por estado */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFiltroEstado(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${filtroEstado === opt.value
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
                }`}
            >
              {opt.label}
              {opt.value !== 'ALL' && counts[opt.value] ? (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${filtroEstado === opt.value ? 'bg-white/20' : 'bg-slate-100'
                  }`}>
                  {counts[opt.value]}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Búsqueda por texto */}
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Nombre, teléfono, número..."
            value={busquedaTexto}
            onChange={e => setBusquedaTexto(e.target.value)}
          />
          {busquedaTexto && (
            <button
              onClick={() => setBusquedaTexto('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >×</button>
          )}
        </div>
      </div>

      {/* ── Contenido ── */}
      {isLoading ? (
        <div className="p-16 text-center text-gray-400">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          Cargando reservas...
        </div>
      ) : filtradas.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-500 font-medium">No hay reservas que mostrar</p>
          <p className="text-gray-400 text-sm mt-1">
            {busquedaTexto ? 'Intenta con otro término de búsqueda' : 'Crea una nueva reserva con el botón de arriba'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">

          {/* Check-ins de hoy */}
          {hoy.length > 0 && (filtroEstado === 'ALL' || filtroEstado === 'CONFIRMED' || filtroEstado === 'PENDING') && (
            <Grupo
              titulo="🏨 Llegan hoy"
              color="blue"
              reservas={hoy}
              onVer={setReservaSeleccionada}
              onCheckin={id => navigate(`/checkin?reservaId=${id}`)}
              onCancelar={handleCancelar}
            />
          )}

          {/* En el hotel ahora */}
          {enHotel.length > 0 && (filtroEstado === 'ALL' || filtroEstado === 'CHECKED_IN') && (
            <Grupo
              titulo="✅ En el hotel ahora"
              color="green"
              reservas={enHotel}
              onVer={setReservaSeleccionada}
              onCheckin={id => navigate(`/checkin?reservaId=${id}`)}
              onCancelar={handleCancelar}
            />
          )}

          {/* Próximas */}
          {futuras.length > 0 && (filtroEstado === 'ALL' || filtroEstado === 'CONFIRMED' || filtroEstado === 'PENDING') && (
            <Grupo
              titulo="📅 Próximas llegadas"
              color="gray"
              reservas={futuras}
              onVer={setReservaSeleccionada}
              onCheckin={id => navigate(`/checkin?reservaId=${id}`)}
              onCancelar={handleCancelar}
            />
          )}

          {/* Resto (otros estados visibles según filtro) */}
          {resto.length > 0 && filtroEstado !== 'ALL' && (
            <Grupo
              titulo="Otros"
              color="gray"
              reservas={resto}
              onVer={setReservaSeleccionada}
              onCheckin={id => navigate(`/checkin?reservaId=${id}`)}
              onCancelar={handleCancelar}
            />
          )}
        </div>
      )}

      {/* ── Detalle ── */}
      {reservaSeleccionada && (
        <DetalleReservaModal
          reserva={reservaSeleccionada}
          onClose={() => setReservaSeleccionada(null)}
          onCheckin={() => navigate(`/checkin?reservaId=${reservaSeleccionada.id}`)}
          onCancelar={() => handleCancelar(reservaSeleccionada.id)}
        />
      )}

      {/* ── Modales ── */}
      {showNueva && (
        <NuevaReservaModal
          onClose={() => setShowNueva(false)}
          onCreada={() => {
            setShowNueva(false);
            queryClient.invalidateQueries({ queryKey: ['reservations'] });
          }}
        />
      )}
      {showBuscar && (
        <BuscarReservaModal
          onClose={() => setShowBuscar(false)}
          onSeleccionada={r => { setShowBuscar(false); setReservaSeleccionada(r); }}
        />
      )}
    </div>
  );
}

// ─── Grupo de reservas ────────────────────────────────────────────────────────

function Grupo({
  titulo, color, reservas, onVer, onCheckin, onCancelar,
}: {
  titulo: string;
  color: 'blue' | 'green' | 'gray';
  reservas: ReservationResponse[];
  onVer: (r: ReservationResponse) => void;
  onCheckin: (id: string) => void;
  onCancelar: (id: string) => void;
}) {
  const headerColor = {
    blue: 'bg-blue-50 border-blue-100 text-blue-800',
    green: 'bg-green-50 border-green-100 text-green-800',
    gray: 'bg-slate-50 border-slate-100 text-slate-700',
  }[color];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className={`px-5 py-3 border-b ${headerColor} flex items-center justify-between`}>
        <span className="font-semibold text-sm">{titulo}</span>
        <span className="text-xs opacity-70">{reservas.length} reserva{reservas.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="divide-y divide-gray-50">
        {reservas.map(r => (
          <ReservaRow
            key={r.id}
            reserva={r}
            onVer={() => onVer(r)}
            onCheckin={() => onCheckin(r.id)}
            onCancelar={() => onCancelar(r.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Fila individual ──────────────────────────────────────────────────────────

function ReservaRow({
  reserva, onVer, onCheckin, onCancelar,
}: {
  reserva: ReservationResponse;
  onVer: () => void;
  onCheckin: () => void;
  onCancelar: () => void;
}) {
  const canCheckin = reserva.status === 'CONFIRMED' || reserva.status === 'PENDING';

  return (
    <div className="px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50 transition-colors">
      {/* Punto alerta */}
      <div className="w-1.5 flex-shrink-0">
        {reserva.guestHasObservations && (
          <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-gray-900 text-sm">{reserva.guestName}</span>
          {reserva.guestHasObservations && (
            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">⚠️</span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[reserva.status]}`}>
            {STATUS_LABELS[reserva.status] ?? reserva.statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 flex-wrap">
          <span>{reserva.guestPhone}</span>
          <span>·</span>
          <span>{reserva.roomTypeName}</span>
          {reserva.roomNumber
            ? <span className="bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded">🛏 Hab. {reserva.roomNumber}</span>
            : <span className="text-gray-400 italic">Sin hab. asignada</span>
          }
          <span>·</span>
          <span>{formatDate(reserva.checkInDate)} → {formatDate(reserva.checkOutDate)}</span>
          <span>·</span>
          <span>{reserva.numberOfNights}n · {reserva.numberOfGuests}p</span>
          {reserva.approximateArrivalTime && (
            <><span>·</span><span>🕐 {reserva.approximateArrivalTime}</span></>
          )}
        </div>
      </div>

      {/* Total */}
      <div className="text-right flex-shrink-0">
        <div className="font-semibold text-gray-900 text-sm">{formatCurrency(reserva.estimatedTotal)}</div>
        <div className="text-xs text-gray-400">{reserva.reservationNumber}</div>
        {reserva.depositAmount && (
          <div className="text-xs text-green-600">Dep: {formatCurrency(reserva.depositAmount)}</div>
        )}
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={onVer}
          className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100"
        >
          Ver
        </button>
        {canCheckin && (
          <>
            <button
              onClick={onCheckin}
              className="px-2.5 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Check-in
            </button>
            <button
              onClick={onCancelar}
              className="px-2.5 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
            >
              ✕
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Modal detalle ────────────────────────────────────────────────────────────

function DetalleReservaModal({
  reserva, onClose, onCheckin, onCancelar,
}: {
  reserva: ReservationResponse;
  onClose: () => void;
  onCheckin: () => void;
  onCancelar: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">Detalle de reserva</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="p-6 space-y-4">
          {reserva.guestHasObservations && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2">
              <span className="text-red-500 text-xl">⚠️</span>
              <span className="text-red-700 font-medium text-sm">Este huésped tiene observaciones. Revise antes de proceder.</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Número" value={reserva.reservationNumber} />
            <Field label="Estado" value={STATUS_LABELS[reserva.status] ?? reserva.statusLabel} />
            <Field label="Huésped" value={reserva.guestName} />
            <Field label="Teléfono" value={reserva.guestPhone} />
            <Field label="Tipo hab." value={reserva.roomTypeName} />
            {reserva.roomNumber && <Field label="Habitación" value={`Hab. ${reserva.roomNumber}`} />}
            <Field label="Ocupantes" value={`${reserva.numberOfGuests}`} />
            <Field label="Check-in" value={formatDate(reserva.checkInDate)} />
            <Field label="Check-out" value={formatDate(reserva.checkOutDate)} />
            <Field label="Noches" value={String(reserva.numberOfNights)} />
            <Field label="Total estimado" value={formatCurrency(reserva.estimatedTotal)} />
            {reserva.depositAmount && <Field label="Depósito" value={formatCurrency(reserva.depositAmount)} />}
            {reserva.approximateArrivalTime && <Field label="Llegada aprox." value={reserva.approximateArrivalTime} />}
          </div>

          {reserva.specialRequests && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Solicitudes especiales</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{reserva.specialRequests}</p>
            </div>
          )}

          {reserva.companions.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Acompañantes</p>
              <div className="space-y-1">
                {reserva.companions.map((c, i) => (
                  <div key={i} className="text-sm bg-gray-50 rounded px-3 py-2 text-gray-700">
                    {c.name}{c.documentNumber ? ` · ${c.documentNumber}` : ''}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Cerrar
          </button>
          {(reserva.status === 'CONFIRMED' || reserva.status === 'PENDING') && (
            <>
              <button onClick={onCancelar} className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50">
                Cancelar reserva
              </button>
              <button onClick={onCheckin} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
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
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-medium text-gray-900">{value}</p>
    </div>
  );
}