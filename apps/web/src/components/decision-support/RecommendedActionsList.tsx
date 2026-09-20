import { ActionPriority, type RecommendedAction } from '@grid-up/shared';

const PRIORITY_CLASS: Record<ActionPriority, string> = {
  [ActionPriority.URGENT]: 'status-critical',
  [ActionPriority.PROMPT]: 'status-high',
  [ActionPriority.ROUTINE]: 'status-normal',
};

/** Asama 9 madde 7-10: deterministic, inspection-oriented recommended actions. */
export function RecommendedActionsList({ actions }: { actions?: RecommendedAction[] }) {
  const list = actions ?? [];

  return (
    <div className="recommended-actions">
      {list.length === 0 ? (
        <p className="empty-hint">No inspection actions recommended right now.</p>
      ) : (
        <ul className="recommended-actions-list">
          {list.map((action, index) => (
            <li key={`${action.source}-${index}`} className="recommended-action-row">
              <span className={`severity-pill ${PRIORITY_CLASS[action.priority]}`}>{action.priority}</span>
              <span className="recommended-action-message">{action.message}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="recommended-actions-note">
        Inspection guidance only. Follow authorized electrical safety procedures.
      </p>
    </div>
  );
}
