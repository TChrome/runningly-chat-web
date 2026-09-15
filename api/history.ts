import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from './lib/session.js';
import { initDb } from './lib/db.js';

// GET/POST /api/history
// Replaces the vite.config.ts /api/history file-based middleware.
// Uses Vercel Postgres for persistent, per-user conversation and video history.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const session = await getIronSession<SessionData>(req as any, res as any, sessionOptions);

    if (!session.user) {
        res.status(401).json({ error: 'Not logged in' });
        return;
    }

    await initDb();
    const email = session.user.email;

    // ── GET: Return full history ─────────────────────────────────────────────────
    if (req.method === 'GET') {
        const convResult = await sql`
      SELECT sender, content, message_id AS id, conversation_id, agent_type
      FROM runningly_conversations
      WHERE user_email = ${email}
      ORDER BY created_at ASC;
    `;

        const videoResult = await sql`
      SELECT video_url AS "videoUrl", title, type
      FROM runningly_videos
      WHERE user_email = ${email}
      ORDER BY created_at DESC;
    `;

        res.status(200).json({
            conversations: convResult.rows,
            videos: videoResult.rows,
        });
        return;
    }

    // ── POST: Mutate history ─────────────────────────────────────────────────────
    if (req.method === 'POST') {
        const body = req.body as { action: string; message?: any; video?: any };
        const { action, message, video } = body;

        if (action === 'append_message' && message) {
            const convId = message.conversationId || 'default';
            const agentType = message.agentType || 'remote';
            await sql`
        INSERT INTO runningly_conversations (user_email, sender, content, message_id, conversation_id, agent_type)
        VALUES (${email}, ${message.sender}, ${message.content}, ${message.id || null}, ${convId}, ${agentType});
      `;

        } else if (action === 'append_video' && video) {
            // Avoid duplicates by URL
            const existing = await sql`
        SELECT id FROM runningly_videos
        WHERE user_email = ${email} AND video_url = ${video.videoUrl}
        LIMIT 1;
      `;
            if (existing.rowCount === 0) {
                await sql`
          INSERT INTO runningly_videos (user_email, video_url, title, type)
          VALUES (${email}, ${video.videoUrl}, ${video.title}, ${video.type || 'video'});
        `;
            }

        } else if (action === 'clear') {
            await sql`DELETE FROM runningly_conversations WHERE user_email = ${email};`;
        }

        // Return refreshed state
        const convResult = await sql`
      SELECT sender, content, message_id AS id, conversation_id, agent_type
      FROM runningly_conversations
      WHERE user_email = ${email}
      ORDER BY created_at ASC;
    `;
        const videoResult = await sql`
      SELECT video_url AS "videoUrl", title, type
      FROM runningly_videos
      WHERE user_email = ${email}
      ORDER BY created_at DESC;
    `;

        res.status(200).json({
            conversations: convResult.rows,
            videos: videoResult.rows,
        });
        return;
    }

    res.status(405).json({ error: 'Method not allowed' });
}
