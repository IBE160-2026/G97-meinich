// Linted as src/engine/fixture.ts: the engine may not import Next.js.
import { NextResponse } from 'next/server';

export const respond = NextResponse.json;
