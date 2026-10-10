// All DDL lives in supabase/migrations (Story 1.2; AGENTS.md). The one
// exception is CREATE ROLE in supabase/roles.sql, which the Supabase CLI
// applies before the migrations. Neither holds a password.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { listRepositoryFiles } from '../scripts/check-no-public-env.ts';

const root = path.resolve(import.meta.dirname, '..');
const ROLES_FILE = 'supabase/roles.sql';
const MIGRATIONS = 'supabase/migrations/';

const DDL =
  /\b(?:CREATE|ALTER|DROP)\s+(?:OR\s+REPLACE\s+)?(?:UNIQUE\s+)?(?:TEMP(?:ORARY)?\s+)?(?:TABLE|SCHEMA|VIEW|MATERIALIZED\s+VIEW|INDEX|FUNCTION|PROCEDURE|TRIGGER|ROLE|USER|GROUP|EXTENSION|TYPE|SEQUENCE|POLICY|DOMAIN|DATABASE|PUBLICATION|SUBSCRIPTION|RULE|AGGREGATE|OPERATOR|DEFAULT\s+PRIVILEGES)\b/i;

// SQL with -- line comments and /* */ block comments removed.
function stripComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

const sqlFiles = listRepositoryFiles(root).filter((file) => file.endsWith('.sql'));
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('DDL placement', () => {
  it('finds the roles file and at least one migration', () => {
    expect(sqlFiles).toContain(ROLES_FILE);
    expect(sqlFiles.some((file) => file.startsWith(MIGRATIONS))).toBe(true);
  });

  it('has no DDL in a .sql file outside supabase/migrations, except roles.sql', () => {
    const offenders = sqlFiles
      .filter((file) => !file.startsWith(MIGRATIONS) && file !== ROLES_FILE)
      .filter((file) => DDL.test(stripComments(read(file))));
    expect(offenders).toEqual([]);
  });

  it('holds only CREATE ROLE statements in supabase/roles.sql', () => {
    const statements = stripComments(read(ROLES_FILE))
      .split(';')
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter((s) => s.length > 0);
    expect(statements.length).toBeGreaterThan(0);
    for (const statement of statements) {
      expect(statement).toMatch(/^CREATE ROLE [a-z_][a-z0-9_]* LOGIN$/i);
    }
  });

  it('has no PASSWORD in roles.sql or any migration', () => {
    const offenders = sqlFiles
      .filter((file) => file === ROLES_FILE || file.startsWith(MIGRATIONS))
      .filter((file) => /\bPASSWORD\b/i.test(stripComments(read(file))));
    expect(offenders).toEqual([]);
  });

  it('detects DDL and passwords the way the checks above rely on', () => {
    expect(DDL.test('create table register.x (id int);')).toBe(true);
    expect(DDL.test('ALTER DEFAULT PRIVILEGES FOR ROLE postgres')).toBe(true);
    expect(DDL.test(stripComments('-- create table x\nselect 1;'))).toBe(false);
    expect(/\bPASSWORD\b/i.test(stripComments("CREATE ROLE x LOGIN PASSWORD 'y';"))).toBe(true);
  });
});
