import fs from 'node:fs';
import path from 'node:path';

import { ELEVEN_MODEL_ID, TAIL_SECONDS, requireEnv } from '../config';
import type { CaptionWord, Captions, SceneTiming, VideoScript } from '../types';
import {
  contentDir,
  ensureDir,
  isMain,
  readJson,
  requireArg,
  runCli,
  writeJson,
} from '../util/paths';

type Alignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

type TtsResponse = {
  audio_base64: string;
  alignment: Alignment | null;
};

const ENDPOINT = 'https://api.elevenlabs.io/v1/text-to-speech';

/** Sahne metinlerini tek bir seslendirme metnine birleştirir ve karakter aralıklarını döner. */
function buildText(script: VideoScript): { fullText: string; ranges: { start: number; end: number }[] } {
  const segments = script.scenes.map((scene) => scene.narration.trim().replace(/\s+/g, ' '));
  const ranges: { start: number; end: number }[] = [];
  let cursor = 0;

  for (const segment of segments) {
    ranges.push({ start: cursor, end: cursor + segment.length });
    cursor += segment.length + 1; // araya bir boşluk
  }

  return { fullText: segments.join(' '), ranges };
}

async function synthesize(text: string): Promise<TtsResponse> {
  const apiKey = requireEnv('ELEVENLABS_API_KEY');
  const voiceId = requireEnv('ELEVENLABS_VOICE_ID');

  const url = `${ENDPOINT}/${voiceId}/with-timestamps?output_format=mp3_44100_128`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: ELEVEN_MODEL_ID,
      // Lüks/belgesel tonu: yüksek stabilite, hafif yavaş algı.
      voice_settings: {
        stability: 0.65,
        similarity_boost: 0.8,
        style: 0.2,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as TtsResponse;
}

/** Karakter hizalamasından kelime zamanları çıkarır. */
function extractWords(fullText: string, alignment: Alignment): CaptionWord[] {
  const { character_start_times_seconds: starts, character_end_times_seconds: ends } = alignment;
  const words: CaptionWord[] = [];
  const matcher = /\S+/g;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(fullText)) !== null) {
    const first = match.index;
    const last = match.index + match[0].length - 1;
    words.push({
      text: match[0],
      start: starts[first] ?? 0,
      end: ends[last] ?? starts[first] ?? 0,
    });
  }

  return words;
}

/** Hizalama gelmezse karakter sayısına göre orantısal zamanlama (yedek plan). */
function approximateWords(fullText: string, totalSeconds: number): CaptionWord[] {
  const words: CaptionWord[] = [];
  const matcher = /\S+/g;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(fullText)) !== null) {
    words.push({
      text: match[0],
      start: (match.index / fullText.length) * totalSeconds,
      end: ((match.index + match[0].length) / fullText.length) * totalSeconds,
    });
  }

  return words;
}

export async function generateVoice(slug: string): Promise<Captions> {
  const dir = contentDir(slug);
  const script = readJson<VideoScript>(path.join(dir, 'script.json'));
  const { fullText, ranges } = buildText(script);

  console.log(`[voice] ${fullText.length} karakter seslendiriliyor (${ELEVEN_MODEL_ID})`);
  const result = await synthesize(fullText);

  ensureDir(dir);
  const audioPath = path.join(dir, 'voice.mp3');
  fs.writeFileSync(audioPath, Buffer.from(result.audio_base64, 'base64'));

  const alignment = result.alignment;
  const aligned = alignment != null && alignment.characters.length === fullText.length;

  if (alignment && !aligned) {
    console.warn(
      `[voice] uyarı: hizalama uzunluğu (${alignment.characters.length}) metinle (${fullText.length}) eşleşmiyor; orantısal zamanlamaya düşülüyor.`,
    );
  }

  let words: CaptionWord[];
  let scenes: SceneTiming[];
  let spokenSeconds: number;

  if (aligned && alignment) {
    words = extractWords(fullText, alignment);
    const ends = alignment.character_end_times_seconds;
    const starts = alignment.character_start_times_seconds;
    spokenSeconds = ends[ends.length - 1] ?? 0;
    scenes = ranges.map((range, index) => ({
      index,
      start: starts[range.start] ?? 0,
      end: ends[range.end - 1] ?? spokenSeconds,
    }));
  } else {
    // Kaba tahmin: dakikada ~150 kelime.
    const wordCount = fullText.split(/\s+/).length;
    spokenSeconds = (wordCount / 150) * 60;
    words = approximateWords(fullText, spokenSeconds);
    scenes = ranges.map((range, index) => ({
      index,
      start: (range.start / fullText.length) * spokenSeconds,
      end: (range.end / fullText.length) * spokenSeconds,
    }));
  }

  // Son sahne kuyruğa kadar uzasın ki görsel sesin bitiminde kesilmesin.
  const durationSec = spokenSeconds + TAIL_SECONDS;
  const lastScene = scenes[scenes.length - 1];
  if (lastScene) lastScene.end = durationSec;

  const captions: Captions = { durationSec, words, scenes };
  writeJson(path.join(dir, 'captions.json'), captions);

  console.log(`[voice] ${audioPath}`);
  console.log(`[voice] ${words.length} kelime, ${durationSec.toFixed(1)} sn`);
  return captions;
}

async function main(): Promise<void> {
  await generateVoice(requireArg('slug'));
}

if (isMain(import.meta.url)) runCli(main);
