import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';

/**
 * Kanal avatarı ve banner'ı. Videolarla aynı palet ve tipografiyi kullanır:
 * krem serif, altın harf aralıklı etiket, neredeyse siyah zemin.
 *
 * Flux'a yazı yazdırmak bozuk sonuç verdiği için kanal sanatı Remotion'da
 * üretilir — tipografi keskin, ölçüler tam olur.
 */

const CREAM = '#F5EFE3';
const GOLD = '#C9A227';
const INK = '#0B0B0F';
const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = 'Helvetica, Arial, sans-serif';

/** Neredeyse siyah zemin, ortasında hafif sıcak parıltı. */
const Backdrop: React.FC = () => (
  <>
    <AbsoluteFill style={{ backgroundColor: INK }} />
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(70% 60% at 50% 45%, rgba(201,162,39,0.16) 0%, rgba(201,162,39,0) 70%)',
      }}
    />
  </>
);

/**
 * 800x800 monogram: $ ve V.
 *
 * İki harf aynı punto ile yazılırsa eşit görünmez — Georgia'da $ glifi
 * versal yüksekliğini aşar, V ise tam versal boyundadır. Bu yüzden $ biraz
 * küçültülüp dikeyde kaydırılıyor; amaç iki formun optik olarak aynı
 * yükseklikte oturması.
 */
const MONO_SIZE = 300;

/** Ortalanmış, gerçekten dairesel halka. AbsoluteFill+margin kutuyu kare
 *  tutmadığı için ölçü açıkça veriliyor. */
const Ring: React.FC<{ size: number; width: number; opacity: number }> = ({
  size,
  width,
  opacity,
}) => (
  <div
    style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: size,
      height: size,
      marginTop: -size / 2,
      marginLeft: -size / 2,
      borderRadius: '50%',
      border: `${width}px solid ${GOLD}`,
      opacity,
    }}
  />
);

export const Avatar: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />

    <Ring size={700} width={2} opacity={0.4} />
    <Ring size={660} width={5} opacity={0.9} />

    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transform: 'translateY(-4px)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            transform: 'translateX(-18px)',
            filter: 'drop-shadow(0 16px 44px rgba(0,0,0,0.8))',
          }}
        >
          <span
            style={{
              fontFamily: SERIF,
              fontWeight: 700,
              fontSize: MONO_SIZE * 0.95,
              lineHeight: 1,
              color: CREAM,
              display: 'inline-block',
              marginRight: -6,
            }}
          >
            $
          </span>
          <span
            style={{
              fontFamily: SERIF,
              fontWeight: 700,
              fontSize: MONO_SIZE,
              lineHeight: 1,
              color: CREAM,
              letterSpacing: '-0.04em',
              display: 'inline-block',
            }}
          >
            V
          </span>
        </div>

        {/* harflerin altında ince altın çizgi */}
        <div
          style={{
            width: 170,
            height: 4,
            marginTop: 34,
            backgroundColor: GOLD,
            opacity: 0.95,
          }}
        />
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);

/**
 * 2048x1152. Her cihazda görünen güvenli alan ortadaki 1235x338 —
 * okunması gereken her şey oraya sığar, dışı yalnızca dekoratif.
 */
export const Banner: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    <AbsoluteFill
      style={{
        background:
          'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.55) 100%)',
      }}
    />

    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      {/* güvenli alan */}
      <div
        style={{
          width: 1235,
          height: 338,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: '0.34em',
            textTransform: 'uppercase',
            color: GOLD,
          }}
        >
          The Economics of Luxury
        </div>

        <div
          style={{
            width: 74,
            height: 3,
            backgroundColor: GOLD,
            opacity: 0.7,
            margin: '26px 0 30px',
          }}
        />

        <div
          style={{
            fontFamily: SERIF,
            fontWeight: 700,
            fontSize: 72,
            lineHeight: 1.05,
            whiteSpace: 'nowrap',
            color: CREAM,
            letterSpacing: '-0.02em',
            textShadow: '0 18px 60px rgba(0,0,0,0.75)',
          }}
        >
          The price tag is never the price.
        </div>

        <div
          style={{
            marginTop: 30,
            fontFamily: SANS,
            fontSize: 30,
            fontWeight: 500,
            letterSpacing: '0.04em',
            color: 'rgba(245,239,227,0.72)',
          }}
        >
          What it actually costs to own the things you are shown.
        </div>
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);

/* ---------------------------------------------------------------------------
 * Açık temalı banner.
 * ------------------------------------------------------------------------- */

const PAPER = '#F7F2E8';
const INK_TEXT = '#14141A';
/** Krem üzerinde okunabilir altın: #C9A227 kontrastı 2:1'de kalıyor, bu ~5:1. */
const GOLD_DEEP = '#7E620F';
/** Yalnızca dekoratif çizgiler için — metin taşımadığı için kontrast şartı yok. */
const GOLD_RULE = '#A8841A';

