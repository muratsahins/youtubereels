import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

type Props = {
  value: string;
  label: string;
};

/**
 * Bu nişin retention motoru: her sahnede beklenen rakam.
 * Altyazı bandının üstünde, ekranın üst yarısında durur.
 */
export const NumberCard: React.FC<Props> = ({ value, label }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.6 } });
  const scale = interpolate(enter, [0, 1], [0.9, 1]);
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const drift = interpolate(frame, [0, 120], [0, -14], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 430,
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${drift}px) scale(${scale})`,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 190,
            lineHeight: 1,
            fontWeight: 700,
            color: '#F5EFE3',
            letterSpacing: '-0.03em',
            textShadow: '0 18px 60px rgba(0,0,0,0.75)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </div>
        <div
          style={{
            marginTop: 22,
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontSize: 34,
            fontWeight: 600,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: '#C9A227',
            textShadow: '0 4px 24px rgba(0,0,0,0.8)',
          }}
        >
          {label}
        </div>
      </div>
    </AbsoluteFill>
  );
};
