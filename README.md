# Media Resolve
Browser-based converter that turns any media into formats **DaVinci Resolve Free on Linux** imports reliably. 100% client-side (ffmpeg.wasm) → hosts on **GitHub Pages**.

## Features
| Feature | Details |
|---|---|
| Any input | Whatever ffmpeg can decode (MKV, MP4, AVI, WebM, MTS…) |
| Presets | Edit (DNxHR HQ), Color (ProRes 422 HQ), Proxy (DNxHR LB 720p), Audio (WAV) |
| Tools | Rotate, frame extraction (PNG), Plyr player, tooltips |
| UX | Drag & drop, progress bar, toasts, error handling, dark/light, gradient UI |
| Dev menu | Live ffmpeg command, logs, custom extra args |

## Run / Deploy
```bash
npx serve .          # local
```
Push to `main` → Settings ▸ Pages ▸ Source: **GitHub Actions**. Zero build step.

## Stack & libraries (called from CDN, not forked)
| Library | Use |
|---|---|
| [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) | Conversion engine |
| [Motion](https://github.com/motiondivision/motion) | Fluid animations |
| [Plyr](https://github.com/sampotts/plyr) | Player API |

## Pros / Cons
| Pros | Cons |
|---|---|
| No upload, private, free hosting | No GPU encoding (wasm) – use CLI command from Dev menu |
| No install, no backend | Large files (>~2 GB) may exhaust browser memory |
| Resolve-friendly codecs | Single-threaded core (slower); ProRes/DNxHR can't preview in browser |

## Credits
FFmpeg, ffmpeg.wasm, Motion, Plyr. UI inspiration: motion.dev, Figma, moviplayer.com. Not affiliated with Blackmagic Design. MIT licensed.
