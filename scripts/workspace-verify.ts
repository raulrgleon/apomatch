// Optional verification harness for containers with isolated per-command networks.
// All processes share this command's local network. Native PostgreSQL runs in CI.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { spawn } from 'node:child_process';
async function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: process.env });
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)),
    );
    child.on('error', reject);
  });
}
async function main() {
  const db = await PGlite.create('.workspace-db');
  const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 55432, maxConnections: 20 });
  await server.start();
  try {
    await run('npx', ['prisma', 'migrate', 'deploy']);
    await run('npm', ['run', 'db:seed']);
    await db.exec('DEALLOCATE ALL');
    await run('npm', ['run', 'test:integration']);
    if (process.argv.includes('--e2e')) await run('npm', ['run', 'test:e2e']);
  } finally {
    await server.stop();
    await db.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
