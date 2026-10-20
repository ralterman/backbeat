# Demo clips — sources and attribution

Stock footage used in the home-page demo (`public/demo/`). All five are from
Pexels under the [Pexels License](https://www.pexels.com/license/) (free for
commercial use, no attribution required — recorded here anyway). Each was
trimmed to ≤15 s, center-cropped to 1080×1920, and re-encoded to H.264 at
~2 Mbps. Only the product clip has recorded audio; the others were uploaded
silent and any empty audio track was dropped.

The tracks (`public/demo/*.mp3`) are genuine Backbeat output: each clip was run
through the app's own frame extraction, Claude analysis and ElevenLabs
generation (`music_v2_5`) on 2026-10-21. Total spend: 802 ElevenLabs credits.

| slot | file | Pexels ID | source URL | creator | original | used |
|---|---|---|---|---|---|---|
| hero (product) | `product.*` | 6150664 | https://www.pexels.com/video/person-popping-a-bubble-wrap-6150664/ | see note | 17.0 s, 1080×2048, with audio | 15.0 s |
| travel | `travel.*` | 36621255 | https://www.pexels.com/video/stunning-aerial-view-of-rugged-coastal-cliffs-36621255/ | see note | 15.6 s, 1080×1920 | 15.0 s |
| food | `food.*` | 5952089 | https://www.pexels.com/video/person-mixing-the-mixture-5952089/ | see note | 12.1 s, 1080×2048 | 12.1 s |
| sports | `sports.*` | 33670184 | https://www.pexels.com/video/dynamic-skateboarding-tricks-at-sunset-33670184/ | see note | 12.0 s, 1080×1920 | 12.0 s |
| gaming | `gameplay.*` | 8757863 | https://www.pexels.com/video/person-pressing-a-game-controller-8757863/ | see note | 10.0 s, 1080×1920 | 10.0 s |

**Creator note:** creator names could not be captured at sourcing time —
Pexels served a Cloudflare bot challenge on every individual video page (the
search pages and download URLs worked, which is how the clips were vetted
and fetched). The Pexels License does not require attribution; the ID and
URL above are the permanent record and resolve to the creator on the Pexels
site. Fill in the names here if you open those pages.

Selection rules applied: 10–20 s, 1080p, portrait, no faces as the main
subject, no visible brands or logos. The gaming clip shows a generic
controller (the word "SHARE" on one button is the only text); a true
screen-recording clip was available but displayed a recognizable game HUD
and was rejected on the brand rule.
