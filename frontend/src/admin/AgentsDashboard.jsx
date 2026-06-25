import { useNavigate } from 'react-router-dom';

const AGENTS = [
  {
    id: 'linkedin',
    label: 'LinkedIn Post Generator',
    icon: 'fab fa-linkedin',
    description: 'Generate 3 short, professional LinkedIn post variants from your portfolio knowledge base. Includes hashtags and one-click copy.',
    path: '/admin/agents/linkedin',
    color: '#0077b5'
  },
  {
    id: 'email',
    label: 'Email Analyser',
    icon: 'fas fa-envelope-open-text',
    description: 'AI-powered email analysis — summarise, classify priority (TNP/College/Work), extract deadlines, generate replies, and send emails.',
    path: '/admin/agents/email',
    color: '#8b5cf6'
  }
];

export default function AgentsDashboard() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="agents-overview-header">
        <p className="agents-overview-sub">
          AI-powered agents that work with your portfolio data. Click any agent to open its workspace.
        </p>
      </div>

      <div className="agents-cards-grid">
        {AGENTS.map(agent => (
          <div
            key={agent.id}
            className="agent-card"
            onClick={() => navigate(agent.path)}
            style={{ '--agent-color': agent.color }}
          >
            <div className="agent-card-icon">
              <i className={agent.icon}></i>
            </div>
            <div className="agent-card-body">
              <h3>{agent.label}</h3>
              <p>{agent.description}</p>
            </div>
            <div className="agent-card-arrow">
              <i className="fas fa-arrow-right"></i>
            </div>
          </div>
        ))}

        {/* Placeholder for future agents */}
        <div className="agent-card agent-card-coming-soon">
          <div className="agent-card-icon">
            <i className="fas fa-plus"></i>
          </div>
          <div className="agent-card-body">
            <h3>More Agents Coming</h3>
            <p>New AI agents will appear here as they are added.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
