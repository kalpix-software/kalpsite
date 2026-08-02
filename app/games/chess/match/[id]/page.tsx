import ChessMatchClient from '@/components/games/chess/ChessMatchClient';

export const dynamic = 'force-dynamic';

export default function ChessMatchPage({
  params,
}: {
  params: { id: string };
}) {
  return <ChessMatchClient matchId={params.id} />;
}
