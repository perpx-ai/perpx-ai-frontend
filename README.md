# PerpX App

Trading interface for PerpX, built on the GMX interface.

## Setup

```bash
# create .env with the VITE_* variables below
yarn install
yarn start             # dev server on http://localhost:3010
yarn build             # production build to ./build
```

All deployment-specific settings (backend URL, links, keys) come from `VITE_*`
variables, read in `src/config/perpx.ts` and `src/config/env.ts`:
VITE_BACKEND_URL, VITE_ARENA_GRAPHQL_URI, VITE_APP_URL, VITE_APP_UI_FEE_RECEIVER,
VITE_APP_ALCHEMY_KEY, VITE_WALLET_CONNECT_PROJECT_ID, VITE_STAKING_URL,
VITE_TELEGRAM_COMMUNITY_URL, VITE_X_URL, VITE_TELEGRAM_BOT_USERNAME,
VITE_DEV_MODE, VITE_LOCAL_MODE. Every `VITE_*` value is
bundled into the public JavaScript, so never put server-side secrets in `.env`.

## License

Derived from the GMX Interface, licensed under the Business Source License 1.1 —
see [LICENSE](LICENSE).
