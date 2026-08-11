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
const STYLE_SUFFIX =
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

type Prediction = {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[] | null;
  error?: string | null;
  urls?: { get?: string };
};

async function replicateImage(prompt: string): Promise<Buffer> {
  const token = requireEnv('REPLICATE_API_TOKEN');
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(
    `https://api.replicate.com/v1/models/${REPLICATE_MODEL}/predictions`,
    {
      method: 'POST',
      headers: { ...headers, Prefer: 'wait' },
      body: JSON.stringify({
        input: {
          prompt: `${prompt}. ${STYLE_SUFFIX}`,
          aspect_ratio: '9:16',
          output_format: 'png',
          num_outputs: 1,
        },
      }),
    },
  );

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

  for (const [index, scene] of script.scenes.entries()) {
    const stem = `scene-${String(index + 1).padStart(2, '0')}`;

    if (IMAGE_PROVIDER === 'replicate') {
      const file = `${stem}.png`;
      const target = path.join(outDir, file);
      if (fs.existsSync(target)) {
        console.log(`[assets] ${file} zaten var, atlanıyor`);
      } else {
        console.log(`[assets] ${file} üretiliyor…`);
        fs.writeFileSync(target, await replicateImage(scene.imagePrompt));
      }
      manifest.scenes.push({ index, file });
    } else {
      const file = `${stem}.svg`;
      fs.writeFileSync(path.join(outDir, file), placeholderSvg(index), 'utf8');
      manifest.scenes.push({ index, file });
    }
  }

  writeJson(path.join(dir, 'assets.json'), manifest);
  console.log(`[assets] ${manifest.scenes.length} görsel hazır (${IMAGE_PROVIDER})`);
  return manifest;
}

async function main(): Promise<void> {
  await generateAssets(requireArg('slug'));
}

if (isMain(import.meta.url)) runCli(main);
