import React from 'react';
import { AbsoluteFill } from 'remotion';

/** Yazının her görselin üstünde okunabilir kalmasını sağlayan sabit karartma katmanı. */
export const Vignette: React.FC = () => (
  <>
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(120% 80% at 50% 40%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 100%)',
      }}
    />
    <AbsoluteFill
      style={{
        background:
          'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.75) 100%)',
      }}
    />
  </>
);
