/**
 * ORBITAL server — entry point.
 * Initializes the SQLite DB schema, then starts Express.
 */
import { createApp } from './app';
import { openDb } from './db';

const PORT = Number(process.env.ORBITAL_PORT || 8787);
const HOST = process.env.ORBITAL_HOST || '0.0.0.0';

// Ensure DB + schema exist before listening.
openDb();

const app = createApp();

app.listen(PORT, HOST, () => {
  console.log(`orbital-server listening on http://${HOST}:${PORT}`);
});
