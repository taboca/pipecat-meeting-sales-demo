# Pipecat Daily Bot Frontend

Demo of a voice assistant bot that joins a Daily.co room using the simple Pipecat flow. This frontend is a static Daily UI served by a tiny Express server; it fetches `roomUrl`/`joinToken` from `config.json` and pairs with the Pipecat quickstart backend. For the full upstream quickstart (RTVI/local WebRTC server, multiple transports), see https://github.com/pipecat-ai/pipecat-quickstart.

The focus here is the simplest path: a bot entering a specific Daily room with OpenAI STT/LLM/TTS via `bot_simple.py`. Use this when you just need the bot to join a static Daily room. If you need the richer quickstart (token minting, local WebRTC dev server, more transports), follow the repo above.

This repo is intended to sit alongside the sibling backend at https://github.com/taboca/pipecat-quickstart (a fork of the upstream). Run that backend to handle STT/LLM/TTS and bot orchestration; point this frontend at the same Daily room.

## Setup
- Copy `config_SAMPLE.json` to `config.json` and fill in your values: `ROOM_URL`, optionally `DAILY_TOKEN`, and any keys your backend expects.
- Install deps and start the server: `npm install && node index.js`.
- Open http://localhost:3000 to load the UI; it will read the room URL/token from `/config`.

## Notes
- `config.json` is git-ignored to keep secrets out of version control; avoid committing real API keys.
