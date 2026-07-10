#!/usr/bin/env node
/**
 * Skip API compile on Vercel — only the Next.js app deploys there.
 * Railway/Docker set VERCEL unset and run the full Nest build.
 */
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

if (process.env.VERCEL) {
  console.log('Skipping @cleartg/api build on Vercel');
  process.exit(0);
}

execSync('pnpm --filter @cleartg/database generate', { stdio: 'inherit' });
execSync('nest build', { stdio: 'inherit', cwd: join(__dirname, '..') });
