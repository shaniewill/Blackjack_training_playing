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
export const speak = (text: string, rate = 1.0, pitch = 1.0) => {
    if (!('speechSynthesis' in window)) return;

    // Chrome bug: speech silently fails when paused (e.g. after tab switch)
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();

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
                note(ctx, 600, now, 0.05, 'triangle');
                note(ctx, 1000, now + 0.05, 0.05, 'triangle');
                break;

            case 'bust':
                slide(ctx, 700, 120, now, 0.45);
                speak('Bust!', 1.1, 0.85);
                break;

            case 'win':
                note(ctx, 523, now, 0.08, 'square');
                note(ctx, 659, now + 0.08, 0.08, 'square');
                note(ctx, 784, now + 0.16, 0.08, 'square');
                note(ctx, 1047, now + 0.24, 0.2, 'square');
                speak('You win!', 1.0, 1.1);
                break;

            case 'blackjack':
                [0, 0.09, 0.18, 0.27].forEach((t, i) =>
                    note(ctx, 880 + i * 110, now + t, 0.09, 'square')
                );
                note(ctx, 1760, now + 0.38, 0.35, 'sawtooth');
                speak('Blackjack! You win!', 1.0, 1.2);
                break;

            case 'loss':
                slide(ctx, 280, 130, now, 0.5);
                speak('Dealer wins.', 0.9, 0.85);
                break;

            case 'push':
                note(ctx, 400, now, 0.2, 'triangle');
                note(ctx, 400, now + 0.25, 0.2, 'triangle');
                speak("It's a push.", 0.95, 1.0);
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
