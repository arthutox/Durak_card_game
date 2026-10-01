import type { ConnectionStatus } from '../store/roomStore';

const LABELS: Record<ConnectionStatus, string> = {
  connecting: 'Connecting…',
  online: 'Online',
  offline: 'No connection to the server',
};

export function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  return (
    <span className={`connection connection-${status}`} role="status">
      <span className="connection-dot" />
      {LABELS[status]}
    </span>
  );
}
