'use client';

import { useState, useEffect } from 'react';
import {
  MapPin,
  Building,
  Home,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Search,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Layers,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

interface ConfigItem {
  id: string;
  type: string;
  value: string;
  parentId: string | null;
  collegeId: string | null;
}

export default function CollegeLocationsPage() {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Selected hierarchy
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('');
  const [selectedMandalId, setSelectedMandalId] = useState<string>('');

  // Search terms
  const [districtSearch, setDistrictSearch] = useState('');
  const [mandalSearch, setMandalSearch] = useState('');
  const [villageSearch, setVillageSearch] = useState('');

  // New item inputs
  const [newDistrict, setNewDistrict] = useState('');
  const [newMandal, setNewMandal] = useState('');
  const [newVillage, setNewVillage] = useState('');

  // Inline editing state: { id, value }
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingAction, setSavingAction] = useState(false);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/config?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const all: ConfigItem[] = data.configs || [];
        setConfigs(all);

        // Pre-select first district if none selected
        const districts = all.filter(c => c.type === 'DISTRICT');
        if (districts.length > 0 && !selectedDistrictId) {
          const firstDist = districts[0].id;
          setSelectedDistrictId(firstDist);

          const mandalsForDist = all.filter(c => c.type === 'MANDAL' && c.parentId === firstDist);
          if (mandalsForDist.length > 0) {
            setSelectedMandalId(mandalsForDist[0].id);
          }
        }
      } else {
        setError('Failed to load locations.');
      }
    } catch (e) {
      console.error(e);
      setError('Error connecting to server.');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string, isErr = false) => {
    if (isErr) {
      setError(msg);
      setTimeout(() => setError(''), 4000);
    } else {
      setSuccess(msg);
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  const handleAdd = async (type: 'DISTRICT' | 'MANDAL' | 'VILLAGE', value: string, parentId?: string | null) => {
    if (!value.trim()) return;
    if (type === 'MANDAL' && !parentId) {
      showToast('Please select a parent District first.', true);
      return;
    }
    if (type === 'VILLAGE' && !parentId) {
      showToast('Please select a parent Mandal first.', true);
      return;
    }

    setSavingAction(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          value: value.trim(),
          parentId: parentId || null,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        showToast(resData.error || 'Failed to add item.', true);
      } else {
        showToast(`Added ${type.toLowerCase()} "${value.trim()}" successfully!`);
        if (type === 'DISTRICT') {
          setNewDistrict('');
          setSelectedDistrictId(resData.config.id);
        } else if (type === 'MANDAL') {
          setNewMandal('');
          setSelectedMandalId(resData.config.id);
        } else if (type === 'VILLAGE') {
          setNewVillage('');
        }
        await fetchConfigs();
      }
    } catch (e) {
      showToast('Error saving location.', true);
    } finally {
      setSavingAction(false);
    }
  };

  const handleEditSave = async (id: string) => {
    if (!editValue.trim()) return;
    setSavingAction(true);
    try {
      const res = await fetch(`/api/config/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: editValue.trim() }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        showToast(errJson.error || 'Failed to update location.', true);
      } else {
        showToast('Updated location successfully!');
        setEditingId(null);
        setEditValue('');
        await fetchConfigs();
      }
    } catch (e) {
      showToast('Error updating location.', true);
    } finally {
      setSavingAction(false);
    }
  };

  const handleDelete = async (id: string, name: string, type: string) => {
    const confirmMsg =
      type === 'DISTRICT'
        ? `Are you sure you want to delete District "${name}"?\nALL its mandals and villages will also be removed!`
        : type === 'MANDAL'
        ? `Are you sure you want to delete Mandal "${name}"?\nALL its villages will also be removed!`
        : `Are you sure you want to delete Village "${name}"?`;

    if (!window.confirm(confirmMsg)) return;

    setSavingAction(true);
    try {
      const res = await fetch(`/api/config/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errJson = await res.json();
        showToast(errJson.error || 'Failed to delete location.', true);
      } else {
        showToast(`Deleted "${name}" successfully.`);
        if (selectedDistrictId === id) setSelectedDistrictId('');
        if (selectedMandalId === id) setSelectedMandalId('');
        await fetchConfigs();
      }
    } catch (e) {
      showToast('Error deleting location.', true);
    } finally {
      setSavingAction(false);
    }
  };

  // Filtered lists
  const allDistricts = configs.filter(c => c.type === 'DISTRICT');
  const filteredDistricts = allDistricts.filter(d =>
    d.value.toLowerCase().includes(districtSearch.toLowerCase().trim())
  );

  const allMandalsForSelectedDistrict = selectedDistrictId
    ? configs.filter(c => c.type === 'MANDAL' && c.parentId === selectedDistrictId)
    : [];
  const filteredMandals = allMandalsForSelectedDistrict.filter(m =>
    m.value.toLowerCase().includes(mandalSearch.toLowerCase().trim())
  );

  const allVillagesForSelectedMandal = selectedMandalId
    ? configs.filter(c => c.type === 'VILLAGE' && c.parentId === selectedMandalId)
    : [];
  const filteredVillages = allVillagesForSelectedMandal.filter(v =>
    v.value.toLowerCase().includes(villageSearch.toLowerCase().trim())
  );

  const selectedDistrict = allDistricts.find(d => d.id === selectedDistrictId);
  const selectedMandal = allMandalsForSelectedDistrict.find(m => m.id === selectedMandalId);

  return (
    <div style={{ maxWidth: '1320px', margin: '0 auto', paddingBottom: '4rem' }}>
      {/* 1. Header & Context */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.75rem',
          backgroundColor: '#ffffff',
          padding: '1.25rem 1.75rem',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.65rem', fontWeight: 800, color: '#0F2B47', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <MapPin size={28} color="#047857" /> Locations & Geography
            </h1>
            <span
              style={{
                backgroundColor: '#ecfdf5',
                color: '#047857',
                padding: '0.25rem 0.75rem',
                borderRadius: '20px',
                fontSize: '0.78rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                border: '1px solid #bbf7d0',
              }}
            >
              <ShieldCheck size={14} /> College Scope
            </span>
          </div>
          <p style={{ margin: '0.35rem 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
            Configure your college's Districts, Mandals, and Villages. This data is private to your college and available to your AGMs, Field Staff, and Telecallers.
          </p>
        </div>

        <button
          onClick={fetchConfigs}
          disabled={loading || savingAction}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.6rem 1.1rem',
            backgroundColor: '#f1f5f9',
            color: '#334155',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          <RefreshCw size={15} className={loading ? 'spin-animation' : ''} />
          Refresh
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{ padding: '0.85rem 1.25rem', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '10px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {success && (
        <div style={{ padding: '0.85rem 1.25rem', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '10px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
          <CheckCircle2 size={18} /> {success}
        </div>
      )}

      {/* 2. Three-Column Hierarchical Workspace */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.25rem',
          alignItems: 'start',
        }}
      >
        {/* COLUMN 1: DISTRICTS */}
        <div
          className="card"
          style={{
            padding: '1.25rem',
            borderTop: '4px solid #047857',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '620px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0F2B47', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Layers size={18} color="#047857" /> 1. Districts
            </h2>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, background: '#dcfce7', color: '#166534', padding: '0.2rem 0.55rem', borderRadius: '12px' }}>
              {allDistricts.length} total
            </span>
          </div>

          <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: '#64748b' }}>
            Click a district to view and manage its mandals.
          </p>

          {/* Add District Input */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              type="text"
              className="form-control"
              placeholder="New District name..."
              value={newDistrict}
              onChange={e => setNewDistrict(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd('DISTRICT', newDistrict)}
              disabled={savingAction}
              style={{ fontSize: '0.88rem' }}
            />
            <button
              onClick={() => handleAdd('DISTRICT', newDistrict)}
              disabled={savingAction || !newDistrict.trim()}
              style={{
                backgroundColor: '#047857',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.5rem 0.85rem',
                cursor: !newDistrict.trim() ? 'not-allowed' : 'pointer',
                opacity: !newDistrict.trim() ? 0.6 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              <Plus size={16} /> Add
            </button>
          </div>

          {/* Search Filter */}
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search districts..."
              value={districtSearch}
              onChange={e => setDistrictSearch(e.target.value)}
              style={{ paddingLeft: '2rem', fontSize: '0.82rem', height: '36px' }}
            />
          </div>

          {/* Districts List */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '420px', paddingRight: '2px' }}>
            {filteredDistricts.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                No districts found. Add a district above.
              </div>
            ) : (
              filteredDistricts.map(d => {
                const isSelected = selectedDistrictId === d.id;
                const isEditing = editingId === d.id;

                if (isEditing) {
                  return (
                    <div
                      key={d.id}
                      style={{
                        padding: '0.5rem',
                        backgroundColor: '#f8fafc',
                        border: '1.5px solid #047857',
                        borderRadius: '8px',
                        display: 'flex',
                        gap: '0.4rem',
                        alignItems: 'center',
                      }}
                    >
                      <input
                        type="text"
                        className="form-control"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleEditSave(d.id)}
                        autoFocus
                        style={{ fontSize: '0.85rem', height: '32px' }}
                      />
                      <button
                        onClick={() => handleEditSave(d.id)}
                        disabled={savingAction}
                        style={{ background: '#047857', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.35rem 0.5rem', cursor: 'pointer' }}
                        title="Save rename"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        style={{ background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '6px', padding: '0.35rem 0.5rem', cursor: 'pointer' }}
                        title="Cancel"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={d.id}
                    onClick={() => {
                      setSelectedDistrictId(d.id);
                      // Auto-select first mandal of this district if available
                      const childMandals = configs.filter(c => c.type === 'MANDAL' && c.parentId === d.id);
                      setSelectedMandalId(childMandals.length > 0 ? childMandals[0].id : '');
                    }}
                    style={{
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: isSelected ? '1.5px solid #047857' : '1px solid #e2e8f0',
                      backgroundColor: isSelected ? '#f0fdf4' : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: isSelected ? 700 : 500, fontSize: '0.9rem', color: isSelected ? '#047857' : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {d.value}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setEditingId(d.id);
                          setEditValue(d.value);
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.2rem' }}
                        title="Rename District"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(d.id, d.value, 'DISTRICT')}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem' }}
                        title="Delete District"
                      >
                        <Trash2 size={14} />
                      </button>
                      {isSelected && <ChevronRight size={16} color="#047857" style={{ marginLeft: '0.2rem' }} />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUMN 2: MANDALS */}
        <div
          className="card"
          style={{
            padding: '1.25rem',
            borderTop: '4px solid #2563eb',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '620px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0F2B47', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Building size={18} color="#2563eb" /> 2. Mandals
            </h2>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, background: '#dbeafe', color: '#1e40af', padding: '0.2rem 0.55rem', borderRadius: '12px' }}>
              {allMandalsForSelectedDistrict.length} mandals
            </span>
          </div>

          <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: '#64748b' }}>
            {selectedDistrict ? (
              <span>Mandals in <strong>{selectedDistrict.value}</strong></span>
            ) : (
              <span style={{ color: '#ef4444' }}>Please select a district from left first</span>
            )}
          </p>

          {/* Add Mandal Input */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              type="text"
              className="form-control"
              placeholder={selectedDistrict ? `New Mandal in ${selectedDistrict.value}...` : 'Select a District first'}
              value={newMandal}
              onChange={e => setNewMandal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd('MANDAL', newMandal, selectedDistrictId)}
              disabled={savingAction || !selectedDistrictId}
              style={{ fontSize: '0.88rem' }}
            />
            <button
              onClick={() => handleAdd('MANDAL', newMandal, selectedDistrictId)}
              disabled={savingAction || !selectedDistrictId || !newMandal.trim()}
              style={{
                backgroundColor: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.5rem 0.85rem',
                cursor: (!selectedDistrictId || !newMandal.trim()) ? 'not-allowed' : 'pointer',
                opacity: (!selectedDistrictId || !newMandal.trim()) ? 0.6 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              <Plus size={16} /> Add
            </button>
          </div>

          {/* Search Filter */}
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search mandals..."
              value={mandalSearch}
              onChange={e => setMandalSearch(e.target.value)}
              disabled={!selectedDistrictId}
              style={{ paddingLeft: '2rem', fontSize: '0.82rem', height: '36px' }}
            />
          </div>

          {/* Mandals List */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '420px', paddingRight: '2px' }}>
            {!selectedDistrictId ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                Select a District from the left column to view Mandals.
              </div>
            ) : filteredMandals.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                No mandals found in {selectedDistrict?.value}. Add one above.
              </div>
            ) : (
              filteredMandals.map(m => {
                const isSelected = selectedMandalId === m.id;
                const isEditing = editingId === m.id;

                if (isEditing) {
                  return (
                    <div
                      key={m.id}
                      style={{
                        padding: '0.5rem',
                        backgroundColor: '#f8fafc',
                        border: '1.5px solid #2563eb',
                        borderRadius: '8px',
                        display: 'flex',
                        gap: '0.4rem',
                        alignItems: 'center',
                      }}
                    >
                      <input
                        type="text"
                        className="form-control"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleEditSave(m.id)}
                        autoFocus
                        style={{ fontSize: '0.85rem', height: '32px' }}
                      />
                      <button
                        onClick={() => handleEditSave(m.id)}
                        disabled={savingAction}
                        style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.35rem 0.5rem', cursor: 'pointer' }}
                        title="Save rename"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        style={{ background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '6px', padding: '0.35rem 0.5rem', cursor: 'pointer' }}
                        title="Cancel"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMandalId(m.id)}
                    style={{
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: isSelected ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                      backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: isSelected ? 700 : 500, fontSize: '0.9rem', color: isSelected ? '#2563eb' : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.value}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setEditingId(m.id);
                          setEditValue(m.value);
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.2rem' }}
                        title="Rename Mandal"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(m.id, m.value, 'MANDAL')}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem' }}
                        title="Delete Mandal"
                      >
                        <Trash2 size={14} />
                      </button>
                      {isSelected && <ChevronRight size={16} color="#2563eb" style={{ marginLeft: '0.2rem' }} />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUMN 3: VILLAGES / HABITATIONS */}
        <div
          className="card"
          style={{
            padding: '1.25rem',
            borderTop: '4px solid #7c3aed',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '620px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0F2B47', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Home size={18} color="#7c3aed" /> 3. Villages / Habitations
            </h2>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, background: '#ede9fe', color: '#5b21b6', padding: '0.2rem 0.55rem', borderRadius: '12px' }}>
              {allVillagesForSelectedMandal.length} villages
            </span>
          </div>

          <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: '#64748b' }}>
            {selectedMandal ? (
              <span>Villages in <strong>{selectedMandal.value}</strong></span>
            ) : (
              <span style={{ color: '#ef4444' }}>Please select a mandal from middle first</span>
            )}
          </p>

          {/* Add Village Input */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              type="text"
              className="form-control"
              placeholder={selectedMandal ? `New Village in ${selectedMandal.value}...` : 'Select a Mandal first'}
              value={newVillage}
              onChange={e => setNewVillage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd('VILLAGE', newVillage, selectedMandalId)}
              disabled={savingAction || !selectedMandalId}
              style={{ fontSize: '0.88rem' }}
            />
            <button
              onClick={() => handleAdd('VILLAGE', newVillage, selectedMandalId)}
              disabled={savingAction || !selectedMandalId || !newVillage.trim()}
              style={{
                backgroundColor: '#7c3aed',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.5rem 0.85rem',
                cursor: (!selectedMandalId || !newVillage.trim()) ? 'not-allowed' : 'pointer',
                opacity: (!selectedMandalId || !newVillage.trim()) ? 0.6 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              <Plus size={16} /> Add
            </button>
          </div>

          {/* Search Filter */}
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search villages..."
              value={villageSearch}
              onChange={e => setVillageSearch(e.target.value)}
              disabled={!selectedMandalId}
              style={{ paddingLeft: '2rem', fontSize: '0.82rem', height: '36px' }}
            />
          </div>

          {/* Villages List */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '420px', paddingRight: '2px' }}>
            {!selectedMandalId ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                Select a Mandal from the middle column to view Villages.
              </div>
            ) : filteredVillages.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                No villages found in {selectedMandal?.value}. Add one above.
              </div>
            ) : (
              filteredVillages.map(v => {
                const isEditing = editingId === v.id;

                if (isEditing) {
                  return (
                    <div
                      key={v.id}
                      style={{
                        padding: '0.5rem',
                        backgroundColor: '#f8fafc',
                        border: '1.5px solid #7c3aed',
                        borderRadius: '8px',
                        display: 'flex',
                        gap: '0.4rem',
                        alignItems: 'center',
                      }}
                    >
                      <input
                        type="text"
                        className="form-control"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleEditSave(v.id)}
                        autoFocus
                        style={{ fontSize: '0.85rem', height: '32px' }}
                      />
                      <button
                        onClick={() => handleEditSave(v.id)}
                        disabled={savingAction}
                        style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.35rem 0.5rem', cursor: 'pointer' }}
                        title="Save rename"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        style={{ background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '6px', padding: '0.35rem 0.5rem', cursor: 'pointer' }}
                        title="Cancel"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={v.id}
                    style={{
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontWeight: 500, fontSize: '0.9rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {v.value}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <button
                        onClick={() => {
                          setEditingId(v.id);
                          setEditValue(v.value);
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.2rem' }}
                        title="Rename Village"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(v.id, v.value, 'VILLAGE')}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem' }}
                        title="Delete Village"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
