import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig } from 'remotion';

import type { ShortProps } from '../types';
import { Captions } from './components/Captions';
import { KenBurns } from './components/KenBurns';
import { NumberCard } from './components/NumberCard';
import { Vignette } from './components/Vignette';

export const LuxuryShort: React.FC<ShortProps> = ({
  durationSec,
  audio,
  music,
  scenes,
  words,
  burnCaptions,
}) => {
  const { fps } = useVideoConfig();
  const totalFrames = Math.max(1, Math.round(durationSec * fps));

  // Sahne sınırlarını bitişik yapıyoruz: ses hizalamasındaki boşluklar
  // aradaki tek karelik siyah kareler olarak görünmesin.
  const bounds = scenes.map((scene, index) => {
    const from = index === 0 ? 0 : Math.round(scene.start * fps);
    const nextScene = scenes[index + 1];
    const to =
      nextScene != null ? Math.round(nextScene.start * fps) : Math.round(scene.end * fps);
    return { from, durationInFrames: Math.max(1, Math.min(to, totalFrames) - from) };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#05050a' }}>
      {scenes.map((scene, index) => {
        const bound = bounds[index]!;
        return (
          <Sequence
            key={`${scene.src}-${index}`}
            from={bound.from}
            durationInFrames={bound.durationInFrames}
          >
            <KenBurns
              src={scene.src}
              motion={scene.motion}
              durationInFrames={bound.durationInFrames}
            />
            {scene.bigNumber ? (
              <NumberCard value={scene.bigNumber.value} label={scene.bigNumber.label} />
            ) : null}
          </Sequence>
        );
      })}

      <Vignette />
      {burnCaptions ? <Captions words={words} /> : null}

      {audio ? <Audio src={staticFile(audio)} /> : null}
      {music ? <Audio src={staticFile(music)} volume={0.1} loop /> : null}
    </AbsoluteFill>
  );
};
