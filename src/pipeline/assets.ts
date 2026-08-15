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
export const STYLE_SUFFIX =
  'cinematic still, dramatic low-key lighting, shallow depth of field, subtle film grain, ' +
  'rich contrast, vertical 9:16 composition, no text, no logos, no watermarks, no visible faces';

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

async function replicateImage(prompt: string): Promise<Buffer> {
  const token = requireEnv('REPLICATE_API_TOKEN');
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const body = JSON.stringify({
    input: {
      prompt: `${prompt}. ${STYLE_SUFFIX}`,
      aspect_ratio: '9:16',
      output_format: 'png',
      num_outputs: 1,
    },
  });

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

export async function generateAssets(slug: string): Promise<AssetManifest> {
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
      console.log(`[assets] ${file} üretiliyor (flux)…`);
      fs.writeFileSync(target, await replicateImage(scene.imagePrompt));
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
  await generateAssets(requireArg('slug'));
}

if (isMain(import.meta.url)) runCli(main);
