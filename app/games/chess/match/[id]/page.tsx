import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';

import ChessMatchClient from '@/components/games/chess/ChessMatchClient';

export const dynamic = 'force-dynamic';

export default function ChessMatchPage({
  params,
}: {
  params: { id: string };
}) {
  return <ChessMatchClient matchId={params.id} />;
}
