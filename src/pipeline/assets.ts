import fs from 'node:fs';
import path from 'node:path';

import { IMAGE_PROVIDER, REPLICATE_MODEL, requireEnv } from '../config';
import type { AssetManifest, VideoScript } from '../types';
import {
  assetsDir,
  contentDir,
  ensureDir,
  isMain,
  readJson,
  requireArg,
  runCli,
  writeJson,
} from '../util/paths';

/** Tüm sahnelere uygulanan ortak görsel imza — kanalın tutarlı bir görünüşü olsun diye. */
/** Aydınlatma dışında her videoda aynı kalan görsel imza. */
const STYLE_BASE =
  'shallow depth of field, subtle film grain, rich contrast, vertical 9:16 composition, ' +
  'no text, no logos, no watermarks, no visible faces';

/**
 * Kanalın varsayılanı gündüz (2026-08-25 itibarıyla). Rakam kartı krem/altın ve üst
 * üçte birde durduğu için gündüz karelerde üst bölümün gölgede kalması şart -
 * bu kural script.ts sistem promptunda görsel promptlara dayatılıyor.
 * Gece varyantı hâlâ duruyor: npm run assets -- --slug X --night
 */
export const STYLE_SUFFIX = 'cinematic still, dramatic low-key lighting, ' + STYLE_BASE;
export const DAYLIGHT_STYLE_SUFFIX =
  'cinematic still, bright natural daylight, soft directional sunlight, clear sky, ' + STYLE_BASE;

const PALETTES: [string, string][] = [
  ['#0b0b0f', '#3a2c1a'],
  ['#0a0d12', '#1f3140'],
  ['#100b0b', '#4a2a20'],
  ['#0c0f0c', '#26362a'],
  ['#0d0a10', '#39264a'],
  ['#0f0d09', '#4a3c1e'],
];

function placeholderSvg(index: number): string {
  const palette = PALETTES[index % PALETTES.length] ?? PALETTES[0]!;
  const [from, to] = palette;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <radialGradient id="g" cx="50%" cy="35%" r="80%">
      <stop offset="0%" stop-color="${to}"/>
      <stop offset="100%" stop-color="${from}"/>
    </radialGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#g)"/>
  <text x="540" y="940" fill="#ffffff22" font-family="Georgia, serif" font-size="220"
        text-anchor="middle">${String(index + 1).padStart(2, '0')}</text>
  <text x="540" y="1030" fill="#ffffff22" font-family="Helvetica, Arial, sans-serif"
        font-size="30" letter-spacing="8" text-anchor="middle">PLACEHOLDER</text>
</svg>`;
}

/** imagePrompt uzun ve sinematik; stok arama için kısa somut bir sorguya indiriyoruz. */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'in', 'on', 'at', 'with', 'and', 'from', 'into',
  'view', 'shot', 'close', 'macro', 'detail', 'wide', 'aerial', 'interior',
  'vertical', 'dark', 'cold', 'warm', 'soft', 'deep', 'empty', 'large', 'vast',
]);

function deriveQuery(imagePrompt: string): string {
  const firstClause = imagePrompt.split(',')[0] ?? imagePrompt;
  const words = firstClause
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
  return words.slice(0, 3).join(' ') || 'luxury';
}

type PexelsResponse = {
  photos?: { src?: { original?: string; large2x?: string } }[];
};

async function pexelsImage(query: string, offset: number): Promise<Buffer> {
  const apiKey = requireEnv('PEXELS_API_KEY');

  const url =
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}` +
    `&orientation=portrait&per_page=15`;

  const response = await fetch(url, { headers: { Authorization: apiKey } });
  if (!response.ok) {
    throw new Error(`Pexels ${response.status}: ${await response.text()}`);
  }

  const json = (await response.json()) as PexelsResponse;
  const photos = json.photos ?? [];
  if (photos.length === 0) {
    throw new Error(`Pexels "${query}" için sonuç döndürmedi. stockQuery'yi genelleştir.`);
  }

  // Aynı sorgu birden fazla sahnede çıkarsa aynı fotoğrafı iki kez kullanmayalım.
  const photo = photos[offset % photos.length]!;
  const source = photo.src?.original ?? photo.src?.large2x;
  if (!source) throw new Error('Pexels sonucunda kullanılabilir görsel yok.');

  const image = await fetch(source);
  if (!image.ok) throw new Error(`Görsel indirilemedi: ${image.status}`);
  return Buffer.from(await image.arrayBuffer());
}

