import ChessReplayClient from '@/components/games/chess/ChessReplayClient';

export default function ChessReplayPage({
  params,
}: {
  params: { id: string };
}) {
  return <ChessReplayClient matchId={params.id} />;
}
