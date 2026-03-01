// ─── Auth API helpers ─────────────────────────────────────────────────────────

const API_BASE = '';  // Same origin via Vite proxy

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

export interface GameHistoryEntry {
    id: number;
    mode: string;
    hands_played: number;
    hands_won: number;
    hands_lost: number;
    hands_pushed: number;
    blackjacks: number;
    chips_delta: number;
    created_at: string;
}

// ── Token management ─────────────────────────────────────────────────────────
export function getToken(): string | null {
    return localStorage.getItem('bj_token');
}

export function setToken(token: string) {
    localStorage.setItem('bj_token', token);
}

export function clearToken() {
    localStorage.removeItem('bj_token');
}

function authHeaders(): Record<string, string> {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

// ── API calls ────────────────────────────────────────────────────────────────
export async function register(username: string, password: string, displayName?: string, avatar?: string): Promise<{ token: string; user: UserProfile }> {
    const res = await fetch(`${API_BASE}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, displayName, avatar }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    return data;
}

export async function login(username: string, password: string): Promise<{ token: string; user: UserProfile }> {
    const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    return data;
}

export async function fetchMe(): Promise<UserProfile | null> {
    const token = getToken();
    if (!token) return null;
    try {
        const res = await fetch(`${API_BASE}/api/me`, { headers: authHeaders() });
        if (!res.ok) return null;
        const data = await res.json();
        return data.user;
    } catch {
        return null;
    }
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
        const res = await fetch(`${API_BASE}/api/leaderboard`);
        const data = await res.json();
        return data.leaderboard || [];
    } catch {
        return [];
    }
}

export async function fetchHistory(limit: number = 20): Promise<GameHistoryEntry[]> {
    try {
        const res = await fetch(`${API_BASE}/api/history?limit=${limit}`, { headers: authHeaders() });
        if (!res.ok) return [];
        const data = await res.json();
        return data.history || [];
    } catch {
        return [];
    }
}
