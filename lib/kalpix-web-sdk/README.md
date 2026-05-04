# kalpix-web-sdk

TypeScript port of the parts of `kalpix_sdk` (Dart) that the kalpsite webview
games need. Mirrors `kalpix-backend/internal/protocol/messages.go` envelope
shapes and the existing RPC surface (game/get_catalog, game/get_leaderboard,
matchmaker_add, match_join, match_data, etc.) so chess, future webview games,
and standalone web sessions all use the same protocol the Flutter client uses.

## Layout

| File | Purpose |
| --- | --- |
| `types.ts` | Wire envelope and payload types mirrored from the Go protocol. |
| `config.ts` | Host/port/SSL config + URL builders (`/api/v1/<fn>`, `/ws?token=`). |
| `errors.ts` | `KalpixError`, `KalpixSessionExpiredError`, `KalpixSocketError`. |
| `auth.ts` | `SessionStore`, URL fragment consumer, Flutter `kalpix_refresh_token` bridge. |
| `socket.ts` | `KalpixSocket` — connect, reconnect (1s→30s), CID-correlated requests, RPC, match data/state/presence streams. |
| `rpc.ts` | `KalpixHttp` — POST `/api/v1/<fn>` with bearer, auto-retry on 401. |
| `matchmaker.ts` | `findMatch(...)` helper with the Tero-style 5s bot fallback. |
| `match.ts` | `joinMatch(...)` returning a typed `MatchSession` filtered to one match id. |
| `games.ts` | `GameApi` — typed wrappers over `game/get_catalog`, leaderboard, rules, stats, store. |
| `index.ts` | `KalpixClient` singleton wiring everything together. |

## Usage (inside the chess webview page)

```ts
import { KalpixClient, GameApi, joinMatch, findMatch, decodeJsonBytes } from '@/lib/kalpix-web-sdk';

const client = new KalpixClient({
  config: { host: 'api.kalpixgames.com' },
});
await client.connect();

const games = new GameApi(client.http);
const stats = await games.getPlayerStats('chess');

const handle = findMatch(client.socket, {
  minCount: 2,
  maxCount: 2,
  query: '+properties.timeControl:blitz +properties.rated:true',
  stringProperties: { timeControl: 'blitz', rated: 'true' },
  numericProperties: { rating: stats.gameSpecific.rating as number ?? 1200 },
  timeoutMs: 5_000,
  async onTimeout() {
    const { matchId } = await client.socket.rpc<{ matchId: string }>(
      'find_or_create_chess_match', { timeControl: 'blitz', allowBot: true });
    await client.socket.rpc('add_bot_to_chess_match', { matchId, difficulty: 3 });
    return { ticket: '', match_id: matchId };
  },
});

const matched = await handle.result;
if (!matched) throw new Error('No match');

const session = await joinMatch(client.socket, matched.match_id);
session.onState((s) => render(decodeJsonBytes<ChessState>(s.state)));
session.send(1, { from: 'e2', to: 'e4' }); // OP_MOVE
```

## Token delivery from Flutter

`ChessWebViewPage` should load:

```
https://kalpsite.com/games/chess#token=<jwt>&uid=<userId>
```

`consumeUrlFragment` (called by `new KalpixClient(...)`) reads the fragment,
populates the session store, then `history.replaceState`s it away so the JWT
does not survive in webview history.

For 401s the SDK calls `window.flutter_inappwebview.callHandler('kalpix_refresh_token')`,
which the Flutter `ChessWebViewPage` registers and answers with a fresh token
from `KalpixClientManager.I.refresh()`.
