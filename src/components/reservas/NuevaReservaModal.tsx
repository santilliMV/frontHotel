import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reservationsApi } from '../../api/reservations';
import type { CreateReservationDTO, OccupantType, ReservationCompanion, ReservationResponse } from '../../api/reservations';
import apiClient from '../../api/client';
import { PAYMENT_METHODS } from '../../constants';

const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const todayLocal = () => toLocalDateStr(new Date());
const fmtCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');

interface RoomType { id: string; name: string; capacity: number; description: string; }
interface RoomOption { id: string; roomNumber: string; floor: number; status: string; roomTypeId: string; roomTypeName: string; }
interface PaymentEntry { method: string; amount: string; }

interface Props {
  onClose: () => void;
  onCreada: () => void;
  reservaExistente?: ReservationResponse;
}

const OCCUPANT_LABELS: Record<OccupantType, string> = {
  INDIVIDUAL: 'Individual (1 persona)',
  PAREJA: 'Pareja (2 personas)',
  MULTIPLE_PERSON: 'Múltiple (3+ personas)',
};

const STEPS = ['Contacto', 'Fechas', 'Habitación', 'Pago', 'Confirmar'];

export default function NuevaReservaModal({ onClose, onCreada, reservaExistente }: Props) {
  const isCambioHabitacion = !!reservaExistente;
  const queryClient = useQueryClient();

  const [step, setStep] = useState(isCambioHabitacion ? 2 : 0);
  const [form, setForm] = useState<Partial<CreateReservationDTO>>({
    numberOfGuests: 1,
    occupantType: 'INDIVIDUAL',
    companions: [],
    roomTypeId: reservaExistente?.roomTypeId,
    checkInDate: reservaExistente?.checkInDate,
    checkOutDate: reservaExistente?.checkOutDate,
  });
  const [newCompanion, setNewCompanion] = useState<ReservationCompanion>({ name: '' });
  const [payments, setPayments] = useState<PaymentEntry[]>([{ method: 'CASH', amount: '' }]);
  const [error, setError] = useState('');

  const { data: roomTypes = [] } = useQuery<RoomType[]>({
    queryKey: ['room-types'],
    queryFn: () => apiClient.get('/rooms/types').then(r => r.data),
  });

  // Habitaciones disponibles para las fechas seleccionadas
  const canFetchRooms = !!(form.checkInDate && form.checkOutDate && form.checkInDate < form.checkOutDate);
  const { data: availableRooms = [], isLoading: roomsLoading } = useQuery<RoomOption[]>({
    queryKey: ['rooms-available-by-date', form.checkInDate, form.checkOutDate],
    queryFn: () => apiClient.get(`/rooms/available-by-date?checkIn=${form.checkInDate}&checkOut=${form.checkOutDate}`).then(r => r.data),
    enabled: canFetchRooms,
  });

  const roomsForType = availableRooms.filter(r =>
    form.roomTypeId ? r.roomTypeId === form.roomTypeId : true
  );

  const roomsByFloor = roomsForType.reduce((acc, room) => {
    if (!acc[room.floor]) acc[room.floor] = [];
    acc[room.floor].push(room);
    return acc;
  }, {} as Record<number, RoomOption[]>);

  const nights = form.checkInDate && form.checkOutDate
    ? Math.max(0, Math.round(
      (new Date(form.checkOutDate + 'T12:00:00').getTime() - new Date(form.checkInDate + 'T12:00:00').getTime()) / 86400000
    ))
    : 0;

  // Precio estimado
  const { data: priceData } = useQuery({
    queryKey: ['price', form.roomTypeId, form.occupantType, form.checkInDate, form.checkOutDate, form.numberOfGuests],
    queryFn: () => apiClient.get('/rooms/price', {
      params: {
        roomTypeId: form.roomTypeId,
        occupantType: form.occupantType,
        checkIn: form.checkInDate,
        checkOut: form.checkOutDate,
        numberOfGuests: form.numberOfGuests,
      }
    }).then(r => r.data),
    enabled: !!(form.roomTypeId && form.occupantType && form.checkInDate && form.checkOutDate && nights > 0),
  });

  const totalAbonado = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  // Agrega esta variable junto a totalAbonado:
  const precioBase = priceData?.totalPrice ?? 0;
  const abonoExcede = precioBase > 0 && totalAbonado > precioBase;

  const createMutation = useMutation({
    mutationFn: reservationsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      onCreada();
    },
    onError: (e: any) => {
      setError(e?.response?.data?.error || e?.response?.data?.message || 'Error al crear la reserva');
    },
  });

  const changeMutation = useMutation({
    mutationFn: ({ id, roomId }: { id: string; roomId: string }) =>
      reservationsApi.changeRoom(id, roomId),
    onSuccess: () => onCreada(),
    onError: (e: any) => setError(e?.response?.data?.error || 'Error al cambiar la habitación'),
  });

  const set = (key: keyof CreateReservationDTO, value: any) =>
    setForm(f => ({ ...f, [key]: value }));

  const addCompanion = () => {
    if (!newCompanion.name.trim()) return;
    set('companions', [...(form.companions || []), newCompanion]);
    setNewCompanion({ name: '' });
  };
  const removeCompanion = (i: number) =>
    set('companions', (form.companions || []).filter((_, idx) => idx !== i));

  const addPaymentLine = () => setPayments(p => [...p, { method: 'CASH', amount: '' }]);
  const removePaymentLine = (i: number) => setPayments(p => p.filter((_, idx) => idx !== i));
  const updatePayment = (i: number, key: 'method' | 'amount', val: string) =>
    setPayments(p => p.map((x, idx) => idx === i ? { ...x, [key]: val } : x));

  const canNext = () => {
    if (step === 0) return !!(form.firstName?.trim() && form.phone?.trim());
    if (step === 1) return !!(form.checkInDate && form.checkOutDate && nights > 0 && form.occupantType && form.roomTypeId);
    if (step === 2) return !!(form.roomId);
    if (step === 3) return true; // pago es opcional
    return true;
  };

  const handleSubmit = () => {
    setError('');
    if (isCambioHabitacion && form.roomId) {
      changeMutation.mutate({ id: reservaExistente.id, roomId: form.roomId });
      return;
    }
    const validPayments = payments
      .filter(p => parseFloat(p.amount) > 0)
      .map(p => ({ method: p.method, amount: parseFloat(p.amount) }));

    createMutation.mutate({
      ...(form as CreateReservationDTO),
      depositAmount: totalAbonado > 0 ? totalAbonado : undefined,
      depositPayments: validPayments.length > 0 ? validPayments : undefined,
    });
  };

  const selectedRoom = availableRooms.find(r => r.id === form.roomId);
  const selectedRoomType = roomTypes.find(r => r.id === form.roomTypeId);
  const isPending = createMutation.isPending || changeMutation.isPending;

  const visibleSteps = isCambioHabitacion ? ['Habitación', 'Confirmar'] : STEPS;
  const visibleStep = isCambioHabitacion ? step - 2 : step;

  const fi = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">
            {isCambioHabitacion ? `Cambiar habitación — ${reservaExistente.reservationNumber}` : 'Nueva reserva'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Steps */}
        <div className="px-6 py-3 border-b flex-shrink-0">
          <div className="flex items-center gap-0">
            {visibleSteps.map((label, i) => (
              <div key={i} className="flex items-center flex-1">
                <div className={`flex items-center gap-1.5 ${i <= visibleStep ? 'text-blue-600' : 'text-gray-400'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2
                    ${i < visibleStep ? 'bg-blue-600 border-blue-600 text-white'
                      : i === visibleStep ? 'border-blue-600 text-blue-600'
                        : 'border-gray-300 text-gray-400'}`}>
                    {i < visibleStep ? '✓' : i + 1}
                  </div>
                  <span className="text-xs font-medium hidden sm:block">{label}</span>
                </div>
                {i < visibleSteps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${i < visibleStep ? 'bg-blue-600' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Step 0: Contacto */}
          {step === 0 && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
                Solo se necesita nombre y teléfono. El registro completo del huésped se hace al check-in.
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre <span className="text-red-500">*</span></label>
                  <input className={fi} placeholder="Juan" value={form.firstName || ''} onChange={e => set('firstName', e.target.value)} autoFocus />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
                  <input className={fi} placeholder="Pérez" value={form.lastName || ''} onChange={e => set('lastName', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono <span className="text-red-500">*</span></label>
                <input className={fi} placeholder="3001234567" value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Acompañantes (opcional)</label>
                {(form.companions || []).map((c, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="flex-1 text-sm text-gray-700">{c.name} {c.documentNumber ? `· ${c.documentNumber}` : ''}</span>
                    <button onClick={() => removeCompanion(i)} className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre acompañante" value={newCompanion.name}
                    onChange={e => setNewCompanion(c => ({ ...c, name: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addCompanion()} />
                  <input className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Cédula" value={newCompanion.documentNumber || ''}
                    onChange={e => setNewCompanion(c => ({ ...c, documentNumber: e.target.value }))} />
                  <button onClick={addCompanion} className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-600 hover:bg-gray-200 font-medium">+</button>
                </div>
              </div>
            </>
          )}

          {/* Step 1: Fechas + tipo */}
          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Check-in <span className="text-red-500">*</span></label>
                  <input type="date" className={fi} min={todayLocal()} value={form.checkInDate || ''}
                    onChange={e => { set('checkInDate', e.target.value); set('roomId', undefined); }} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Check-out <span className="text-red-500">*</span></label>
                  <input type="date" className={fi} min={form.checkInDate || todayLocal()} value={form.checkOutDate || ''}
                    onChange={e => { set('checkOutDate', e.target.value); set('roomId', undefined); }} />
                </div>
              </div>

              {nights > 0 && (
                <div className="bg-blue-50 rounded-xl px-4 py-2 text-sm text-blue-700 font-medium">
                  {nights} noche{nights !== 1 ? 's' : ''}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hora aproximada de llegada</label>
                <input type="time" className={fi} value={form.approximateArrivalTime || ''}
                  onChange={e => set('approximateArrivalTime', e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de ocupante <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-1 gap-2">
                  {(Object.entries(OCCUPANT_LABELS) as [OccupantType, string][]).map(([val, label]) => (
                    <button key={val} onClick={() => {
                      set('occupantType', val);
                      if (val === 'INDIVIDUAL') set('numberOfGuests', 1);
                      if (val === 'PAREJA') set('numberOfGuests', 2);
                      if (val === 'MULTIPLE_PERSON') set('numberOfGuests', 3);
                    }}
                      className={`px-4 py-3 rounded-xl border-2 text-left text-sm font-medium transition-colors
                        ${form.occupantType === val ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {form.occupantType === 'MULTIPLE_PERSON' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número de personas</label>
                  <input type="number" min={3} max={10} className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.numberOfGuests || 3} onChange={e => set('numberOfGuests', Number(e.target.value))} />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de habitación <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-1 gap-2">
                  {roomTypes.map(rt => (
                    <button key={rt.id} onClick={() => { set('roomTypeId', rt.id); set('roomId', undefined); }}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-colors
                        ${form.roomTypeId === rt.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 text-sm">{rt.name}</div>
                      </div>
                      {form.roomTypeId === rt.id && (
                        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Solicitudes especiales</label>
                <textarea rows={2} className={`${fi} resize-none`} placeholder="Ej: cama adicional, piso alto..."
                  value={form.specialRequests || ''} onChange={e => set('specialRequests', e.target.value)} />
              </div>
            </>
          )}

          {/* Step 2: Habitación */}
          {step === 2 && (
            <>
              {priceData && (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                  <div>
                    <div className="text-2xl font-black text-slate-800">{fmtCOP(priceData.totalPrice)}</div>
                    <div className="text-xs text-slate-500">{priceData.numberOfNights} noche{priceData.numberOfNights !== 1 ? 's' : ''} · {selectedRoomType?.name}</div>
                  </div>
                </div>
              )}

              {!canFetchRooms ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
                  Selecciona las fechas primero para ver habitaciones disponibles.
                </div>
              ) : roomsLoading ? (
                <div className="text-center py-6 text-gray-400 text-sm">Cargando habitaciones disponibles...</div>
              ) : (
                <>
                  {form.roomTypeId && (
                    <>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Habitaciones disponibles — {selectedRoomType?.name}
                        <span className="ml-2 text-xs text-gray-400">({roomsForType.length} disponibles)</span>
                      </label>

                      {roomsForType.length === 0 ? (
                        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                          No hay habitaciones disponibles de tipo {selectedRoomType?.name} para esas fechas.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {Object.entries(roomsByFloor).sort(([a], [b]) => Number(a) - Number(b)).map(([floor, rooms]) => (
                            <div key={floor}>
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Piso {floor}</p>
                              <div className="grid grid-cols-4 gap-2">
                                {rooms.map(room => (
                                  <button key={room.id} onClick={() => set('roomId', room.id)}
                                    className={`py-2 px-3 rounded-lg border-2 text-sm font-semibold transition-colors
                                      ${form.roomId === room.id ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50'}`}>
                                    {room.roomNumber}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {selectedRoom && (
                        <div className="mt-3 bg-blue-50 rounded-xl px-4 py-2 text-sm text-blue-700">
                          Hab. <span className="font-semibold">{selectedRoom.roomNumber}</span> — Piso {selectedRoom.floor}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}

          {/* Step 3: Pago */}
          {step === 3 && (
            <>
              {priceData && (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-2">
                  <div>
                    <div className="text-xs text-slate-500 mb-0.5">Total estimado estadía</div>
                    <div className="text-2xl font-black text-slate-800">{fmtCOP(priceData.totalPrice)}</div>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <div>{priceData.numberOfNights} noche{priceData.numberOfNights !== 1 ? 's' : ''}</div>
                    <div>{selectedRoomType?.name} · Hab. {selectedRoom?.roomNumber}</div>
                  </div>
                </div>
              )}

              <p className="text-sm font-medium text-gray-700 mb-2">Abono o depósito (opcional)</p>
              <p className="text-xs text-gray-400 mb-3">Si el huésped paga algo ahora, se registra en caja. El saldo restante se cobra al check-in o checkout.</p>

              {payments.map((p, i) => (
                <div key={i} className="grid grid-cols-2 gap-3 mb-3 items-end">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Método</label>
                    <select className={fi} value={p.method} onChange={e => updatePayment(i, 'method', e.target.value)}>
                      {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 mb-1 block">Monto</label>
                      <input className={fi} type="number" min="0" placeholder="0"
                        value={p.amount} onChange={e => updatePayment(i, 'amount', e.target.value)} />
                    </div>
                    {payments.length > 1 && (
                      <button onClick={() => removePaymentLine(i)} className="text-gray-400 hover:text-red-500 text-xl pb-2 leading-none">×</button>
                    )}
                  </div>
                </div>
              ))}

              <button onClick={addPaymentLine}
                className="w-full py-2.5 border border-dashed border-gray-300 hover:border-gray-400 rounded-xl text-sm text-gray-500 hover:text-gray-700 transition-all mb-3">
                + Agregar otro método
              </button>

              {totalAbonado > 0 && (
                <div className={`flex justify-between items-center border rounded-xl px-4 py-3 ${abonoExcede ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                  <div>
                    <span className={`text-sm font-medium ${abonoExcede ? 'text-red-700' : 'text-emerald-700'}`}>Total abonado</span>
                    {abonoExcede && (
                      <div className="text-xs text-red-600 mt-0.5">Supera el total ({fmtCOP(precioBase)})</div>
                    )}
                  </div>
                  <span className={`text-lg font-bold ${abonoExcede ? 'text-red-700' : 'text-emerald-700'}`}>{fmtCOP(totalAbonado)}</span>
                </div>
              )}

              {totalAbonado === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
                  Sin abono — el huésped pagará al llegar o al hacer checkout.
                </div>
              )}
            </>
          )}

          {/* Step 4: Confirmar */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <Row label="Huésped" value={`${form.firstName} ${form.lastName || ''}`.trim()} />
                <Row label="Teléfono" value={form.phone || ''} />
                <Row label="Tipo habitación" value={selectedRoomType?.name || ''} />
                <Row label="Habitación" value={selectedRoom?.roomNumber ? `Hab. ${selectedRoom.roomNumber}` : '—'} />
                <Row label="Ocupante" value={form.occupantType ? OCCUPANT_LABELS[form.occupantType] : ''} />
                <Row label="Check-in" value={form.checkInDate || ''} />
                <Row label="Check-out" value={form.checkOutDate || ''} />
                <Row label="Noches" value={String(nights)} />
                {form.approximateArrivalTime && <Row label="Llegada aprox." value={form.approximateArrivalTime} />}
                {priceData && <Row label="Total estimado" value={fmtCOP(priceData.totalPrice)} />}
                {totalAbonado > 0 && <Row label="Abono registrado" value={fmtCOP(totalAbonado)} />}
                {totalAbonado > 0 && priceData && (
                  <Row label="Saldo pendiente" value={fmtCOP(Math.max(0, priceData.totalPrice - totalAbonado))} />
                )}
                {form.companions?.length ? (
                  <Row label="Acompañantes" value={form.companions.map(c => c.name).join(', ')} />
                ) : null}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-between flex-shrink-0">
          <button
            onClick={() => {
              const firstStep = isCambioHabitacion ? 2 : 0;
              if (step === firstStep) onClose();
              else setStep(s => s - 1);
            }}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            {step === (isCambioHabitacion ? 2 : 0) ? 'Cancelar' : '← Atrás'}
          </button>

          {(() => {
            const lastStep = isCambioHabitacion ? 3 : 4;
            if (step < lastStep) {
              return (
                <button onClick={() => setStep(s => s + 1)} disabled={!canNext() || (step === 3 && abonoExcede)}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
                  Siguiente →
                </button>
              );
            }
            return (
              <button onClick={handleSubmit} disabled={isPending}
                className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60 flex items-center gap-2">
                {isPending && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {isPending ? 'Guardando...' : (isCambioHabitacion ? '✓ Cambiar habitación' : '✓ Crear reserva')}
              </button>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}