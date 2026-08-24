import type { FrontierSportsGame, FrontierSportsState } from '@/lib/frontier/types';
import styles from './frontier-sports-state.module.css';

function gameTime(game: FrontierSportsGame): string {
  if (game.live || game.completed) return game.status;
  const date = new Date(game.date);
  if (Number.isNaN(date.getTime())) return game.status;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function SportsStatePanel({ state }: { state: FrontierSportsState }) {
  if (state.kind === 'scoreboard') {
    return (
      <section className={styles.panel} aria-label={`${state.leagueLabel} scores and schedule`}>
        <div className={styles.panelHead}>
          <span>LIVE STATE</span>
          <span>{state.leagueLabel}</span>
        </div>
        <div className={styles.games}>
          {state.games.slice(0, 6).map((game) => (
            <div
              key={game.id}
              className={styles.game}
              data-live={game.live || undefined}
              data-favorite={game.competitors.some((team) => team.favorite) || undefined}
            >
              <div className={styles.gameState}>{gameTime(game)}</div>
              <div className={styles.teams}>
                {game.competitors.slice(0, 2).map((team) => (
                  <div key={`${game.id}-${team.id ?? team.abbreviation}`} className={styles.team} data-favorite={team.favorite || undefined}>
                    <span className={styles.abbreviation}>{team.abbreviation || team.shortName.slice(0, 3).toUpperCase()}</span>
                    <span className={styles.teamName}>{team.shortName}</span>
                    {team.record ? <span className={styles.record}>{team.record}</span> : null}
                    {team.score !== undefined ? <strong className={styles.score}>{team.score}</strong> : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className={styles.panel} aria-label={`${state.leagueLabel} standings`}>
      <div className={styles.panelHead}>
        <span>TABLE</span>
        <span>{state.leagueLabel}</span>
      </div>
      <div className={styles.table} role="table" aria-label={`${state.leagueLabel} standings table`}>
        <div className={`${styles.tableRow} ${styles.tableHeader}`} role="row">
          <span role="columnheader">#</span>
          <span role="columnheader">TEAM</span>
          <span role="columnheader">REC</span>
          <span role="columnheader">PTS</span>
        </div>
        {state.standings.slice(0, 10).map((row) => (
          <div key={`${row.rank}-${row.abbreviation}-${row.team}`} className={styles.tableRow} data-favorite={row.favorite || undefined} role="row">
            <span role="cell">{row.rank}</span>
            <span role="cell" className={styles.standingTeam}>{row.abbreviation || row.team}</span>
            <span role="cell">{row.record ?? '·'}</span>
            <strong role="cell">{row.points ?? '·'}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
