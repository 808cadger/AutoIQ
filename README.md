# AutoIQ

<!-- INSTALL-START -->
## Install and run

These instructions install and run `AutoIQ` from a fresh clone.

### Clone
```bash
git clone https://github.com/808cadger/AutoIQ.git
cd AutoIQ
```

### Web app
```bash
npm install
npm run serve
```

### Android build/open
```bash
npm run cap:sync
npm run cap:android
```

### Desktop app
```bash
npm run electron
npm run electron:dist
```

### Python/API service
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Notes
- Use Node.js 22 or newer for the current package set.
- Android builds require Android Studio, a configured SDK, and Java 21 when Gradle is used.
- Create any required `.env` file from `.env.example` before starting backend services.

### AI/API setup
- If the app has AI features, add the required provider key in the app settings or local `.env` file.
- Browser-only apps store user-provided API keys on the local device unless a backend endpoint is configured.

### License
- Apache License 2.0. See [`LICENSE`](./LICENSE).
<!-- INSTALL-END -->
