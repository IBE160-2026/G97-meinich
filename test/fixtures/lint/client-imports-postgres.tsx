'use client';
// Linted as src/components/fixture.tsx: a client module may not import the database client.
import postgres from 'postgres';

export const client = postgres;
