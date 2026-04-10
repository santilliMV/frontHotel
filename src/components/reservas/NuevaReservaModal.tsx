import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { reservationsApi } from '../../api/reservations';
import type { CreateReservationDTO, OccupantType, ReservationCompanion } from '../../api/reservations';
import  apiClient from '../../api/client';
import { formatCurrency } from '../../utils/format';

interface RoomType {
  id: string;
  name: string;
  capacity: number;
  description: string;
}

interface Props {
  onClose: () => void;
  onCreada: () => void;
}

const OCCUPANT_LABELS: Record<OccupantType, string> = {
  INDIVIDUAL:      'Individual (1 persona)',
  PAREJA:          'Pareja (2 personas)',
  MULTIPLE_PERSON: 'Múltiple (3+ personas)',
};

const STEPS = ['Huésped', 'Habitación', 'Fechas', 'Confirmar'];

export default function NuevaReservaModal({ onClose, onCreada }: Props) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Partial<CreateReservationDTO>>({
    numberOfGuests: 1,
    companions: [],
  });
  const [newCompanion, setNewCompanion] = useState<ReservationCompanion>({ name: '' });
  const [error, setError] = useState('');

  const { data: roomTypes = [] } = useQuery<RoomType[]>({
    queryKey: ['room-types'],
    queryFn: () => apiClient.get('/rooms/types').then(r => r.data),
  });

  const mutation = useMutation({
    mutationFn: reservationsApi.create,
    onSuccess: () => onCreada(),
    onError: (e: any) => {
      const msg = e?.response?.data?.error || e?.response?.data?.campos
        ? JSON.stringify(e.response.data.campos)
        : 'Error al crear la reserva';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const set = (key: keyof CreateReservationDTO, value: any) =>
    setForm(f => ({ ...f, [key]: value }));

  // Calcular noches
  const nights = form.checkInDate && form.checkOutDate
    ? Math.max(0, Math.ceil(
        (new Date(form.checkOutDate).getTime() - new Date(form.checkInDate).getTime())
        / (1000 * 60 * 60 * 24)
      ))
    : 0;

  const canNext = () => {
    if (step === 0) return !!(form.firstName?.trim() && form.phone?.trim());
    if (step === 1) return !!(form.roomTypeId && form.occupantType);
    if (step === 2) return !!(form.checkInDate && form.checkOutDate && nights > 0);
    return true;
  };

  const addCompanion = () => {
    if (!newCompanion.name.trim()) return;
    set('companions', [...(form.companions || []), newCompanion]);
    setNewCompanion({ name: '' });
  };

  const removeCompanion = (i: number) => {
    set('companions', (form.companions || []).filter((_, idx) => idx !== i));
  };

  const handleSubmit = () => {
    setError('');
    mutation.mutate(form as CreateReservationDTO);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">Nueva reserva</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Steps */}
        <div className="px-6 py-3 border-b flex-shrink-0">
          <div className="flex items-center gap-0">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center flex-1">
                <div className={`flex items-center gap-1.5 ${i <= step ? 'text-blue-600' : 'text-gray-400'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2
                    ${i < step ? 'bg-blue-600 border-blue-600 text-white'
                    : i === step ? 'border-blue-600 text-blue-600'
                    : 'border-gray-300 text-gray-400'}`}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <span className="text-xs font-medium hidden sm:block">{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-blue-600' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Step 0: Huésped */}
          {step === 0 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Juan"
                    value={form.firstName || ''}
                    onChange={e => set('firstName', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Pérez"
                    value={form.lastName || ''}
                    onChange={e => set('lastName', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="3001234567"
                  value={form.phone || ''}
                  onChange={e => set('phone', e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">Si el huésped ya existe, se vincula automáticamente</p>
              </div>

              {/* Acompañantes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Acompañantes (opcional)</label>
                {(form.companions || []).map((c, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="flex-1 text-sm text-gray-700">{c.name} {c.documentNumber ? `· ${c.documentNumber}` : ''}</span>
                    <button onClick={() => removeCompanion(i)} className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre acompañante"
                    value={newCompanion.name}
                    onChange={e => setNewCompanion(c => ({ ...c, name: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addCompanion()}
                  />
                  <input
                    className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Cédula"
                    value={newCompanion.documentNumber || ''}
                    onChange={e => setNewCompanion(c => ({ ...c, documentNumber: e.target.value }))}
                  />
                  <button
                    onClick={addCompanion}
                    className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-600 hover:bg-gray-200 font-medium"
                  >
                    + Add
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Step 1: Habitación */}
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de habitación <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {roomTypes.map(rt => (
                    <button
                      key={rt.id}
                      onClick={() => set('roomTypeId', rt.id)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-colors
                        ${form.roomTypeId === rt.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 text-sm">{rt.name}</div>
                        <div className="text-xs text-gray-500">{rt.description}</div>
                      </div>
                      <div className="text-xs text-gray-400">Cap. {rt.capacity}</div>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de ocupante <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {(Object.entries(OCCUPANT_LABELS) as [OccupantType, string][]).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => {
                        set('occupantType', val);
                        if (val === 'INDIVIDUAL') set('numberOfGuests', 1);
                        if (val === 'PAREJA') set('numberOfGuests', 2);
                      }}
                      className={`px-4 py-3 rounded-xl border-2 text-left text-sm font-medium transition-colors
                        ${form.occupantType === val
                          ? 'border-blue-500 bg-blue-50 text-blue-800'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {form.occupantType === 'MULTIPLE_PERSON' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número de huéspedes</label>
                  <input
                    type="number"
                    min={3}
                    max={10}
                    className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.numberOfGuests || 3}
                    onChange={e => set('numberOfGuests', Number(e.target.value))}
                  />
                </div>
              )}
            </>
          )}

          {/* Step 2: Fechas */}
          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Check-in <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min={new Date().toISOString().split('T')[0]}
                    value={form.checkInDate || ''}
                    onChange={e => set('checkInDate', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Check-out <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min={form.checkInDate || new Date().toISOString().split('T')[0]}
                    value={form.checkOutDate || ''}
                    onChange={e => set('checkOutDate', e.target.value)}
                  />
                </div>
              </div>

              {nights > 0 && (
                <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-700">
                  <span className="font-semibold">{nights} noche{nights !== 1 ? 's' : ''}</span>
                  {' '}· {form.occupantType && OCCUPANT_LABELS[form.occupantType as OccupantType]}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hora aproximada de llegada</label>
                <input
                  type="time"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.approximateArrivalTime || ''}
                  onChange={e => set('approximateArrivalTime', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Depósito (opcional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                    value={form.depositAmount || ''}
                    onChange={e => set('depositAmount', e.target.value ? Number(e.target.value) : undefined)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Solicitudes especiales</label>
                <textarea
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Ej: cama adicional, piso alto..."
                  value={form.specialRequests || ''}
                  onChange={e => set('specialRequests', e.target.value)}
                />
              </div>
            </>
          )}

          {/* Step 3: Confirmar */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm">
                <Row label="Huésped" value={`${form.firstName} ${form.lastName || ''}`.trim()} />
                <Row label="Teléfono" value={form.phone || ''} />
                <Row label="Tipo habitación" value={roomTypes.find(r => r.id === form.roomTypeId)?.name || ''} />
                <Row label="Ocupante" value={form.occupantType ? OCCUPANT_LABELS[form.occupantType] : ''} />
                <Row label="Huéspedes" value={String(form.numberOfGuests)} />
                <Row label="Check-in" value={form.checkInDate || ''} />
                <Row label="Check-out" value={form.checkOutDate || ''} />
                <Row label="Noches" value={String(nights)} />
                {form.approximateArrivalTime && <Row label="Llegada aprox." value={form.approximateArrivalTime} />}
                {form.depositAmount ? <Row label="Depósito" value={formatCurrency(form.depositAmount)} /> : null}
                {form.companions?.length ? (
                  <Row label="Acompañantes" value={form.companions.map(c => c.name).join(', ')} />
                ) : null}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-between flex-shrink-0">
          <button
            onClick={() => step === 0 ? onClose() : setStep(s => s - 1)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            {step === 0 ? 'Cancelar' : '← Atrás'}
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Siguiente →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={mutation.isPending}
              className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60 flex items-center gap-2"
            >
              {mutation.isPending && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {mutation.isPending ? 'Creando...' : '✓ Crear reserva'}
            </button>
          )}
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