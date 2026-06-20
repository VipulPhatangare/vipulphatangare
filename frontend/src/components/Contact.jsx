import { useState } from 'react';
import api from '../api/axios.js';

const EMPTY = { name: '', phone: '', email: '', message: '' };

export default function Contact() {
  const [form, setForm]       = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [status, setStatus]   = useState(null); // { type: 'success'|'error', text }

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const { data } = await api.post('/contact', form);
      setStatus({ type: 'success', text: data.message });
      setForm(EMPTY);
    } catch (err) {
      setStatus({ type: 'error', text: err.response?.data?.error || 'Failed to send message.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="contact-section">
      <div className="contact-inner">
        <div className="contact-header">
          <span className="contact-eyebrow">Get In Touch</span>
          <h2 className="contact-title">Contact Me</h2>
          <p className="contact-sub">
            Have a project, question, or just want to say hi? Fill out the form and I'll get back to you.
          </p>
        </div>

        <form className="contact-form" onSubmit={handleSubmit} noValidate>
          <div className="contact-row">
            <div className="contact-field">
              <label>Name <span className="contact-required">*</span></label>
              <input
                type="text"
                placeholder="Your full name"
                value={form.name}
                onChange={f('name')}
                required
              />
            </div>
            <div className="contact-field">
              <label>Phone <span className="contact-required">*</span></label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={form.phone}
                onChange={f('phone')}
                required
              />
            </div>
          </div>

          <div className="contact-field">
            <label>Email <span className="contact-optional">(optional)</span></label>
            <input
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={f('email')}
            />
          </div>

          <div className="contact-field">
            <label>Message <span className="contact-required">*</span></label>
            <textarea
              rows={5}
              placeholder="Write your message here…"
              value={form.message}
              onChange={f('message')}
              required
            />
          </div>

          {status && (
            <div className={`contact-status contact-status-${status.type}`}>
              <i className={`fas ${status.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
              {status.text}
            </div>
          )}

          <button type="submit" className="contact-submit" disabled={loading}>
            {loading
              ? <><i className="fas fa-spinner fa-spin"></i> Sending…</>
              : <><i className="fas fa-paper-plane"></i> Send Message</>
            }
          </button>
        </form>

        <div className="contact-links">
          <a href="mailto:vipulphatangare@example.com" className="contact-link">
            <i className="fas fa-envelope"></i> Email
          </a>
          <a href="https://github.com/VipulPhatanagare" target="_blank" rel="noreferrer" className="contact-link">
            <i className="fab fa-github"></i> GitHub
          </a>
          <a href="https://linkedin.com/in/vipulphatangare" target="_blank" rel="noreferrer" className="contact-link">
            <i className="fab fa-linkedin"></i> LinkedIn
          </a>
        </div>
      </div>
    </section>
  );
}
