import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { updateRoomStatus } from '../api/dashboard';
import apiClient from '../api/client';
import { reservationsApi } from '../api/reservations';
import type { ReservationResponse } from '../api/reservations';
import type { RoomStatus } from '../types';
import { formatDate } from '../utils/format';
import NuevaReservaModal from '../components/reservas/NuevaReservaModal';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface RoomByDate {
  id: string;
  roomNumber: string;
  floor: number;
  roomTypeName: string;
  roomTypeId?: string;
  status: RoomStatus;
  statusLabel: string;
  guestName?: string;
  guestPhone?: string;
  checkInDate?: string;
  checkOutDate?: string;
  numberOfNights?: number;
  reservationNumber?: string;
  reservationId?: string;
  guestHasObservations?: boolean;
  preAssignedReservationId?: string;
  preAssignedReservationNumber?: string;
  preAssignedGuestName?: string;
  preAssignedCheckIn?: string;
  preAssignedCheckOut?: string;
}

const STATUS_STYLES: Record<RoomStatus, string> = {
  AVAILABLE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  OCCUPIED: 'bg-blue-100 text-blue-700 border-blue-200',
  DIRTY: 'bg-amber-100 text-amber-700 border-amber-200',
  MAINTENANCE: 'bg-red-100 text-red-700 border-red-200',
  RESERVED: 'bg-purple-100 text-purple-700 border-purple-200',
};

const STATUS_ROW: Record<RoomStatus, string> = {
  AVAILABLE: '',
  OCCUPIED: 'bg-blue-50',
  DIRTY: 'bg-amber-50',
  MAINTENANCE: 'bg-red-50',
  RESERVED: 'bg-purple-50',
};

const STATUS_LABELS: Record<RoomStatus, string> = {
  AVAILABLE: 'Disponible',
  OCCUPIED: 'Ocupada',
  DIRTY: 'Sucia',
  MAINTENANCE: 'Mantenimiento',
  RESERVED: 'Reservada',
};

// ─── Helpers fecha ────────────────────────────────────────────────────────────

