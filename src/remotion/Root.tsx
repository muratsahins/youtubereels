import React from 'react';
import { Composition } from 'remotion';

import type { ShortProps } from '../types';
import { VIDEO } from '../video';
import { ContactSheet, type ContactSheetProps } from './ContactSheet';
import { LuxuryShort } from './LuxuryShort';

/** Studio'da props verilmeden açıldığında görünen boş taslak. */
const defaultProps: ShortProps = {
  slug: 'preview',
  title: 'Anatomy of Wealth',
  durationSec: 8,
  audio: null,
  music: null,
  scenes: [],
  words: [],
};

const contactSheetDefaults: ContactSheetProps = { images: [], labels: [] };

export const RemotionRoot: React.FC = () => {
  return (
    <>
    <Composition
      id="LuxuryShort"
      component={LuxuryShort}
      width={VIDEO.width}
      height={VIDEO.height}
      fps={VIDEO.fps}
      durationInFrames={Math.round(defaultProps.durationSec * VIDEO.fps)}
      defaultProps={defaultProps}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.max(1, Math.round(props.durationSec * VIDEO.fps)),
      })}
    />

    {/* Yükleme öncesi metin/logo denetimi için — video üretimine dahil değil. */}
    <Composition
      id="ContactSheet"
      component={ContactSheet}
      width={1536}
      height={2688}
      fps={1}
      durationInFrames={1}
      defaultProps={contactSheetDefaults}
    />
    </>
  );
};
