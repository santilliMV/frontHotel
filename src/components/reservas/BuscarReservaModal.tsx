import { useState } from 'react';
import { reservationsApi } from '../../api/reservations';
import type { ReservationResponse } from '../../api/reservations';
import { formatCurrency, formatDate } from '../../utils/format';

interface Props {
  onClose: () => void;
  onSeleccionada: (r: ReservationResponse) => void;
}

export default function BuscarReservaModal({ onClose, onSeleccionada }: Props) {
  const [query, setQuery] = useState('');
  const [tipo, setTipo] = useState<'telefono' | 'numero'>('telefono');
  const [resultados, setResultados] = useState<ReservationResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [buscado, setBuscado] = useState(false);

  const buscar = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setBuscado(true);
    try {
      if (tipo === 'telefono') {
        const data = await reservationsApi.getByPhone(query.trim());
        setResultados(Array.isArray(data) ? data : [data]);
      } else {
        const data = await reservationsApi.getByNumber(query.trim());
        setResultados(data ? [data] : []);
      }
    } catch (e: any) {
      if (e?.response?.status === 404) {
        setResultados([]);
      } else {
        setError('Error al buscar. Intente de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]">

        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">Buscar reserva</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-4 border-b flex-shrink-0 space-y-3">
          {/* Tipo de búsqueda */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => { setTipo('telefono'); setResultados([]); setBuscado(false); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors
                ${tipo === 'telefono' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              📞 Por teléfono
            </button>
            <button
              onClick={() => { setTipo('numero'); setResultados([]); setBuscado(false); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors
                ${tipo === 'numero' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              🔢 Por número
            </button>
          </div>

          {/* Input + Buscar */}
          <div className="flex gap-2">
            <input
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={tipo === 'telefono' ? 'Ej: 3001234567' : 'Ej: RES-20260410-001'}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && buscar()}
              autoFocus
            />
            <button
              onClick={buscar}
              disabled={loading || !query.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : '🔍'}
              Buscar
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* Resultados */}
        <div className="flex-1 overflow-y-auto">
          {buscado && !loading && resultados.length === 0 && (
            <div className="p-10 text-center">
              <div className="text-3xl mb-2">🔍</div>
              <p className="text-gray-500">No se encontraron reservas</p>
              <p className="text-gray-400 text-sm mt-1">
                Intente con {tipo === 'telefono' ? 'otro número de teléfono' : 'otro número de reserva'}
              </p>
            </div>
          )}

          {resultados.map(r => (
            <button
              key={r.id}
              onClick={() => onSeleccionada(r)}
              className="w-full text-left px-6 py-4 hover:bg-blue-50 border-b border-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{r.guestName}</span>
                    {r.guestHasObservations && (
                      <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">⚠️</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {r.guestPhone} · {r.roomTypeName} · {r.numberOfNights} noche{r.numberOfNights !== 1 ? 's' : ''}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {formatDate(r.checkInDate)} → {formatDate(r.checkOutDate)}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-semibold text-gray-900">{formatCurrency(r.estimatedTotal)}</div>
                  <div className="text-xs text-gray-400">{r.reservationNumber}</div>
                  <div className={`text-xs mt-1 px-2 py-0.5 rounded-full inline-block font-medium
                    ${r.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-700'
                    : r.status === 'CHECKED_IN' ? 'bg-green-100 text-green-700'
                    : r.status === 'CANCELLED' ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-600'}`}>
                    {r.statusLabel}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="px-6 py-3 border-t flex-shrink-0">
          <button onClick={onClose} className="w-full py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}