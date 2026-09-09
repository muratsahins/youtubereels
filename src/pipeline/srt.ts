import fs from 'node:fs';
import path from 'node:path';

import type { Captions } from '../types';
import { toCaptionChunks } from '../util/captions';
import { arg, CONTENT_ROOT, contentDir, isMain, readJson, runCli } from '../util/paths';

/** Kanal kuralı (2026-09-03): İngilizce dışındaki altyazı dilleri. */
export const SUBTITLE_LANGS = ['es', 'hi', 'pt-BR', 'tr'] as const;
export type SubtitleLang = (typeof SUBTITLE_LANGS)[number];

/** slug/translations.json şekli: her dil, sahnelerle aynı sırada bir cümle dizisi. */
export type Translations = Partial<Record<SubtitleLang, string[]>>;

function formatTimestamp(seconds: number): string {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const rest = ms % 1000;
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(rest, 3)}`;
}

function toSrt(cues: { start: number; end: number; text: string }[]): string {
  return cues
    .map(
      (cue, index) =>
        `${index + 1}\n${formatTimestamp(cue.start)} --> ${formatTimestamp(cue.end)}\n${cue.text}\n`,
    )
    .join('\n');
}

/** Orijinal İngilizce: kelime bazlı zamanlamayı okunabilir kısa öbeklere böler. */
export function captionsToSrt(captions: Captions): string {
  const chunks = toCaptionChunks(captions.words);
  return toSrt(chunks.map((c) => ({ start: c.start, end: c.end, text: c.words.map((w) => w.text).join(' ') })));
}

/** Çeviri dilleri: kelime hizalaması anlamsız olduğu için sahne başına tek altyazı kartı. */
export function translationToSrt(captions: Captions, sceneTexts: string[]): string {
  if (sceneTexts.length !== captions.scenes.length) {
    throw new Error(
      `Çeviri sahne sayısı uyuşmuyor: ${sceneTexts.length} çeviri, ${captions.scenes.length} sahne.`,
    );
  }
  return toSrt(
    captions.scenes.map((scene, i) => ({ start: scene.start, end: scene.end, text: sceneTexts[i]! })),
  );
}

function writeEnglishSrt(slug: string): string | null {
  const captionsFile = path.join(contentDir(slug), 'captions.json');
  if (!fs.existsSync(captionsFile)) return null;

  const captions = readJson<Captions>(captionsFile);
  const outFile = path.join(contentDir(slug), 'captions.srt');
  fs.writeFileSync(outFile, captionsToSrt(captions), 'utf8');
  return outFile;
}

function writeTranslatedSrts(slug: string): string[] {
  const captionsFile = path.join(contentDir(slug), 'captions.json');
  const translationsFile = path.join(contentDir(slug), 'translations.json');
  if (!fs.existsSync(captionsFile) || !fs.existsSync(translationsFile)) return [];

  const captions = readJson<Captions>(captionsFile);
  const translations = readJson<Translations>(translationsFile);

  const written: string[] = [];
  for (const lang of SUBTITLE_LANGS) {
    const texts = translations[lang];
    if (!texts) continue;
    const outFile = path.join(contentDir(slug), `captions.${lang}.srt`);
    fs.writeFileSync(outFile, translationToSrt(captions, texts), 'utf8');
    written.push(outFile);
  }
  return written;
}

function writeAllForSlug(slug: string): string[] {
  const en = writeEnglishSrt(slug);
  const translated = writeTranslatedSrts(slug);
  return en ? [en, ...translated] : translated;
}

async function main(): Promise<void> {
  const slug = arg('slug');

  if (slug) {
    const written = writeAllForSlug(slug);
    if (written.length === 0) {
      throw new Error(`captions.json yok: ${path.join(contentDir(slug), 'captions.json')}`);
    }
    written.forEach((f) => console.log(`[srt] yazıldı: ${f}`));
    return;
  }

  const slugs = fs
    .readdirSync(CONTENT_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  let count = 0;
  for (const s of slugs) {
    const written = writeAllForSlug(s);
    written.forEach((f) => console.log(`[srt] yazıldı: ${f}`));
    count += written.length;
  }
  console.log(`[srt] toplam ${count} dosya üretildi.`);
}

if (isMain(import.meta.url)) runCli(main);
