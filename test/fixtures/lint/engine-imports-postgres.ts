// Linted as src/engine/fixture.ts: the engine may not import the database client.
import postgres from 'postgres';

export const client = postgres;
