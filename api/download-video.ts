import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
import { sql } from '@vercel/postgres';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from './lib/session';
import { initDb } from './lib/db';

// POST /api/download-video
// Replaces the local-filesystem proxy in vite.config.ts /download_video.
// Fetches the video from the Python backend (winrunningly.t-chrome.com),
// uploads it to Vercel Blob for permanent CDN storage,
// stores metadata in Postgres, and returns the Blob CDN URL.
//
// Vercel Blob has a 500MB file size limit and global CDN delivery.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const session = await getIronSession<SessionData>(req as any, res as any, sessionOptions);
    if (!session.user) {
        res.status(401).json({ error: 'Not logged in' });
        return;
    }

    const { remote_url, file_name } = req.body as { remote_url: string; file_name: string };
    if (!remote_url || !file_name) {
        res.status(400).json({ error: 'Missing remote_url or file_name' });
        return;
    }

    try {
        // ── Step 1: Fetch video stream from Python backend ────────────────────────
        const backendRes = await fetch(remote_url, {
            headers: {
                'ngrok-skip-browser-warning': 'true',
                'Bypass-Tunnel-Reminder': 'true',
            },
        });

        if (!backendRes.ok) {
            throw new Error(`Backend responded ${backendRes.status}: ${await backendRes.text()}`);
        }

        // ── Step 2: Upload video stream directly to Vercel Blob ───────────────────
        // Unique key: email-prefix + timestamp + filename to prevent collisions
        const safeEmail = session.user.email.replace(/[^a-zA-Z0-9]/g, '_');
        const blobKey = `videos/${safeEmail}/${Date.now()}_${file_name}`;

        const blob = await put(blobKey, backendRes.body!, {
            access: 'public',
            contentType: 'video/mp4',
        });

        // ── Step 3: Persist metadata in Postgres ─────────────────────────────────
        await initDb();
        const title = file_name
            .replace('.mp4', '')
            .replace(/_\d+/g, '')
            .replace(/_/g, ' ')
            .trim()
            .split(' ')
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ') || 'Automation Result';

        await sql`
      INSERT INTO runningly_videos (user_email, video_url, title, type)
      VALUES (${session.user.email}, ${blob.url}, ${title}, 'video')
      ON CONFLICT DO NOTHING;
    `;

        res.status(200).json({ local_url: blob.url });

    } catch (err: any) {
        console.error('Video download/upload error:', err.message);
        res.status(500).json({ error: err.message });
    }
}
