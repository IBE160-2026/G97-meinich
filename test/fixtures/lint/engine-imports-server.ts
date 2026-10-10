// Linted as src/engine/fixture.ts: the engine may not import src/server.
import { db } from '@/server/db';

export const handle = db;
