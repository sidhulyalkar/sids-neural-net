# Shasta microphone compatibility and operations

The microphone button is **one utterance per deliberate user tap**. No audio
capture starts automatically, no background listening, and no transcription work
runs inside the Three.js render loop.

## Browser capability routing
- Chrome/Chromium and Edge: prefer native `SpeechRecognition` when available.
- Safari on macOS/iOS: prefer native speech when it is supported; otherwise
  use standard `MediaRecorder` with `audio/mp4`.
- Firefox (desktop/mobile): prefer the fallback `MediaRecorder` WebM/Opus
  recording and a server-side transcription.
- If native recognition encounters a service/network failure, tapping the mic
  **again** switches to the fallback; microphone denial never automatically
  starts a second capture session.
- The selected MIME uses `MediaRecorder.isTypeSupported`, not user-agent sniffing.
- Microphone permission is requested only following the user's tap. Active
  recording stops after five seconds or when the mic is tapped again.
- Navigation, game pause, hidden tabs and unmount cancel capture and requests;
  all audio tracks are stopped. No site-side audio or transcript persistence.

## Required fallback configuration (Vercel preview/production)
Add **server-side** environment variables:
- `SHASTA_VOICE_TRANSCRIPTION_ENABLED=true`
- `OPENAI_API_KEY` with provider access to `gpt-transcribe`

Apply them to appropriate Preview and Production scopes in Vercel's environment
management, then redeploy. **Never** use a `NEXT_PUBLIC_` key or place an API
key in the source, PR, screenshots, or browser. No audio is uploaded when the
server reports the fallback unconfigured. The fallback's only provider is
OpenAI's official transcription API. Provider processing is subject to their
data handling terms. This is a cloud fallback, not on-device transcription.

## Abuse and cost controls
- HTTPS and same-origin requests; only `audio/webm` or `audio/mp4` accepted.
- 1 MiB raw request limit enforced while reading streamed bytes.
- Up to five seconds recorded, maximum ~14 seconds including the HTTP timeout.
- Strict Shasta grammar is applied on the server and checked on the client.
  Arbitrary spoken text cannot drive a game command or turn the endpoint
  into a general-purpose transcription proxy.
- Per-worker request budget: 8 requests/minute and 80/day per IP.
- **Before a public rollout**, configure Vercel WAF/managed rate limits or
  another shared persistent quota because serverless processes do not share the
  in-memory request budget. Set usage alerts/cost ceilings with the provider.

## Qualification
- `node --import tsx --test tests/world-shasta-cross-browser.test.ts` for
  MIME negotiation, malicious/unrecognized transcripts, upload ceilings and rate limiting.
- `node scripts/playtest-shasta-cross-browser-voice.mjs` via GitHub Actions
  matrix on Chromium, Firefox and WebKit (Safari engine). Uses synthetic audio,
  mocked provider response, denied permissions and tab-background cancellation.
- Native browser speech tests remain in the original Shasta voice/catch suite.

No automated microphone test alone can guarantee every device/OS permission
setting. On real devices, verify a command in Chrome, Edge, Firefox, Safari,
iOS Safari and Android Chrome using a test deployment with a configured provider.
