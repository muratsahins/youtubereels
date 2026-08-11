import { z } from 'zod';

/**
 * Yapılandırılmış çıktı şeması.
 * Not: structured outputs sayısal/uzunluk kısıtlarını (min/max) desteklemez —
 * sahne sayısı gibi kuralları prompt'ta belirtiyoruz, şemada değil.
 */
export const MotionSchema = z.enum(['zoom-in', 'zoom-out', 'pan-left', 'pan-right']);

export const BigNumberSchema = z.object({
  value: z.string().describe('Ekranda büyük gösterilecek rakam, örn. "$4.2M" veya "40"'),
  label: z.string().describe('Rakamın altındaki kısa açıklama, en fazla 5 kelime'),
});

export const SceneSchema = z.object({
  narration: z.string().describe('Bu sahnede seslendirilecek metin, 1-2 cümle'),
  imagePrompt: z
    .string()
    .describe(
      'Görsel üretim prompt\'u. Marka adı, logo, ünlü ismi veya tanınabilir yüz İÇERMEZ.',
    ),
  motion: MotionSchema,
  bigNumber: BigNumberSchema.nullable().describe('Rakam yoksa null'),
});

export const VideoScriptSchema = z.object({
  title: z.string().describe('YouTube başlığı, en fazla 60 karakter'),
  description: z.string().describe('2-3 cümlelik açıklama'),
  tags: z.array(z.string()).describe('8-12 etiket'),
  scenes: z.array(SceneSchema).describe('6-9 sahne. İlk sahne kanca, son sahne döngüyü kapatır.'),
});

export type Motion = z.infer<typeof MotionSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type VideoScript = z.infer<typeof VideoScriptSchema>;

export type CaptionWord = {
  text: string;
  start: number;
  end: number;
};

export type SceneTiming = {
  index: number;
  start: number;
  end: number;
};

export type Captions = {
  durationSec: number;
  words: CaptionWord[];
  scenes: SceneTiming[];
};

export type AssetManifest = {
  provider: string;
  scenes: { index: number; file: string }[];
};

/** Remotion kompozisyonuna giren düzleştirilmiş props. */
export type RenderScene = {
  src: string;
  motion: Motion;
  start: number;
  end: number;
  bigNumber: { value: string; label: string } | null;
};

export type ShortProps = {
  slug: string;
  title: string;
  durationSec: number;
  audio: string | null;
  music: string | null;
  scenes: RenderScene[];
  words: CaptionWord[];
};
