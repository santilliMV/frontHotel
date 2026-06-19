import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import { usePageTitle } from '../hooks/usePageTitle';
import type { RoomType, OccupantType } from '../types';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface RoomPrice {
  id: string;
  roomType: RoomType;
  occupantType: OccupantType;
  dayOfWeek: number;
  price: number;
  isActive: boolean;
  changedBy: string | null;
  changedAt: string | null;
  previousPrice: number | null;
}

interface PriceChangeRequest {
  roomTypeId: string;
  occupantType: OccupantType;
  dayOfWeek: number;
  newPrice: number;
}

interface HotelSetting {
  key: string;
  value: string;
  description: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const DAY_LABELS: Record<number, string> = {
  1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves',
  5: 'Viernes', 6: 'Sábado', 7: 'Domingo',
};

const OCCUPANT_LABELS: Record<OccupantType, string> = {
  INDIVIDUAL:      'Individual',
  PAREJA:          'Pareja',
  MULTIPLE_PERSON: 'Múltiple (por persona)',
};

const OCCUPANT_COLORS: Record<OccupantType, string> = {
  INDIVIDUAL:      'bg-slate-100 text-slate-700',
  PAREJA:          'bg-blue-100 text-blue-700',
  MULTIPLE_PERSON: 'bg-purple-100 text-purple-700',
};

const WEEKEND = [6, 7];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });

function groupByOccupant(prices: RoomPrice[]) {
  const map: Partial<Record<OccupantType, RoomPrice[]>> = {};
  for (const p of prices) {
    if (!map[p.occupantType]) map[p.occupantType] = [];
    map[p.occupantType]!.push(p);
  }
  for (const key of Object.keys(map) as OccupantType[]) {
    map[key]!.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  }
  return map;
}

// ── Modal editar precio habitación ────────────────────────────────────────────

interface EditModalProps {
  price: RoomPrice;
  onClose: () => void;
  onSaved: () => void;
}

