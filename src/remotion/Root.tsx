import React from 'react';
import { Composition } from 'remotion';

import type { ShortProps } from '../types';
import { VIDEO } from '../video';
import { Avatar, Banner, BannerLight, type BannerLightProps } from './ChannelArt';
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

    {/* Kanal sanatı — video üretimine dahil değil, elle still olarak alınır. */}
    <Composition
      id="Avatar"
      component={Avatar}
      width={800}
      height={800}
      fps={1}
      durationInFrames={1}
    />

    <Composition
      id="Banner"
      component={Banner}
      width={2048}
      height={1152}
      fps={1}
      durationInFrames={1}
    />

    {/* Açık tema — aynı ölçü ve tipografi, metin zemini üç türlü. */}
    <Composition
      id="BannerLight"
      component={BannerLight}
      width={2048}
      height={1152}
      fps={1}
      durationInFrames={1}
      defaultProps={{ plate: 'solid' } satisfies BannerLightProps}
    />

    <Composition
      id="BannerLightGlass"
      component={BannerLight}
      width={2048}
      height={1152}
      fps={1}
      durationInFrames={1}
      defaultProps={{ plate: 'glass' } satisfies BannerLightProps}
    />

    <Composition
      id="BannerLightBare"
      component={BannerLight}
      width={2048}
      height={1152}
      fps={1}
      durationInFrames={1}
      defaultProps={{ plate: 'none' } satisfies BannerLightProps}
    />
    </>
  );
};
