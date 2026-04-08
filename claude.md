# AutoIQ - AI Vehicle Damage Estimator
PWA app for vehicle damage assessment: VIN scan/decode, damage analysis, part identification, repair timeline, readable PDF reports. Multi-platform: PWA/Android APK/Electron. Local API keys only.

Repo: https://github.com/808cadger/AutoIQ. Dev: cadger808 (Pearl City, HI).

## Stack
- Frontend: Vanilla JS/HTML/CSS (app.js, index.html, intake.js, pipeline.js)
- AI Pipeline: Claude API (vinScanner.js, partIdentifier.js, prompts/)
- Mobile: Capacitor (android/, capacitor.config.json)
- Desktop: Electron (electron/)
- PWA: manifest.json, sw.js
- Agents/Backend: agents/, backend/ (Node proxy?)
- CI: .gitea/workflows

## Folder Structure
- agents/: AI agent logic
- android/: Capacitor APK builds
- backend/: Server logic
- electron/: Desktop builds
- icons/: App assets
- prompts/: Claude prompt templates
- Core JS: app.js (main), intake.js (input), pipeline.js (flow), vinScanner.js, partIdentifier.js

## Commands
- npm install
- npx serve .  # Dev server
- npx cap sync android && cd android && ./gradlew assembleDebug  # APK
- npm run electron:dist  # Electron build
- npm test  # Add tests if missing
- npm run lint  # Code quality

## Code Rules (VIN+Repair Pipeline)
- Modular pipeline: intake → VIN decode → damage scan → parts → timeline → report
- One file, one concern: vinScanner.js = VIN only, partIdentifier.js = parts only
- Security: Local API keys, camera perms for VIN scanning, no cloud data
- PWA standards: Offline-capable sw.js, instant report export
- Report format: Readable PDF/txt with repair timeline, part numbers, cost estimates
- AI Prompts: Use prompts/ folder templates; VIN decode → "Decode VIN [VIN] → make/model/year", Parts → "Identify damaged parts from [description/images]"
- Avoid: Hardcoded VINs, god functions, external dependencies beyond Claude API
- Phases: MVP (current) → Report polish → Multi-vehicle → B2B export

## Claude Workflow
1. Read CLAUDE.md + scan prompts/ for AI context
2. Understand pipeline: intake.js → vinScanner.js → partIdentifier.js → pipeline.js → report
3. Think: "Which pipeline stage? Modular fix?"
4. Output: Targeted diffs/patches, never full rewrites
5. Commit: "feat: [vin|parts|report|pipeline] [description]"

Example tasks:
- "Add multi-VIN support to intake.js"
- "Improve partIdentifier.js accuracy for [damage type]"
- "Readable PDF export from pipeline.js"
