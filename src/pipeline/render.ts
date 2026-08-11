import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { MUSIC_FILE } from '../config';
import type { AssetManifest, Captions, ShortProps, VideoScript } from '../types';
import {
  OUT_DIR,
  PUBLIC_DIR,
  contentDir,
  ensureDir,
  isMain,
  publicRef,
  readJson,
  requireArg,
  runCli,
  writeJson,
} from '../util/paths';

const COMPOSITION_ID = 'LuxuryShort';
const ENTRY = 'src/remotion/index.ts';

export function buildProps(slug: string): ShortProps {
  const dir = contentDir(slug);
  const script = readJson<VideoScript>(path.join(dir, 'script.json'));
  const captions = readJson<Captions>(path.join(dir, 'captions.json'));
  const assets = readJson<AssetManifest>(path.join(dir, 'assets.json'));

  const assetByIndex = new Map(assets.scenes.map((entry) => [entry.index, entry.file]));

  const scenes = script.scenes.map((scene, index) => {
    const file = assetByIndex.get(index);
    if (!file) throw new Error(`Sahne ${index + 1} için görsel yok. "npm run assets" çalıştır.`);

    const timing = captions.scenes[index];
    if (!timing) throw new Error(`Sahne ${index + 1} için zamanlama yok. "npm run voice" çalıştır.`);

    return {
      src: publicRef('content', slug, 'assets', file),
      motion: scene.motion,
      start: timing.start,
      end: timing.end,
      bigNumber: scene.bigNumber,
    };
  });

  const audioPath = path.join(dir, 'voice.mp3');
  const music =
    MUSIC_FILE && fs.existsSync(path.join(PUBLIC_DIR, 'music', MUSIC_FILE))
      ? publicRef('music', MUSIC_FILE)
      : null;

  return {
    slug,
    title: script.title,
    durationSec: captions.durationSec,
    audio: fs.existsSync(audioPath) ? publicRef('content', slug, 'voice.mp3') : null,
    music,
    scenes,
    words: captions.words,
  };
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} çıkış kodu ${code}`));
    });
  });
}

export async function renderVideo(slug: string): Promise<string> {
  const props = buildProps(slug);
  const propsPath = path.join(contentDir(slug), 'props.json');
  writeJson(propsPath, props);

  ensureDir(OUT_DIR);
  const outputPath = path.join(OUT_DIR, `${slug}.mp4`);

  console.log(`[render] ${props.scenes.length} sahne, ${props.durationSec.toFixed(1)} sn`);
  await run('npx', [
    'remotion',
    'render',
    ENTRY,
    COMPOSITION_ID,
    outputPath,
    `--props=${propsPath}`,
  ]);

  console.log(`[render] hazır: ${outputPath}`);
  return outputPath;
}

async function main(): Promise<void> {
  await renderVideo(requireArg('slug'));
}

if (isMain(import.meta.url)) runCli(main);
