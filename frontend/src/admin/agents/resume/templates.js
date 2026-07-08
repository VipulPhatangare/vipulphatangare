// Resume template presets — mirrors backend utils/resumeRenderer.js TEMPLATES.
// Preview uses web-safe font fallbacks; the exported PDF uses the print fonts.
export const RESUME_TEMPLATES = [
  { id: 'modern',  label: 'Modern',  accent: '#1a4fa0', font: "'Segoe UI', 'Calibri', system-ui, sans-serif", heading: 'bar',   nameAccent: false, desc: 'Blue accent, left-bar headings' },
  { id: 'classic', label: 'Classic', accent: '#1a1a1a', font: "Georgia, 'Times New Roman', serif",             heading: 'rule',  nameAccent: false, desc: 'Serif, ruled headings' },
  { id: 'minimal', label: 'Minimal', accent: '#333333', font: "'Helvetica Neue', Arial, sans-serif",           heading: 'plain', nameAccent: false, desc: 'Airy, no rules, wide spacing' },
  { id: 'compact', label: 'Compact', accent: '#1a1a1a', font: "'Calibri', Arial, sans-serif",                  heading: 'rule',  nameAccent: false, desc: 'Dense — fits more on a page' },
  { id: 'accent',  label: 'Accent',  accent: '#0f766e', font: "'Segoe UI', 'Calibri', system-ui, sans-serif",  heading: 'band',  nameAccent: true,  desc: 'Teal banded headings' },
];

export const templateById = (id) => RESUME_TEMPLATES.find(t => t.id === id) || RESUME_TEMPLATES[0];

// Font ids MUST match backend utils/resumeRenderer.js FONT_STACKS exactly — the id is
// what gets stored in preferences.fontFamily; the backend whitelists ids, never raw CSS.
export const FONT_OPTIONS = [
  { id: 'calibri',   label: 'Calibri',        css: "'Calibri', 'Segoe UI', sans-serif",   kind: 'Sans-serif' },
  { id: 'helvetica', label: 'Helvetica Neue', css: "'Helvetica Neue', Arial, sans-serif", kind: 'Sans-serif' },
  { id: 'verdana',   label: 'Verdana',        css: "Verdana, Geneva, sans-serif",         kind: 'Sans-serif' },
  { id: 'trebuchet', label: 'Trebuchet MS',   css: "'Trebuchet MS', sans-serif",          kind: 'Sans-serif' },
  { id: 'georgia',   label: 'Georgia',        css: "Georgia, 'Times New Roman', serif",   kind: 'Serif' },
  { id: 'cambria',   label: 'Cambria',        css: "Cambria, Georgia, serif",             kind: 'Serif' },
  { id: 'garamond',  label: 'Garamond',       css: "'Garamond', 'EB Garamond', serif",    kind: 'Serif' },
  { id: 'times',     label: 'Times New Roman', css: "'Times New Roman', Times, serif",    kind: 'Serif' },
];

export const fontCssById = (id) => FONT_OPTIONS.find(f => f.id === id)?.css || '';

// Curated professional accent colors + the option to pick a custom hex.
export const COLOR_PRESETS = [
  { id: 'blue',    hex: '#1a4fa0', label: 'Blue' },
  { id: 'teal',    hex: '#0f766e', label: 'Teal' },
  { id: 'charcoal',hex: '#1a1a1a', label: 'Charcoal' },
  { id: 'burgundy',hex: '#7c2d3c', label: 'Burgundy' },
  { id: 'forest',  hex: '#1e5631', label: 'Forest' },
  { id: 'slate',   hex: '#334155', label: 'Slate' },
  { id: 'purple',  hex: '#5b21b6', label: 'Purple' },
  { id: 'amber',   hex: '#92400e', label: 'Amber' },
];
