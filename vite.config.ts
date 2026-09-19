import { defineConfig, ViteDevServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Logging } from '@google-cloud/logging';
import { IncomingMessage, ServerResponse } from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Types ───────────────────────────────────────────────────────────────────
interface User {
    id: string;
    name: string;
    email: string;
    picture: string;
    access_token: string;
}

// Extend IncomingMessage to include session and passport properties
interface AuthenticatedRequest extends IncomingMessage {
    session: session.Session & Partial<session.SessionData> & { next_url?: string };
    user?: User;
    isAuthenticated(): boolean;
    logIn(user: User, done: (err: any) => void): void;
    logout(done: (err: any) => void): void;
    query?: Record<string, string>;
}

// ─── Google Cloud Logging Setup ──────────────────────────────────────────────
const logging = new Logging({
    keyFilename: path.join(__dirname, 'logging-service-account.json'),
});
const logger = logging.log('my_logger');

// ─── Google OAuth Credentials ─────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'your-client-id';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'your-client-secret';
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-session-secret';

// ─── Active Users ─────────────────────────────────────────────────────────────
const activeUsers: Record<string, User> = {};

// ─── Passport ─────────────────────────────────────────────────────────────────
passport.use(new GoogleStrategy(
    {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        scope: ['openid', 'email', 'profile'],
        userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo',
    },
    (accessToken: string, _refreshToken: string, profile: Profile, done: (err: any, user?: any) => void) => {
        const user: User = {
            id: profile.id,
            name: profile.displayName,
            email: profile.emails?.[0]?.value || '',
            picture: profile.photos?.[0]?.value || '',
            access_token: accessToken,
        };
        activeUsers[user.email] = user;
        return done(null, user);
    }
));

passport.serializeUser((user: any, done) => done(null, user));
passport.deserializeUser((obj: any, done) => done(null, obj));

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve) => {
        let raw = '';
        req.on('data', chunk => { raw += chunk; });
        req.on('end', () => {
            try { resolve(JSON.parse(raw)); } catch { resolve({}); }
        });
    });
}

function sendJson(res: ServerResponse, code: number, obj: any) {
    const body = JSON.stringify(obj);
    res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
    res.end(body);
}

