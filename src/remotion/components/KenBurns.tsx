import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';

import type { Motion } from '../../types';

type Props = {
  src: string;
  motion: Motion;
  durationInFrames: number;
};

/** Statik görsel Shorts'ta ölür — her sahneye yavaş bir kamera hareketi bindiriyoruz. */
function transformFor(motion: Motion, progress: number): string {
  switch (motion) {
    case 'zoom-in':
      return `scale(${interpolate(progress, [0, 1], [1.06, 1.2])})`;
    case 'zoom-out':
      return `scale(${interpolate(progress, [0, 1], [1.2, 1.06])})`;
    case 'pan-left':
      return `scale(1.18) translateX(${interpolate(progress, [0, 1], [3.5, -3.5])}%)`;
    case 'pan-right':
      return `scale(1.18) translateX(${interpolate(progress, [0, 1], [-3.5, 3.5])}%)`;
  }
}

export const KenBurns: React.FC<Props> = ({ src, motion, durationInFrames }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, Math.max(1, durationInFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Kesmelerde sert bir sıçrama olmasın diye 3 karelik giriş.
  const opacity = interpolate(frame, [0, 3], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ overflow: 'hidden', opacity }}>
      <Img
        src={staticFile(src)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: transformFor(motion, progress),
          transformOrigin: 'center center',
        }}
      />
    </AbsoluteFill>
  );
};
