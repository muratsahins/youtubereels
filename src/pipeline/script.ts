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
- One scene = one image, so the scene count is set by length. Pick a length, then match it:
    up to 45 seconds  -> 8 scenes,  roughly 110-140 words
    45 to 60 seconds  -> 10 scenes, roughly 140-180 words
    over 60 seconds   -> 12 scenes, roughly 180-220 words
  The narrator reads at about 3 words per second; the word count is what actually sets the
  runtime, so pick the band first and hold the whole script inside it. Default to 8 scenes
  unless the topic genuinely carries more.
- Scene 1 is the HOOK. Under 12 words, lands in 3 seconds, opens a loop the viewer needs closed.
- Each scene is 1-2 short spoken sentences. No lists, no semicolons, no subordinate clause pileups.
- Half the scenes must carry a bigNumber: 4 of 8, 5 of 10, 6 of 12. Numbers are the
  retention engine of this format.
- The final scene closes the loop back to the hook so the video rewatches cleanly, then adds one
  short second sentence inviting the viewer to follow and like for more of these breakdowns.
  Keep that line under 10 words and specific to the channel ("more of these"), never generic
  ("like and subscribe!") and never a separate scene — it rides in the last scene's narration.
- Second person, present tense. Never say "in this video", never greet.

NUMBERS
Use realistic, defensible figures. When an exact figure is genuinely unknowable, use a clearly
framed range or order of magnitude. Never invent precise-sounding fake statistics.

IMAGE PROMPT RULES (copyright and safety — non-negotiable)
- Never name a brand, company, logo, product model, or real person.
- Never request a recognizable human face. People may appear only as silhouettes, hands, backs,
  or out of frame.
- Describe generic objects with cinematic specificity: lighting, lens, material, texture, mood.
- Every prompt is vertical 9:16 framing.

IMAGE PROMPT RULES (subject accuracy)
Name the exact subject in EVERY prompt, including close-ups and interiors — not just the
establishing shots. An interior or detail shot that omits it drifts to whatever is most common
in that category, which is rarely the luxury subject you mean.
- Write "superyacht engine room", not "engine room of a large vessel".
- Write "superyacht refit yard", not "vessel in a dry dock".
Avoid generic scale and industry words — "vessel", "large ship", "industrial", "enormous",
"facility" — unless the subject really is industrial. They pull the image toward commercial
equivalents: cargo ships, factories, warehouses.
Add one or two material details that only the luxury version has: polished teak, glossy white
paint, chrome, lacquered joinery, spotless painted floors. These separate it far more reliably
than adjectives like "luxury" or "expensive" do.

IMAGE PROMPT RULES (top of the market, not merely nice)
The channel's whole premise is the top of the market, so every frame should read as the most
expensive plausible version of its subject — not an upscale or aspirational one. When a scene
could go either way, pick the more expensive material, the rarer finish, the higher tier of the
category: a private members' club over a nice restaurant, a bespoke tailoring workshop over a
flagship store rack, a super-prime penthouse over a merely expensive apartment, hand-finished
joinery over veneer. This applies to the setting as much as the object — corridors, waiting
rooms and back-of-house spaces should look as considered and expensive as the hero shot.
Every single imagePrompt (not just the hero scenes) must name at least two specific premium
materials or craft techniques — not generic adjectives. Draw from or match the tier of: hand-cut
or hand-carved stone, hand-stitched leather, nappa leather, suede, calfskin, gilt or gold-leaf
trim, hand-rubbed oiled oak, walnut, rosewood, burl wood, brushed steel, milled aluminium,
titanium, forged carbon fibre, mahogany panelling, book-matched veneer or glass, brass fittings,
bronze, wrought iron, velvet upholstery, cashmere, silk, linen, alcantara, hand-blown glass,
Murano glass, polished teak, lacquered joinery, marble, onyx, platinum, sapphire crystal,
guilloché, hand-knotted rug, patina, cut crystal, sterling silver, bone china, damask,
herringbone parquet, bespoke tailoring, coffered ceiling. A prompt that only says "luxury" or
"expensive" without naming the material has not met this bar and must be rewritten. This is
checked automatically after generation — a script that fails it does not get saved.

IMAGE PROMPT RULES (branded surfaces)
Image models ignore "no text" and "no logos" instructions on the one surface of a product that
normally carries branding — a watch dial, a phone screen, a car grille, a sneaker side panel.
They fill it with a garbled near-miss of a real wordmark, which looks cheap and sits exactly
where a trademark would.
Compose the branding out instead of asking for it to be absent. In practice only one of the
options works: the branded zone must be CROPPED OUT OF THE FRAME ENTIRELY. "Facing away",
"face-down", "angled away", "dial not visible" and "in shadow" are all ignored — the model
turns the object back toward camera and paints a garbled near-miss wordmark on it anyway.
A watch reads as expensive from its bracelet and clasp alone, so put the watch head outside
the frame edge. On a garment, shoot the shoulder with the collar cropped out, or the back
panel. On a bag, the rear panel with no clasp or hardware in frame.
The same applies to any surface that normally carries lettering, not just products: shop
fascias, hanging signs, awnings, receipts, filing labels, book spines. Frame them out. A
street-level shopfront will always produce fake signage — start the frame above it.

