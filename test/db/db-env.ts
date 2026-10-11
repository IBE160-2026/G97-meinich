// Connection settings for the database tests. Values come from the process
// environment first, then the repository's .env (written by `pnpm db:roles`),
// then the local Supabase CLI default.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

export const root = path.resolve(import.meta.dirname, '../..');

const DEFAULT_SUPABASE_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

function fromDotEnv(name: string): string | undefined {
  const file = path.join(root, '.env');
  if (!existsSync(file)) return undefined;
  const value = parseEnv(readFileSync(file, 'utf8'))[name];
  return value === '' ? undefined : value;
}

export function setting(name: string): string | undefined {
  const value = process.env[name];
  if (value !== undefined && value !== '') return value;
  return fromDotEnv(name);
}

export const supabaseDbUrl = (): string => setting('SUPABASE_DB_URL') ?? DEFAULT_SUPABASE_DB_URL;
