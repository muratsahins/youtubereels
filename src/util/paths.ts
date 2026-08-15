import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const ROOT = process.cwd();
export const PUBLIC_DIR = path.join(ROOT, 'public');
export const CONTENT_ROOT = path.join(PUBLIC_DIR, 'content');
export const OUT_DIR = path.join(ROOT, 'out');

export function contentDir(slug: string): string {
  return path.join(CONTENT_ROOT, slug);
}

export function assetsDir(slug: string): string {
  return path.join(contentDir(slug), 'assets');
}

/** Remotion staticFile() için public/ köküne göreli, forward-slash'lı yol. */
export function publicRef(...segments: string[]): string {
  return segments.join('/');
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function readJson<T>(file: string): T {
  if (!fs.existsSync(file)) {
    throw new Error(`Dosya yok: ${file}\nÖnceki pipeline adımını çalıştırdın mı?`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

export function writeJson(file: string, data: unknown): void {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');

export function slugify(input: string): string {
  const map: Record<string, string> = {
    ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u',
    Ç: 'c', Ğ: 'g', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u',
  };
  return input
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** `--key value` ve `--key=value` biçimlerini okur. */
export function arg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  const withEquals = argv.find((a) => a.startsWith(`--${name}=`));
  if (withEquals) return withEquals.slice(name.length + 3);
  const idx = argv.indexOf(`--${name}`);
  if (idx !== -1) {
    const next = argv[idx + 1];
    if (next && !next.startsWith('--')) return next;
  }
  return undefined;
}

export function requireArg(name: string): string {
  const value = arg(name);
  if (!value) throw new Error(`--${name} argümanı gerekli.`);
  return value;
}

/** Dosya doğrudan çalıştırıldı mı (Windows yol biçimiyle uyumlu). */
export function isMain(importMetaUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return importMetaUrl === pathToFileURL(entry).href;
}

/**
 * Bir hatayı yakalayıp süreci düzgün sonlandıran CLI sarmalayıcısı.
 * process.exit() yerine exitCode kullanıyoruz: Windows'ta açık bir fetch varken
 * exit() çağırmak libuv assertion gürültüsü basıyor.
 */
export function runCli(fn: () => Promise<void>): void {
  fn().catch((error: unknown) => {
    console.error('\n✖ ' + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  });
}
