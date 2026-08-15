# youtubereels — "Anatomy of Wealth" pipeline

Niş 3 (Lüks Ekonomisi) için dikey YouTube Shorts üretim hattı.
Konu ver → senaryo, seslendirme, kelime bazlı altyazı, AI görseller ve 1080×1920 mp4 çıkar.

```
konu → script.json → voice.mp3 + captions.json → assets/*.png → out/<slug>.mp4
```

## Kurulum

```bash
npm install
cp .env.example .env      # PowerShell: Copy-Item .env.example .env
```

`.env` içindekiler:

| Değişken | Gerekli mi | Ne için |
|---|---|---|
| `ANTHROPIC_API_KEY` | evet | Senaryo üretimi (Claude Opus 5) |
| `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID` | ses için | Seslendirme + kelime zamanlaması |
| `REPLICATE_API_TOKEN` | `IMAGE_PROVIDER=replicate` ise | Flux ile görsel üretimi |
| `IMAGE_PROVIDER` | — | `placeholder` (varsayılan) veya `replicate` |
| `CONTENT_LANG` | — | `en` (varsayılan, yüksek RPM) veya `tr` |
| `MUSIC_FILE` | — | `public/music/` içindeki lisanslı müzik dosyasının adı |

## Kurulumu doğrula (API anahtarı gerekmez)

`public/content/smoketest/` içinde hazır bir örnek senaryo var. Render zincirinin
çalıştığını görmek için:

```bash
npm run assets -- --slug smoketest
npm run render -- --slug smoketest
```

→ `out/smoketest.mp4` (12 sn, 1080×1920, gradient görseller + kelime bazlı altyazı).
İlk render'da Remotion, Chrome Headless Shell'i indirir; bu bir kereliktir.

## İlk gerçek video

```bash
# Senaryo + görsel, ses yok (sadece ANTHROPIC_API_KEY gerekir):
npm run all -- --topic "The real annual cost of a private jet" --skip-voice

# Tam üretim:
npm run all -- --topic "The real annual cost of a private jet"
```

Çıktı: `out/<slug>.mp4`

## Adım adım çalıştırma

Her adım bağımsız; sadece değişen adımı yeniden çalıştırabilirsin.

```bash
npm run script -- --topic "Why some watches appreciate"   # → script.json (slug'ı yazdırır)
npm run voice  -- --slug why-some-watches-appreciate      # → voice.mp3 + captions.json
npm run assets -- --slug why-some-watches-appreciate      # → assets/scene-NN.png
npm run render -- --slug why-some-watches-appreciate      # → out/<slug>.mp4
```

Kurguyu göz kararı ayarlamak için:

```bash
npm run studio
```

Studio'da soldaki props panelinden `public/content/<slug>/props.json` içeriğini yapıştırıp
canlı önizleyebilirsin.

## Dosya düzeni

```
src/
  config.ts              env + sabitler
  types.ts               zod şemaları (senaryo + render props)
  video.ts               1080x1920 @ 30fps
  util/paths.ts          yol, slug, CLI argümanları
  pipeline/
    script.ts            Claude Opus 5, yapılandırılmış JSON çıktı
    voice.ts             ElevenLabs with-timestamps → mp3 + kelime zamanları
    assets.ts            Replicate/Flux veya placeholder SVG
    render.ts            props.json üretir, remotion render'ı çağırır
    run.ts               uçtan uca orkestrasyon
  remotion/
    Root.tsx             kompozisyon tanımı, süre captions'tan hesaplanır
    LuxuryShort.tsx      sahneler + altyazı + ses
    components/          KenBurns, NumberCard, Captions, Vignette
public/content/<slug>/   script.json, captions.json, assets.json, props.json, voice.mp3, assets/
out/                     render edilmiş mp4'ler
```

Remotion `staticFile()` yalnızca `public/` altını görebildiği için üretilen tüm medya
`public/content/<slug>/` içine yazılır.

## Video başına maliyet (kabaca)

| Kalem | Tutar |
|---|---|
| Senaryo (Claude) | ~$0.02 |
| Seslendirme (ElevenLabs, ~140 kelime) | ~$0.05 |
| 7 görsel (Flux schnell) | ~$0.02–0.20 |
| Render | $0 (yerel) |

`IMAGE_PROVIDER=placeholder` ile toplam maliyet sadece senaryo çağrısı kadardır.

## Telif ve politika kuralları (koda gömülü)

- Senaryo sistem prompt'u görsel prompt'larında **marka adı, logo, ürün modeli, ünlü ismi ve
  tanınabilir yüz** üretilmesini yasaklar. Bu kuralı gevşetme — kanal kapanma sebebi.
- Müzik yalnızca `public/music/` içine koyduğun lisanslı dosyadan gelir. Trend şarkı
  kullanılan Shorts videoları reklam geliri üretmez.
- ElevenLabs'ın **ücretli** planı ticari kullanım lisansı verir; ücretsiz planla üretilen sesi
  monetize kanalda kullanma.
- YouTube'un "özgün olmayan içerik" politikası şablonu birebir tekrarlayan kanalları hedefler.
  Bu hat taslak üretir; son kurgu kararlarını (kesme yeri, kanca seçimi) sen ver.

## Sürüm notu

`@anthropic-ai/sdk` **0.116+** ve `zod` **v4** gerekir — adaptive thinking, `stop_details` ve
`zodOutputFormat` bu sürümlerde tiplenmiş durumda. SDK 0.x olduğu için `^0.70` gibi bir caret
minor sürümü sabitler; sürümü düşürme.

## Bilinen sınırlar

- `voice.ts`, ElevenLabs karakter hizalamasına dayanır. Hizalama gelmezse dakikada 150 kelime
  varsayan orantısal zamanlamaya düşer ve uyarı basar.
- `script.ts`, Claude Opus 5'te `fallbacks: 'default'` ile çalışır: güvenlik sınıflandırıcısı
  isteği reddederse Anthropic aynı çağrı içinde önerdiği yedek modele düşer. İstemiyorsan
  `fallbacks` ve `betas` satırlarını sil.
- Sahne geçişleri sert kesim. Çapraz geçiş istersen `LuxuryShort.tsx` içindeki `Sequence`
  sınırlarını çakıştırıp `KenBurns`'e opacity interpolasyonu ekle.

## Görselleri elle üretmek (ücretsiz, birebir prompt uyumu)

Replicate API her model için kredi ister, ama **web arayüzü ücretsiz çalıştırmaya izin verir**.
Kredi yüklemeden API ile birebir aynı sonucu almanın yolu:

```bash
npm run prompts -- --slug <slug>     # → prompts.txt, kopyala-yapıştır hazır
```

1. `prompts.txt` dosyasını aç.
2. https://replicate.com/black-forest-labs/flux-schnell sayfasında her prompt'u çalıştır
   (`aspect_ratio = 9:16`, `output_format = png`).
3. Çıkan görselleri `public/content/<slug>/assets/` içine `scene-01.png` … `scene-NN.png`
   olarak kaydet.
4. `.env` içinde `IMAGE_PROVIDER=manual` yap, sonra:

```bash
npm run assets -- --slug <slug>      # eksik dosya varsa isim isim söyler
npm run render -- --slug <slug>
```

`manual` sağlayıcı hiçbir API çağrısı yapmaz; sadece dosyaların yerinde olduğunu doğrular.
