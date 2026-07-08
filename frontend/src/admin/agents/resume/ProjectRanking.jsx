import { useState } from 'react';

function ScoreBadge({ score }) {
  const cls = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
  return <span className={`ra-score-badge ra-score-${cls}`}>{score}</span>;
}

function ResearchSummary({ resume, meta }) {
  const cr = resume.companyResearch;
  const jd = resume.jdParsed;
  return (
    <div className="ra-research-grid">
      <div className="ra-research-card">
        <h4>
          <i className="fas fa-building"></i> {resume.company}
          {meta?.companyFromCache && <span className="ra-cache-badge">from cache</span>}
        </h4>
        {cr ? (
          <>
            {cr.industry && <p><strong>Industry:</strong> {cr.industry}</p>}
            {cr.overview && <p>{cr.overview}</p>}
            {cr.techStack?.length > 0 && (
              <div className="ra-chip-row">{cr.techStack.map((t, i) => <span key={i} className="ra-chip">{t}</span>)}</div>
            )}
            {cr.culture && <p className="ra-muted">{cr.culture}</p>}
          </>
        ) : (
          <p className="ra-muted">{meta?.companyWarning || 'Company research unavailable — generating from JD only.'}</p>
        )}
      </div>
      <div className="ra-research-card">
        <h4>
          <i className="fas fa-file-lines"></i> Parsed JD
          {meta?.jdFromCache && <span className="ra-cache-badge">from cache</span>}
        </h4>
        {jd?.roleSummary && <p>{jd.roleSummary}</p>}
        {jd?.seniorityLevel && <p><strong>Seniority:</strong> {jd.seniorityLevel}</p>}
        {jd?.requiredSkills?.length > 0 && (
          <div className="ra-chip-row">
            {jd.requiredSkills.map((s, i) => <span key={i} className="ra-chip ra-chip-required">{s}</span>)}
            {(jd.niceToHaveSkills || []).map((s, i) => <span key={`n${i}`} className="ra-chip">{s}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProjectRanking({ resume, meta, onRank, onConfirm, ranking, confirming }) {
  const ranked = resume.projectRanking || [];
  const [selected, setSelected] = useState(() => new Set(
    ranked.filter(r => r.selected || r.score >= 60).map(r => String(r.projectId))
  ));

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <div className="ra-ranking">
      <ResearchSummary resume={resume} meta={meta} />

      {ranked.length === 0 ? (
        <div className="ra-center-block">
          <button className="ra-primary-btn" onClick={onRank} disabled={ranking}>
            {ranking ? (<><i className="fas fa-spinner fa-spin"></i> Scoring projects against the JD…</>)
                     : (<><i className="fas fa-ranking-star"></i> Rank my projects for this job</>)}
          </button>
        </div>
      ) : (
        <>
          <h4 className="ra-subheading">Select projects to include ({selected.size} selected)</h4>
          <div className="ra-rank-list">
            {ranked.map(r => {
              const id = String(r.projectId);
              return (
                <label key={id} className={`ra-rank-item${selected.has(id) ? ' selected' : ''}`}>
                  <input type="checkbox" checked={selected.has(id)} onChange={() => toggle(id)} />
                  <ScoreBadge score={r.score} />
                  <div className="ra-rank-body">
                    <span className="ra-rank-title">{r.title}</span>
                    <span className="ra-rank-reason">{r.reasoning}</span>
                  </div>
                </label>
              );
            })}
          </div>
          <button className="ra-primary-btn" disabled={selected.size === 0 || confirming}
            onClick={() => onConfirm([...selected])}>
            {confirming ? (<><i className="fas fa-spinner fa-spin"></i> Setting up editor…</>)
                        : (<><i className="fas fa-pen-ruler"></i> Continue to editor with {selected.size} project{selected.size !== 1 ? 's' : ''}</>)}
          </button>
        </>
      )}
    </div>
  );
}
