import { useState, useEffect } from 'react';
import api from '../api/axios.js';

export default function ManageProfile() {
  const [form, setForm] = useState({
    name: '', title: '', subtitle: '', tagline: '',
    githubUrl: '', linkedinUrl: '', instagramUrl: '', whatsappUrl: '', leetcodeUrl: '', portfolioUrl: '', footerText: '',
    email: '', phone: '', location: ''
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
          <h3 style={{ color: 'var(--primary)', marginBottom: '1rem', fontSize: '1rem' }}>Contact Info (used on resumes)</h3>
          <div className="form-group">
            <label><i className="fas fa-envelope" style={{ marginRight: 8, color: 'var(--primary)' }}></i>Email</label>
            <input value={form.email || ''} onChange={f('email')} placeholder="you@example.com" />
          </div>
          <div className="form-group">
            <label><i className="fas fa-phone" style={{ marginRight: 8, color: 'var(--primary)' }}></i>Phone</label>
            <input value={form.phone || ''} onChange={f('phone')} placeholder="+91 98765 43210" />
          </div>
          <div className="form-group">
            <label><i className="fas fa-location-dot" style={{ marginRight: 8, color: 'var(--primary)' }}></i>Location</label>
            <input value={form.location || ''} onChange={f('location')} placeholder="Pune, India" />
          </div>
          <div className="form-group">
            <label><i className="fas fa-globe" style={{ marginRight: 8, color: 'var(--primary)' }}></i>Portfolio URL</label>
            <input value={form.portfolioUrl || ''} onChange={f('portfolioUrl')} placeholder="https://vipulphatangare.cloud" />
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
          <div className="form-group">
            <label>
              <svg viewBox="0 0 24 24" width="0.9em" height="0.9em" fill="var(--primary)" style={{ marginRight: 8, verticalAlign: -1 }} xmlns="http://www.w3.org/2000/svg">
                <path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.938 5.938 0 0 0 1.271 1.818l4.277 4.193.039.038c2.248 2.165 5.852 2.133 8.063-.074l2.396-2.392c.54-.54.54-1.414.003-1.955a1.378 1.378 0 0 0-1.951-.003l-2.396 2.392a3.021 3.021 0 0 1-4.205.038l-.02-.019-4.276-4.193c-.652-.64-.972-1.469-.948-2.263a2.68 2.68 0 0 1 .066-.523 2.545 2.545 0 0 1 .619-1.164L9.13 8.114c1.058-1.134 3.204-1.27 4.43-.278l3.501 2.831c.593.48 1.461.387 1.94-.207a1.384 1.384 0 0 0-.207-1.943l-3.5-2.831c-.8-.647-1.766-1.045-2.774-1.202l2.015-2.158A1.384 1.384 0 0 0 13.483 0zm-2.866 12.815a1.38 1.38 0 0 0-1.38 1.382 1.38 1.38 0 0 0 1.38 1.382H20.79a1.38 1.38 0 0 0 1.38-1.382 1.38 1.38 0 0 0-1.38-1.382z" />
              </svg>
              LeetCode URL
            </label>
            <input value={form.leetcodeUrl} onChange={f('leetcodeUrl')} placeholder="https://leetcode.com/u/..." />
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
