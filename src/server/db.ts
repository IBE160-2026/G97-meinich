import 'server-only';
// The request path's only database client (AD-3, AD-19). It connects as
// `reader`, the SELECT-only role, and READER_DATABASE_URL is read here and
// nowhere else (test/reader-url.test.ts). One client per process: it is kept
// on globalThis so a dev-server reload does not open a second pool. Every
// statement has a 5 s timeout (statement_timeout), because the request path
// is open and unauthenticated.
//
// postgres.js is used with its default types: int8 and numeric arrive as
// strings and are parsed by src/engine/inputs.ts (AD-8). Do not add a
// `types` or `transform` option that turns them into numbers
// (test/db/read-types.test.ts).
import postgres from 'postgres';

export type ReaderSql = postgres.Sql;

const holder = globalThis as typeof globalThis & { peerlessReaderSql?: ReaderSql };

/** The shared reader client, created on first use. Throws when READER_DATABASE_URL is unset. */
export function readerSql(): ReaderSql {
  if (holder.peerlessReaderSql === undefined) {
    const url = process.env.READER_DATABASE_URL;
    if (url === undefined || url === '') {
      throw new Error('READER_DATABASE_URL is not set; see .env.example and run `pnpm db:roles`');
    }
    holder.peerlessReaderSql = postgres(url, {
      max: 5,
      idle_timeout: 60,
      connect_timeout: 10,
      onnotice: () => {},
      // /api/sok is open to anyone: no query may hold a connection longer
      // than five seconds.
      connection: { application_name: 'peerless-web', statement_timeout: 5000 },
    });
  }
  return holder.peerlessReaderSql;
}
