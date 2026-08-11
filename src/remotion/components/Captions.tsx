import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

import type { CaptionWord } from '../../types';

type Chunk = {
  words: CaptionWord[];
  start: number;
  end: number;
};

const MAX_WORDS = 4;
const MAX_DURATION = 1.9;
const MAX_GAP = 0.45;

/** Kelimeleri okunabilir kısa öbeklere böler: cümle sonu, uzun duraklama veya 4 kelime. */
function toChunks(words: CaptionWord[]): Chunk[] {
  const chunks: Chunk[] = [];
  let current: CaptionWord[] = [];

  const flush = () => {
    if (current.length === 0) return;
    const first = current[0]!;
    const last = current[current.length - 1]!;
    chunks.push({ words: current, start: first.start, end: last.end });
    current = [];
  };

  for (const [index, word] of words.entries()) {
    current.push(word);

    const next = words[index + 1];
    const chunkStart = current[0]!.start;
    const endsSentence = /[.!?:—]$/.test(word.text);
    const gapTooBig = next != null && next.start - word.end > MAX_GAP;
    const tooLong = word.end - chunkStart >= MAX_DURATION;

    if (current.length >= MAX_WORDS || endsSentence || gapTooBig || tooLong) flush();
  }

  flush();
  return chunks;
}

export const Captions: React.FC<{ words: CaptionWord[] }> = ({ words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;

  const chunks = useMemo(() => toChunks(words), [words]);
  if (chunks.length === 0) return null;

  // Duraklamalarda ekran boş kalmasın diye son başlamış öbeği tutuyoruz.
  let active: Chunk | null = null;
  for (const candidate of chunks) {
    if (candidate.start <= time) active = candidate;
    else break;
  }
  if (!active || time > active.end + 0.6) return null;

  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'flex-end',
        // Shorts arayüzü alt ~320px'i kapatır; altyazıyı güvenli bölgede tutuyoruz.
        paddingBottom: 470,
        paddingLeft: 80,
        paddingRight: 80,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '0 20px',
          textAlign: 'center',
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontSize: 78,
          fontWeight: 800,
          lineHeight: 1.18,
          letterSpacing: '-0.01em',
        }}
      >
        {active.words.map((word, index) => {
          const isActive = time >= word.start && time <= word.end;
          return (
            <span
              key={`${word.start}-${index}`}
              style={{
                color: isActive ? '#F2C14E' : '#FFFFFF',
                transform: isActive ? 'translateY(-4px)' : 'none',
                display: 'inline-block',
                textShadow: '0 6px 28px rgba(0,0,0,0.9), 0 2px 6px rgba(0,0,0,0.9)',
              }}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