// ─── Vite Plugin ──────────────────────────────────────────────────────────────
function runniglyAuthPlugin() {
    return {
        name: 'runningly-auth',
        configureServer(server: ViteDevServer) {
            const downloadsDir = path.join(__dirname, 'static', 'downloads');
            fs.mkdirSync(downloadsDir, { recursive: true });
            const dataDir = path.join(__dirname, 'data');
            fs.mkdirSync(dataDir, { recursive: true });

            // 1. Query Parser (Passport needs req.query)
            server.middlewares.use((req: any, _res, next) => {
                if (!req.query) {
                    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
                    req.query = Object.fromEntries(url.searchParams.entries());
                }
                next();
            });

            // 2. Session + Passport middleware
            const sessionMiddleware = session({
                secret: SESSION_SECRET,
                resave: false,
                saveUninitialized: false,
                cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
            });
            server.middlewares.use(sessionMiddleware as any);
            server.middlewares.use(passport.initialize() as any);
            server.middlewares.use(passport.session() as any);

            // Serve downloads
            server.middlewares.use('/download', (req: IncomingMessage, res: ServerResponse, next: () => void) => {
                const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
                const target = url.searchParams.get('file') || url.searchParams.get('vf') || path.basename(url.pathname);
                if (!target) { res.writeHead(400); res.end('Missing file param'); return; }
                const safeName = path.basename(target);
                const candidates = [
                    path.join(downloadsDir, safeName),
                    path.join(__dirname, '..', 'NTQA', safeName),
                    path.join(__dirname, '..', 'NTQA', 'snapshots', safeName)
                ];
                const foundFile = candidates.find(c => fs.existsSync(c) && fs.statSync(c).isFile());
                if (foundFile) {
                    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
                    res.setHeader('Content-Type', 'application/octet-stream');
                    fs.createReadStream(foundFile).pipe(res);
                } else {
                    res.writeHead(404); res.end('File not found');
                }
            });

            server.middlewares.use('/download_file', (req: IncomingMessage, res: ServerResponse, next: () => void) => {
                const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
                const target = url.searchParams.get('file') || url.searchParams.get('vf') || path.basename(url.pathname);
                if (!target) { res.writeHead(400); res.end('Missing file param'); return; }
                const safeName = path.basename(target);
                const candidates = [
                    path.join(downloadsDir, safeName),
                    path.join(__dirname, '..', 'NTQA', safeName),
                    path.join(__dirname, '..', 'NTQA', 'snapshots', safeName)
                ];
                const foundFile = candidates.find(c => fs.existsSync(c) && fs.statSync(c).isFile());
                if (foundFile) {
                    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
                    res.setHeader('Content-Type', 'application/octet-stream');
                    fs.createReadStream(foundFile).pipe(res);
                } else {
                    res.writeHead(404); res.end('File not found');
                }
            });

            server.middlewares.use('/static/downloads', (req: IncomingMessage, res: ServerResponse, next: () => void) => {
                const file = path.join(downloadsDir, path.basename((req.url || '').split('?')[0]));
                if (fs.existsSync(file) && fs.statSync(file).isFile()) {
                    res.setHeader('Content-Type', 'application/octet-stream');
                    fs.createReadStream(file).pipe(res);
                } else {
                    res.writeHead(404); res.end('Not found');
                }
            });

            // ── /api/auth/login ─────────────────────────────────────────────────────
            server.middlewares.use('/api/auth/login', (req: any, res: ServerResponse, next: any) => {
                const protocol = req.headers['x-forwarded-proto'] || 'http';
                const baseUrl = `${protocol}://${req.headers.host}`;
                const url = new URL(req.url || '', baseUrl);
                const nextUrl = url.searchParams.get('next');
                if (nextUrl) req.session.next_url = nextUrl;

                if (req.isAuthenticated()) {
                    const target = req.session.next_url || '/';
                    delete req.session.next_url;
                    res.writeHead(302, { Location: target });
                    return res.end();
                }
                passport.authenticate('google', {
                    scope: ['openid', 'email', 'profile'],
                    prompt: 'select_account',
                    callbackURL: `${baseUrl}/api/auth/callback`
                })(req, res, next);
            });

            // ── /api/auth/callback ─────────────────────────────────────────────
            server.middlewares.use('/api/auth/callback', (req: any, res: ServerResponse, next: any) => {
                const protocol = req.headers['x-forwarded-proto'] || 'http';
                const baseUrl = `${protocol}://${req.headers.host}`;

                passport.authenticate('google', {
                    failureRedirect: '/api/auth/login',
                    callbackURL: `${baseUrl}/api/auth/callback`
                }, (err: any, user: User) => {
                    if (err || !user) {
                        res.writeHead(302, { Location: '/api/auth/login' });
                        return res.end();
                    }
                    req.logIn(user, (loginErr: any) => {
                        if (loginErr) return next(loginErr);

                        // Log the login event to Google Cloud Logging (Parity with Python app)
                        const email = user.email || "Unknown";
                        const entry = logger.entry({}, `User ${email} logged in successfully.`);
                        logger.write(entry).catch(err => console.error('Cloud Logging Error:', err));

                        const target = req.session.next_url || '/';
                        delete req.session.next_url;
                        res.writeHead(302, { Location: target });
                        res.end();
                    });
                })(req, res, next);
            });

            // ── /api/current-user ─────────────────────────────────────────────────────
            server.middlewares.use('/api/current-user', (req: any, res: ServerResponse, next: any) => {
                if (req.method !== 'GET') return next();
                if (!req.isAuthenticated()) {
                    return sendJson(res, 401, { error: 'Not logged in' });
                }
                sendJson(res, 200, {
                    name: req.user.name,
                    email: req.user.email,
                    picture: req.user.picture,
                });
            });

            // ── /api/history ──────────────────────────────────────────────────────
            server.middlewares.use('/api/history', async (req: any, res: ServerResponse, next: any) => {
                if (!req.isAuthenticated()) {
                    return sendJson(res, 401, { error: 'Not logged in' });
                }
                const email = req.user.email || 'default';
                const userHistoryFile = path.join(dataDir, `history_${email.replace(/[^a-zA-Z0-9_.-]/g, '_')}.json`);

                if (req.method === 'GET') {
                    let history: { conversations: any[], videos: any[] } = {
                        conversations: [],
                        videos: [
                            { videoUrl: "static/downloads/okta_new.mp4", title: "Okta Sync Training", type: "video" },
                            { videoUrl: "static/downloads/okta_new.mp4", title: "Daily Salesforce Extract", type: "download" },
                            { videoUrl: "static/downloads/okta_new.mp4", title: "Automated Report Export", type: "document" }
                        ]
                    };
                    if (fs.existsSync(userHistoryFile)) {
                        try {
                            const data = fs.readFileSync(userHistoryFile, 'utf8');
                            history = JSON.parse(data);
                        } catch (e) {
                            console.error('Error reading user history file:', e);
                        }
                    }
                    return sendJson(res, 200, history);
                }

                if (req.method === 'POST') {
                    const body = await parseBody(req);
                    const { action, message, video } = body;

                    let history: { conversations: any[], videos: any[] } = {
                        conversations: [],
                        videos: [
                            { videoUrl: "static/downloads/okta_new.mp4", title: "Okta Sync Training", type: "video" },
                            { videoUrl: "static/downloads/okta_new.mp4", title: "Daily Salesforce Extract", type: "download" },
                            { videoUrl: "static/downloads/okta_new.mp4", title: "Automated Report Export", type: "document" }
                        ]
                    };

                    if (fs.existsSync(userHistoryFile)) {
                        try {
                            const data = fs.readFileSync(userHistoryFile, 'utf8');
                            history = JSON.parse(data);
                        } catch (e) {
                            console.error('Error reading user history file:', e);
                        }
                    }

                    if (action === 'append_message' && message) {
                        history.conversations.push(message);
                    } else if (action === 'append_video' && video) {
                        const exists = history.videos.some((v: any) => v.videoUrl === video.videoUrl);
                        if (!exists) {
                            history.videos.unshift(video);
                        }
                    } else if (action === 'clear') {
                        history.conversations = [];
                    }

                    try {
                        fs.writeFileSync(userHistoryFile, JSON.stringify(history, null, 2), 'utf8');
                    } catch (e) {
                        console.error('Error writing user history file:', e);
                        return sendJson(res, 500, { error: 'Failed to save history' });
                    }

                    return sendJson(res, 200, history);
                }

                return next();
            });

            // ── /api/downloads ────────────────────────────────────────────────────
            server.middlewares.use('/api/downloads', (req: any, res: ServerResponse, next: any) => {
                if (req.method !== 'GET') return next();
                try {
                    const files = fs.readdirSync(downloadsDir);
                    const mp4Files = files
                        .filter(file => file.endsWith('.mp4'))
                        .map(file => {
                            const filePath = path.join(downloadsDir, file);
                            const stats = fs.statSync(filePath);
                            return {
                                fileName: file,
                                videoUrl: `/static/downloads/${file}`,
                                mtime: stats.mtime.getTime(),
                            };
                        })
                        .sort((a, b) => b.mtime - a.mtime); // Latest first

                    sendJson(res, 200, mp4Files);
                } catch (e: any) {
                    console.error('Error reading downloads directory:', e.message);
                    sendJson(res, 500, { error: e.message });
                }
            });

            // ── /api/logout ───────────────────────────────────────────────────────────
            server.middlewares.use('/api/logout', (req: any, res: ServerResponse, next: any) => {
                if (req.method !== 'GET') return next();
                const protocol = req.headers['x-forwarded-proto'] || 'http';
                const baseUrl = `${protocol}://${req.headers.host}`;
                const url = new URL(req.url || '', baseUrl);
                const target = url.searchParams.get('next') || '/';
                req.logout(() => {
                    req.session.destroy(() => {
                        res.setHeader('Set-Cookie', 'connect.sid=; Max-Age=0; Path=/');
                        res.writeHead(302, { Location: target });
                        res.end();
                    });
                });
            });

            // ── /api/revoke ───────────────────────────────────────────────────────────
            server.middlewares.use('/api/revoke', async (req: any, res: ServerResponse, next: any) => {
                if (req.method !== 'GET') return next();
                const protocol = req.headers['x-forwarded-proto'] || 'http';
                const baseUrl = `${protocol}://${req.headers.host}`;
                const url = new URL(req.url || '', baseUrl);
                const target = url.searchParams.get('next') || '/';
                try {
                    if (req.user?.access_token) {
                        await axios.get(`https://accounts.google.com/o/oauth2/revoke?token=${req.user.access_token}`);
                        if (req.user.email) delete activeUsers[req.user.email];
                    }
                } catch (e: any) { console.warn('Revoke failed:', e.message); }
                req.logout(() => {
                    req.session.destroy(() => {
                        res.setHeader('Set-Cookie', 'connect.sid=; Max-Age=0; Path=/');
                        res.writeHead(302, { Location: target });
                        res.end();
                    });
                });
            });

            // ── /api/download-video ───────────────────────────────────────────────────
            server.middlewares.use('/api/download-video', async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
                if (req.method !== 'POST') return next();
                const body = await parseBody(req);
                const { remote_url, file_name } = body;
                if (!remote_url || !file_name) return sendJson(res, 400, { error: 'Missing parameters' });

                const safeName = path.basename(file_name.replace(/\\/g, '/'));
                const ext = path.extname(safeName);
                const base = path.basename(safeName, ext);
                const uniqueName = `${base}_${Date.now()}${ext}`;
                const localPath = path.join(downloadsDir, uniqueName);

                try {
                    const response = await axios.get(remote_url, {
                        responseType: 'stream',
                        headers: {
                            'ngrok-skip-browser-warning': 'true',
                            'Bypass-Tunnel-Reminder': 'true'
                        },
                    });
                    const writer = fs.createWriteStream(localPath);
                    response.data.pipe(writer);
                    await new Promise((resolve, reject) => {
                        writer.on('finish', resolve);
                        writer.on('error', reject);
                    });
                    sendJson(res, 200, { local_url: `/static/downloads/${uniqueName}` });
                } catch (e: any) {
                    console.error('Download error:', e.message);
                    sendJson(res, 500, { error: e.message });
                }
            });
        },
    };
}

// ─── Vite Config ──────────────────────────────────────────────────────────────
export default defineConfig({
    plugins: [runniglyAuthPlugin()],
    server: {
        port: 5000,
        host: true,
    },
    build: {
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'index.html'),
                ntqa: path.resolve(__dirname, 'ntqa.html')
            }
        }
    }
});