IMAGE PROMPT RULES (removing anything, not just branding)
A negative instruction is not a reliable way to remove something. "No radiator", "no people",
"no clutter" get ignored the same way "no logos" does, because the model has nothing to put
in that space instead. Name what occupies it. To clear the wall under a window, write "a long
low upholstered bench running the full width of the wall beneath the window sill"; to empty a
room, write what the empty floor is made of and what light falls on it. Say what IS there,
and the unwanted thing has nowhere to appear.

IMAGE PROMPT RULES (readable subject, daylight with a shaded top)
Every prompt needs a subject a viewer can name in one glance. A macro of a smooth painted
panel or a plain wall is not a subject — it returns an abstract blur that communicates nothing.
Crop tight on something with an identifiable shape instead: a nose and cockpit glass rather
than a fuselage panel, an engine intake rather than a cowling surface.
Shoot in daylight. Bright natural light, clear sky, sunlight falling through windows — the
channel is no longer a night-lit channel.
Daylight has one hard constraint. The finished frame carries a large cream-and-gold number
card across its upper third and white captions across its lower third, and cream on a pale
surface disappears. So every prompt must put the TOP THIRD of the frame in shadow or in deep
colour while the subject stays in sunlight: a deep blue sky above the subject, a ceiling
falling into shadow, a shaded wall behind a sunlit object, the subject sitting low in frame.
Never let the top third be a white wall, an overcast sky, a blank panel or blown-out glass.
Do not ask for this with the word "shadow" alone - that either gets ignored or darkens the
whole frame. NAME THE DARK OBJECT that fills the top band: a dark timber panelled wall, a
black extraction hood, a coffered ceiling, a deep blue sky, a stone vault. The subject stays
in sunlight below it.
This matters most on scenes that carry a bigNumber; check those first.

STOCK QUERY
stockQuery is a fallback search term for stock photo libraries, used when images are sourced
from stock instead of generated. Give 2-4 concrete nouns, no adjectives, no camera language:
"superyacht aerial", "engine room", "marina night". It should describe the same subject as
imagePrompt, just searchable.

BIG NUMBERS
bigNumber.value is what appears on screen in large type — keep it short ("$4.2M", "40", "12%").
bigNumber.label is at most 5 words. Set bigNumber to null for scenes that carry no figure.`;

/** "top of the market" kuralının otomatik denetimi — script.ts sistem promptundaki listeyle aynı. */
const PREMIUM_MATERIAL_KEYWORDS = [
  'hand-cut stone', 'hand-carved', 'hand-stitched', 'nappa leather', 'leather', 'suede',
  'calfskin', 'gilt', 'gold-leaf', 'gold leaf', 'hand-rubbed', 'oiled oak', 'walnut', 'rosewood',
  'burl', 'brushed steel', 'milled aluminium', 'milled aluminum', 'titanium', 'forged carbon',
  'carbon fibre', 'carbon fiber', 'mahogany', 'book-matched', 'veneer', 'brass', 'bronze',
  'wrought iron', 'velvet', 'cashmere', 'silk', 'linen', 'alcantara', 'hand-blown', 'murano',
  'polished teak', 'teak', 'lacquer', 'marble', 'onyx', 'platinum', 'sapphire', 'guilloch',
  'hand-knotted', 'patina', 'chrome', 'crystal', 'sterling silver', 'bone china', 'damask',
  'herringbone', 'bespoke', 'coffered',
];

/** Tire/boşluk farkı yüzünden ("brushed-steel" vs "brushed steel") yanlış eleme olmasın diye normalize et. */
const normalizeForMatch = (text: string) => text.toLowerCase().replace(/[-\s]+/g, ' ');

function countPremiumMaterials(imagePrompt: string): number {
  const normalized = normalizeForMatch(imagePrompt);
  return PREMIUM_MATERIAL_KEYWORDS.filter((keyword) => normalized.includes(normalizeForMatch(keyword)))
    .length;
}

/** "top of the market" kuralını zorunlu kılar — yetersiz sahne varsa script hiç kaydedilmez. */
function validateTopOfMarket(script: VideoScript): void {
  const failing = script.scenes
    .map((scene, index) => ({ index, count: countPremiumMaterials(scene.imagePrompt) }))
    .filter(({ count }) => count < 2);

  if (failing.length > 0) {
    const list = failing.map(({ index }) => `sahne ${index + 1}`).join(', ');
    throw new Error(
      `"Top of the market" kuralı ihlal edildi (${list}): imagePrompt en az iki somut premium ` +
        `malzeme/işçilik terimi içermeli (bkz. PREMIUM_MATERIAL_KEYWORDS). Konuyu yeniden üret.`,
    );
  }
}

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

  if (script.scenes.length < 8) {
    throw new Error(`Sadece ${script.scenes.length} sahne üretildi; en az 8 bekleniyor.`);
  }

  validateTopOfMarket(script);

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
