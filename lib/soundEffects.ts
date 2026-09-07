'use client';

// Web Audio API fallback synthesizer + file audio player

let audioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function unlockAudio(): boolean {
  try {
    const ctx = getAudioContext();
    if (ctx) {
      // Play a short silent buffer to unlock audio on iOS / Chrome
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      return true;
    }
  } catch (err) {
    console.warn('Audio unlock error:', err);
  }
  return false;
}

// Synthesized Fallback: Celebration / Clap Chords
function playSynthesizedClap() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 arpeggio fanfare
  notes.forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + index * 0.08);

    gain.gain.setValueAtTime(0.01, now + index * 0.08);
    gain.gain.exponentialRampToValueAtTime(0.3, now + index * 0.08 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + index * 0.08);
    osc.stop(now + index * 0.08 + 0.45);
  });

  // Add a burst of applause white noise
  const bufferSize = ctx.sampleRate * 0.8;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.25));
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1200;
  filter.Q.value = 1.5;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.18, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);
}

// Synthesized Fallback: Wrong Buzzer
function playSynthesizedWrong() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'sawtooth';
  osc2.type = 'sawtooth';
  osc1.frequency.setValueAtTime(146.83, now); // D3
  osc2.frequency.setValueAtTime(155.56, now); // D#3 dissonance

  gain.gain.setValueAtTime(0.25, now);
  gain.gain.setValueAtTime(0.25, now + 0.35);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.5);
  osc2.stop(now + 0.5);
}

// Synthesized Fallback: Clock Tick
function playSynthesizedTick() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, now);
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.05);
}

export function playSound(type: 'clap' | 'wrong' | 'tick') {
  if (typeof window === 'undefined') return;

  const file = `/sounds/${type}.mp3`;
  const audio = new Audio(file);
  audio.volume = 0.85;

  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      // If audio file doesn't load or is blocked, use Web Audio API synthesizer
      if (type === 'clap') playSynthesizedClap();
      else if (type === 'wrong') playSynthesizedWrong();
      else if (type === 'tick') playSynthesizedTick();
    });
  }
}
