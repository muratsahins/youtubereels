import type { CaptionWord } from '../types';

export type CaptionChunk = {
  words: CaptionWord[];
  start: number;
  end: number;
};

const MAX_WORDS = 4;
const MAX_DURATION = 1.9;
const MAX_GAP = 0.45;

/** Kelimeleri okunabilir kısa öbeklere böler: cümle sonu, uzun duraklama veya 4 kelime. */
export function toCaptionChunks(words: CaptionWord[]): CaptionChunk[] {
  const chunks: CaptionChunk[] = [];
  let current: CaptionWord[] = [];

  const flush = () => {
    if (current.length === 0) return;
    const first = current[0]!;
    const last = current[current.length - 1]!;
    chunks.push({ words: current, start: first.start, end: last.end });
    current = [];
  };

  for (const [index, word] of words.entries()) {
    current.push(word);

    const next = words[index + 1];
    const chunkStart = current[0]!.start;
    const endsSentence = /[.!?:—]$/.test(word.text);
    const gapTooBig = next != null && next.start - word.end > MAX_GAP;
    const tooLong = word.end - chunkStart >= MAX_DURATION;

    if (current.length >= MAX_WORDS || endsSentence || gapTooBig || tooLong) flush();
  }

  flush();

  // Cümlenin son kelimesi öbek sınırına denk gelince tek kelimelik yetim öbek
  // kalıyor ("logo."). Ekranda tek bir kelime, üstelik aktif olduğu için tamamen
  // vurgu renginde — bozuk görünüyor. Geriye doğru birleştiriyoruz.
  for (let index = chunks.length - 1; index > 0; index--) {
    const chunk = chunks[index]!;
    const previous = chunks[index - 1]!;
    if (chunk.words.length > 1 || previous.words.length >= MAX_WORDS + 2) continue;

    previous.words = [...previous.words, ...chunk.words];
    previous.end = chunk.end;
    chunks.splice(index, 1);
  }

  return chunks;
}
