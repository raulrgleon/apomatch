// Development/testing fallback for restricted workspaces without Docker.
// Uses the PostgreSQL WASM engine. CI and production use native PostgreSQL 16.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
async function main() {
  const db = await PGlite.create(process.env.PGLITE_DATA_DIR || 'memory://');
  const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 55432 });
  await server.start();
  console.log('Development PostgreSQL WASM listening on 127.0.0.1:55432');
  for (const event of ['SIGINT', 'SIGTERM'])
    process.on(event, async () => {
      await server.stop();
      await db.close();
      process.exit(0);
    });
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
