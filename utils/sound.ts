// Web Audio API Sound Utility
// Simple synthesizer for game sound effects

// Prevent multiple audio contexts
let audioContext: AudioContext | null = null;

const getAudioContext = () => {
    if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContext;
};

type SoundType = 'click' | 'deal' | 'win' | 'loss' | 'bust' | 'push' | 'blackjack';

export const playSound = (type: SoundType) => {
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        const now = ctx.currentTime;

        switch (type) {
            case 'click':
                // High "Pop" / Bubble sound
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05); // Pitch Up
                gainNode.gain.setValueAtTime(0.3, now); // Louder
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;

            case 'deal':
                // "Zip" / Card slide - fast filtersweep noise
                // We'll simulate with a fast sliding triangle for simplicity since white noise needs a buffer
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.linearRampToValueAtTime(1200, now + 0.08); // Fast Zip Up
                gainNode.gain.setValueAtTime(0.1, now);
                gainNode.gain.linearRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;

            case 'win':
                // 8-bit Power Up (Arpeggio Up)
                playNote(ctx, 523.25, now, 0.08, 'square'); // C5
                playNote(ctx, 659.25, now + 0.08, 0.08, 'square'); // E5
                playNote(ctx, 783.99, now + 0.16, 0.08, 'square'); // G5
                playNote(ctx, 1046.50, now + 0.24, 0.2, 'square'); // C6 - Sustain

                // Add a "ding"
                playNote(ctx, 2093.00, now + 0.24, 0.3, 'sine'); // C7
                break;

            case 'blackjack':
                // Jackpot Fanfare
                const start = now;
                [0, 0.1, 0.2, 0.3].forEach((t, i) => {
                    playNote(ctx, 880 + (i * 100), start + t, 0.1, 'square');
                });
                playNote(ctx, 1760, start + 0.4, 0.4, 'sawtooth');
                break;

            case 'loss':
                // "Sad Trombone" / Wobble Down
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.linearRampToValueAtTime(150, now + 0.4); // Slide Down

                // Add wobble (LFO effect manual)
                gainNode.gain.setValueAtTime(0.2, now);
                gainNode.gain.linearRampToValueAtTime(0.01, now + 0.4);

                osc.start(now);
                osc.stop(now + 0.4);

                // Second "wah"
                setTimeout(() => {
                    const ctx2 = getAudioContext();
                    const osc2 = ctx2.createOscillator();
                    const g2 = ctx2.createGain();
                    osc2.connect(g2);
                    g2.connect(ctx2.destination);
                    osc2.type = 'sawtooth';
                    osc2.frequency.setValueAtTime(150, ctx2.currentTime);
                    osc2.frequency.linearRampToValueAtTime(100, ctx2.currentTime + 0.5);
                    g2.gain.setValueAtTime(0.2, ctx2.currentTime);
                    g2.gain.linearRampToValueAtTime(0.01, ctx2.currentTime + 0.5);
                    osc2.start(ctx2.currentTime);
                    osc2.stop(ctx2.currentTime + 0.5);
                }, 400);
                break;

            case 'bust':
                // Cartoon "Slip/Fall" - Whistle Down
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.5); // Fast Drop

                gainNode.gain.setValueAtTime(0.2, now);
                gainNode.gain.linearRampToValueAtTime(0.01, now + 0.5);

                osc.start(now);
                osc.stop(now + 0.5);
                break;

            case 'push':
                // "Meh" - Two flat tones
                playNote(ctx, 400, now, 0.2, 'triangle');
                playNote(ctx, 400, now + 0.25, 0.3, 'triangle');
                break;
        }

    } catch (e) {
        console.error("Audio play failed", e);
    }
};

// Helper for playing musical notes
const playNote = (ctx: AudioContext, freq: number, startTime: number, duration: number, type: OscillatorType = 'sine') => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;

    osc.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(0.1, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

    osc.start(startTime);
    osc.stop(startTime + duration);
};