function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatDayLabel(d: Date): string {
  const todayStr = toDateStr(new Date());
  const ds = toDateStr(d);
  if (ds === todayStr) return 'Hoy — ' + d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  if (ds === toDateStr(addDays(new Date(), 1))) return 'Mañana — ' + d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Planilla() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const todayDate = new Date();

  const [currentDate, setCurrentDate] = useState<Date>(todayDate);
  const [selectedRoom, setSelectedRoom] = useState<RoomByDate | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<RoomStatus | 'ALL'>('ALL');
  const [reservaCambio, setReservaCambio] = useState<ReservationResponse | null>(null);

  const dateStr = toDateStr(currentDate);
  const isToday = dateStr === toDateStr(todayDate);

  const { data: rooms = [], isLoading, isError } = useQuery<RoomByDate[]>({
    queryKey: ['rooms-by-date', dateStr],
    queryFn: () => apiClient.get(`/rooms/by-date?date=${dateStr}`).then(r => r.data),
    refetchInterval: 30000,
  });

  const statusMutation = useMutation({
    mutationFn: ({ roomId, status }: { roomId: string; status: string }) =>
      updateRoomStatus(roomId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms-by-date'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowStatusModal(false);
      setSelectedRoom(null);
    },
  });

  const counts = rooms.reduce<Partial<Record<RoomStatus, number>>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  const filtered = filterStatus === 'ALL' ? rooms : rooms.filter(r => r.status === filterStatus);

  const handleMover = async (reservaId: string) => {
    try {
      const r = await reservationsApi.getById(reservaId);
      setReservaCambio(r);
    } catch { /* silencioso */ }
  };

  /**
   * Navega a /checkin pasando los datos de la reserva como state.
   * CheckIn los usa para pre-rellenar el formulario.
   */
  const handleCheckin = async (room: RoomByDate, reservaId: string) => {
    try {
      const reserva = await reservationsApi.getById(reservaId);
      navigate('/checkin', {
        state: {
          reservationId: reserva.id,  // ✅ agrega esto
          prefill: {
            roomTypeId: reserva.roomTypeId,
            roomId: room.id,
            checkInDate: reserva.checkInDate,
            checkOutDate: reserva.checkOutDate,
            numberOfGuests: reserva.numberOfGuests,
            occupantType: reserva.occupantType,
          },
        },
      });
    } catch {
      navigate('/checkin');
    }
  };
  const handleEntregar = (reservaId: string) => {
    navigate('/checkout', { state: { reservationId: reservaId } });
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-slate-500 text-sm">Cargando habitaciones...</p>
    </div>
  );

  if (isError) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-red-500 text-sm">Error al cargar los datos.</p>
    </div>
  );

  return (
    <div className="p-6 space-y-5">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Planilla de habitaciones</h2>
          <p className="text-sm text-slate-500 mt-0.5 capitalize">{formatDayLabel(currentDate)}</p>
        </div>

        {/* Navegador de fecha */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(d => addDays(d, -1))}
            disabled={isToday}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 text-lg font-bold"
          >
            ‹
          </button>

          <input
            type="date"
            value={dateStr}
            min={toDateStr(todayDate)}
            onChange={e => {
              if (e.target.value) setCurrentDate(new Date(e.target.value + 'T12:00:00'));
            }}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            onClick={() => setCurrentDate(d => addDays(d, 1))}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-lg font-bold"
          >
            ›
          </button>

          {!isToday && (
            <button
              onClick={() => { setCurrentDate(todayDate); setFilterStatus('ALL'); }}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
            >
              Hoy
            </button>
          )}
        </div>
      </div>

      {/* Tarjetas de estado */}
      <div className="grid grid-cols-5 gap-3">
        {(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'DIRTY', 'MAINTENANCE'] as RoomStatus[]).map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(filterStatus === status ? 'ALL' : status)}
            className={`rounded-lg border p-3 text-left transition-all ${filterStatus === status
              ? STATUS_STYLES[status] + ' ring-2 ring-offset-1 ring-slate-400'
              : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
          >
            <p className="text-2xl font-bold text-slate-800">{counts[status] ?? 0}</p>
            <p className="text-xs text-slate-500 mt-0.5">{STATUS_LABELS[status]}</p>
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-semibold text-slate-600 w-20">Hab.</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Tipo</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 w-14">Piso</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 w-32">Estado</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Huésped / Reserva</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 w-24">Entrada</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 w-24">Salida</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 w-14">N.</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 w-44">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(room => (
              <RoomRow
                key={room.id}
                room={room}
                isToday={isToday}
                onChangeStatus={() => { setSelectedRoom(room); setShowStatusModal(true); }}
                onCheckin={(reservaId) => handleCheckin(room, reservaId)}
                onDirectCheckin={() => navigate('/checkin')}
                onMover={handleMover}
                onEntregar={handleEntregar}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-slate-400 text-sm">
                  No hay habitaciones con ese estado para esta fecha.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal cambio de estado */}
      {showStatusModal && selectedRoom && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80">
            <h3 className="font-semibold text-slate-800 mb-1">
              Hab. {selectedRoom.roomNumber} — {selectedRoom.status === 'OCCUPIED' ? 'Registrar entrega' : 'Marcar como limpia'}
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              {selectedRoom.status === 'OCCUPIED'
                ? 'La habitación pasará a estado Sucia.'
                : 'La habitación pasará a estado Disponible.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => statusMutation.mutate({
                  roomId: selectedRoom.id,
                  status: selectedRoom.status === 'OCCUPIED' ? 'DIRTY' : 'AVAILABLE',
                })}
                disabled={statusMutation.isPending}
                className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-400 text-white text-sm font-medium py-2.5 rounded-lg"
              >
                {statusMutation.isPending ? 'Guardando...' : 'Confirmar'}
              </button>
              <button
                onClick={() => { setShowStatusModal(false); setSelectedRoom(null); }}
                className="flex-1 border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-medium py-2.5 rounded-lg"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal cambiar habitación */}
      {reservaCambio && (
        <NuevaReservaModal
          onClose={() => setReservaCambio(null)}
          onCreada={() => {
            setReservaCambio(null);
            queryClient.invalidateQueries({ queryKey: ['rooms-by-date'] });
            queryClient.invalidateQueries({ queryKey: ['reservations'] });
          }}
          reservaExistente={reservaCambio}
        />
      )}
    </div>
  );
}

// ─── Fila ─────────────────────────────────────────────────────────────────────

function RoomRow({
  room, isToday, onChangeStatus, onCheckin, onDirectCheckin, onMover, onEntregar,
}: {
  room: RoomByDate;
  isToday: boolean;
  onChangeStatus: () => void;
  onCheckin: (reservaId: string) => void;
  onDirectCheckin: () => void;
  onMover: (reservaId: string) => void;
  onEntregar: (reservaId: string) => void;
}) {
  const isOccupied = room.status === 'OCCUPIED';
  const isReserved = room.status === 'RESERVED';
  const isDirty = room.status === 'DIRTY';
  const isAvailable = room.status === 'AVAILABLE';

  const guestName = isOccupied ? room.guestName : (isReserved ? room.preAssignedGuestName : '');
  const checkIn = isOccupied ? room.checkInDate : (isReserved ? room.preAssignedCheckIn : '');
  const checkOut = isOccupied ? room.checkOutDate : (isReserved ? room.preAssignedCheckOut : '');
  const nights = isOccupied ? room.numberOfNights : undefined;
  const resNum = isOccupied ? room.reservationNumber : (isReserved ? room.preAssignedReservationNumber : '');
  const reservaId = isOccupied ? room.reservationId : (isReserved ? room.preAssignedReservationId : undefined);

  return (
    <tr className={`hover:bg-slate-50 transition-colors ${STATUS_ROW[room.status]}`}>
      <td className="px-4 py-3 font-semibold text-slate-800">{room.roomNumber}</td>
      <td className="px-4 py-3 text-slate-600 text-xs">{room.roomTypeName}</td>
      <td className="px-4 py-3 text-slate-600">{room.floor}</td>
      <td className="px-4 py-3">
        <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium border ${STATUS_STYLES[room.status]}`}>
          {room.statusLabel}
        </span>
      </td>
      <td className="px-4 py-3">
        {guestName && <span className="text-slate-700 font-medium block">{guestName}</span>}
        {resNum && <span className="text-xs text-purple-600">{resNum}</span>}
        {room.guestHasObservations && (
          <span className="ml-1 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">⚠️</span>
        )}
      </td>
      <td className="px-4 py-3 text-slate-600 text-xs">{checkIn ? formatDate(checkIn) : ''}</td>
      <td className="px-4 py-3 text-slate-600 text-xs">{checkOut ? formatDate(checkOut) : ''}</td>
      <td className="px-4 py-3 text-slate-500 text-xs">{nights ?? ''}</td>
      <td className="px-4 py-3">
        <div className="flex gap-1.5 flex-wrap">
          {isToday && (isAvailable || isReserved) && (
            <button
              onClick={() => reservaId ? onCheckin(reservaId) : onDirectCheckin()}
              className="text-xs text-white bg-slate-700 hover:bg-slate-600 rounded-lg px-3 py-1.5"
            >
              Entrada
            </button>
          )}
          {isToday && isOccupied && reservaId && (
            <button
              onClick={() => onEntregar(reservaId)}
              className="text-xs text-white bg-amber-600 hover:bg-amber-500 rounded-lg px-3 py-1.5"
            >
              Entregar
            </button>
          )}
          {isToday && isDirty && (
            <button
              onClick={onChangeStatus}
              className="text-xs text-slate-600 border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-100"
            >
              Limpia
            </button>
          )}
          {reservaId && (isReserved || isOccupied) && (
            <button
              onClick={() => onMover(reservaId)}
              className="text-xs text-purple-600 border border-purple-200 rounded-lg px-3 py-1.5 hover:bg-purple-50"
            >
              Mover
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}