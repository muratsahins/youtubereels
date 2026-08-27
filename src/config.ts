import 'dotenv/config';

export { VIDEO } from './video';

/** Senaryo modeli. Bu projedeki tek LLM çağrısı burada. */
export const MODEL = 'claude-opus-5';

export const ELEVEN_MODEL_ID = process.env.ELEVENLABS_MODEL_ID ?? 'eleven_multilingual_v2';

export const IMAGE_PROVIDER = (process.env.IMAGE_PROVIDER ?? 'placeholder') as
  | 'placeholder'
  | 'replicate'
  | 'pexels'
  | 'manual';

/** Kanal kuralı: her zaman en üst kalite model. .env yoksa bile flux-1.1-pro'ya düş. */
export const REPLICATE_MODEL = process.env.REPLICATE_MODEL ?? 'black-forest-labs/flux-1.1-pro';

export const CONTENT_LANG = (process.env.CONTENT_LANG ?? 'en') as 'en' | 'tr';

export const MUSIC_FILE = process.env.MUSIC_FILE?.trim() || null;

/** Ses bittikten sonra bırakılan sessiz kuyruk (saniye). */
export const TAIL_SECONDS = 0.5;

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} tanımlı değil. .env.example dosyasını .env olarak kopyala ve doldur.`);
  }
  return value;
}
