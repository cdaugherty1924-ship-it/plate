# Plate

A dead-simple calorie tracker. Tell it what you ate in plain words; Claude guesses the calories and logs it by day and meal.

- `public/index.html` is the whole app (the log is saved on the phone).
- `server.js` serves the app and asks Claude for the calorie estimates, using a Claude subscription sign-in token (`CLAUDE_CODE_OAUTH_TOKEN`) rather than an API key.
- Hosted on Fly.io (`fly.toml`). Secrets: `CLAUDE_CODE_OAUTH_TOKEN`, `APP_PASSCODE`, optional `CLAUDE_MODEL` (default `haiku`).

Deploy: `fly deploy`
