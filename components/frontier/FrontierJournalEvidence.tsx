import { ExternalLink } from 'lucide-react';
import type { FrontierItem } from '@/lib/frontier/types';
import styles from './frontier-journal.module.css';

type Props = { item: FrontierItem };

export function FrontierJournalEvidence({ item }: Props) {
  const metrics = item.metrics?.filter((metric) => metric.label.trim() && metric.value.trim()).slice(0, 6) ?? [];
  const artifacts = item.artifacts?.slice(0, 6) ?? [];
  const members = item.convergence?.members.slice(0, 5) ?? [];
  const sports = item.sportsState;

  if (!metrics.length && !artifacts.length && !members.length && !sports) return null;

  return (
    <section id="frontier-evidence" className={styles.evidenceGallery} aria-label="Source evidence">
      <div className={styles.exhibitHeading}>
        <span>SOURCE MATERIAL</span>
        <span>Reported, not inferred</span>
      </div>

      {sports ? (
        <section className={styles.sportsExhibit} aria-label={sports.leagueLabel}>
          <div className={styles.exhibitLabel}>{sports.leagueLabel}</div>
          {sports.kind === 'scoreboard' ? (
            <div className={styles.scoreGrid}>
              {sports.games.slice(0, 6).map((game) => (
                <div className={styles.scoreRow} key={game.id}>
                  <div className={styles.scoreStatus}>
                    <span>{game.status}</span>
                    {game.detail ? <span>{game.detail}</span> : null}
                  </div>
                  <div className={styles.scoreTeams}>
                    {game.competitors.map((team, index) => (
                      <div className={styles.scoreTeam} key={team.id ?? team.abbreviation + index}>
                        <strong>{team.shortName}</strong>
                        <span>{team.score ?? '–'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.standingsTable} role="table" aria-label={sports.leagueLabel + ' standings'}>
              {sports.standings.slice(0, 8).map((team) => (
                <div role="row" key={team.team} className={styles.standingRow}>
                  <span role="cell">{team.rank.toString().padStart(2, '0')}</span>
                  <strong role="cell">{team.team}</strong>
                  <span role="cell">{team.record ?? (team.points === undefined ? '–' : team.points + ' pts')}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {metrics.length > 0 ? (
        <section className={styles.metricsExhibit} aria-label="Reported metrics">
          <h3 className={styles.exhibitLabel}>Reported measurements</h3>
          <dl className={styles.metricExhibitGrid}>
            {metrics.map((metric, index) => (
              <div key={metric.label + index} className={styles.metricExhibit}>
                <dt>{metric.label}</dt>
                <dd>{metric.value}</dd>
                {metric.detail ? <p>{metric.detail}</p> : null}
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {artifacts.length > 0 ? (
        <section className={styles.artifactExhibit} aria-label="Source artifacts">
          <h3 className={styles.exhibitLabel}>Technical & primary references</h3>
          <div className={styles.artifactExhibitGrid}>
            {artifacts.map((artifact, index) => (
              <div key={artifact.kind + artifact.label + index} className={styles.artifactExhibitItem}>
                <span className={styles.artifactKind}>{artifact.kind.replace(/_/g, ' ')}</span>
                {artifact.url?.startsWith('https://') ? (
                  <a href={artifact.url} target="_blank" rel="noopener noreferrer">
                    <strong>{artifact.label}</strong><ExternalLink size={13} aria-hidden="true"/>
                  </a>
                ) : <strong>{artifact.label}</strong>}
                {artifact.value ? <code>{artifact.value}</code> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {members.length > 0 ? (
        <section className={styles.convergenceExhibit} aria-label="Other sources on this topic">
          <div className={styles.convergenceHeading}>
            <h3 className={styles.exhibitLabel}>Other sources on this topic</h3>
            <span>{members.length} shown</span>
          </div>
          <div className={styles.sourceEvidenceList}>
            {members.map((member, index) => (
              <a href={member.url} key={member.id + member.url} target="_blank" rel="noopener noreferrer">
                <span className={styles.sourceEvidenceNumber}>{String(index + 1).padStart(2, '0')}</span>
                <span className={styles.sourceEvidenceBody}>
                  <span>{member.sourceLabel}</span>
                  <strong>{member.title}</strong>
                  {member.excerpt ? <small>{member.excerpt}</small> : null}
                </span>
                <ExternalLink size={14} aria-hidden="true"/>
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
