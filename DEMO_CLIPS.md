# Demo clips — sources and attribution

Stock footage used in the home-page demo (`public/demo/`). All five are from
Pexels under the [Pexels License](https://www.pexels.com/license/) (free for
commercial use, no attribution required — recorded here anyway). Each was
trimmed to ≤15 s, center-cropped to 1080×1920, and re-encoded to H.264 at
~2 Mbps. The hero and product clips have recorded audio; the others were
uploaded silent and any empty audio track was dropped.

The tracks are genuine Backbeat output: each clip was run through the app's
own frame extraction (one frame per 3 s at 512 px), Claude analysis and
ElevenLabs generation (`music_v2_5`). The hero track was generated on
2026-10-27 (about 150 credits). The four row tracks were regenerated on
2026-10-27 (about 1,000 credits): the 2026-10-21 tracks matched the clips'
length on paper but the model wrote a musical ending into each one, so the
music had faded out by 7-10 s. The regeneration fed the clip looped twice
(so the ending lands past the clip's end) and kept the first clip-length of
the result; analysis still ran on the real clip's frames.

**Audio is baked into the files** (2026-10-27), so the page plays plain
`<video>` elements with no separate audio element:

- `travel.mp4`, `sports.mp4`, `gameplay.mp4` (silent sources): the generated
  track is the audio stream, trimmed to the clip with a 1 s fade out and any
  leading silence removed (travel starts 5 s into its track, past a long
  cinematic build).
- `product.mp4` (source has its own sound): the track is mixed under the
  clip's audio through the export route's chain at the Loud gain (-8 dB;
  bubble wrap, no dialogue to protect).
- `hero-original.mp4`: the chopping clip with only its own sound.
- `hero-backbeat.mp4`: the same clip with the track mixed under it through
  the export route's chain at the Loud gain: music fades 2 s in and 2 s out,
  drops to -8 dB, amix with normalize=0, alimiter at 0.8, atrim to the clip
  length. The hero toggle swaps between these two files. Both hero files
  run the clip audio through the same compressor + limiter first (knife hits
  peak at 0 dBFS in the source and would otherwise block normalisation).

Every file is then normalised with two-pass ffmpeg loudnorm to -16 LUFS
integrated, pre-encode true peak -2 dBTP (-3 for the hero pair) so the AAC
overshoot still lands under -1.5 dBTP. Measured after encoding (2026-10-27):

| file | video s | audio s | I LUFS | TP dBTP |
|---|---|---|---|---|
| hero-original.mp4 | 10.800 | 10.800 | -16.47 | -1.92 |
| hero-backbeat.mp4 | 10.800 | 10.800 | -16.22 | -2.41 |
| travel.mp4 | 15.000 | 15.000 | -16.27 | -2.01 |
| product.mp4 | 15.000 | 15.000 | -16.27 | -1.96 |
| sports.mp4 | 11.967 | 11.966 | -16.04 | -1.90 |
| gameplay.mp4 | 9.967 | 9.966 | -16.06 | -1.63 |

(The 0.7 ms on sports and gameplay is AAC frame granularity, 1024 samples
at 48 kHz, against a 30 fps video length that is not a whole frame count.)

The generated MP3s are not shipped; the 2026-10-21 set is in git history
(`git show d3f01ce:public/demo/travel.mp3` and so on) and the 2026-10-27
regenerations were kept only in the session scratch directory.

| slot | file | Pexels ID | source URL | creator | original | used |
|---|---|---|---|---|---|---|
| hero (food) | `hero-original.mp4`, `hero-backbeat.mp4`, `hero.jpg` | 13152669 | https://www.pexels.com/video/cutting-potato-on-board-13152669/ | see note | 10.8 s, 1080×1920, with audio | 10.8 s |
| travel | `travel.*` | 36621255 | https://www.pexels.com/video/stunning-aerial-view-of-rugged-coastal-cliffs-36621255/ | see note | 15.6 s, 1080×1920 | 15.0 s |
| product (row, Food slot) | `product.*` | 6150664 | https://www.pexels.com/video/person-popping-a-bubble-wrap-6150664/ | see note | 17.0 s, 1080×2048, with audio | 15.0 s |
| sports | `sports.*` | 33670184 | https://www.pexels.com/video/dynamic-skateboarding-tricks-at-sunset-33670184/ | see note | 12.0 s, 1080×1920 | 12.0 s |
| gaming | `gameplay.*` | 8757863 | https://www.pexels.com/video/person-pressing-a-game-controller-8757863/ | see note | 10.0 s, 1080×1920 | 10.0 s |

Retired on 2026-10-27: the silent food clip (Pexels 5952089, "person mixing
the mixture"), replaced in the hero by the potato-chopping clip; the bubble
wrap clip moved from the hero into the row's Food slot.

**Hero audio check (2026-10-27):** 13152669 was chosen from ~190 portrait
food and drink candidates probed with ffprobe; only 16 carried an audio
stream and all but two of those were digital silence (volumedetect mean and
max both -91 dB). The chopping clip measured -23.8 LUFS integrated, peak
-0.1 dBFS (knife on board, kitchen room tone), so "Original" on the hero is
genuinely the clip's own sound. The runner-up, a coffee pour (13714645), had
real but very quiet audio (-55 LUFS) and was passed over.

**Creator note:** creator names could not be captured at sourcing time —
Pexels serves a Cloudflare bot challenge on every individual video page (the
search pages and download URLs work, which is how the clips were vetted and
fetched). The Pexels License does not require attribution; the ID and URL
above are the permanent record and resolve to the creator on the Pexels site.
Fill in the names here if you open those pages.

Selection rules applied: 10–20 s, 1080p, portrait, no faces as the main
subject, no visible brands or logos. The gaming clip shows a generic
controller (the word "SHARE" on one button is the only text); a true
screen-recording clip was available but displayed a recognizable game HUD
and was rejected on the brand rule. The hero clip shows a hand and knife
only.
