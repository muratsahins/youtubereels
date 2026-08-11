import path from 'node:path';

import { generateAssets } from './assets';
import { renderVideo } from './render';
import { generateScript } from './script';
import { generateVoice } from './voice';
import {
  arg,
  contentDir,
  ensureDir,
  isMain,
  requireArg,
  runCli,
  slugify,
  writeJson,
} from '../util/paths';

/**
 * Uçtan uca: konu → senaryo → ses + altyazı → görseller → mp4
 *
 * Kullanım:
 *   npm run all -- --topic "The real annual cost of a private jet"
 *   npm run all -- --topic "..." --skip-voice     (ElevenLabs anahtarı yokken)
 */
async function main(): Promise<void> {
  const topic = requireArg('topic');
  const slug = arg('slug') ?? slugify(topic);
  const skipVoice = process.argv.includes('--skip-voice');

  console.log(`\n=== ${slug} ===\n`);

  const script = await generateScript(topic);
  const dir = contentDir(slug);
  ensureDir(dir);
  writeJson(path.join(dir, 'script.json'), script);
  console.log(`[script] ${script.scenes.length} sahne — "${script.title}"`);

  if (skipVoice) {
    // Sessiz taslak: sahne başına sabit süre, ses yok.
    const perScene = 5;
    writeJson(path.join(dir, 'captions.json'), {
      durationSec: script.scenes.length * perScene,
      words: [],
      scenes: script.scenes.map((_, index) => ({
        index,
        start: index * perScene,
        end: (index + 1) * perScene,
      })),
    });
    console.log('[voice] atlandı (--skip-voice): sessiz taslak zamanlaması yazıldı');
  } else {
    await generateVoice(slug);
  }

  await generateAssets(slug);
  const output = await renderVideo(slug);

  console.log(`\n✔ ${output}\n`);
}

if (isMain(import.meta.url)) runCli(main);
