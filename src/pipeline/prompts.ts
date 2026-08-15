import path from 'node:path';
import fs from 'node:fs';

import type { VideoScript } from '../types';
import { assetsDir, contentDir, ensureDir, isMain, readJson, requireArg, runCli } from '../util/paths';
import { STYLE_SUFFIX } from './assets';

const MODEL_URL = 'https://replicate.com/black-forest-labs/flux-schnell';

/**
 * Görselleri elle üretmek için kopyala-yapıştır hazır prompt listesi çıkarır.
 * Replicate'in web arayüzü ücretsiz çalıştırmaya izin verdiği için, kredi
 * yüklemeden de API ile birebir aynı sonucu almanın yolu bu.
 */
export function writePrompts(slug: string): string {
  const dir = contentDir(slug);
  const script = readJson<VideoScript>(path.join(dir, 'script.json'));
  const outDir = assetsDir(slug);
  ensureDir(outDir);

  const lines: string[] = [
    `# ${script.title}`,
    '',
    `Model:      ${MODEL_URL}`,
    'Ayarlar:    aspect_ratio = 9:16   |   output_format = png',
    `Kaydet:     ${outDir}`,
    '',
    'Her prompt için çıkan görseli karşısındaki dosya adıyla kaydet.',
    'Bitince:    npm run assets -- --slug ' + slug + '   (IMAGE_PROVIDER=manual)',
    '            npm run render -- --slug ' + slug,
    '',
    '='.repeat(78),
    '',
  ];

  for (const [index, scene] of script.scenes.entries()) {
    const file = `scene-${String(index + 1).padStart(2, '0')}.png`;
    lines.push(`--- ${file} ---`);
    lines.push('');
    lines.push(`${scene.imagePrompt}. ${STYLE_SUFFIX}`);
    lines.push('');
  }

  const file = path.join(dir, 'prompts.txt');
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  return file;
}

async function main(): Promise<void> {
  const slug = requireArg('slug');
  const file = writePrompts(slug);
  console.log(`[prompts] yazıldı: ${file}`);
  console.log(`[prompts] model: ${MODEL_URL}`);
}

if (isMain(import.meta.url)) runCli(main);