function EditPriceModal({ price, onClose, onSaved }: EditModalProps) {
  const [newPrice, setNewPrice] = useState(String(Math.round(price.price)));
  const [adminPass, setAdminPass] = useState('');
  const [passVerified, setPassVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [passError, setPassError] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (body: PriceChangeRequest) => apiClient.put('/prices', body),
    onSuccess: () => { onSaved(); onClose(); },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'Error al cambiar precio'),
  });

  const handleVerifyPass = async () => {
    if (!adminPass.trim()) return;
    setVerifying(true);
    setPassError('');
    try {
      const res = await apiClient.post('/admin/verify-password', { password: adminPass });
      if (res.data?.valid) {
        setPassVerified(true);
      } else {
        setPassError('Contraseña incorrecta');
      }
    } catch {
      setPassError('Error al verificar contraseña');
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = () => {
    setError('');
    const num = parseFloat(newPrice);
    if (!newPrice || isNaN(num) || num <= 0) { setError('Ingresa un precio válido'); return; }
    if (num === price.price) { setError('El precio es igual al actual'); return; }
    mutation.mutate({
      roomTypeId:   price.roomType.id,
      occupantType: price.occupantType,
      dayOfWeek:    price.dayOfWeek,
      newPrice:     num,
    });
  };

  const diff = parseFloat(newPrice) - price.price;
  const showDiff = newPrice && !isNaN(parseFloat(newPrice)) && parseFloat(newPrice) !== price.price;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Cambiar precio</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {price.roomType.name} · {OCCUPANT_LABELS[price.occupantType]} · {DAY_LABELS[price.dayOfWeek]}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-400 mb-0.5">Precio actual</p>
            <p className="text-xl font-bold text-slate-800">{fmtCOP(price.price)}</p>
            {price.previousPrice && (
              <p className="text-xs text-slate-400 mt-0.5">
                Anterior: {fmtCOP(price.previousPrice)}
                {price.changedBy && ` · ${price.changedBy}`}
                {price.changedAt && ` · ${fmtDateTime(price.changedAt)}`}
              </p>
            )}
          </div>

          {!passVerified ? (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Contraseña de administrador
              </label>
              <div className="flex gap-2">
                <input
                  type="password" placeholder="••••••••" value={adminPass}
                  onChange={e => { setAdminPass(e.target.value); setPassError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleVerifyPass()}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  autoFocus
                />
                <button
                  onClick={handleVerifyPass}
                  disabled={verifying || !adminPass.trim()}
                  className="px-4 py-2.5 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50"
                >
                  {verifying ? '...' : 'Verificar'}
                </button>
              </div>
              {passError && <p className="text-xs text-red-600 mt-1.5">{passError}</p>}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs font-medium">
                <span>✓</span> Identidad verificada
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Nuevo precio <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input
                    type="number" value={newPrice}
                    onChange={e => { setNewPrice(e.target.value); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                    placeholder="0" min="0" autoFocus
                    className="w-full border border-slate-300 rounded-lg pl-7 pr-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
                {showDiff && (
                  <p className={`text-xs mt-1.5 font-medium ${diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {diff > 0 ? '+' : ''}{fmtCOP(diff)} respecto al precio actual
                  </p>
                )}
              </div>
              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium">
            Cancelar
          </button>
          {passVerified && (
            <button
              onClick={handleSave}
              disabled={mutation.isPending}
              className="px-5 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Guardando...' : 'Guardar precio'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tabla de precios por tipo de habitación ───────────────────────────────────

function PriceTable({ roomType, onEdit }: { roomType: RoomType; onEdit: (p: RoomPrice) => void }) {
  const { data: prices = [], isLoading } = useQuery<RoomPrice[]>({
    queryKey: ['prices', roomType.id],
    queryFn: async () => (await apiClient.get(`/prices/type/${roomType.id}`)).data,
  });

  const grouped = groupByOccupant(prices);
  const occupants = Object.keys(grouped) as OccupantType[];

  if (isLoading) return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-6 text-center text-sm text-slate-400">
      Cargando precios...
    </div>
  );

  if (occupants.length === 0) return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-6 text-center text-sm text-slate-400">
      Sin precios configurados.
    </div>
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {occupants.map((occupant, oi) => {
        const rows = grouped[occupant]!;
        return (
          <div key={occupant} className={oi > 0 ? 'border-t border-slate-100' : ''}>
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${OCCUPANT_COLORS[occupant]}`}>
                {OCCUPANT_LABELS[occupant]}
              </span>
              {occupant === 'MULTIPLE_PERSON' && (
                <span className="text-xs text-purple-500 font-medium">
                  precio × número de huéspedes
                </span>
              )}
            </div>
            <div className="divide-y divide-slate-50">
              {rows.map(price => (
                <div key={price.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium w-20 ${WEEKEND.includes(price.dayOfWeek) ? 'text-blue-600' : 'text-slate-600'}`}>
                      {DAY_LABELS[price.dayOfWeek]}
                    </span>
                    <span className="text-sm font-semibold text-slate-800">{fmtCOP(price.price)}</span>
                    {price.occupantType === 'MULTIPLE_PERSON' && (
                      <span className="text-xs text-purple-400">/ persona</span>
                    )}
                    {price.previousPrice && price.previousPrice !== price.price && (
                      <span className="text-xs text-slate-400 line-through">{fmtCOP(price.previousPrice)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {price.changedBy && (
                      <span className="text-xs text-slate-400 hidden sm:block">
                        {price.changedBy}{price.changedAt && ` · ${fmtDateTime(price.changedAt)}`}
                      </span>
                    )}
                    <button
                      onClick={() => onEdit(price)}
                      className="text-xs px-3 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-colors font-medium"
                    >
                      Editar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Sección: Precio del Rato ──────────────────────────────────────────────────

function RatoPriceSection() {
  const queryClient = useQueryClient();
  const [editing, setEditing]           = useState(false);
  const [adminPass, setAdminPass]       = useState('');
  const [passVerified, setPassVerified] = useState(false);
  const [verifying, setVerifying]       = useState(false);
  const [passError, setPassError]       = useState('');
  const [newPrice, setNewPrice]         = useState('');
  const [error, setError]               = useState('');

  const { data: setting, isLoading } = useQuery<HotelSetting>({
    queryKey: ['setting', 'rato.price'],
    queryFn: async () => (await apiClient.get('/admin/settings/rato.price')).data,
  });

  const mutation = useMutation({
    mutationFn: (value: string) => apiClient.put('/admin/settings/rato.price', { value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setting', 'rato.price'] });
      handleCancel();
    },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'Error al guardar'),
  });

  const handleVerifyPass = async () => {
    if (!adminPass.trim()) return;
    setVerifying(true);
    setPassError('');
    try {
      const res = await apiClient.post('/admin/verify-password', { password: adminPass });
      if (res.data?.valid) {
        setPassVerified(true);
        setNewPrice(setting ? String(Math.round(parseFloat(setting.value))) : '');
      } else {
        setPassError('Contraseña incorrecta');
      }
    } catch {
      setPassError('Error al verificar contraseña');
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = () => {
    setError('');
    const num = parseFloat(newPrice);
    if (!newPrice || isNaN(num) || num <= 0) { setError('Ingresa un precio válido'); return; }
    mutation.mutate(String(Math.round(num)));
  };

  const handleCancel = () => {
    setEditing(false);
    setPassVerified(false);
    setAdminPass('');
    setNewPrice('');
    setPassError('');
    setError('');
  };

  const currentPrice = setting ? parseFloat(setting.value) : null;
  const diff = newPrice && currentPrice !== null && !isNaN(parseFloat(newPrice))
    ? parseFloat(newPrice) - currentPrice
    : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Servicio Rato</h2>
        <span className="text-xs text-slate-400">3 horas · precio único · aplica todos los días</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
            Rato (3h)
          </span>
        </div>

        <div className="px-4 py-3">
          {isLoading ? (
            <p className="text-sm text-slate-400">Cargando...</p>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-800">
                  {currentPrice !== null ? fmtCOP(currentPrice) : '—'}
                </span>
                {setting?.updatedBy && (
                  <span className="text-xs text-slate-400 hidden sm:block">
                    {setting.updatedBy}{setting.updatedAt && ` · ${fmtDateTime(setting.updatedAt)}`}
                  </span>
                )}
              </div>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs px-3 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-colors font-medium"
                >
                  Editar
                </button>
              )}
            </div>
          )}

          {editing && (
            <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              {!passVerified ? (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Contraseña de administrador
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password" placeholder="••••••••" value={adminPass}
                      onChange={e => { setAdminPass(e.target.value); setPassError(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleVerifyPass()}
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                      autoFocus
                    />
                    <button
                      onClick={handleVerifyPass}
                      disabled={verifying || !adminPass.trim()}
                      className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50"
                    >
                      {verifying ? '...' : 'Verificar'}
                    </button>
                  </div>
                  {passError && <p className="text-xs text-red-600 mt-1">{passError}</p>}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-xs font-medium">
                    <span>✓</span> Identidad verificada
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Nuevo precio <span className="text-red-500">*</span>
                    </label>
                    <div className="relative max-w-xs">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                      <input
                        type="number" value={newPrice}
                        onChange={e => { setNewPrice(e.target.value); setError(''); }}
                        onKeyDown={e => e.key === 'Enter' && handleSave()}
                        placeholder="0" min="0" autoFocus
                        className="w-full border border-slate-300 rounded-lg pl-7 pr-4 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                      />
                    </div>
                    {diff !== null && diff !== 0 && (
                      <p className={`text-xs mt-1 font-medium ${diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {diff > 0 ? '+' : ''}{fmtCOP(diff)} respecto al precio actual
                      </p>
                    )}
                  </div>
                  {error && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
                  )}
                </>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button onClick={handleCancel} className="px-4 py-1.5 text-sm text-slate-600 hover:text-slate-800 font-medium">
                  Cancelar
                </button>
                {passVerified && (
                  <button
                    onClick={handleSave}
                    disabled={mutation.isPending}
                    className="px-4 py-1.5 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50"
                  >
                    {mutation.isPending ? 'Guardando...' : 'Guardar'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function AdminPrecios() {
  usePageTitle('Precios — Admin');
  const queryClient = useQueryClient();
  const [editingPrice, setEditingPrice] = useState<RoomPrice | null>(null);
  const [expandedType, setExpandedType] = useState<string | null>(null);

  const { data: roomTypes = [], isLoading } = useQuery<RoomType[]>({
    queryKey: ['roomTypes'],
    queryFn: async () => (await apiClient.get('/rooms/types')).data,
  });

  const activeType = expandedType ?? roomTypes[0]?.id ?? null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">

        <div>
          <h1 className="text-xl font-semibold text-slate-800">Precios</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Gestiona las tarifas de habitaciones y servicios. Los cambios aplican solo a reservas nuevas.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-3">
          <span className="text-amber-500 text-base mt-0.5 shrink-0">⚠</span>
          <div className="text-xs text-amber-700 space-y-0.5">
            <p className="font-medium">Los cambios de precio requieren contraseña de administrador</p>
            <p>Los precios modificados solo afectan reservas y check-ins futuros. El historial queda en auditoría.</p>
          </div>
        </div>

        {/* ── Habitaciones ── */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Habitaciones</h2>

          {isLoading && (
            <div className="text-center py-8 text-slate-400 text-sm">Cargando...</div>
          )}

          {!isLoading && roomTypes.length > 0 && (
            <>
              <div className="flex gap-1 flex-wrap">
                {roomTypes.map(rt => (
                  <button
                    key={rt.id}
                    onClick={() => setExpandedType(rt.id)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      activeType === rt.id
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    {rt.name}
                  </button>
                ))}
              </div>

              {activeType && (
                <>
                  <p className="text-xs text-slate-400">
                    {roomTypes.find(rt => rt.id === activeType)?.name} · Semana (L–V) · Fin de semana (Sáb–Dom)
                  </p>
                  <PriceTable
                    key={activeType}
                    roomType={roomTypes.find(rt => rt.id === activeType)!}
                    onEdit={setEditingPrice}
                  />
                </>
              )}
            </>
          )}
        </div>

        {/* ── Separador ── */}
        <div className="border-t border-slate-200" />

        {/* ── Servicio Rato ── */}
        <RatoPriceSection />

      </div>

      {editingPrice && (
        <EditPriceModal
          price={editingPrice}
          onClose={() => setEditingPrice(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['prices'] })}
        />
      )}
    </div>
  );
}