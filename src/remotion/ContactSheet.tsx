import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';

export type ContactSheetProps = {
  /** public/ köküne göreli görsel yolları, en fazla 4 tane. */
  images: string[];
  labels: string[];
};

/**
 * Yükleme öncesi denetim aracı: görselleri neredeyse tam çözünürlükte bir ızgarada
 * yan yana koyar, böylece 8 sahne 2 bakışta metin/logo açısından taranabilir.
 * Kanal kimliği grade'i BİLEREK uygulanmıyor — ham görselde ne varsa görmek istiyoruz.
 */
export const ContactSheet: React.FC<ContactSheetProps> = ({ images, labels }) => (
  <AbsoluteFill
    style={{
      backgroundColor: '#111',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: '1fr 1fr',
    }}
  >
    {images.map((src, index) => (
      <div key={src} style={{ position: 'relative', overflow: 'hidden' }}>
        <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            padding: '10px 22px',
            backgroundColor: 'rgba(0,0,0,0.75)',
            color: '#fff',
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontSize: 40,
            fontWeight: 700,
          }}
        >
          {labels[index] ?? ''}
        </div>
      </div>
    ))}
  </AbsoluteFill>
);
