import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDashboardSummary, getRooms, updateRoomStatus } from '../api/dashboard';
import type { Room, RoomStatus } from '../types';
import { formatDate } from '../utils/format';

const STATUS_LABEL: Record<RoomStatus, string> = {
  AVAILABLE: 'Disponible',
  OCCUPIED: 'Ocupada',
  DIRTY: 'Sucia',
  MAINTENANCE: 'Mantenimiento',
  RESERVED: 'Reservada',
};

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

function sortRoomNumber(a: Room, b: Room) {
  return parseInt(a.roomNumber) - parseInt(b.roomNumber);
}

export default function Planilla() {
  const queryClient = useQueryClient();
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<RoomStatus | 'ALL'>('ALL');

  const { data: summary } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboardSummary,
    refetchInterval: 30000,
  });

  const { data: roomsData, isLoading, isError } = useQuery({
    queryKey: ['rooms'],
    queryFn: getRooms,
    refetchInterval: 30000,
  });

  const mutation = useMutation({
    mutationFn: ({ roomId, status }: { roomId: string; status: string }) =>
      updateRoomStatus(roomId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowStatusModal(false);
      setSelectedRoom(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500 text-sm">Cargando habitaciones...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-red-500 text-sm">Error al cargar los datos. Verificá la conexión con el servidor.</p>
      </div>
    );
  }

  const rooms = [...(Array.isArray(roomsData) ? roomsData : [])].sort(sortRoomNumber);
  const filtered = filterStatus === 'ALL'
    ? rooms
    : rooms.filter((r) => r.status === filterStatus);

  const counts = {
    AVAILABLE: summary?.rooms.available ?? 0,
    OCCUPIED: summary?.rooms.occupied ?? 0,
    DIRTY: summary?.rooms.dirty ?? 0,
    MAINTENANCE: summary?.rooms.maintenance ?? 0,
    RESERVED: rooms.filter((r) => r.status === 'RESERVED').length,
  };

  return (
    <div className="p-6">

      {/* Encabezado */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-800">Planilla de habitaciones</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          {new Date().toLocaleDateString('es-CO', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          })}
        </p>
      </div>

      {/* Resumen de estados */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {(Object.keys(counts) as RoomStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(filterStatus === status ? 'ALL' : status)}
            className={`rounded-lg border p-3 text-left transition-all ${
              filterStatus === status
                ? STATUS_STYLES[status] + ' ring-2 ring-offset-1 ring-slate-400'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <p className="text-2xl font-bold text-slate-800">{counts[status]}</p>
            <p className="text-xs text-slate-500 mt-0.5">{STATUS_LABEL[status]}</p>
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-semibold text-slate-600 w-24">Hab.</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Tipo</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Piso</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Estado</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Huesped</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Check-in</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Check-out</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Noches</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 w-40">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((room) => (
              <RoomRow
                key={room.id}
                room={room}
                onChangeStatus={() => {
                  setSelectedRoom(room);
                  setShowStatusModal(true);
                }}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-sm">
                  No hay habitaciones con ese estado.
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
              Hab. {selectedRoom.roomNumber} —{' '}
              {selectedRoom.status === 'OCCUPIED' ? 'Registrar entrega' : 'Marcar como limpia'}
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              {selectedRoom.status === 'OCCUPIED'
                ? 'Al confirmar, la habitacion pasara a estado Sucia.'
                : 'Al confirmar, la habitacion pasara a estado Disponible.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() =>
                  mutation.mutate({
                    roomId: selectedRoom.id,
                    status: selectedRoom.status === 'OCCUPIED' ? 'DIRTY' : 'AVAILABLE',
                  })
                }
                disabled={mutation.isPending}
                className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-400 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                {mutation.isPending ? 'Guardando...' : 'Confirmar'}
              </button>
              <button
                onClick={() => { setShowStatusModal(false); setSelectedRoom(null); }}
                className="flex-1 border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function RoomRow({ room, onChangeStatus }: { room: Room; onChangeStatus: () => void }) {
  const occupancy = (room as any).currentOccupancy;
  const showStatusButton = room.status === 'OCCUPIED' || room.status === 'DIRTY';
  const showCheckinButton = room.status === 'AVAILABLE' || room.status === 'RESERVED';

  return (
    <tr className={`hover:bg-slate-50 transition-colors ${STATUS_ROW[room.status]}`}>
      <td className="px-4 py-3 font-semibold text-slate-800">{room.roomNumber}</td>
      <td className="px-4 py-3 text-slate-600">{room.roomType?.name ?? '—'}</td>
      <td className="px-4 py-3 text-slate-600">{room.floor}</td>
      <td className="px-4 py-3">
        <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium border ${STATUS_STYLES[room.status]}`}>
          {STATUS_LABEL[room.status]}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-700">
        {occupancy?.guestName ?? ''}
      </td>
      <td className="px-4 py-3 text-slate-600">
        {occupancy?.checkInDate ? formatDate(occupancy.checkInDate) : ''}
      </td>
      <td className="px-4 py-3 text-slate-600">
        {occupancy?.checkOutDate ? formatDate(occupancy.checkOutDate) : ''}
      </td>
      <td className="px-4 py-3 text-slate-600">
        {occupancy?.numberOfNights ?? ''}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          {showCheckinButton && (
            <button
              onClick={() => window.location.href = '/checkin'}
              className="text-xs text-white bg-slate-700 hover:bg-slate-600 rounded-lg px-3 py-1.5 transition-colors"
            >
              Entrada
            </button>
          )}
          {showStatusButton && (
            <button
              onClick={onChangeStatus}
              className="text-xs text-slate-600 border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-100 transition-colors"
            >
              {room.status === 'OCCUPIED' ? 'Entregar' : 'Limpia'}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}