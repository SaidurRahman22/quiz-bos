import { DIFFICULTIES } from '../utils.js';

const LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard', mix: 'Mix' };
const ICONS = { easy: '🟢', medium: '🟡', hard: '🔴', mix: '🎲' };

// Segmented control for choosing a difficulty. `counts` (optional) shows how
// many items are available at each level and disables empty ones.
export default function DifficultyToggle({ value, onChange, counts }) {
  return (
    <div className="difficulty-toggle" role="tablist" aria-label="Difficulty">
      {DIFFICULTIES.map((d) => {
        const n = counts ? counts[d] : undefined;
        const disabled = counts && d !== 'mix' && !n;
        return (
          <button
            key={d}
            role="tab"
            aria-selected={value === d}
            className={`dt-btn ${value === d ? 'active' : ''}`}
            disabled={disabled}
            onClick={() => onChange(d)}
            title={disabled ? `No ${LABELS[d]} items` : LABELS[d]}
          >
            <span className="dt-icon">{ICONS[d]}</span>
            <span>{LABELS[d]}</span>
            {n !== undefined && <span className="dt-count">{n}</span>}
          </button>
        );
      })}
    </div>
  );
}
