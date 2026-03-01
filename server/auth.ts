import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
    createUser, findUserByUsername, getUserProfile,
    getLeaderboard, getGameHistory, updateProfile,
} from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'blackjack-local-dev-secret-key-change-in-prod';
const TOKEN_EXPIRY = '30d';

// ─── JWT helpers ──────────────────────────────────────────────────────────────
export function signToken(userId: number): string {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): { userId: number } | null {
    try {
        return jwt.verify(token, JWT_SECRET) as { userId: number };
    } catch {
        return null;
    }
}

// ─── Auth middleware (optional — doesn't block if missing) ────────────────────
export interface AuthRequest extends Request {
    userId?: number;
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        const payload = verifyToken(authHeader.slice(7));
        if (payload) req.userId = payload.userId;
    }
    next();
}

// ─── Routes ───────────────────────────────────────────────────────────────────
const router = Router();

// Validate username: 3-16 chars, alphanumeric + underscore
const USERNAME_RE = /^[a-zA-Z0-9_]{3,16}$/;

router.post('/api/register', async (req: AuthRequest, res: Response) => {
    try {
        const { username, password, displayName, avatar } = req.body;
        if (!username || !password) {
            res.status(400).json({ error: 'Username and password are required' });
            return;
        }
        if (!USERNAME_RE.test(username)) {
            res.status(400).json({ error: 'Username must be 3-16 alphanumeric characters' });
            return;
        }
        if (password.length < 4) {
            res.status(400).json({ error: 'Password must be at least 4 characters' });
            return;
        }

        const existing = findUserByUsername(username);
        if (existing) {
            res.status(409).json({ error: 'Username already taken' });
            return;
        }

        const hash = await bcrypt.hash(password, 10);
        const user = createUser(username, hash, displayName || username, avatar || '🎰');
        const token = signToken(user.id);
        const profile = getUserProfile(user.id);

        res.json({ token, user: profile });
    } catch (err: any) {
        console.error('[register]', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/api/login', async (req: AuthRequest, res: Response) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            res.status(400).json({ error: 'Username and password are required' });
            return;
        }

        const user = findUserByUsername(username);
        if (!user) {
            res.status(401).json({ error: 'Invalid username or password' });
            return;
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            res.status(401).json({ error: 'Invalid username or password' });
            return;
        }

        const token = signToken(user.id);
        const profile = getUserProfile(user.id);

        res.json({ token, user: profile });
    } catch (err: any) {
        console.error('[login]', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/api/me', optionalAuth, (req: AuthRequest, res: Response) => {
    if (!req.userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
    }
    const profile = getUserProfile(req.userId);
    if (!profile) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    res.json({ user: profile });
});

router.get('/api/history', optionalAuth, (req: AuthRequest, res: Response) => {
    if (!req.userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
    }
    const limit = parseInt(req.query.limit as string) || 20;
    const history = getGameHistory(req.userId, Math.min(limit, 50));
    res.json({ history });
});

router.put('/api/profile', optionalAuth, (req: AuthRequest, res: Response) => {
    if (!req.userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
    }
    const { displayName, avatar } = req.body;
    if (displayName) {
        updateProfile(req.userId, displayName, avatar || '🎰');
    }
    const profile = getUserProfile(req.userId);
    res.json({ user: profile });
});

router.get('/api/leaderboard', (_req: Request, res: Response) => {
    const entries = getLeaderboard(20);
    res.json({ leaderboard: entries });
});

export default router;
