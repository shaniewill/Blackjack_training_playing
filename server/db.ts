import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'blackjack.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent reads
db.pragma('journal_mode = WAL');

// ─── Schema ───────────────────────────────────────────────────────────────────
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        username    TEXT UNIQUE NOT NULL COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        avatar      TEXT NOT NULL DEFAULT '🎰',
        chips       INTEGER NOT NULL DEFAULT 1000,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS game_history (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id      INTEGER NOT NULL REFERENCES users(id),
        mode         TEXT NOT NULL,
        hands_played INTEGER NOT NULL DEFAULT 0,
        hands_won    INTEGER NOT NULL DEFAULT 0,
        hands_lost   INTEGER NOT NULL DEFAULT 0,
        hands_pushed INTEGER NOT NULL DEFAULT 0,
        blackjacks   INTEGER NOT NULL DEFAULT 0,
        chips_delta  INTEGER NOT NULL DEFAULT 0,
        created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS training_stats (
        user_id           INTEGER PRIMARY KEY REFERENCES users(id),
        total_decisions   INTEGER NOT NULL DEFAULT 0,
        correct_decisions INTEGER NOT NULL DEFAULT 0,
        best_streak       INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_game_history_user ON game_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_chips ON users(chips DESC);
`);

// ─── Types ────────────────────────────────────────────────────────────────────
export interface UserRow {
    id: number;
    username: string;
    password_hash: string;
    display_name: string;
    avatar: string;
    chips: number;
    created_at: string;
}

export interface GameHistoryRow {
    id: number;
    user_id: number;
    mode: string;
    hands_played: number;
    hands_won: number;
    hands_lost: number;
    hands_pushed: number;
    blackjacks: number;
    chips_delta: number;
    created_at: string;
}

export interface TrainingStatsRow {
    user_id: number;
    total_decisions: number;
    correct_decisions: number;
    best_streak: number;
}

export interface UserProfile {
    id: number;
    username: string;
    display_name: string;
    avatar: string;
    chips: number;
    created_at: string;
    stats: {
        total_hands: number;
        total_won: number;
        total_lost: number;
        total_pushed: number;
        total_blackjacks: number;
        total_chips_won: number;
        total_chips_lost: number;
        best_session_delta: number;
        games_played: number;
    };
    training: {
        total_decisions: number;
        correct_decisions: number;
        accuracy: number;
        best_streak: number;
    };
}

// ─── Prepared statements ──────────────────────────────────────────────────────
const stmts = {
    createUser: db.prepare(`
        INSERT INTO users (username, password_hash, display_name, avatar)
        VALUES (?, ?, ?, ?)
    `),
    findByUsername: db.prepare(`SELECT * FROM users WHERE username = ?`),
    findById: db.prepare(`SELECT * FROM users WHERE id = ?`),
    updateChips: db.prepare(`UPDATE users SET chips = ? WHERE id = ?`),
    updateProfile: db.prepare(`UPDATE users SET display_name = ?, avatar = ? WHERE id = ?`),

    recordGame: db.prepare(`
        INSERT INTO game_history (user_id, mode, hands_played, hands_won, hands_lost, hands_pushed, blackjacks, chips_delta)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    getGameHistory: db.prepare(`
        SELECT * FROM game_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
    `),
    getAggregateStats: db.prepare(`
        SELECT
            COALESCE(SUM(hands_played), 0) as total_hands,
            COALESCE(SUM(hands_won), 0) as total_won,
            COALESCE(SUM(hands_lost), 0) as total_lost,
            COALESCE(SUM(hands_pushed), 0) as total_pushed,
            COALESCE(SUM(blackjacks), 0) as total_blackjacks,
            COALESCE(SUM(CASE WHEN chips_delta > 0 THEN chips_delta ELSE 0 END), 0) as total_chips_won,
            COALESCE(SUM(CASE WHEN chips_delta < 0 THEN ABS(chips_delta) ELSE 0 END), 0) as total_chips_lost,
            COALESCE(MAX(chips_delta), 0) as best_session_delta,
            COUNT(*) as games_played
        FROM game_history WHERE user_id = ?
    `),

    getTrainingStats: db.prepare(`SELECT * FROM training_stats WHERE user_id = ?`),
    upsertTrainingStats: db.prepare(`
        INSERT INTO training_stats (user_id, total_decisions, correct_decisions, best_streak)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            total_decisions = total_decisions + excluded.total_decisions,
            correct_decisions = correct_decisions + excluded.correct_decisions,
            best_streak = MAX(best_streak, excluded.best_streak)
    `),

    getLeaderboard: db.prepare(`
        SELECT
            u.id, u.username, u.display_name, u.avatar, u.chips,
            COALESCE(SUM(g.hands_played), 0) as total_hands,
            COALESCE(SUM(g.hands_won), 0) as total_won
        FROM users u
        LEFT JOIN game_history g ON g.user_id = u.id
        GROUP BY u.id
        ORDER BY u.chips DESC
        LIMIT ?
    `),
};

// ─── Public API ───────────────────────────────────────────────────────────────
export function createUser(username: string, passwordHash: string, displayName: string, avatar: string = '🎰'): UserRow {
    stmts.createUser.run(username, passwordHash, displayName, avatar);
    return stmts.findByUsername.get(username) as UserRow;
}

export function findUserByUsername(username: string): UserRow | undefined {
    return stmts.findByUsername.get(username) as UserRow | undefined;
}

export function findUserById(id: number): UserRow | undefined {
    return stmts.findById.get(id) as UserRow | undefined;
}

export function updateChips(userId: number, chips: number) {
    stmts.updateChips.run(chips, userId);
}

export function updateProfile(userId: number, displayName: string, avatar: string) {
    stmts.updateProfile.run(displayName, avatar, userId);
}

export function recordGame(
    userId: number,
    mode: string,
    handsPlayed: number,
    handsWon: number,
    handsLost: number,
    handsPushed: number,
    blackjacks: number,
    chipsDelta: number,
) {
    stmts.recordGame.run(userId, mode, handsPlayed, handsWon, handsLost, handsPushed, blackjacks, chipsDelta);
}

export function getGameHistory(userId: number, limit: number = 20): GameHistoryRow[] {
    return stmts.getGameHistory.all(userId, limit) as GameHistoryRow[];
}

export function getUserProfile(userId: number): UserProfile | null {
    const user = findUserById(userId);
    if (!user) return null;

    const stats = stmts.getAggregateStats.get(userId) as any;
    const training = (stmts.getTrainingStats.get(userId) as TrainingStatsRow) || {
        total_decisions: 0,
        correct_decisions: 0,
        best_streak: 0,
    };

    return {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar: user.avatar,
        chips: user.chips,
        created_at: user.created_at,
        stats: {
            total_hands: stats.total_hands,
            total_won: stats.total_won,
            total_lost: stats.total_lost,
            total_pushed: stats.total_pushed,
            total_blackjacks: stats.total_blackjacks,
            total_chips_won: stats.total_chips_won,
            total_chips_lost: stats.total_chips_lost,
            best_session_delta: stats.best_session_delta,
            games_played: stats.games_played,
        },
        training: {
            total_decisions: training.total_decisions,
            correct_decisions: training.correct_decisions,
            accuracy: training.total_decisions > 0
                ? Math.round((training.correct_decisions / training.total_decisions) * 100)
                : 0,
            best_streak: training.best_streak,
        },
    };
}

export function recordTraining(userId: number, total: number, correct: number, bestStreak: number) {
    stmts.upsertTrainingStats.run(userId, total, correct, bestStreak);
}

export interface LeaderboardEntry {
    id: number;
    username: string;
    display_name: string;
    avatar: string;
    chips: number;
    total_hands: number;
    total_won: number;
    win_rate: number;
}

export function getLeaderboard(limit: number = 20): LeaderboardEntry[] {
    const rows = stmts.getLeaderboard.all(limit) as any[];
    return rows.map(r => ({
        ...r,
        win_rate: r.total_hands > 0 ? Math.round((r.total_won / r.total_hands) * 100) : 0,
    }));
}

export default db;
