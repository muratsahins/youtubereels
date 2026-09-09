import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

import type { CaptionWord } from '../../types';
import { toCaptionChunks, type CaptionChunk as Chunk } from '../../util/captions';

const toChunks = toCaptionChunks;

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
