'use client';

import { accentRotation, lobbyTheme } from '@/components/games/shell/theme';
import CreatePrivateButton from './CreatePrivateButton';
import QueueRow from './QueueRow';

export interface QueueMode {
  key: 'blitz' | 'rapid';
  title: string;
  subtitle: string;
}

const DEFAULT_QUEUES: QueueMode[] = [
  { key: 'blitz', title: 'Blitz 5+0', subtitle: '1v1 · 5-minute clock · rated' },
  { key: 'rapid', title: 'Rapid 10+0', subtitle: '1v1 · 10-minute clock · rated' },
];

export default function ArenaTab({
  queues = DEFAULT_QUEUES,
  onCreatePrivate,
  onJoinQueue,
}: {
  queues?: QueueMode[];
  onCreatePrivate: () => void;
  onJoinQueue: (q: QueueMode) => void;
}) {
  return (
    <div className="flex flex-col gap-4 px-5 pb-32 pt-5">
      <CreatePrivateButton onClick={onCreatePrivate} />

      <div
        className="text-sm font-medium"
        style={{ color: lobbyTheme.textMuted }}
      >
        Matchmaking Queues
      </div>

      <div className="flex flex-col gap-2">
        {queues.map((q, i) => (
          <QueueRow
            key={q.key}
            title={q.title}
            subtitle={q.subtitle}
            borderColor={accentRotation[i % accentRotation.length]}
            onJoin={() => onJoinQueue(q)}
          />
        ))}
      </div>
    </div>
  );
}
