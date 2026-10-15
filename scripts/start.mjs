import { cpSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
if (!existsSync('.next/standalone/server.js')) throw new Error('Run npm run build first');
cpSync('.next/static', '.next/standalone/.next/static', { recursive: true });
if (existsSync('public')) cpSync('public', '.next/standalone/public', { recursive: true });
const child = spawn(process.execPath, ['--env-file-if-exists=.env', '.next/standalone/server.js'], {
  stdio: 'inherit',
  env: { ...process.env, HOSTNAME: '0.0.0.0', PORT: process.env.PORT || '3000' },
});
for (const event of ['SIGTERM', 'SIGINT']) process.on(event, () => child.kill(event));
child.on('exit', (code) => process.exit(code || 0));
