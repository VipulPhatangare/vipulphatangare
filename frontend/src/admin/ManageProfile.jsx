import { useState, useEffect } from 'react';
import api from '../api/axios.js';

export default function ManageProfile() {
  const [form, setForm] = useState({
    name: '', title: '', subtitle: '', tagline: '',
    githubUrl: '', linkedinUrl: '', instagramUrl: '', whatsappUrl: '', footerText: ''
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get('/profile')
      .then(r => setForm(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      await api.put('/profile', form);
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save profile.');
    } finally { setSaving(false); }
  };

  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  return (
    <div style={{ maxWidth: 700 }}>
      <p style={{ color: 'rgba(240,244,248,0.6)', marginBottom: '1.5rem' }}>
        Update your portfolio profile information, bio, and social links.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ background: 'var(--darker)', border: '1px solid var(--gray)', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ color: 'var(--primary)', marginBottom: '1rem', fontSize: '1rem' }}>Personal Info</h3>
          <div className="form-group">
            <label>Full Name</label>
            <input value={form.name} onChange={f('name')} placeholder="Vipul Phatangare" />
          </div>
          <div className="form-group">
            <label>Title (shown in sidebar)</label>
            <input value={form.title} onChange={f('title')} placeholder="AI/ML Engineer" />
          </div>
          <div className="form-group">
            <label>Subtitle (shown below name)</label>
            <input value={form.subtitle} onChange={f('subtitle')} placeholder="Aspiring AI/ML Engineer" />
          </div>
          <div className="form-group">
            <label>Bio / Tagline</label>
            <textarea value={form.tagline} onChange={f('tagline')} rows={5} placeholder="Write your bio here..." />
          </div>
          <div className="form-group">
            <label>Footer Text</label>
            <input value={form.footerText} onChange={f('footerText')} placeholder="© 2026 Vipul Phatangare. All rights reserved." />
          </div>
        </div>

        <div style={{ background: 'var(--darker)', border: '1px solid var(--gray)', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ color: 'var(--primary)', marginBottom: '1rem', fontSize: '1rem' }}>Social Links</h3>
          <div className="form-group">
            <label><i className="fab fa-github" style={{ marginRight: 8, color: 'var(--primary)' }}></i>GitHub URL</label>
            <input value={form.githubUrl} onChange={f('githubUrl')} placeholder="https://github.com/..." />
          </div>
          <div className="form-group">
            <label><i className="fab fa-linkedin" style={{ marginRight: 8, color: 'var(--primary)' }}></i>LinkedIn URL</label>
            <input value={form.linkedinUrl} onChange={f('linkedinUrl')} placeholder="https://linkedin.com/in/..." />
          </div>
          <div className="form-group">
            <label><i className="fab fa-instagram" style={{ marginRight: 8, color: 'var(--primary)' }}></i>Instagram URL</label>
            <input value={form.instagramUrl} onChange={f('instagramUrl')} placeholder="https://instagram.com/..." />
          </div>
          <div className="form-group">
            <label><i className="fab fa-whatsapp" style={{ marginRight: 8, color: 'var(--primary)' }}></i>WhatsApp URL</label>
            <input value={form.whatsappUrl} onChange={f('whatsappUrl')} placeholder="https://wa.me/+91..." />
          </div>
        </div>

        {error && <p className="error-msg">{error}</p>}
        {success && <p className="success-msg">{success}</p>}

        <button type="submit" className="btn-primary-full" disabled={saving}>
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
}
