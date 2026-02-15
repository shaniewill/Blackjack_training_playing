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
                // Short high blip
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
                gainNode.gain.setValueAtTime(0.1, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;

            case 'deal':
                // White noise burst for card slide
                // Oscillator can't do white noise easily, so we use a quick slide
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.linearRampToValueAtTime(600, now + 0.1);
                gainNode.gain.setValueAtTime(0.05, now);
                gainNode.gain.linearRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.15);
                break;

            case 'win':
                // Major Arpeggio (C - E - G)
                playNote(ctx, 523.25, now, 0.1, 'sine'); // C5
                playNote(ctx, 659.25, now + 0.1, 0.1, 'sine'); // E5
                playNote(ctx, 783.99, now + 0.2, 0.4, 'sine'); // G5
                break;

            case 'blackjack':
                // Faster, higher major arpeggio
                playNote(ctx, 523.25, now, 0.08, 'square'); // C5
                playNote(ctx, 659.25, now + 0.08, 0.08, 'square'); // E5
                playNote(ctx, 783.99, now + 0.16, 0.08, 'square'); // G5
                playNote(ctx, 1046.50, now + 0.24, 0.4, 'square'); // C6
                break;

            case 'loss':
                // Descending minor 
                playNote(ctx, 392.00, now, 0.15, 'triangle'); // G4
                playNote(ctx, 311.13, now + 0.15, 0.4, 'triangle'); // Eb4
                break;

            case 'bust':
                // Low buzzer
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.linearRampToValueAtTime(100, now + 0.3);
                gainNode.gain.setValueAtTime(0.1, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
                break;

            case 'push':
                // Neutral chord
                playNote(ctx, 440, now, 0.2, 'sine'); // A4
                playNote(ctx, 554.37, now, 0.2, 'sine'); // C#5
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
