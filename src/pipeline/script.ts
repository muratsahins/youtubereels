import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

import { CONTENT_LANG, MODEL, requireEnv } from '../config';
import { VideoScriptSchema, type VideoScript } from '../types';
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

const SYSTEM = `You write scripts for a vertical YouTube Shorts channel called "Anatomy of Wealth".

The channel explains the ECONOMICS behind luxury: what an asset actually costs to own, why
certain objects hold value, how the money behind them really works. Tone is curiosity plus
hard numbers — a documentary narrator, never aspirational flexing and never a sales pitch.

FORMAT RULES
- 6 to 9 scenes. Total narration must read aloud in 35-50 seconds (roughly 110-150 words).
- Scene 1 is the HOOK. Under 12 words, lands in 3 seconds, opens a loop the viewer needs closed.
- Each scene is 1-2 short spoken sentences. No lists, no semicolons, no subordinate clause pileups.
- At least 4 scenes must carry a bigNumber. Numbers are the retention engine of this format.
- The final scene closes the loop back to the hook so the video rewatches cleanly.
- Second person, present tense. Never say "in this video", never greet, never ask for subscribes.

NUMBERS
Use realistic, defensible figures. When an exact figure is genuinely unknowable, use a clearly
framed range or order of magnitude. Never invent precise-sounding fake statistics.

IMAGE PROMPT RULES (copyright and safety — non-negotiable)
- Never name a brand, company, logo, product model, or real person.
- Never request a recognizable human face. People may appear only as silhouettes, hands, backs,
  or out of frame.
- Describe generic objects with cinematic specificity: lighting, lens, material, texture, mood.
- Every prompt is vertical 9:16 framing.

STOCK QUERY
stockQuery is a fallback search term for stock photo libraries, used when images are sourced
from stock instead of generated. Give 2-4 concrete nouns, no adjectives, no camera language:
"superyacht aerial", "engine room", "marina night". It should describe the same subject as
imagePrompt, just searchable.

BIG NUMBERS
bigNumber.value is what appears on screen in large type — keep it short ("$4.2M", "40", "12%").
bigNumber.label is at most 5 words. Set bigNumber to null for scenes that carry no figure.`;

function userPrompt(topic: string): string {
  const language =
    CONTENT_LANG === 'tr'
      ? 'Write the narration, title and description in Turkish. Keep imagePrompt in English.'
      : 'Write everything in English (US audience).';

  return `Topic: ${topic}

${language}

Write the full script now.`;
}

export async function generateScript(topic: string): Promise<VideoScript> {
  const client = new Anthropic({ apiKey: requireEnv('ANTHROPIC_API_KEY') });

  // `fallbacks: 'default'` — Claude Opus 5'in güvenlik sınıflandırıcısı bir isteği reddederse
  // Anthropic aynı çağrı içinde önerdiği yedek modele düşer. İstemezsen bu iki satırı sil.
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: {
      effort: 'high',
      format: zodOutputFormat(VideoScriptSchema),
    },
    system: SYSTEM,
    messages: [{ role: 'user', content: userPrompt(topic) }],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error(
      `Model bu konuyu reddetti (${response.stop_details?.category ?? 'kategori yok'}). Konuyu yeniden ifade et.`,
    );
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('Yanıt max_tokens sınırına takıldı; max_tokens değerini artır.');
  }

  const text = response.content.find((block) => block.type === 'text')?.text;
  if (!text) throw new Error('Modelden metin bloğu gelmedi.');

  const script = VideoScriptSchema.parse(JSON.parse(text));

  if (script.scenes.length < 4) {
    throw new Error(`Sadece ${script.scenes.length} sahne üretildi; en az 6 bekleniyor.`);
  }

  return script;
}

async function main(): Promise<void> {
  const topic = requireArg('topic');
  const slug = arg('slug') ?? slugify(topic);

  console.log(`[script] konu: ${topic}`);
  const script = await generateScript(topic);

  const dir = contentDir(slug);
  ensureDir(dir);
  writeJson(path.join(dir, 'script.json'), script);

  const words = script.scenes.reduce((n, s) => n + s.narration.split(/\s+/).length, 0);
  console.log(`[script] ${script.scenes.length} sahne, ~${words} kelime`);
  console.log(`[script] başlık: ${script.title}`);
  console.log(`[script] yazıldı: ${path.join(dir, 'script.json')}`);
  console.log(`[script] slug: ${slug}`);
}

if (isMain(import.meta.url)) runCli(main);
