# Vipul Phatangare — Personal Portfolio

A full-stack MERN portfolio website with an admin dashboard and AI-powered agents. Built to showcase ML/AI projects and manage portfolio content dynamically.

---

## Live Features

### Portfolio (Public)

| Section | Description |
|---|---|
| **Home** | Animated typing roles, skill stats counters, tech stack display |
| **Projects** | ML/AI project showcase fetched from MongoDB |
| **Research** | Research papers and publications |
| **Study Material** | Notes and learning resources |
| **Gallery** | Certificates and achievement images |
| **Contact** | Contact form with email delivery |

**UI Extras:**
- Welcome animation on first load
- Glassmorphism design with animated gradient mesh background
- Particle canvas effect
- Custom cursor
- Scroll progress indicator
- Page wipe transitions between sections
- Magnetic nav links (desktop hover effect)
- AI chatbot floating widget (powered by Gemini)
- Easter egg: type `synthomind` anywhere on the page

---

### Admin Dashboard (`/admin`)

Protected by JWT authentication.

| Route | Feature |
|---|---|
| `/admin` | Dashboard home — overview stats |
| `/admin/portfolio` | Manage Projects, Skills, Research, Notes, Certificates, Profile |
| `/admin/chatbot` | Configure the AI chatbot system prompt |
| `/admin/apikeys` | Store and manage API keys |
| `/admin/agents` | AI Agents hub |
| `/admin/prompts` | Prompt Saver — save reusable prompts |
| `/admin/ports` | Track used ports |
| `/admin/dailynotes` | Daily journal/notes |
| `/admin/messages` | View contact form messages |

---

### AI Agents

#### Email Analyser (`/admin/agents/email`)
- Syncs Gmail inbox via IMAP (imapflow)
- Gemini AI analysis: summary, priority classification, category, deadline extraction, action items
- Priority tagging: TNP emails flagged as **high priority**
- Reply drafting with AI suggestions
- Compose & send emails via SMTP (Nodemailer)
- Auto-sync scheduler: runs every 4 hours (IST) via node-cron

#### LinkedIn Post Generator (`/admin/agents/linkedin`)
- RAG-powered: retrieves context from your portfolio knowledge base
- Generates post titles, full post bodies, and hashtag suggestions
- Multiple tone and length options
- Powered by Gemini 2.5 Flash

---

## Tech Stack

**Frontend**
- React 18 + Vite 5
- React Router DOM v6
- Axios
- Pure CSS (custom design system, ~6000 lines, no UI framework)

**Backend**
- Node.js + Express
- MongoDB Atlas + Mongoose
- JWT authentication (bcryptjs + jsonwebtoken)
- Multer (file uploads)
- node-cron (scheduled tasks)

**AI / Integrations**
- Google Gemini AI (`@google/generative-ai`)
- OpenAI SDK
- Gmail IMAP via imapflow + mailparser
- SMTP email via Nodemailer
- PDF parsing via pdf-parse

---

## Project Structure

```
vipulphatangare/
├── backend/
│   ├── models/          # Mongoose schemas (Admin, Project, Skill, Research, Note, Email, Todo...)
│   ├── routes/          # Express API routes (auth, projects, chatbot, emails, agents...)
│   ├── middleware/       # JWT auth middleware
│   ├── utils/           # emailScheduler, gmailFetcher, emailAnalyzer
│   └── server.js        # Express entry point (port 7000)
├── frontend/
│   ├── src/
│   │   ├── components/  # Portfolio sections (Home, Projects, Research, Notes, Certificates, Contact, Chatbot)
│   │   ├── admin/       # Admin dashboard pages + agents
│   │   └── api/         # Axios instance
│   └── index.html
└── uploads/             # Profile image uploads
```

---

## API Routes

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/login` | Admin login |
| GET | `/api/auth/verify` | Verify JWT |
| GET/POST | `/api/projects` | Portfolio projects |
| GET/POST | `/api/skills` | Skills |
| GET/POST | `/api/research` | Research entries |
| GET/POST | `/api/notes` | Study notes |
| GET/POST | `/api/certificates` | Gallery |
| GET/POST | `/api/achievements` | Achievements |
| GET/PUT | `/api/profile` | Profile info |
| POST | `/api/chatbot` | AI chatbot query |
| GET/POST | `/api/emails` | Email sync & management |
| POST | `/api/contact` | Contact form submission |
| GET/POST | `/api/prompts` | Saved prompts |
| GET/POST | `/api/dailynotes` | Daily notes |
| GET/POST | `/api/ports` | Port tracker |
| GET/POST | `/api/apikeys` | API key storage |
| GET/POST | `/api/agents` | Agent configurations |
| GET/POST | `/api/todos` | Todo items |

---

## Setup & Running

### Prerequisites
- Node.js 18+
- MongoDB Atlas account
- Gmail account with App Password enabled
- Google Gemini API key

### Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
PORT=7000
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_jwt_secret_key
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_gmail_app_password
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
```

Run `npm run check-config` to verify the Gemini API key is set up correctly.

```bash
npm run dev      # development with nodemon
npm start        # production
```

### Frontend

```bash
cd frontend
npm install
npm run dev      # Vite dev server
npm run build    # Production build
```

The frontend proxies API calls to `http://localhost:7000`.

---

## Environment Variables Reference

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `EMAIL_USER` | Gmail address for IMAP sync |
| `EMAIL_PASS` | Gmail App Password (not your account password) |
| `GEMINI_API_KEY` | Google Gemini API key for AI features |
| `GEMINI_MODEL` | Default Gemini model name (default: `gemini-2.5-flash`) |
| `PORT` | Backend server port (default: 7000) |

---

## Key Design Decisions

- **No UI framework** — entire design system is hand-crafted CSS with CSS variables and glassmorphism
- **JWT in localStorage** — admin auth stored client-side, verified on every admin route
- **Auto email sync** — cron job runs every 4 hours IST; skips gracefully if Gmail credentials are absent
- **RAG for LinkedIn agent** — portfolio data acts as knowledge base to prevent AI hallucination in posts

---

## Author

**Vipul Phatangare** — AI/ML Engineer  
Team SynthoMind Lead | Hackathon Winner | Research Intern
