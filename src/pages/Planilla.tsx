import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { updateRoomStatus } from '../api/dashboard';
import apiClient from '../api/client';
import { reservationsApi } from '../api/reservations';
import type { ReservationResponse } from '../api/reservations';
import type { RoomStatus } from '../types';
import { formatDate } from '../utils/format';
import NuevaReservaModal from '../components/reservas/NuevaReservaModal';
import RoomDetailPanel from '../components/planilla/RoomDetailPanel';
import { usePageTitle } from '../hooks/usePageTitle';


// ─── Tipos ────────────────────────────────────────────────────────────────────

interface TowelTx {
  type: string;
  reservationNumber: string | null;
  notes: string | null;

}

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
  numberOfGuests?: number;
  reservationNumber?: string;
  reservationId?: string;
  guestHasObservations?: boolean;
  preAssignedReservationId?: string;
  preAssignedReservationNumber?: string;
  preAssignedGuestName?: string;
  preAssignedCheckIn?: string;
  preAssignedCheckOut?: string;
  rato?: boolean;
  checkedOut?: boolean;
  overdue?: boolean;
}

interface DailyObservation {
  id: string;
  date: string;
  observationFor: string;
  content: string;
  createdBy: string | null;
  type: 'GENERAL' | 'MAINTENANCE' | 'WARNING' | 'CLEANING' | string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | string;
  resolved: boolean;
  createdAt: string;
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

const OBS_TYPE_LABEL: Record<string, string> = {
  GENERAL: 'General',
  MAINTENANCE: 'Mantenimiento',
  WARNING: 'Advertencia',
  CLEANING: 'Aseo',
};

const OBS_TYPE_COLOR: Record<string, string> = {
  GENERAL: 'bg-slate-100 text-slate-600',
  MAINTENANCE: 'bg-blue-100 text-blue-600',
  WARNING: 'bg-orange-100 text-orange-600',
  CLEANING: 'bg-teal-100 text-teal-600',
};

const OBS_PRIORITY_LABEL: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
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

function formatDayLabel(d: Date, _isToday: boolean, isPast: boolean): string {
  const ds = toDateStr(d);
  const todayStr = toDateStr(new Date());
  if (ds === todayStr) return 'Hoy — ' + d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  if (ds === toDateStr(addDays(new Date(), 1))) return 'Mañana — ' + d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
  if (isPast) return 'Historial — ' + d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Planilla() {
  usePageTitle('Planilla');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const todayDate = new Date();

  const [currentDate, setCurrentDate] = useState<Date>(todayDate);
  const [selectedRoom, setSelectedRoom] = useState<RoomByDate | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<RoomStatus | 'ALL'>('ALL');
  const [reservaCambio, setReservaCambio] = useState<ReservationResponse | null>(null);
  const [showMaintenanceAlert, setShowMaintenanceAlert] = useState(false);
  const [detailRoom, setDetailRoom] = useState<RoomByDate | null>(null);

  const dateStr = toDateStr(currentDate);
  const todayStr = toDateStr(todayDate);
  const isToday = dateStr === todayStr;
  const isPast = dateStr < todayStr;

  const { data: rooms = [], isLoading, isError } = useQuery<RoomByDate[]>({
    queryKey: ['rooms-by-date', dateStr],
    queryFn: () => apiClient.get(`/rooms/by-date?date=${dateStr}`).then(r => r.data),
    refetchInterval: isToday ? 30000 : false,
  });



  const { data: towelTxsHoy = [] } = useQuery<TowelTx[]>({
    queryKey: ['towel-transactions-today', todayStr],
    queryFn: () => apiClient.get(`/towels/transactions/${todayStr}`).then(r => r.data),
    enabled: isToday,
    staleTime: 30_000,
    refetchInterval: isToday ? 60_000 : false,
  });

  // ── Query observaciones (solo hoy) ───────────────────────────────────────

  const { data: pendingObs = [] } = useQuery<DailyObservation[]>({
    queryKey: ['observations-today-planilla'],
    queryFn: () => apiClient.get('/observations/today').then(r => r.data),
    refetchInterval: 60_000,
    staleTime: 0,
  });

  const allPendingObs = pendingObs.filter(o => !o.resolved);
  const highObs = allPendingObs.filter(o => o.priority === 'HIGH');

  const priorityOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const sortedObs = [...allPendingObs].sort(
    (a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
  );

  // ── Notificación horaria de mantenimiento ────────────────────────────────

  const notifShownAt = useRef<number | null>(null);

  useEffect(() => {
    const checkAndNotify = () => {
      const now = new Date();
      const maintenanceObs = pendingObs.filter(o => !o.resolved && o.type === 'MAINTENANCE');
      if (maintenanceObs.length === 0) return;
      const lastShown = notifShownAt.current;
      const oneHour = 60 * 60 * 1000;
      if (lastShown && now.getTime() - lastShown < oneHour) return;
      notifShownAt.current = now.getTime();
      setShowMaintenanceAlert(true);
    };
    checkAndNotify();
    const interval = setInterval(checkAndNotify, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [pendingObs]);

  // ─────────────────────────────────────────────────────────────────────────

  const statusMutation = useMutation({
    mutationFn: async ({ roomId, status }: { roomId: string; status: string }) => {
      await updateRoomStatus(roomId, status);
      if (status === 'AVAILABLE') {
        await apiClient.post(`/towels/room-clean/${roomId}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms-by-date'] });
      queryClient.invalidateQueries({ queryKey: ['towels-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowStatusModal(false);
      setSelectedRoom(null);
    },
    gcTime: 0, // ← agrega esto
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

  const handleCheckin = async (room: RoomByDate, reservaId: string) => {
    try {
      const reserva = await reservationsApi.getById(reservaId);
      navigate('/checkin', {
        state: {
          reservationId: reserva.id,
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
          <p className="text-sm text-slate-500 mt-0.5 capitalize">
            {formatDayLabel(currentDate, isToday, isPast)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(d => addDays(d, -1))}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-lg font-bold"
          >
            ‹
          </button>
          <input
            type="date"
            value={dateStr}
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

      {/* Banner modo historial */}
      {isPast && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
          <p className="text-sm text-slate-600">
            Modo historial — vista de solo lectura. Las habitaciones con varias entradas ese día aparecen como filas separadas.
          </p>
        </div>
      )}

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

      {/* Observaciones pendientes — solo se muestran cuando es hoy */}
      {isToday && sortedObs.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-700">Observaciones pendientes</h3>
            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 rounded-md">
              {sortedObs.length}
            </span>
            {highObs.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                {highObs.length} urgente{highObs.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="divide-y divide-slate-50">
            {sortedObs.map(o => (
              <div
                key={o.id}
                className={`flex items-start gap-3 px-5 py-3.5 ${o.priority === 'HIGH' ? 'bg-red-50/50' : ''}`}
              >
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${o.priority === 'HIGH' ? 'bg-red-500 animate-pulse'
                  : o.priority === 'MEDIUM' ? 'bg-amber-400'
                    : 'bg-slate-300'
                  }`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${o.priority === 'HIGH' ? 'text-red-800 font-medium' : 'text-slate-700'
                    }`}>
                    {o.content}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${OBS_TYPE_COLOR[o.type] ?? 'bg-slate-100 text-slate-500'
                      }`}>
                      {OBS_TYPE_LABEL[o.type] ?? o.type}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded border ${o.priority === 'HIGH'
                      ? 'bg-red-100 text-red-600 border-red-200'
                      : o.priority === 'MEDIUM'
                        ? 'bg-amber-100 text-amber-600 border-amber-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                      {OBS_PRIORITY_LABEL[o.priority] ?? o.priority}
                    </span>
                    {o.createdBy && (
                      <span className="text-xs text-slate-400">por {o.createdBy}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabla de habitaciones */}
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
              {/* La columna de acciones solo existe si no es historial */}
              {!isPast && (
                <th className="text-left px-4 py-3 font-semibold text-slate-600 w-52">Acciones</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((room, index) => (
              <RoomRow
                key={`${room.id}-${room.reservationId ?? 'none'}-${index}`}
                room={room}
                isToday={isToday}
                isPast={isPast}
                towelTxsHoy={towelTxsHoy}           // <-- prop nueva
                onChangeStatus={() => { setSelectedRoom(room); setShowStatusModal(true); }}
                onCheckin={(reservaId) => handleCheckin(room, reservaId)}
                onDirectCheckin={() => navigate('/checkin')}
                onMover={handleMover}
                onEntregar={handleEntregar}
                onVerRato={() => navigate('/rato')}
                onVerDetalle={() => setDetailRoom(room)}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={isPast ? 8 : 9} className="px-4 py-10 text-center text-slate-400 text-sm">
                  {isPast
                    ? 'No hubo actividad en esa fecha.'
                    : 'No hay habitaciones con ese estado para esta fecha.'}
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
                onClick={() => {
                  if (statusMutation.isPending) return;
                  statusMutation.mutate({
                    roomId: selectedRoom.id,
                    status: selectedRoom.status === 'OCCUPIED' ? 'DIRTY' : 'AVAILABLE',
                  });
                }}
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
            // Forzar refetch inmediato
            queryClient.resetQueries({ queryKey: ['rooms-by-date'] });
          }}
          reservaExistente={reservaCambio}
        />
      )}

      {/* Notificación horaria de mantenimiento */}
      {showMaintenanceAlert && pendingObs.filter(o => !o.resolved && o.type === 'MAINTENANCE').length > 0 && (
        <div className="fixed top-4 right-4 z-50 bg-white border border-blue-200 rounded-xl shadow-lg p-4 max-w-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-blue-800">Recordatorio de mantenimiento</p>
              <ul className="mt-1 space-y-0.5">
                {pendingObs.filter(o => !o.resolved && o.type === 'MAINTENANCE').map(o => (
                  <li key={o.id} className="text-xs text-blue-600">· {o.content}</li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => setShowMaintenanceAlert(false)}
              className="text-slate-400 hover:text-slate-600 text-lg leading-none flex-shrink-0"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Panel de detalle */}
      {detailRoom && (
        <RoomDetailPanel
          room={detailRoom}
          onClose={() => setDetailRoom(null)}
          onEntregar={(reservaId) => {
            setDetailRoom(null);
            handleEntregar(reservaId);
          }}
        />
      )}
    </div>
  );
}

// ─── Fila ─────────────────────────────────────────────────────────────────────

// ─── Fila ─────────────────────────────────────────────────────────────────────

function RoomRow({
  room, isToday, isPast, towelTxsHoy, onChangeStatus, onCheckin, onDirectCheckin, onMover, onEntregar, onVerRato, onVerDetalle,
}: {
  room: RoomByDate;
  isToday: boolean;
  isPast: boolean;
  towelTxsHoy: TowelTx[];
  onChangeStatus: () => void;
  onCheckin: (reservaId: string) => void;
  onDirectCheckin: () => void;
  onMover: (reservaId: string) => void;
  onEntregar: (reservaId: string) => void;
  onVerRato: () => void;
  onVerDetalle: () => void;
}) {
  const queryClient = useQueryClient();

  const isOccupied = room.status === 'OCCUPIED';
  const isReserved = room.status === 'RESERVED';
  const isDirty = room.status === 'DIRTY';
  const isAvailable = room.status === 'AVAILABLE';
  const isEntregada = !!room.checkedOut;
  const isOverdue = !!room.overdue;

  const guestName = isOccupied ? room.guestName : (isReserved ? room.preAssignedGuestName : '');
  const checkIn = isOccupied ? room.checkInDate : (isReserved ? room.preAssignedCheckIn : '');
  const checkOut = isOccupied ? room.checkOutDate : (isReserved ? room.preAssignedCheckOut : '');
  const nights = isOccupied ? room.numberOfNights : undefined;
  const resNum = isOccupied ? room.reservationNumber : (isReserved ? room.preAssignedReservationNumber : '');
  const reservaId = isOccupied ? room.reservationId : (isReserved ? room.preAssignedReservationId : undefined);

  // ── Lógica aseo ──────────────────────────────────────────────────────────
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  // Día intermedio: hoy está entre checkIn y checkOut
  const esIntermedio = isToday && isOccupied && !room.rato && !isEntregada
    && !!room.checkInDate && !!room.checkOutDate
    && todayStr > room.checkInDate
    && todayStr < room.checkOutDate;

  const { data: roomTowels } = useQuery<{ currentInRoom: number }>({
    queryKey: ['room-towels', room.reservationId],
    queryFn: () => apiClient.get(`/towels/room-towels/${room.reservationId}`).then(r => r.data),
    enabled: esIntermedio && !!room.reservationId,
  });

  // El aseo ya fue hecho hoy si hay una tx NIGHTLY_CHANGE para el número de reserva de esta habitación
  // Reemplaza esto:
  const aseoHecho = esIntermedio && towelTxsHoy.some(
    t => t.type === 'NIGHTLY_CHANGE'
      && t.reservationNumber === room.reservationNumber
      && t.notes?.startsWith('Aseo')
  );

  const [confirming, setConfirming] = useState(false);
  const [aseoLoading, setAseoLoading] = useState(false);

  const handleAseoSi = async () => {
    if (!room.reservationId || !room.id) return;
    setAseoLoading(true);
    const towelsToDeliver = room.numberOfGuests ?? 1;
    const towelsToReturn = towelsToDeliver; // en aseo siempre se recogen las mismas que se entregan
    try {
      await apiClient.post(
        `/towels/nightly-change?reservationId=${room.reservationId}&roomId=${room.id}&towelsReturned=${towelsToReturn}&towelsDelivered=${towelsToDeliver}&nightNumber=0`
      );
      queryClient.invalidateQueries({ queryKey: ['towel-transactions-today', todayStr] });
      queryClient.invalidateQueries({ queryKey: ['towels-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['room-towels', room.reservationId] });
      setConfirming(false);
    } catch {
      setConfirming(false);
    } finally {
      setAseoLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  const colCount = isPast ? 8 : 9;

  return (
    <>
      <tr className={`transition-colors ${isEntregada
        ? 'bg-slate-50/60 opacity-75'
        : isOverdue
          ? 'bg-orange-50/40 hover:bg-orange-50'
          : `hover:bg-slate-50 ${STATUS_ROW[room.status]}`
        }`}>
        <td className="px-4 py-3 font-semibold text-slate-800">{room.roomNumber}</td>
        <td className="px-4 py-3 text-slate-600 text-xs">{room.roomTypeName}</td>
        <td className="px-4 py-3 text-slate-600">{room.floor}</td>
        <td className="px-4 py-3">
          <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium border ${isEntregada
            ? 'bg-slate-100 text-slate-400 border-slate-200'
            : isOverdue
              ? 'bg-orange-100 text-orange-700 border-orange-200'
              : room.rato
                ? 'bg-violet-100 text-violet-700 border-violet-200'
                : STATUS_STYLES[room.status]
            }`}>
            {isEntregada ? 'Entregada' : isOverdue ? 'Vencida' : room.rato ? 'Rato' : room.statusLabel}
          </span>
        </td>
        <td className="px-4 py-3">
          {guestName && (
            <span className={`font-medium block ${isEntregada ? 'text-slate-400' : 'text-slate-700'}`}>
              {guestName}
            </span>
          )}
          {resNum && (
            <span className={`text-xs ${isEntregada ? 'text-slate-400' : 'text-purple-600'}`}>
              {resNum}
            </span>
          )}
          {room.guestHasObservations && (
            <span className="ml-1 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">obs.</span>
          )}
        </td>
        <td className={`px-4 py-3 text-xs ${isEntregada ? 'text-slate-400' : 'text-slate-600'}`}>
          {checkIn ? formatDate(checkIn) : ''}
        </td>
        <td className={`px-4 py-3 text-xs ${isEntregada ? 'text-slate-400' : 'text-slate-600'}`}>
          {checkOut ? formatDate(checkOut) : ''}
        </td>
        <td className={`px-4 py-3 text-xs ${isEntregada ? 'text-slate-400' : 'text-slate-500'}`}>
          {nights ?? ''}
        </td>

        {!isPast && (
          <td className="px-4 py-3">
            {!isEntregada && (
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
                    onClick={() => room.rato ? onVerRato() : onEntregar(reservaId)}
                    className={`text-xs text-white rounded-lg px-3 py-1.5 ${isOverdue
                      ? 'bg-orange-600 hover:bg-orange-500'
                      : 'bg-amber-600 hover:bg-amber-500'
                      }`}
                  >
                    {room.rato ? 'Ver rato' : isOverdue ? 'Entregar (vencida)' : 'Entregar'}
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

                {isToday && reservaId && (isReserved || isOccupied) && room.checkOutDate !== todayStr && (
                  <button
                    onClick={() => onMover(reservaId)}
                    className="text-xs text-purple-600 border border-purple-200 rounded-lg px-3 py-1.5 hover:bg-purple-50"
                  >
                    Mover
                  </button>
                )}

                {(isOccupied || isReserved) && reservaId && (
                  <button
                    onClick={onVerDetalle}
                    className="text-xs text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50"
                  >
                    Ver
                  </button>
                )}

                {/* Botón Aseo — solo días intermedios y si no se ha hecho hoy */}
                {esIntermedio && !aseoHecho && !confirming && (
                  <button
                    onClick={() => setConfirming(true)}
                    className="text-xs text-teal-700 border border-teal-200 bg-teal-50 rounded-lg px-3 py-1.5 hover:bg-teal-100"
                  >
                    Aseo
                  </button>
                )}

                {esIntermedio && aseoHecho && (
                  <span className="text-xs text-teal-600 font-medium px-1">Aseo hecho</span>
                )}

              </div>
            )}
            {isEntregada && (
              <span className="text-xs text-slate-400 italic">—</span>
            )}
          </td>
        )}
      </tr>

      {/* Confirmación de aseo — fila inline */}
      {esIntermedio && confirming && (
        <tr className="bg-teal-50/60 border-t border-teal-100">
          <td colSpan={colCount} className="px-4 py-3">
            <div className="flex items-center gap-4">
              <p className="text-sm text-slate-700">
                <span className="font-medium">Hab. {room.roomNumber}</span> —
                ¿El huésped aceptó el aseo?
                {room.numberOfGuests && (
                  <span className="text-slate-500 ml-1">
                    (se repondrán {room.numberOfGuests} toalla{room.numberOfGuests !== 1 ? 's' : ''})
                  </span>
                )}
              </p>
              <button
                onClick={handleAseoSi}
                disabled={aseoLoading}
                className="text-xs text-white bg-teal-600 hover:bg-teal-500 disabled:bg-teal-300 rounded-lg px-4 py-1.5 font-medium"
              >
                {aseoLoading ? 'Registrando...' : 'Sí, hacer aseo'}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="text-xs text-slate-600 border border-slate-300 rounded-lg px-4 py-1.5 hover:bg-slate-100"
              >
                No, omitir
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}