import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios.js';

// Self-contained model dropdown backed by /api/models.
//   feature: 'chatbot' | 'linkedin' | 'email' | 'resume'  → per-feature override
//            (adds a "Use global default" option)
//   feature: null/undefined                               → the global-default selector
// refreshToken: bump to force a refetch (e.g. after the global default changes,
//   so the "Use global default (…)" labels update). onSaved fires after a save.
export default function ModelSelect({ feature = null, label, hint, refreshToken = 0, onSaved }) {
  const [models, setModels] = useState([]);
  const [globalModel, setGlobalModel] = useState('');
  const [value, setValue] = useState('');
  const [status, setStatus] = useState('idle'); // idle | saving | saved | error
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const { data } = await api.get('/models');
    setModels(data.models);
    setGlobalModel(data.globalModel);
    setValue(feature ? (data.features[feature] || 'inherit') : data.globalModel);
  }, [feature]);

  useEffect(() => { load().catch(e => setErr(e.response?.data?.error || e.message)); }, [load, refreshToken]);

  const labelFor = (id) => models.find(m => m.id === id)?.label || id;

  const change = async (newVal) => {
    const prev = value;
    setValue(newVal); setStatus('saving'); setErr('');
    try {
      const body = feature ? { features: { [feature]: newVal } } : { globalModel: newVal };
      const { data } = await api.put('/models', body);
      setGlobalModel(data.globalModel);
      setStatus('saved');
      setTimeout(() => setStatus(s => (s === 'saved' ? 'idle' : s)), 2000);
      onSaved && onSaved(data);
    } catch (e) {
      setValue(prev);
      setErr(e.response?.data?.error || e.message);
      setStatus('error');
    }
  };

  return (
    <div className="model-select" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      {label && <label style={{ fontWeight: 600 }}>{label}</label>}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <select
          className="form-input"
          style={{ maxWidth: 340 }}
          value={value}
          onChange={e => change(e.target.value)}
          disabled={status === 'saving' || models.length === 0}
        >
          {feature && <option value="inherit">Use global default ({labelFor(globalModel)})</option>}
          {models.map(m => (
            <option key={m.id} value={m.id}>
              {m.label}{m.provider === 'nvidia' ? ' · NVIDIA' : m.provider === 'gemini' ? ' · Google' : ''}
            </option>
          ))}
        </select>
        <span style={{ fontSize: '0.85rem', minWidth: 70 }}>
          {status === 'saving' && <span><i className="fas fa-spinner fa-spin"></i> Saving…</span>}
          {status === 'saved' && <span style={{ color: '#22c55e' }}><i className="fas fa-check"></i> Saved</span>}
          {status === 'error' && <span style={{ color: '#ef4444' }}>{err}</span>}
        </span>
      </div>
      {hint && <span className="form-hint">{hint}</span>}
    </div>
  );
}
