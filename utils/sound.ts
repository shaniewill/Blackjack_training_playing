// Sound + Voice Utility
// Short beeps for gameplay cues; Web Speech API for all result announcements

let audioContext: AudioContext | null = null;

const getCtx = () => {
    if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') audioContext.resume();
    return audioContext;
};

// Pre-load voices — Chrome loads them asynchronously and ignores speech if voices aren't ready
if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

// ── Voice via Web Speech API ──────────────────────────────────────────────────
export const speak = (text: string, rate = 1.3, pitch = 1.0) => {
    if (!('speechSynthesis' in window)) return;

    // Cancel any queued/in-progress speech so new announcements are instant
    window.speechSynthesis.cancel();

    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'en-US';
    utt.rate = rate;
    utt.pitch = pitch;
    utt.volume = 1;

    // Pick best English voice if available (Microsoft voices on Windows are great)
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang === 'en-US') ?? voices.find(v => v.lang.startsWith('en'));
    if (voice) utt.voice = voice;

    window.speechSynthesis.speak(utt);
};


// ── Sound effects ─────────────────────────────────────────────────────────────
type SoundType = 'click' | 'deal' | 'win' | 'loss' | 'bust' | 'push' | 'blackjack';



export const playSound = (type: SoundType) => {
    try {
        const ctx = getCtx();
        const now = ctx.currentTime;

        switch (type) {
            case 'click':
                note(ctx, 900, now, 0.07, 'sine');
                break;

            case 'deal':
                // Crisp card-snap feel
                note(ctx, 600, now, 0.04, 'triangle');
                note(ctx, 1200, now + 0.04, 0.04, 'triangle');
                break;

            case 'bust':
                // Gentle descending — not harsh, a soft "oh no"
                note(ctx, 500, now, 0.12, 'sine');
                note(ctx, 400, now + 0.12, 0.12, 'sine');
                note(ctx, 300, now + 0.24, 0.25, 'sine');
                speak('Bust', 0.95, 0.85);
                break;

            case 'win': {
                // Bright ascending major chord — celebratory 🎶
                const winNotes = [523, 659, 784, 880, 1047]; // C5 E5 G5 A5 C6
                winNotes.forEach((f, i) => {
                    note(ctx, f, now + i * 0.08, 0.12, 'sine');
                    note(ctx, f, now + i * 0.08, 0.06, 'square'); // shimmer layer
                });
                // Sparkle on top
                note(ctx, 1568, now + 0.4, 0.3, 'sine');
                speak('You win', 1.0, 1.15);
                break;
            }

            case 'blackjack': {
                // Triumphant fanfare — ascending with a grand finish
                const bjNotes = [659, 784, 988, 1175, 1319]; // E5 G5 B5 D6 E6
                bjNotes.forEach((f, i) => {
                    note(ctx, f, now + i * 0.1, 0.15, 'square');
                    note(ctx, f * 0.5, now + i * 0.1, 0.1, 'sine'); // bass layer
                });
                // Grand finale chord
                [1319, 1568, 1976].forEach(f => note(ctx, f, now + 0.55, 0.5, 'sine'));
                speak('Blackjack, you win', 1.0, 1.25);
                break;
            }

            case 'loss':
                // Soft minor descent — sad but still warm
                note(ctx, 440, now, 0.2, 'sine');
                note(ctx, 392, now + 0.2, 0.2, 'sine');
                note(ctx, 330, now + 0.4, 0.35, 'sine');
                speak('Dealer wins', 0.9, 0.9);
                break;

            case 'push':
                // Neutral warm tone — two gentle matching notes
                note(ctx, 523, now, 0.15, 'sine');
                note(ctx, 523, now + 0.2, 0.15, 'sine');
                note(ctx, 659, now + 0.35, 0.2, 'sine');
                speak('Push', 0.95, 1.0);
                break;
        }
    } catch (e) {
        console.error('Audio error:', e);
    }
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const note = (
    ctx: AudioContext,
    freq: number,
    t: number,
    dur: number,
    type: OscillatorType
) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t);
    osc.stop(t + dur);
};

const slide = (
    ctx: AudioContext,
    freqFrom: number,
    freqTo: number,
    t: number,
    dur: number
) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freqFrom, t);
    osc.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.linearRampToValueAtTime(0.001, t + dur);
    osc.start(t);
    osc.stop(t + dur);
};