type Prediction = {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[] | null;
  error?: string | null;
  urls?: { get?: string };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function replicateAttempt(prompt: string, daylight: boolean): Promise<Buffer> {
  const token = requireEnv('REPLICATE_API_TOKEN');
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const suffix = daylight ? DAYLIGHT_STYLE_SUFFIX : STYLE_SUFFIX;

  // flux-1.1-pro num_outputs kabul etmiyor ve 9:16'da 768x1344 üretiyor; custom
  // ölçüyle 832x1440'a çıkıyoruz (kare 1080x1920 render ediliyor, upscale azalsın).
  const isPro = REPLICATE_MODEL.includes('-pro');
  const input = isPro
    ? {
        prompt: `${prompt}. ${suffix}`,
        aspect_ratio: 'custom' as const,
        width: 832,
        height: 1440,
        output_format: 'png' as const,
        safety_tolerance: 2,
      }
    : {
        prompt: `${prompt}. ${suffix}`,
        aspect_ratio: '9:16' as const,
        output_format: 'png' as const,
        num_outputs: 1,
      };

  const body = JSON.stringify({ input });

  // Replicate hesap durumuna göre dakikada birkaç isteğe kadar kısıtlayabiliyor.
  // Bir 429 tüm partiyi düşürmemeli; bekleyip tekrar deniyoruz.
  let response: Response | undefined;
  for (let attempt = 1; attempt <= 5; attempt++) {
    response = await fetch(`https://api.replicate.com/v1/models/${REPLICATE_MODEL}/predictions`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'wait' },
      body,
    });

    if (response.status !== 429) break;

    const retryAfter = Number(response.headers.get('retry-after'));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : attempt * 12000;
    console.log(`[assets]   hız sınırı, ${Math.round(waitMs / 1000)} sn bekleniyor…`);
    await sleep(waitMs);
  }

  if (!response) throw new Error('Replicate isteği kurulamadı.');
  if (!response.ok) {
    throw new Error(`Replicate ${response.status}: ${await response.text()}`);
  }

  let prediction = (await response.json()) as Prediction;

  // `Prefer: wait` çoğu zaman bitmiş sonucu döner; dönmezse kısa bir poll.
  const pollUrl = prediction.urls?.get;
  for (let attempt = 0; attempt < 60 && prediction.status !== 'succeeded'; attempt++) {
    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new Error(`Replicate tahmini başarısız: ${prediction.error ?? prediction.status}`);
    }
    if (!pollUrl) break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const poll = await fetch(pollUrl, { headers });
    prediction = (await poll.json()) as Prediction;
  }

  const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (!output) throw new Error('Replicate çıktısı boş döndü.');

  const image = await fetch(output);
  if (!image.ok) throw new Error(`Görsel indirilemedi: ${image.status}`);
  return Buffer.from(await image.arrayBuffer());
}

/**
 * Replicate zaman zaman tahminleri sunucu tarafında düşürüyor (örn. E9828).
 * Bunlar geçici; aynı istek birkaç saniye sonra sorunsuz çalışıyor. Tek bir
 * hıçkırık 8 görsellik partiyi düşürmesin diye sahne bazında tekrar deniyoruz.
 */
async function replicateImage(prompt: string, daylight: boolean): Promise<Buffer> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await replicateAttempt(prompt, daylight);
    } catch (error) {
      lastError = error;
      if (attempt === 3) break;
      const message = error instanceof Error ? error.message : String(error);
      console.log(`[assets]   deneme ${attempt} başarısız (${message}); tekrar deneniyor…`);
      await sleep(attempt * 5000);
    }
  }

  throw lastError;
}

export async function generateAssets(
  slug: string,
  options: { daylight?: boolean } = {},
): Promise<AssetManifest> {
  const daylight = options.daylight ?? true;
  const dir = contentDir(slug);
  const script = readJson<VideoScript>(path.join(dir, 'script.json'));
  const outDir = assetsDir(slug);
  ensureDir(outDir);

  const manifest: AssetManifest = { provider: IMAGE_PROVIDER, scenes: [] };
  const missing: string[] = [];

  for (const [index, scene] of script.scenes.entries()) {
    const stem = `scene-${String(index + 1).padStart(2, '0')}`;

    if (IMAGE_PROVIDER === 'placeholder') {
      const file = `${stem}.svg`;
      fs.writeFileSync(path.join(outDir, file), placeholderSvg(index), 'utf8');
      manifest.scenes.push({ index, file });
      continue;
    }

    const file = `${stem}.png`;
    const target = path.join(outDir, file);

    if (IMAGE_PROVIDER === 'manual') {
      if (!fs.existsSync(target)) missing.push(file);
      manifest.scenes.push({ index, file });
      continue;
    }

    if (fs.existsSync(target)) {
      console.log(`[assets] ${file} zaten var, atlanıyor`);
      manifest.scenes.push({ index, file });
      continue;
    }

    if (IMAGE_PROVIDER === 'replicate') {
      console.log(`[assets] ${file} üretiliyor (${REPLICATE_MODEL}, ${daylight ? 'gündüz' : 'gece'})…`);
      fs.writeFileSync(target, await replicateImage(scene.imagePrompt, daylight));
    } else {
      // Eski senaryolarda stockQuery alanı olmayabilir; prompt'tan türetiyoruz.
      const stockQuery =
        (scene as { stockQuery?: string }).stockQuery ?? deriveQuery(scene.imagePrompt);
      console.log(`[assets] ${file} aranıyor (pexels: "${stockQuery}")…`);
      fs.writeFileSync(target, await pexelsImage(stockQuery, index));
    }

    manifest.scenes.push({ index, file });
  }

  if (missing.length > 0) {
    throw new Error(
      `${missing.length} görsel eksik:\n  ${missing.join('\n  ')}\n\n` +
        `Bunları şu klasöre koy: ${outDir}\n` +
        `Prompt'lar için: npm run prompts -- --slug ${slug}`,
    );
  }

  writeJson(path.join(dir, 'assets.json'), manifest);
  console.log(`[assets] ${manifest.scenes.length} görsel hazır (${IMAGE_PROVIDER})`);
  return manifest;
}

async function main(): Promise<void> {
  await generateAssets(requireArg('slug'), {
    daylight: !process.argv.includes('--night'),
  });
}

if (isMain(import.meta.url)) runCli(main);
