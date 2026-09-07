import fs from 'node:fs';
import path from 'node:path';

function createWavBuffer(sampleRate, durationSec, sampleFn) {
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2; // 16-bit mono
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // Subchunk 1 (fmt)
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1 size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // audio format (1 for PCM)
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample

  // Subchunk 2 (data)
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.max(-1, Math.min(1, sampleFn(t, durationSec)));
    const intSample = Math.floor(sample * 32767);
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }

  return buffer;
}

const dir = path.join(process.cwd(), 'public', 'sounds');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// 1. Tick sound (short click)
const tickWav = createWavBuffer(44100, 0.08, (t) => {
  const env = Math.exp(-t * 80);
  return Math.sin(2 * Math.PI * 1200 * t) * env * 0.5;
});
fs.writeFileSync(path.join(dir, 'tick.mp3'), tickWav);

// 2. Wrong buzzer sound (dissonant harsh buzz)
const wrongWav = createWavBuffer(44100, 0.6, (t) => {
  const env = Math.exp(-t * 2.5);
  const saw1 = (t * 140) % 1 > 0.5 ? 0.4 : -0.4;
  const saw2 = (t * 148) % 1 > 0.5 ? 0.4 : -0.4;
  return (saw1 + saw2) * env;
});
fs.writeFileSync(path.join(dir, 'wrong.mp3'), wrongWav);

// 3. Clap / Celebration fanfare sound
const clapWav = createWavBuffer(44100, 0.9, (t) => {
  const env = Math.exp(-t * 2.8);
  const note1 = Math.sin(2 * Math.PI * 523.25 * t);
  const note2 = Math.sin(2 * Math.PI * 659.25 * t);
  const note3 = Math.sin(2 * Math.PI * 783.99 * t);
  const noise = (Math.random() * 2 - 1) * 0.3;
  return ((note1 + note2 + note3) * 0.25 + noise) * env;
});
fs.writeFileSync(path.join(dir, 'clap.mp3'), clapWav);

console.log('Successfully generated public/sounds/tick.mp3, wrong.mp3, clap.mp3');
