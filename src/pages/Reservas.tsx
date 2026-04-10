import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { reservationsApi } from '../api/reservations';
import type { ReservationResponse } from '../api/reservations';
import { formatCurrency, formatDate } from '../utils/format';
import NuevaReservaModal from '../components/reservas/NuevaReservaModal';
import BuscarReservaModal from '../components/reservas/BuscarReservaModal';

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED:   'bg-blue-100 text-blue-800',
  PENDING:     'bg-yellow-100 text-yellow-800',
  CHECKED_IN:  'bg-green-100 text-green-800',
  CHECKED_OUT: 'bg-gray-100 text-gray-700',
  CANCELLED:   'bg-red-100 text-red-800',
};

export default function Reservas() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showNueva, setShowNueva] = useState(false);
  const [showBuscar, setShowBuscar] = useState(false);
  const [reservaSeleccionada, setReservaSeleccionada] = useState<ReservationResponse | null>(null);

  const { data: checkIns = [], isLoading } = useQuery({
    queryKey: ['reservations', 'today-checkins'],
    queryFn: reservationsApi.getTodayCheckIns,
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
    if (confirm('¿Cancelar esta reserva?')) {
      cancelMutation.mutate(id);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reservas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Check-ins de hoy: <span className="font-semibold text-blue-600">{checkIns.length}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowBuscar(true)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Buscar reserva
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

      {/* Lista de check-ins de hoy */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Check-ins esperados hoy</h2>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-gray-400">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
            Cargando...
          </div>
        ) : checkIns.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-500 font-medium">No hay check-ins programados para hoy</p>
            <p className="text-gray-400 text-sm mt-1">Las reservas con llegada hoy aparecerán aquí</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {checkIns.map((r) => (
              <ReservaRow
                key={r.id}
                reserva={r}
                onCheckin={() => navigate(`/checkin?reservaId=${r.id}`)}
                onCancelar={() => handleCancelar(r.id)}
                onVer={() => setReservaSeleccionada(r)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detalle reserva seleccionada */}
      {reservaSeleccionada && (
        <DetalleReservaModal
          reserva={reservaSeleccionada}
          onClose={() => setReservaSeleccionada(null)}
          onCheckin={() => navigate(`/checkin?reservaId=${reservaSeleccionada.id}`)}
          onCancelar={() => handleCancelar(reservaSeleccionada.id)}
        />
      )}

      {/* Modales */}
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
          onSeleccionada={(r) => {
            setShowBuscar(false);
            setReservaSeleccionada(r);
          }}
        />
      )}
    </div>
  );
}

// ─── Fila de reserva ────────────────────────────────────────────────────────

function ReservaRow({
  reserva,
  onCheckin,
  onCancelar,
  onVer,
}: {
  reserva: ReservationResponse;
  onCheckin: () => void;
  onCancelar: () => void;
  onVer: () => void;
}) {
  return (
    <div className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
      {/* Alerta observaciones */}
      <div className="w-2 flex-shrink-0">
        {reserva.guestHasObservations && (
          <div className="w-2 h-2 rounded-full bg-red-500" title="Cliente con observaciones" />
        )}
      </div>

      {/* Info principal */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 truncate">{reserva.guestName}</span>
          {reserva.guestHasObservations && (
            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">⚠️ Obs.</span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[reserva.status]}`}>
            {reserva.statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
          <span>📞 {reserva.guestPhone}</span>
          <span>·</span>
          <span>🛏 {reserva.roomTypeName}</span>
          <span>·</span>
          <span>{reserva.numberOfNights} noche{reserva.numberOfNights !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>{reserva.numberOfGuests} huésped{reserva.numberOfGuests !== 1 ? 'es' : ''}</span>
          {reserva.approximateArrivalTime && (
            <>
              <span>·</span>
              <span>🕐 Llegada: {reserva.approximateArrivalTime}</span>
            </>
          )}
        </div>
      </div>

      {/* Total estimado */}
      <div className="text-right flex-shrink-0">
        <div className="font-semibold text-gray-900">{formatCurrency(reserva.estimatedTotal)}</div>
        <div className="text-xs text-gray-400">{reserva.reservationNumber}</div>
        {reserva.depositAmount && (
          <div className="text-xs text-green-600">Depósito: {formatCurrency(reserva.depositAmount)}</div>
        )}
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onVer}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100"
        >
          Ver
        </button>
        {reserva.status === 'CONFIRMED' || reserva.status === 'PENDING' ? (
          <>
            <button
              onClick={onCheckin}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Check-in
            </button>
            <button
              onClick={onCancelar}
              className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
            >
              Cancelar
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ─── Modal detalle ───────────────────────────────────────────────────────────

function DetalleReservaModal({
  reserva,
  onClose,
  onCheckin,
  onCancelar,
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
              <span className="text-red-700 font-medium text-sm">Este huésped tiene observaciones registradas. Revise antes de proceder.</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Número reserva" value={reserva.reservationNumber} />
            <Field label="Estado" value={reserva.statusLabel} />
            <Field label="Huésped" value={reserva.guestName} />
            <Field label="Teléfono" value={reserva.guestPhone} />
            <Field label="Tipo habitación" value={reserva.roomTypeName} />
            <Field label="Ocupantes" value={`${reserva.numberOfGuests} (${reserva.occupantType})`} />
            <Field label="Check-in" value={formatDate(reserva.checkInDate)} />
            <Field label="Check-out" value={formatDate(reserva.checkOutDate)} />
            <Field label="Noches" value={String(reserva.numberOfNights)} />
            <Field label="Total estimado" value={formatCurrency(reserva.estimatedTotal)} />
            {reserva.approximateArrivalTime && (
              <Field label="Hora llegada aprox." value={reserva.approximateArrivalTime} />
            )}
            {reserva.depositAmount && (
              <Field label="Depósito" value={formatCurrency(reserva.depositAmount)} />
            )}
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
                    {c.name} {c.documentNumber ? `· ${c.documentNumber}` : ''}
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