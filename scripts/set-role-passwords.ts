// `pnpm db:roles`: give the four Peerless roles local passwords (Story 1.2).
//
// supabase/roles.sql creates reader, ingest, derive and loader with no
// password, and nothing committed holds one. This script:
//
//   1. refuses unless SUPABASE_DB_URL points at 127.0.0.1 or localhost, so a
//      hosted database never has its passwords changed by it;
//   2. refuses unless `git check-ignore .env` confirms .env is ignored;
//   3. creates .env from .env.example if it is missing;
//   4. for each role whose URL has no password, generates one (hex from
//      crypto.randomBytes, so it is URL-safe) and writes it into .env;
//      a password already in .env is never overwritten;
//   5. applies every role's password from .env with ALTER ROLE, so a rerun
//      after `pnpm db:reset` restores the same passwords.
//
// It never prints a password. The password is sent as a SCRAM-SHA-256
// verifier computed here, so not even a server-side statement log holds it.
// Running it twice changes nothing (test/db/set-role-passwords.test.ts).
//
// Run: node scripts/set-role-passwords.ts   (from the repository root)
import { execFileSync } from 'node:child_process';
import { createHash, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';
import postgres from 'postgres';

// The fixed list. Nothing outside it is ever altered.
export const ROLES = [
  { role: 'reader', variable: 'READER_DATABASE_URL' },
  { role: 'ingest', variable: 'INGEST_DATABASE_URL' },
  { role: 'derive', variable: 'DERIVE_DATABASE_URL' },
  { role: 'loader', variable: 'LOADER_DATABASE_URL' },
] as const;

export const LOCAL_HOSTS: readonly string[] = ['127.0.0.1', 'localhost'];
const DEFAULT_SUPABASE_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

export class Refusal extends Error {}

export function isLocalUrl(url: string): boolean {
  try {
    return LOCAL_HOSTS.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

// Each role's URL must name that role on a local host, or be empty.
export function checkRoleUrl(role: string, variable: string, url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Refusal(`${variable} is not a valid URL.`);
  }
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Refusal(`${variable} is not a postgresql:// URL.`);
  }
  if (decodeURIComponent(parsed.username) !== role) {
    throw new Refusal(`${variable} must connect as role "${role}".`);
  }
  if (!LOCAL_HOSTS.includes(parsed.hostname)) {
    throw new Refusal(`${variable} must point at 127.0.0.1 or localhost.`);
  }
}

export function generatePassword(): string {
  return randomBytes(32).toString('hex');
}

// RFC 5802 / RFC 7677 verifier in the format Postgres stores in pg_authid.
// ALTER ROLE … PASSWORD with a verifier stores it as is.
export function scramVerifier(password: string, salt: Buffer = randomBytes(16)): string {
  const iterations = 4096;
  const salted = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  const clientKey = createHmac('sha256', salted).update('Client Key').digest();
  const storedKey = createHash('sha256').update(clientKey).digest();
  const serverKey = createHmac('sha256', salted).update('Server Key').digest();
  return `SCRAM-SHA-256$${iterations}:${salt.toString('base64')}$${storedKey.toString('base64')}:${serverKey.toString('base64')}`;
}

interface EnvLine {
  index: number;
  value: string;
}

// The one line defining variable, which must be exactly `VAR=value` at
// column 0. dotenv-style parsers accept other forms (`export VAR=`, spaces
// around `=`, quotes, inline `# comment`) and take the last of several lines;
// rather than guess which reading the app will use, refuse them all.
function findLine(lines: readonly string[], variable: string): EnvLine | undefined {
  const mention = new RegExp(`^\\s*(?:export\\s+)?${variable}\\s*=`);
  const indexes = lines.flatMap((line, index) => (mention.test(line) ? [index] : []));
  if (indexes.length === 0) return undefined;
  if (indexes.length > 1) throw new Refusal(`${variable} is defined on more than one line.`);
  const index = indexes[0] ?? -1;
  const line = lines[index] ?? '';
  const prefix = `${variable}=`;
  if (!line.startsWith(prefix)) {
    throw new Refusal(`${variable} must be written as ${variable}=value at the start of the line.`);
  }
  const value = line.slice(prefix.length);
  if (/[\s#]/.test(value)) {
    throw new Refusal(`${variable} must not contain whitespace or #.`);
  }
  return { index, value };
}

export interface Plan {
  content: string; // the .env to write; identical to the input when nothing changed
  passwords: { role: string; password: string; generated: boolean }[];
}

// Pure: from the current .env and .env.example, the .env to write and the
// password each role ends up with. Throws Refusal on anything unexpected.
export function planEnv(envContent: string, exampleContent: string): Plan {
  const eol = envContent.includes('\r\n') ? '\r\n' : '\n';
  const lines = envContent.split(/\r?\n/);
  const example = exampleContent.split(/\r?\n/);
  const passwords: Plan['passwords'] = [];

  for (const { role, variable } of ROLES) {
    const current = findLine(lines, variable);
    if (current !== undefined && /^["']/.test(current.value)) {
      throw new Refusal(`${variable} must be written without quotes.`);
    }
    let url = current?.value ?? '';
    if (url === '') {
      url = findLine(example, variable)?.value ?? '';
      if (url === '') throw new Refusal(`.env.example has no default for ${variable}.`);
    }
    checkRoleUrl(role, variable, url);

    const parsed = new URL(url);
    let generated = false;
    if (parsed.password === '') {
      parsed.password = generatePassword();
      generated = true;
    }
    const password = decodeURIComponent(parsed.password);
    passwords.push({ role, password, generated });

    if (generated) {
      const line = `${variable}=${parsed.toString()}`;
      if (current === undefined) {
        // Keep a trailing newline at the end of the file.
        if (lines.length > 0 && lines[lines.length - 1] === '') {
          lines.splice(lines.length - 1, 0, line);
        } else {
          lines.push(line);
        }
      } else {
        lines[current.index] = line;
      }
    }
  }
  return { content: lines.join(eol), passwords };
}

export function resolveSupabaseDbUrl(envContent: string | undefined, exampleContent: string): string {
  const fromProcess = process.env.SUPABASE_DB_URL;
  if (fromProcess !== undefined && fromProcess !== '') return fromProcess;
  const fromEnv = envContent === undefined ? undefined : parseEnv(envContent).SUPABASE_DB_URL;
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv;
  const fromExample = parseEnv(exampleContent).SUPABASE_DB_URL;
  if (fromExample !== undefined && fromExample !== '') return fromExample;
  return DEFAULT_SUPABASE_DB_URL;
}

function isGitIgnored(cwd: string, file: string): boolean {
  try {
    execFileSync('git', ['check-ignore', '--quiet', file], { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false; // exit 1 = not ignored; 128 = not a git repository
  }
}

export async function run(cwd: string): Promise<void> {
  const envPath = path.join(cwd, '.env');
  const examplePath = path.join(cwd, '.env.example');

  // 1. Local host only, before anything is written or any role touched.
  //    Reading .env here is only to find SUPABASE_DB_URL.
  if (!existsSync(examplePath)) throw new Refusal('.env.example not found; run from the repository root.');
  const exampleContent = readFileSync(examplePath, 'utf8');
  const envBefore = existsSync(envPath) ? readFileSync(envPath, 'utf8') : undefined;
  const adminUrl = resolveSupabaseDbUrl(envBefore, exampleContent);
  if (!isLocalUrl(adminUrl)) {
    throw new Refusal('SUPABASE_DB_URL must point at 127.0.0.1 or localhost; refusing to change any password.');
  }

  // 2. .env must be gitignored before a password is written into it.
  if (!isGitIgnored(cwd, '.env')) {
    throw new Refusal('.env is not gitignored (git check-ignore .env); refusing to write passwords.');
  }

  // 3.–4. Plan the new .env; throws before writing if any URL is unexpected.
  const plan = planEnv(envBefore ?? exampleContent, exampleContent);
  if (envBefore === undefined || plan.content !== envBefore) {
    writeFileSync(envPath, plan.content, 'utf8');
  }

  // 5. Apply. Statement built by format() with %I and %L; the literal is a
  //    verifier, not the password.
  const sql = postgres(adminUrl, { max: 1, onnotice: () => {} });
  try {
    for (const { role, password, generated } of plan.passwords) {
      const [row] = await sql<{ statement: string }[]>`
        select format('ALTER ROLE %I PASSWORD %L', ${role}::text, ${scramVerifier(password)}::text) as statement
      `;
      if (row === undefined) throw new Error('format() returned no row');
      await sql.unsafe(row.statement);
      console.log(`db:roles: ${role}: ${generated ? 'new password generated, written to .env and applied' : 'password from .env applied'}`);
    }
  } finally {
    await sql.end();
  }
}

async function main(): Promise<void> {
  try {
    await run(process.cwd());
  } catch (error) {
    // Messages name roles and variables only; a database error is reduced to
    // its message and code so no statement text is echoed.
    if (error instanceof Refusal) {
      console.error(`db:roles: ${error.message}`);
    } else if (error instanceof Error) {
      const code = (error as { code?: unknown }).code;
      console.error(`db:roles: failed: ${error.message}${typeof code === 'string' ? ` (${code})` : ''}`);
    } else {
      console.error('db:roles: failed.');
    }
    process.exitCode = 1;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
