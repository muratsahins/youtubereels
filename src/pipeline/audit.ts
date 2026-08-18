import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { OUT_DIR, assetsDir, ensureDir, isMain, publicRef, runCli } from '../util/paths';

/**
 * Her videonun görsellerini 2x2 kontakt sayfalarına dizer.
 * Amaç yükleme öncesi metin/logo taraması: Flux, ürünlerin marka taşıdığı
 * yüzeylere kendiliğinden bozuk wordmark boyayabiliyor ve bu marka riski yaratıyor.
 */
export function buildContactSheets(slug: string): string[] {
  const dir = assetsDir(slug);
  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.png'))
    .sort();

  const outDir = path.join(OUT_DIR, 'audit');
  ensureDir(outDir);
  const sheets: string[] = [];

  for (let page = 0; page * 4 < files.length; page++) {
    const group = files.slice(page * 4, page * 4 + 4);
    const target = path.join(outDir, `${slug}-${page + 1}.png`);

    const props = {
      images: group.map((file) => publicRef('content', slug, 'assets', file)),
      labels: group.map((file) => file.replace('.png', '')),
    };

    // Windows kabuğu inline JSON'daki tırnakları soyuyor; props'u dosyadan geçiriyoruz.
    const propsPath = path.join(outDir, `.${slug}-${page + 1}.props.json`);
    fs.writeFileSync(propsPath, JSON.stringify(props), 'utf8');

    const result = spawnSync(
      'npx',
      [
        'remotion',
        'still',
        'src/remotion/index.ts',
        'ContactSheet',
        target,
        `--props=${propsPath}`,
      ],
      { stdio: 'inherit', shell: process.platform === 'win32' },
    );

    fs.rmSync(propsPath, { force: true });

    if (result.status !== 0) throw new Error(`Kontakt sayfası üretilemedi: ${target}`);
    sheets.push(target);
  }

  return sheets;
}

async function main(): Promise<void> {
  const slugs = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  if (slugs.length === 0) throw new Error('En az bir slug ver.');

  for (const slug of slugs) {
    for (const sheet of buildContactSheets(slug)) console.log(sheet);
  }
}

if (isMain(import.meta.url)) runCli(main);
