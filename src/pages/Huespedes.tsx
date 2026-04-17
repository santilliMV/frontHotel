import { useState, useEffect, useRef, useCallback } from 'react';
import { guestsApi } from '../api/hotel-api';
import type { GuestResponse, GuestRequest, DocumentType } from '../api/hotel-api';
import { COLOMBIA_CITIES, COUNTRIES, DOC_TYPES } from '../constants';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const emptyForm = (): GuestRequest => ({
  firstName: '', lastName: '', phone: '',
  documentType: undefined, documentNumber: '',
  address: '', city: '', country: 'Colombia',
  occupation: '', vehiclePlate: '', observations: '',
});

// ─── GuestForm ────────────────────────────────────────────────────────────────

function GuestForm({
  initial, onSave, onCancel, saving, error,
}: {
  initial: GuestRequest;
  onSave: (d: GuestRequest) => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
}) {
  const [form, setForm] = useState<GuestRequest>(initial);
  const set = (k: keyof GuestRequest, v: string) =>
    setForm((f) => ({ ...f, [k]: v || undefined }));

  return (
    <div className="guest-form">
      {/* Fila 1: Nombre + Apellido */}
      <div className="fg-grid-2">
        <div className="fg-field required">
          <label>Nombre *</label>
          <input className="fg-input" placeholder="Nombre" autoFocus
            value={form.firstName}
            onChange={(e) => set('firstName', e.target.value)} />
        </div>
        <div className="fg-field">
          <label>Apellido</label>
          <input className="fg-input" placeholder="Apellido"
            value={form.lastName ?? ''}
            onChange={(e) => set('lastName', e.target.value)} />
        </div>
      </div>

      {/* Fila 2: Teléfono */}
      <div className="fg-field required">
        <label>Teléfono *</label>
        <input className="fg-input" placeholder="3101234567"
          value={form.phone}
          onChange={(e) => set('phone', e.target.value)} />
      </div>

      {/* Fila 3: Tipo doc + Número doc */}
      <div className="fg-grid-2">
        <div className="fg-field">
          <label>Tipo de documento</label>
          <select className="fg-input"
            value={form.documentType ?? ''}
            onChange={(e) => set('documentType', e.target.value)}>
            <option value="">— Seleccionar —</option>
            {DOC_TYPES.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div className="fg-field">
          <label>Número de documento</label>
          <input className="fg-input" placeholder="123456789"
            value={form.documentNumber ?? ''}
            onChange={(e) => set('documentNumber', e.target.value)} />
        </div>
      </div>

      {/* Fila 4: País + Ciudad */}
      <div className="fg-grid-2">
        <div className="fg-field">
          <label>País</label>
          <select className="fg-input"
            value={form.country ?? 'Colombia'}
            onChange={(e) => set('country', e.target.value)}>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="fg-field">
          <label>Ciudad</label>
          <select className="fg-input"
            value={form.city ?? ''}
            onChange={(e) => set('city', e.target.value)}>
            <option value="">— Seleccionar —</option>
            {COLOMBIA_CITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Fila 5: Dirección */}
      <div className="fg-field">
        <label>Dirección</label>
        <input className="fg-input" placeholder="Calle 123 #45-67"
          value={form.address ?? ''}
          onChange={(e) => set('address', e.target.value)} />
      </div>

      {/* Fila 6: Ocupación + Placa */}
      <div className="fg-grid-2">
        <div className="fg-field">
          <label>Ocupación</label>
          <input className="fg-input" placeholder="Comerciante"
            value={form.occupation ?? ''}
            onChange={(e) => set('occupation', e.target.value)} />
        </div>
        <div className="fg-field">
          <label>Placa vehículo</label>
          <input className="fg-input" placeholder="ABC-123"
            value={form.vehiclePlate ?? ''}
            onChange={(e) => set('vehiclePlate', e.target.value)} />
        </div>
      </div>

      {/* Observaciones */}
      <div className="fg-field obs-field">
        <label>⚠ Observaciones</label>
        <textarea className="fg-input fg-textarea" rows={3}
          placeholder="Ej: No arrendar, cliente problemático…"
          value={form.observations ?? ''}
          onChange={(e) => set('observations', e.target.value)} />
        {form.observations && (
          <span className="obs-warn">Este huésped quedará marcado con alerta</span>
        )}
      </div>

      {error && <div className="fg-error">⚠ {error}</div>}

      <div className="fg-actions">
        <button className="btn-secondary" onClick={onCancel} disabled={saving}>Cancelar</button>
        <button
          className="btn-primary"
          onClick={() => onSave(form)}
          disabled={saving || !form.firstName || !form.phone}
        >
          {saving ? '⟳ Guardando…' : '✓ Guardar huésped'}
        </button>
      </div>
    </div>
  );
}

// ─── GuestCard ────────────────────────────────────────────────────────────────

function GuestCard({ guest, onEdit, onSelect, selectLabel }: {
  guest: GuestResponse;
  onEdit: (g: GuestResponse) => void;
  onSelect?: (g: GuestResponse) => void;
  selectLabel?: string;
}) {
  const initials = (guest.firstName[0] + (guest.lastName?.[0] ?? '')).toUpperCase();
  return (
    <div className={`gc ${guest.hasObservations ? 'gc-obs' : ''}`}>
      <div className="gc-avatar" style={{ background: guest.hasObservations ? '#7f1d1d' : '#1e1e35' }}>
        {initials}
      </div>
      <div className="gc-body">
        <div className="gc-top">
          <span className="gc-name">{guest.fullName}</span>
          {guest.hasObservations && <span className="badge-obs">⚠ Obs.</span>}
          {guest.autoCreated && <span className="badge-auto">Auto</span>}
        </div>
        <div className="gc-meta">
          <span>📞 {guest.phone}</span>
          {guest.documentNumber && <span>🪪 {guest.documentType} {guest.documentNumber}</span>}
          {guest.city && <span>📍 {guest.city}{guest.country && guest.country !== 'Colombia' ? `, ${guest.country}` : ''}</span>}
          {guest.lastStayDate && <span>🏨 Última visita: {fmt(guest.lastStayDate)}</span>}
        </div>
        {guest.hasObservations && (
          <div className="gc-obs-text">"{guest.observations}"</div>
        )}
      </div>
      <div className="gc-btns">
        {onSelect && (
          <button className="btn-select" onClick={() => onSelect(guest)}>
            {selectLabel ?? 'Seleccionar'}
          </button>
        )}
        <button className="btn-edit" onClick={() => onEdit(guest)}>Editar</button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Modal = 'none' | 'create' | 'edit';

export default function Huespedes() {
  const [query, setQuery]     = useState('');
  const [guests, setGuests]   = useState<GuestResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal]     = useState<Modal>('none');
  const [editing, setEditing] = useState<GuestResponse | null>(null);
  const [saving, setSaving]   = useState(false);
  const [formError, setFormError] = useState('');
  const [toast, setToast]     = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try { setGuests(await guestsApi.findAll()); }
    catch { setGuests([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { loadAll(); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try { setGuests(await guestsApi.search(query.trim())); }
      catch { setGuests([]); }
      finally { setLoading(false); }
    }, 350);
  }, [query, loadAll]);

  const openCreate = () => { setEditing(null); setFormError(''); setModal('create'); };
  const openEdit = (g: GuestResponse) => { setEditing(g); setFormError(''); setModal('edit'); };

  const handleSave = async (data: GuestRequest) => {
    setSaving(true); setFormError('');
    try {
      if (modal === 'edit' && editing) {
        await guestsApi.update(editing.id, data);
        setToast('Huésped actualizado');
      } else {
        await guestsApi.create(data);
        setToast('Huésped registrado');
      }
      setModal('none');
      loadAll();
      setTimeout(() => setToast(''), 3000);
    } catch (e: any) {
      setFormError(e?.response?.data?.message || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const initialForm = (): GuestRequest => {
    if (modal === 'edit' && editing) {
      return {
        firstName: editing.firstName, lastName: editing.lastName ?? '',
        phone: editing.phone,
        documentType: editing.documentType ?? undefined,
        documentNumber: editing.documentNumber ?? '',
        address: editing.address ?? '', city: editing.city ?? '',
        country: editing.country ?? 'Colombia',
        occupation: editing.occupation ?? '',
        vehiclePlate: editing.vehiclePlate ?? '',
        observations: editing.observations ?? '',
      };
    }
    return emptyForm();
  };

  const withObs = guests.filter((g) => g.hasObservations);
  const normal  = guests.filter((g) => !g.hasObservations);

  return (
    <>
      <style>{`
        .hp { min-height:100vh; background:#0f1117; padding:32px 24px;
          font-family:'DM Sans','Segoe UI',sans-serif; color:#e8e8f0; }

        .hp-header { display:flex; align-items:center; justify-content:space-between;
          margin-bottom:28px; gap:16px; flex-wrap:wrap; }
        .hp-header-left { display:flex; align-items:center; gap:14px; }
        .hp-icon { width:48px; height:48px; background:linear-gradient(135deg,#0ea5e9,#6366f1);
          border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:22px; }
        .hp-header h1 { font-size:26px; font-weight:700; margin:0; letter-spacing:-.5px; }
        .hp-header p  { margin:2px 0 0; color:#6b7280; font-size:14px; }

        .hp-search { display:flex; gap:10px; margin-bottom:24px; }
        .hp-search input { flex:1; padding:12px 16px; background:#16171f;
          border:1px solid #2a2a3d; border-radius:12px; color:#e8e8f0;
          font-size:15px; outline:none; transition:border .2s; font-family:inherit; }
        .hp-search input:focus { border-color:#6366f1; }
        .hp-search input::placeholder { color:#4b5563; }

        .btn-primary { padding:11px 22px;
          background:linear-gradient(135deg,#6366f1,#8b5cf6);
          border:none; border-radius:11px; color:#fff;
          font-size:14px; font-weight:600; cursor:pointer; transition:opacity .2s; white-space:nowrap; }
        .btn-primary:hover { opacity:.88; }
        .btn-primary:disabled { opacity:.45; cursor:not-allowed; }
        .btn-secondary { padding:11px 20px; background:transparent;
          border:1px solid #2a2a3d; border-radius:11px; color:#9ca3af;
          font-size:14px; cursor:pointer; transition:all .2s; }
        .btn-secondary:hover { border-color:#4b5563; color:#e8e8f0; }
        .btn-edit { padding:7px 14px; background:transparent;
          border:1px solid #2a2a3d; border-radius:8px; color:#9ca3af;
          font-size:13px; cursor:pointer; transition:all .2s; }
        .btn-edit:hover { border-color:#6366f1; color:#a5b4fc; }
        .btn-select { padding:7px 16px; background:rgba(99,102,241,.15);
          border:1px solid rgba(99,102,241,.4); border-radius:8px; color:#a5b4fc;
          font-size:13px; font-weight:600; cursor:pointer; transition:all .2s; }
        .btn-select:hover { background:rgba(99,102,241,.25); }

        .section-lbl { font-size:11px; text-transform:uppercase; letter-spacing:1px;
          color:#4b5563; margin:0 0 12px; display:flex; align-items:center; gap:8px; }
        .section-lbl.red { color:#f87171; }
        .cnt { display:inline-flex; align-items:center; justify-content:center;
          background:#1e1e35; border:1px solid #3730a3; color:#818cf8;
          font-size:12px; font-weight:700; width:24px; height:24px; border-radius:6px; }

        .guest-list { display:flex; flex-direction:column; gap:10px; margin-bottom:28px; }

        .gc { background:#16171f; border:1px solid #2a2a3d; border-radius:14px;
          padding:16px 18px; display:flex; gap:14px; align-items:flex-start; transition:border .2s; }
        .gc:hover { border-color:#3d3d5c; }
        .gc-obs { border-color:rgba(239,68,68,.3)!important; background:rgba(239,68,68,.04); }
        .gc-avatar { width:42px; height:42px; border-radius:12px; flex-shrink:0;
          display:flex; align-items:center; justify-content:center;
          font-size:15px; font-weight:700; color:#a5b4fc; }
        .gc-body { flex:1; min-width:0; }
        .gc-top { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:6px; }
        .gc-name { font-size:16px; font-weight:600; color:#e8e8f0; }
        .badge-obs { font-size:11px; font-weight:600; padding:2px 8px;
          background:rgba(239,68,68,.15); color:#f87171;
          border-radius:4px; border:1px solid rgba(239,68,68,.3); }
        .badge-auto { font-size:11px; padding:2px 8px;
          background:rgba(99,102,241,.1); color:#818cf8;
          border-radius:4px; border:1px solid rgba(99,102,241,.2); }
        .gc-meta { display:flex; flex-wrap:wrap; gap:10px; font-size:13px; color:#6b7280; }
        .gc-meta span { white-space:nowrap; }
        .gc-obs-text { margin-top:8px; font-size:12px; color:#f87171; font-style:italic;
          background:rgba(239,68,68,.08); padding:6px 10px; border-radius:6px;
          border-left:2px solid rgba(239,68,68,.4); }
        .gc-btns { display:flex; flex-direction:column; gap:6px; flex-shrink:0; }

        .empty-state { text-align:center; padding:60px 20px; color:#4b5563; }
        .empty-state p { font-size:15px; margin:8px 0 20px; }
        .loading-state { text-align:center; padding:40px; color:#6b7280; font-size:14px; }

        .toast { position:fixed; bottom:24px; right:24px;
          background:#064e3b; border:1px solid #059669; color:#6ee7b7;
          padding:12px 20px; border-radius:12px; font-size:14px; font-weight:500;
          z-index:999; box-shadow:0 4px 20px rgba(0,0,0,.4); animation:slideUp .3s ease; }
        @keyframes slideUp { from{transform:translateY(16px);opacity:0} to{transform:translateY(0);opacity:1} }

        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.75);
          backdrop-filter:blur(4px); display:flex; align-items:flex-start;
          justify-content:center; z-index:100; padding:24px; overflow-y:auto; }
        .modal-card { background:#16171f; border:1px solid #2a2a3d;
          border-radius:20px; padding:28px; width:100%; max-width:640px; margin:auto; }
        .modal-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:22px; }
        .modal-title { font-size:18px; font-weight:700; margin:0; }
        .modal-close { background:none; border:none; color:#6b7280; font-size:22px;
          cursor:pointer; padding:4px 8px; border-radius:6px; transition:color .2s; }
        .modal-close:hover { color:#e8e8f0; }

        /* Form */
        .guest-form { display:flex; flex-direction:column; gap:14px; }
        .fg-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        @media(max-width:500px) { .fg-grid-2 { grid-template-columns:1fr; } }
        .fg-field { display:flex; flex-direction:column; gap:5px; }
        .fg-field label { font-size:12px; color:#9ca3af; }
        .fg-input { background:#1a1a2e; border:1px solid #2a2a3d; border-radius:10px;
          padding:10px 13px; color:#e8e8f0; font-size:14px; outline:none;
          transition:border .2s; font-family:inherit; width:100%; box-sizing:border-box; }
        .fg-input:focus { border-color:#6366f1; }
        select.fg-input { cursor:pointer; }
        select.fg-input option { background:#1a1a2e; }
        .fg-textarea { resize:vertical; min-height:72px; }
        .obs-field { }
        .obs-warn { font-size:11px; color:#f59e0b; }
        .fg-error { padding:10px 14px; border-radius:8px;
          background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.3);
          color:#f87171; font-size:13px; }
        .fg-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:6px; }
      `}</style>

      <div className="hp">
        <div className="hp-header">
          <div className="hp-header-left">
            <div className="hp-icon">👤</div>
            <div>
              <h1>Huéspedes</h1>
              <p>Registro y consulta de clientes</p>
            </div>
          </div>
          <button className="btn-primary" onClick={openCreate}>+ Nuevo huésped</button>
        </div>

        <div className="hp-search">
          <input placeholder="Buscar por nombre, teléfono o documento…"
            value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        {loading ? (
          <div className="loading-state">Cargando huéspedes…</div>
        ) : guests.length === 0 ? (
          <div className="empty-state">
            <p>No se encontraron huéspedes{query ? ` para "${query}"` : ''}.</p>
            <button className="btn-primary" onClick={openCreate}>+ Registrar huésped</button>
          </div>
        ) : (
          <>
            {withObs.length > 0 && (
              <>
                <p className="section-lbl red">
                  ⚠ Con observaciones <span className="cnt">{withObs.length}</span>
                </p>
                <div className="guest-list">
                  {withObs.map((g) => <GuestCard key={g.id} guest={g} onEdit={openEdit} />)}
                </div>
              </>
            )}
            {normal.length > 0 && (
              <>
                <p className="section-lbl">
                  Huéspedes <span className="cnt">{normal.length}</span>
                </p>
                <div className="guest-list">
                  {normal.map((g) => <GuestCard key={g.id} guest={g} onEdit={openEdit} />)}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {modal !== 'none' && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModal('none')}>
          <div className="modal-card">
            <div className="modal-header">
              <h2 className="modal-title">
                {modal === 'create' ? '+ Nuevo huésped' : `Editar: ${editing?.fullName}`}
              </h2>
              <button className="modal-close" onClick={() => setModal('none')}>×</button>
            </div>
            <GuestForm initial={initialForm()} onSave={handleSave}
              onCancel={() => setModal('none')} saving={saving} error={formError} />
          </div>
        </div>
      )}

      {toast && <div className="toast">✓ {toast}</div>}
    </>
  );
}