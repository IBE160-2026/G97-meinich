'use client';
// Linted as src/components/fixture.tsx: a client module may not import src/server.
import { db } from '../server/db';

export const handle = db;
