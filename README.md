# Media Resolve
Browser-based converter that turns any media into formats **DaVinci Resolve Free on Linux** imports reliably. 100% client-side ([ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)) → hosts on **GitHub Pages**.

## Repo layout
| Path | Purpose |
|---|---|
| `index.html` | Page markup |
| `style.css` | Glass UI, Resolve-gradient theme (dark/light) |
| `app.js` | Conversion, presets, Dev menu, tooltips |
| `.github/workflows/pages.yml` | Pages deploy (Source: GitHub Actions) |

## Features
| Feature | Details |
|---|---|
| Any input | Whatever ffmpeg can decode (MKV, MP4, AVI, WebM, MTS…) |
| Presets | Edit, Color, Proxy, Alpha · YouTube 1080p/4K/Shorts · Reels/TikTok · Instagram 4:5 & 1:1 · X · Facebook · Audio WAV/AIFF/FLAC |
| Multi-file | Add many files, queue, Convert all |
| Audio | Audio files convert to WAV / AIFF / FLAC with sample-rate and bit-depth menus |
| Format menus | Video codec (DNxHR LB→444, ProRes Proxy→4444, MJPEG), audio (PCM 16/24), container (MOV/MKV/MXF), canvas (16:9, 9:16, 4:5, 1:1), fit/fill, fps, sample rate, rotate |
| Frame extraction | PNG/JPG at a chosen time or current player position |
| Dev menu | Live/copyable CLI command, extra args, log level, colour-coded log (copy/download/clear), stats, `ffmpeg -i` file analysis, player event log |
| UX | Drag & drop, progress bar, toasts, error handling, viewport-safe tooltips, blur UI |

## Run / Deploy
```bash
npx serve .
```
Push to `main` → Settings ▸ Pages ▸ Source: **GitHub Actions**.

## Libraries (loaded from CDN, not forked)
| Library | Use |
|---|---|
| [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) | Conversion engine |
| [Motion](https://github.com/motiondivision/motion) | Animations |
| [Plyr](https://github.com/sampotts/plyr) | Player API |

## Pros / Cons
| Pros | Cons |
|---|---|
| Private, no upload, no backend, free hosting | No GPU encoding (use copied CLI command locally) |
| Resolve-friendly codecs, full format menus | Very large files may exhaust browser memory |
| Dev logs & analysis built in | Single-thread wasm is slower; ProRes/DNxHR can't preview in browsers |

## Credits
FFmpeg, ffmpeg.wasm, Motion, Plyr. UI inspiration: motion.dev, Figma, moviplayer.com. Not affiliated with Blackmagic Design. MIT.
