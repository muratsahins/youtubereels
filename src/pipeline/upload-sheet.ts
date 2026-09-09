import fs from 'node:fs';
import path from 'node:path';

import type { Captions, VideoScript } from '../types';
import {
  CONTENT_ROOT,
  OUT_DIR,
  contentDir,
  ensureDir,
  isMain,
  readJson,
  runCli,
  arg,
} from '../util/paths';

/** YouTube açıklama alanına gömülecek hashtag sayısı (fazlası spam sayılır). */
const HASHTAG_COUNT = 3;

const LANG_NAMES: Record<string, string> = {
  en: 'İngilizce (video dili)',
  es: 'İspanyolca',
  hi: 'Hintçe',
  'pt-BR': 'Portekizce (Brezilya)',
  tr: 'Türkçe',
};

/** Slug klasöründeki captions*.srt dosyalarını dil adlarıyla listeler. */
function captionFiles(slug: string): string[] {
  const dir = contentDir(slug);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((file) => /^captions(\.[a-zA-Z-]+)?\.srt$/.test(file))
    .map((file) => {
      const match = file.match(/^captions\.([a-zA-Z-]+)\.srt$/);
      const lang = match ? match[1]! : 'en';
      return { file, label: LANG_NAMES[lang] ?? lang };
    })
    .sort((a, b) => (a.label === 'İngilizce (video dili)' ? -1 : a.label.localeCompare(b.label)))
    .map(({ file, label }) => `${label}: \`${path.join(contentDir(slug), file)}\``);
}

function hashtag(tag: string): string {
  const parts = tag.split(/[^a-z0-9]+/i).filter(Boolean);
  const joined = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  return `#${joined}`;
}

/** out/ içinde render edilmiş mp4'ü olan slug'lar, alfabetik. */
function renderedSlugs(): string[] {
  if (!fs.existsSync(CONTENT_ROOT)) return [];
  return fs
    .readdirSync(CONTENT_ROOT)
    .filter((slug) => fs.existsSync(path.join(OUT_DIR, `${slug}.mp4`)))
    .filter((slug) => fs.existsSync(path.join(contentDir(slug), 'script.json')))
    .sort();
}

function sectionFor(slug: string): string[] {
  const dir = contentDir(slug);
  const script = readJson<VideoScript>(path.join(dir, 'script.json'));
  const mp4 = path.join(OUT_DIR, `${slug}.mp4`);
  const sizeMb = (fs.statSync(mp4).size / 1_000_000).toFixed(1);

  let duration = '?';
  const captionsFile = path.join(dir, 'captions.json');
  if (fs.existsSync(captionsFile)) {
    duration = readJson<Captions>(captionsFile).durationSec.toFixed(1);
  }

  const tags = script.tags.slice(0, HASHTAG_COUNT).map(hashtag).join(' ');
  const captions = captionFiles(slug);

  return [
    `## ${slug}`,
    '',
    `**Dosya:** \`${mp4}\`  (${sizeMb} MB, ${duration} sn)`,
    '',
    '### Altyazı dosyaları',
    '',
    ...(captions.length > 0
      ? [
          'Altyazı içeriğe gömülü değil — Studio\'da "Altyazı ve ses" sekmesinden her dili ayrı yükle:',
          '',
          ...captions.map((line) => `- ${line}`),
        ]
      : ['Bu video için henüz .srt üretilmedi ("npm run srt -- --slug ' + slug + '").']),
    '',
    `### Başlık  _(${script.title.length}/100 karakter)_`,
    '',
    '```',
    script.title,
    '```',
    '',
    '### Açıklama',
    '',
    '```',
    script.description,
    '',
    tags,
    '```',
    '',
    '### Etiketler',
    '',
    '```',
    script.tags.join(', '),
    '```',
    '',
    '---',
    '',
  ];
}

export function writeUploadSheet(slugs: string[]): string {
  const lines: string[] = [
    '# YouTube yükleme föyü',
    '',
    `${slugs.length} video. Her blok YouTube Studio'ya kopyala-yapıştır hazır.`,
    '',
    'Her yüklemede aynı kalan ayarlar:',
    '',
    '- **Kitle:** "Hayır, çocuklara yönelik değil" (bu hat yetişkin finans içeriği üretir)',
    '- **Shorts:** dikey 1080×1920 ve 3 dakikanın altında olduğu için otomatik algılanır,',
    '  ayrı bir kutu işaretlemene gerek yok.',
    '- **Görünürlük:** taslak olarak yükleyip zamanla; hepsini aynı anda yayına alma.',
    '- **Dil / altyazı:** altyazı videoya gömülü DEĞİL. Her video için aşağıda listelenen',
    '  .srt dosyalarını Studio\'da "Altyazı ve ses" sekmesinden tek tek yükle.',
    '',
    '---',
    '',
  ];

  for (const slug of slugs) lines.push(...sectionFor(slug));

  ensureDir(OUT_DIR);
  const file = path.join(OUT_DIR, 'upload-sheet.md');
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  return file;
}

async function main(): Promise<void> {
  const only = arg('slug');
  const slugs = only ? [only] : renderedSlugs();
  if (slugs.length === 0) throw new Error('out/ içinde render edilmiş mp4 yok.');

  const file = writeUploadSheet(slugs);
  console.log(`[sheet] ${slugs.length} video yazıldı: ${file}`);
}

if (isMain(import.meta.url)) runCli(main);