/**
 * Sahne görselleri 768x1344 dikey. Yatay bir banner'a tek görseli yayarsak
 * 2.7 kat büyütmek gerekir ve yumuşar; onun yerine üç dikey kare yan yana
 * konuyor — her biri 683x1152 alana küçülerek oturuyor, yani keskin kalıyor.
 */
const PANELS = [
  'content/the-houses-nobody-lives-in/assets/scene-01.png',
  'content/superyacht-annual-cost/assets/scene-03.png',
  'content/buying-a-second-citizenship/assets/scene-01.png',
];

export type BannerLightProps = {
  /**
   * Metnin arkasındaki zemin:
   * solid — dolu krem kart, en okunaklısı
   * glass — buzlu cam, fotoğraf kartın altından süzülür
   * none  — kart yok, yazı doğrudan fotoğrafın üstünde
   */
  plate: 'solid' | 'glass' | 'none';
};

/** Üç zemin türünün kart kutusuna yansıması. */
const PLATE_STYLE: Record<BannerLightProps['plate'], React.CSSProperties> = {
  solid: {
    backgroundColor: PAPER,
    border: '1px solid rgba(168,132,26,0.45)',
    boxShadow: '0 30px 80px rgba(20,20,26,0.22)',
  },
  glass: {
    backgroundColor: 'rgba(247,242,232,0.62)',
    border: '1px solid rgba(255,255,255,0.55)',
    boxShadow: '0 30px 80px rgba(20,20,26,0.18)',
    backdropFilter: 'blur(16px) saturate(1.15)',
  },
  // Kart yok: okunabilirliği kutu değil, arkadaki tam ekran hale sağlıyor (Halo).
  none: {},
};

/**
 * Kartsız sürümde metnin arkasındaki krem hale. Kutunun içine değil tuvalin
 * tamamına çiziliyor - kutuya sığdırılırsa gradyan kenarda kesilip görünür bir
 * dikdörtgen iz bırakıyor.
 */
const Halo: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        'radial-gradient(44% 34% at 50% 50%, rgba(247,242,232,0.9) 0%,' +
        ' rgba(247,242,232,0.55) 50%, rgba(247,242,232,0) 100%)',
    }}
  />
);

export const BannerLight: React.FC<BannerLightProps> = ({ plate }) => (
  <AbsoluteFill style={{ backgroundColor: PAPER }}>
    <AbsoluteFill style={{ display: 'flex', flexDirection: 'row', gap: 6 }}>
      {PANELS.map((src) => (
        <div key={src} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <Img
            src={staticFile(src)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              // Üç görselin ışığı ve doygunluğu birbirinden farklı; hepsini aynı
              // açık tona çekiyoruz ki tek bir kompozisyon gibi dursun.
              filter: 'brightness(1.03) saturate(0.94)',
            }}
          />
          <AbsoluteFill style={{ backgroundColor: 'rgba(247,242,232,0.10)' }} />
        </div>
      ))}
    </AbsoluteFill>

    {/* üst ve alt kenarlarda kağıda karışma */}
    <AbsoluteFill
      style={{
        background:
          'linear-gradient(to bottom, rgba(247,242,232,0.5) 0%, rgba(247,242,232,0) 20%,' +
          ' rgba(247,242,232,0) 80%, rgba(247,242,232,0.5) 100%)',
      }}
    />

    {plate === 'none' && <Halo />}

    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      {/*
        Güvenli alan 1235x338: telefonda yalnızca bu kadarı görünür. Kart ondan
        biraz büyük (1300x390), böylece metin her cihazda kartın içinde kalıyor
        ve masaüstünde iki yanda fotoğraf görünmeye devam ediyor.
      */}
      <div
        style={{
          width: 1300,
          height: 390,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          ...PLATE_STYLE[plate],
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '0.34em',
            textTransform: 'uppercase',
            color: GOLD_DEEP,
          }}
        >
          The Economics of Luxury
        </div>

        <div
          style={{
            width: 74,
            height: 3,
            backgroundColor: GOLD_RULE,
            opacity: 0.8,
            margin: '22px 0 24px',
          }}
        />

        <div
          style={{
            fontFamily: SERIF,
            fontWeight: 700,
            fontSize: 72,
            lineHeight: 1.05,
            whiteSpace: 'nowrap',
            color: INK_TEXT,
            letterSpacing: '-0.02em',
          }}
        >
          Luxury, itemized.
        </div>

        <div
          style={{
            marginTop: 22,
            fontFamily: SANS,
            fontSize: 25,
            fontWeight: 500,
            letterSpacing: '0.02em',
            color: 'rgba(20,20,26,0.68)',
          }}
        >
          The real cost of the yachts, jets and houses you are shown.
        </div>
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);
