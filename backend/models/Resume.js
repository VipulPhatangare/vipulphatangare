const mongoose = require('mongoose');

// One bullet / line with exactly 3 phrasing variants
const itemSchema = new mongoose.Schema({
  text: { type: String, default: '' },              // currently active text (variant or manual edit)
  variants: [{ type: String }],                     // 3 AI phrasings
  selectedVariant: { type: Number, default: 0 },
  matchScore: { type: Number, default: null },
  isVisible: { type: Boolean, default: true }       // per-bullet show/hide
}, { _id: false });

// Role-grouped entry (used by the experience section: heading = role, subheading = org | dates)
const entrySchema = new mongoose.Schema({
  heading: { type: String, default: '' },
  subheading: { type: String, default: '' },
  items: [itemSchema],
  isVisible: { type: Boolean, default: true }       // per-entry show/hide
}, { _id: false });

const sectionSchema = new mongoose.Schema({
  content: { type: String, default: '' },           // for single-block sections (summary)
  items: [itemSchema],                              // for flat bullet-based sections
  entries: [entrySchema],                           // for role-grouped sections (experience)
  isVisible: { type: Boolean, default: true },
  manuallyEdited: { type: Boolean, default: false },
  lastGeneratedAt: { type: Date, default: null }
}, { _id: false });

const skillEntrySchema = new mongoose.Schema({
  name: { type: String, required: true },
  relevance: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' }
}, { _id: false });

const skillsSectionSchema = new mongoose.Schema({
  matched: [skillEntrySchema],
  additional: [skillEntrySchema],
  isVisible: { type: Boolean, default: true },
  manuallyEdited: { type: Boolean, default: false },
  lastGeneratedAt: { type: Date, default: null }
}, { _id: false });

const projectSectionSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  title: { type: String, default: '' },
  overview: { type: String, default: '' },
  techStack: [{ type: String }],
  demoLink: { type: String, default: '' },
  codeLink: { type: String, default: '' },
  driveLink: { type: String, default: '' },
  items: [itemSchema],
  matchScore: { type: Number, default: null },
  isVisible: { type: Boolean, default: true },
  manuallyEdited: { type: Boolean, default: false },
  lastGeneratedAt: { type: Date, default: null }
}, { _id: false });

const rankingSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  title: { type: String, default: '' },
  score: { type: Number, default: 0 },
  reasoning: { type: String, default: '' },
  selected: { type: Boolean, default: false }
}, { _id: false });

const resumeSchema = new mongoose.Schema({
  company: { type: String, required: true },
  roleTitle: { type: String, required: true },
  jdText: { type: String, default: '' },
  jdHash: { type: String, default: '' },
  preferences: {
    length: { type: String, enum: ['1page', '2page'], default: '1page' },
    tone: { type: String, enum: ['formal', 'casual-confident'], default: 'formal' },
    applicantType: { type: String, enum: ['fresher', 'experienced'], default: 'fresher' },
    emphasis: { type: String, default: '' },
    template: { type: String, enum: ['classic', 'modern', 'minimal', 'compact', 'accent'], default: 'modern' },
    density: { type: String, enum: ['compact', 'comfortable'], default: 'comfortable' },
    accentColor: { type: String, default: '' },  // '' = use template default; validated/whitelisted at render time
    fontFamily: { type: String, default: '' }     // '' = use template default; must match a known font id at render time
  },
  companyResearch: { type: mongoose.Schema.Types.Mixed, default: null },  // snapshot of structured summary
  jdParsed: { type: mongoose.Schema.Types.Mixed, default: null },         // snapshot of parsed JD
  projectRanking: [rankingSchema],
  sections: {
    summary: { type: sectionSchema, default: () => ({}) },
    skills: { type: skillsSectionSchema, default: () => ({}) },
    experience: { type: sectionSchema, default: () => ({}) },
    achievements: { type: sectionSchema, default: () => ({}) },
    education: { type: sectionSchema, default: () => ({}) },
    projects: [projectSectionSchema]
  },
  sectionOrder: {
    type: [String],
    default: ['summary', 'skills', 'projects', 'experience', 'achievements', 'education']
  },
  coverLetter: {
    content: { type: String, default: '' },
    manuallyEdited: { type: Boolean, default: false },
    lastGeneratedAt: { type: Date, default: null }
  },
  status: {
    type: String,
    enum: ['intake', 'researched', 'ranked', 'generating', 'editing', 'exported'],
    default: 'intake'
  }
}, { timestamps: true, minimize: false });

resumeSchema.index({ company: 1, jdHash: 1 });

module.exports = mongoose.model('Resume', resumeSchema);
