import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** Завантажити .env до імпорту AppModule (pnpm dev з кореня monorepo). */
const candidates = [
  join(process.cwd(), '.env'),
  join(process.cwd(), 'apps/api/.env'),
  join(__dirname, '..', '.env'),
  join(__dirname, '..', '..', '.env'),
];

for (const filePath of candidates) {
  if (!existsSync(filePath)) continue;
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
