import { sql } from '@vercel/postgres';

// ─── Initialize Database Schema ───────────────────────────────────────────────
// Run once on first API invocation (idempotent - uses IF NOT EXISTS)
export async function initDb(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS runningly_conversations (
      id          SERIAL PRIMARY KEY,
      user_email  TEXT NOT NULL,
      sender      TEXT NOT NULL,
      content     TEXT NOT NULL,
      message_id  TEXT,
      created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // Add new columns for conversation tracking if they don't exist
  try {
    await sql`ALTER TABLE runningly_conversations ADD COLUMN IF NOT EXISTS conversation_id TEXT DEFAULT 'default';`;
    await sql`ALTER TABLE runningly_conversations ADD COLUMN IF NOT EXISTS agent_type TEXT DEFAULT 'remote';`;
  } catch (e) {
    console.log("Columns might already exist or error adding them:", e);
  }

  await sql`
    CREATE TABLE IF NOT EXISTS runningly_videos (
      id          SERIAL PRIMARY KEY,
      user_email  TEXT NOT NULL,
      video_url   TEXT NOT NULL,
      title       TEXT NOT NULL,
      type        TEXT DEFAULT 'video',
      created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_runningly_conv_email
    ON runningly_conversations(user_email);
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_runningly_video_email
    ON runningly_videos(user_email);
  `;
}
