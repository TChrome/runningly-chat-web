import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from './lib/session';
import { initDb } from './lib/db';

// GET /api/downloads
// Returns list of videos stored in Vercel Postgres for the authenticated user,
// sorted newest first. Replaces the local filesystem scan in vite.config.ts.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const session = await getIronSession<SessionData>(req as any, res as any, sessionOptions);

  if (!session.user) {
    res.status(401).json({ error: 'Not logged in' });
    return;
  }

  await initDb();

  const result = await sql`
    SELECT
      video_url  AS "videoUrl",
      title      AS "fileName",
      created_at AS mtime
    FROM runningly_videos
    WHERE user_email = ${session.user.email}
    ORDER BY created_at DESC;
  `;

  res.status(200).json(result.rows);
}
