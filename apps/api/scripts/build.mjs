#!/usr/bin/env node
/**
 * Skip API compile on Vercel — only the Next.js app deploys there.
 * Railway/Docker set VERCEL unset and run the full Nest build.
 */
if (process.env.VERCEL) {
  console.log('Skipping @cleartg/api build on Vercel');
  process.exit(0);
}

const { execSync } = require('child_process');

execSync('pnpm --filter @cleartg/database generate', { stdio: 'inherit' });
execSync('nest build', { stdio: 'inherit', cwd: require('path').join(__dirname, '..') });
