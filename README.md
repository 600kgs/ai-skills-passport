# AI Skills Digital Passport

[![ci](https://github.com/600kgs/ai-skills-passport/actions/workflows/ci.yml/badge.svg)](https://github.com/600kgs/ai-skills-passport/actions/workflows/ci.yml)

BTU confirms a student's AI skill in its Google Sheet. Seconds later the student has a new version of their multi-page PDF passport in BTU's design, its fingerprint is on the Solana blockchain, and anyone can check that the PDF is genuine, without an account and without having to trust our server.

Built by team **Git Happens** (Oto Sepashvili, Nika Loliashvili) for the BTU AI Skills Digital Passport hackathon, October 2026. [ქართული: არქიტექტურა](docs/ARCHITECTURE.ka.md)

**Try it:** the live test deployment runs at **https://passport.btumarket.ge** (Solana devnet, test issuer). A real issued record: [/v/R24Z-0RS5-R8](https://passport.btumarket.ge/v/R24Z-0RS5-R8), and the same record on [Solana Explorer](https://explorer.solana.com/address/7ZtJ8CD3pacXJEDgLvwK4qhkwnWAMYjjkSvHigm6sUHB?cluster=devnet).

| Passport cover | Skills page |
| --- | --- |
| ![Passport cover, generated from BTU's design](docs/img/passport-cover.jpg) | ![Skills page with BTU's stamps](docs/img/passport-skills.jpg) |

| Verify page (public) | Student page | Admin page |
| --- | --- | --- |
| ![Verify page](docs/img/verify.jpg) | ![Student page](docs/img/student.jpg) | ![Admin page](docs/img/admin.jpg) |

## What it does

- **BTU staff** keep working in the Google Sheet they already use, or upload an Excel file on the admin page. Every row is validated; a bad row never reaches a passport and the sheet shows why.
- **Students** get one permanent Passport ID. Each confirmed skill issues a new version: a new PDF, a new verification code and a new on-chain record. They sign in with their BTU Google account, download their PDFs, get an email for every new version and can add the passport to LinkedIn in one click.
- **Employers** open the code from the PDF or its QR code and drop the PDF on the page. They get one of four answers: authentic and latest, authentic but outdated, modified, or unknown.

## Why a passport can be trusted

The whole point of the system is that a fake PDF gets caught, even if our server were lying.

1. **The browser checks, not us.** The verify page reads the record straight from Solana and hashes the PDF locally; the file is never uploaded. A command-line verifier does the same with no website at all: `pnpm --filter @passport/worker verify <file.pdf> <code>`.
2. **Only BTU's key can write.** Records are [Solana Attestation Service](https://github.com/solana-foundation/solana-attestation-service) attestations under a credential owned by BTU's authority key, which never touches the server. The server only holds a daily signing key.
3. **The domain vouches for the key.** The site publishes [`/.well-known/btu-passport-issuer.json`](https://passport.btumarket.ge/.well-known/btu-passport-issuer.json) over HTTPS, naming the authority, credential and schema. At rollout the same file moves to btu.edu.ge.
4. **A leaked key is contained.** `rotate-issuer` authorizes a new signing key and the chain itself rejects the old one (`SignerNotAuthorized`); every passport already issued keeps verifying. We ran it on the live system. `audit-chain` then lists any record our ledger doesn't know.
5. **Nothing personal on chain.** Each record holds only the PDF's SHA-256 and the version number.

## How it works

![Architecture](docs/architecture.svg)

Google Sheet → **worker** (sync every 15 s, validate, ledger in Postgres) → render the PDF once with Gotenberg → hash → attestation on Solana → the version becomes "latest" only after the chain write succeeds → email the student → write the status back to the sheet. Issued PDFs are stored once and never re-rendered, because a re-render produces different bytes. Details: [architecture (English)](docs/ARCHITECTURE.md), [ქართული](docs/ARCHITECTURE.ka.md).

## The brief's demo scenarios

| Scenario | What happens | Where |
| --- | --- | --- |
| Add a new student | One passport with a permanent ID (BTU-AI-000125) | [sync.ts](apps/worker/src/sync.ts) |
| First passport generation | Multi-page PDF in BTU's design; pages grow with the skills | [pdf/template.ts](apps/worker/src/pdf/template.ts) |
| New confirmed skill in the sheet | Picked up within 15 s, or at once via the admin page | [sync.ts](apps/worker/src/sync.ts), [sheet.ts](packages/core/src/sheet.ts) |
| New skill appears | The student's passport gets a new version | [issue.ts](apps/worker/src/issue.ts) |
| Repeated sync | A Record ID is never added twice (unique key in the ledger) | [db schema](packages/db/src) |
| Wrong student identifier | The row is marked FAILED with the reason; nothing is issued | [sheet.ts](packages/core/src/sheet.ts) |
| Passport update | Passport ID, first issue date and earlier skills are kept | [issue.ts](apps/worker/src/issue.ts) |
| New version issued | New PDF, new code, new attestation | [issue.ts](apps/worker/src/issue.ts), [chain.ts](apps/worker/src/chain.ts) |
| Check an unmodified PDF | "Authentic", checked in the browser against the chain | [verify page](apps/web/src/app/v/%5Bcode%5D), [chain-read.ts](packages/core/src/chain-read.ts) |
| Check a modified PDF | "Modified": one changed byte breaks the match | [verdict.ts](packages/core/src/verdict.ts) |
| Check issuer identity | Signer belongs to BTU's credential, named by the domain's issuer file | [issuer file](apps/web/src/app/.well-known/btu-passport-issuer.json/route.ts) |
| Check an old version | "Authentic, but a newer version exists" | [verdict.ts](packages/core/src/verdict.ts) |
| Student access | BTU Google sign-in; each student sees and downloads only their own PDFs | [me](apps/web/src/app/me/page.tsx), [pdf route](apps/web/src/app/api/pdf/%5Bcode%5D/route.ts) |
| Public verification | No login; the code or QR opens the record | [verify page](apps/web/src/app/v/%5Bcode%5D) |

From the optional extras: a QR code on every PDF page, an admin panel (status, confirm or reject pending skills, passports, activity log), Excel import with a preview, email notifications, LinkedIn sharing, and a cost plan for mainnet (daily Merkle batching).

## Measured

| What | Result |
| --- | --- |
| Confirm click to issued version, live server | about 3 s |
| Render + write to the chain | 1.6 to 2.5 s; 43 versions issued, 0 failed |
| Sync a 5,000-row sheet, nothing new | 0.39 s |
| First import of 5,000 new records | 4.6 s, once |
| One version on chain | 0.00172212 SOL deposit + 0.000005 SOL fee |

5,000 versions a year is about 14 a day; one worker issues about 1,200 an hour. Full numbers and the scaling plan are in [the architecture doc](docs/ARCHITECTURE.md#7-scalability-5000-issues-and-updates-a-year).

## Stack

TypeScript everywhere, so the hashing and chain-reading code is the same on the server and in the verifier's browser. Next.js 16 (site), a Node worker with pg-boss (queue in Postgres), PostgreSQL 17 with Drizzle, Gotenberg (headless Chromium) for the PDF, `@solana/kit` + `sas-lib`, Google Sheets API with a service account, Better Auth (BTU Google accounts only), Brevo for email. Runs as Docker Compose behind Caddy on one VM; GitHub Actions runs typecheck, lint, about 90 tests and a build on every push.

```
apps/web        site: verify page, student page, admin, issuer file
apps/worker     sheet sync, issue queue, PDF, chain writes, email; scripts/ for keys and audits
packages/core   shared rules: sheet parsing, codes, hashing, chain reads, verdicts
packages/db     schema and migrations
docs/           architecture (English, Georgian)
```

## Run it locally

Needs Node 24+, pnpm (via `corepack enable`) and Docker.

```bash
pnpm install
cp .env.example .env          # fill in the sheet id, Google OAuth and the service account path
docker compose up -d          # Postgres on 5433, Gotenberg on 3100
pnpm --filter @passport/worker setup-issuer   # devnet keys, BTU credential and schema
pnpm dev                      # site on http://localhost:3000, worker alongside
pnpm test
```

Production uses `docker-compose.prod.yml` (web, worker, Postgres, Gotenberg, Caddy with automatic HTTPS).

## Before a real rollout

Honest limits of the test deployment: it runs on Solana devnet with a test issuer on our domain; withdrawing an already issued skill (revocation) is not built yet; issuing renders from the skill's current data rather than a frozen copy, so an edit in the ~2 s while a version is being issued could end up in its PDF; backups and monitoring are not switched on, because all data is test data. The rollout plan: BTU's own authority key on a hardware wallet, the issuer file on btu.edu.ge, mainnet with daily batching, backups and alerts, then a gradual start with one group of students. See [section 8 of the architecture](docs/ARCHITECTURE.md#8-for-a-real-rollout).
