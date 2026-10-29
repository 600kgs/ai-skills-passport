# BTU AI Skills Digital Passport: architecture

[ქართული ვერსია](ARCHITECTURE.ka.md)

The system turns confirmed skill records in BTU's Google Sheet into one permanent, versioned PDF passport per student, and records a fingerprint of every version on the Solana blockchain. Anyone can check a passport with the code printed on it and the file itself, without an account and without trusting our server.

Live test deployment: https://passport.btumarket.ge (Solana devnet, test issuer).

![Architecture](architecture.svg)

Two processes share one PostgreSQL database: a **worker** that reads the sheet and issues passports, and a **web app** for verification, students and BTU staff. Gotenberg renders the PDFs. Everything runs as one Docker Compose stack behind Caddy (HTTPS).

| Part | Technology |
|---|---|
| Data source | Google Sheets API (service account), optional Excel upload |
| Worker | Node.js 24, TypeScript, pg-boss job queue |
| Ledger | PostgreSQL 17 (Drizzle ORM) |
| PDF | Gotenberg 8 (Chromium), HTML/CSS template |
| Blockchain | Solana, Solana Attestation Service (SAS) |
| Web | Next.js 16, Better Auth (BTU Google accounts) |
| Email | Brevo transactional API |

## 1. Data source and student identification

**The sheet is the single source of truth.** BTU staff keep entering confirmed skills where they already work. The system never decides whether a student has a skill.

- **Columns are found by header name, not position**, so BTU can reorder or add columns without breaking the import.
- **Every row is validated** before it can affect a passport: required fields, Student ID and Record ID format, dates, the category and its stamp code, duplicate Record IDs, and the same name, email and Passport ID on every row of one student. A faulty row is stopped, and the reason is written next to it in the sheet (`FAILED` plus a note) and listed on the admin page. No passport changes because of it.
- **Verification status:** only `CONFIRMED` rows go into a passport. `PENDING` and `REJECTED` rows are recorded but kept out. A sheet without the status column counts as all confirmed, as BTU's test data defines.
- **Student identity:** the Student ID links all rows of one student. A known student's name and email can't change silently; a mismatch is flagged instead of overwriting an issued passport.
- **Repeated syncs never duplicate:** each Record ID is stored once, with a fingerprint of the row, so a second sync of the same data adds nothing.
- **Status goes back to the sheet:** the system fills `Passport Sync Status`, the version, the time and any error, plus the Passport ID and first-issue date for new students. These cells are rewritten from the ledger on every run, so a lost write heals on the next one.

Two optional paths add data through the same sheet, so it stays the only source:
- **Excel upload (admin page):** the file is checked against the live sheet first (same parser, so duplicates and identity clashes are caught), then the valid rows are inserted under the last record.
- **Confirm / Reject (admin page):** a BTU employee's decision on a `PENDING` record is written into its status cell; sync does the rest.

## 2. Processing

The worker reads the sheet every **15 seconds**, compares it with the ledger in one database transaction (with a lock, so two workers can never sync at once), and queues an **issue job** for every passport that has newly confirmed skills.

An issue job **renders the PDF, stores it, records its fingerprint on chain, and only then marks the version issued**. Each step is saved as it happens, so a crash or a failed network call resumes the same version instead of starting a second one. Before writing to the chain the job checks whether the record is already there, so a retry can't create a duplicate. The skills are frozen when a version opens and the PDF is made from that copy; if a skill is edited, rejected or deleted while the PDF renders, the unfinished version is dropped and started again, so nothing changed mid-issue reaches the chain. Failed jobs retry with growing delays.

After a version is issued, a separate **notify job** emails the student (Georgian and English, with a download link). It is its own job so that an email problem can never fail or repeat an issue. Test addresses (`@example.org`) are skipped.

## 3. Versioning

- **Passport ID and first-issue date are permanent.** They are created once, or taken from the sheet when BTU already assigned them.
- **Every change creates a new version** (V1, V2, ...) with its own verification code. A version's list of included records is fixed when it is created, so an issued version can never change.
- **Issued skills are frozen.** If someone edits a row that is already in an issued passport, the edit is flagged in the sheet and the passport keeps what was confirmed at the time.
- **Old versions keep verifying**, marked "authentic, but a newer version exists". The ledger points to the latest version, and the verify page shows it.

## 4. PDF generation

The passport reproduces BTU's design: the cover, the "about" page, a stamp grid and a detailed skills table, in A4 landscape, using **BTU's official stamps, stickers and logo**. The Georgian name and text are embedded as fonts. Every page carries a QR code to its verify page and the verification code.

Gotenberg (Chromium) turns the HTML template into a PDF. **Each version is rendered once and stored under its own SHA-256 hash.** It is never rendered again, because Chromium doesn't produce byte-identical output twice, and the on-chain fingerprint must match the file the student downloads, byte for byte. A stored file is checked against its hash every time it is served.

## 5. Blockchain verification

**What goes on chain:** for each version, one attestation in the Solana Attestation Service holding only the **SHA-256 hash of the PDF and the version number**. No name, email, ID or skill. The attestation's address is derived from the verification code (`sha256("btu-passport:v1:" + code)`), so the code alone finds the record.

**Issuer identity:** attestations live under a credential that belongs to BTU's **authority key**, and only keys the authority has authorized can write them. The site publishes the authority, credential and schema at `/.well-known/btu-passport-issuer.json` on its own domain. The domain is what vouches for the issuer: in this test it is `passport.btumarket.ge`; in production it would be a btu.edu.ge address.

**How a check works:**
1. The employer opens the verify page (or scans the QR) and adds the PDF.
2. The browser reads the issuer file, then reads the attestation **directly from Solana**.
3. The browser hashes the PDF **locally** (the file is never uploaded) and compares the hash with the attested one.
4. Results: **authentic** (latest version), **authentic but outdated**, **doesn't match** (changed after issue, or a different file), or **unknown code**.

Our server only adds whether a version is the latest. A command-line verifier (`pnpm --filter @passport/worker verify <file.pdf> <code>`) does the same check with no server at all.

## 6. Security

- **Two keys.** The **authority key**, which decides who may issue, never touches the server. The **issuer key** signs attestations and lives on the server only as a read-only secret of the worker container. The web app has neither key and no Google credentials.
- **If the issuer key leaks:** one command (`rotate-issuer`) authorizes a new key and makes the chain itself reject the old one, while every passport already issued keeps verifying. A chain audit (`audit-chain`) then lists any attestation under our credential that our ledger doesn't know, and can close it. It never closes a record whose PDF we hold, so even a database restored from an old backup can't lead to deleting real passports. Both were exercised on devnet.
- **Access:** students sign in with BTU Google accounts only (checked by Google and again on our side) and can download only their own PDFs. Admin pages and actions are limited to listed BTU accounts, and every page and action checks it on the server. All admin actions are logged.
- **Privacy:** the public verify page shows only what is printed on the PDF, and only to someone who has the code. Codes are 10 random characters (about 50 bits) and lookups are rate-limited, so other students' passports can't be found by guessing.
- **Secrets** (keys, Google and Brevo credentials) are never in the repository.

## 7. Scalability: 5,000+ issues and updates a year

Measured on 24 October 2026, live issue figures updated 26 October. Sync and PDF figures come from a developer PC; issue time comes from the live server (Azure, 2 vCPU, 4 GB).

| What | Measured |
|---|---|
| Parse a 5,000-row sheet | 0.18 s |
| First sync of 5,000 new records (1,000 students) | 4.6 s |
| Sync with nothing new | 0.39 s |
| Sync with one new record | 0.34 s |
| Render one passport (1 to 12 skills) | about 0.5 s, 245 to 285 KB |
| Render 8 passports at once | 1.7 s in total |
| Confirm click to issued version / to chain only, live | about 3 s / 1.6 to 2.5 s (43 versions, 0 failed) |
| One version on chain | 0.00172212 SOL deposit (back only by closing the record, which ends its verification) + 0.000005 SOL fee |

**What 5,000 versions a year means:**
- **Load:** about 14 versions a day on average. The 15-second sync takes well under a second even at 5,000 rows, and reading the sheet uses 4 requests a minute, far below Google's per-minute limit.
- **Bursts:** issue jobs run one at a time today, so about 1,200 versions an hour; a burst of 5,000 at once (a whole cohort) finishes in about 4 to 5 hours, unattended, and the queue survives restarts. Jobs are per passport and never conflict, so running 4 in parallel cuts that to roughly an hour; Gotenberg already renders in parallel.
- **Storage:** about 1.3 GB of PDFs a year.
- **Chain cost:** about 8.6 SOL a year locked in deposits plus 0.025 SOL in fees. Old versions must stay on chain to keep verifying, so the locked amount grows with every version.

**What we would change, and when:**

| Limit | When it matters | Change |
|---|---|---|
| Deposit per version | Mainnet, from the first year | **Batch:** one attestation per day holding a Merkle root of that day's versions, with each PDF carrying its short proof. About 365 deposits a year instead of 5,000 (about 0.63 SOL). |
| One issue at a time | Large cohort bursts | Raise the worker's parallelism; split Gotenberg onto its own container. |
| Public Solana RPC rate limits | Any real load | **Done for the server (26 October):** a keyed provider endpoint; browsers keep a keyless one from the issuer file, so verification never depends on our key. |
| Sheet size | Google allows 10 million cells, about 470,000 rows at 21 columns (decades of records) | Archive past years into separate tabs, or read from BTU's student system directly. |
| PDF storage on the server disk | Rollout | Object storage (Azure Blob) with backups. |

## 8. For a real rollout

Built for the test, still to do for production:
- **BTU holds the authority key** on a hardware wallet or a multisig, so nobody outside BTU can authorize issuers.
- **Mainnet and a BTU domain** (for example `passport.btu.edu.ge`), with BTU's own authority key; passports are issued under it.
- **Backups:** hourly database dumps and PDF copies to Azure Blob with soft delete, plus a tested restore.
- **Monitoring:** an uptime check, and alerts for failed issues, a low signing-key balance, and an hourly chain audit.
- **Revocation:** a confirmed skill that later turns out to be wrong. Today `revoke` withdraws the issued version: its chain record is closed and the verify page shows it as revoked, with the reason. Production also needs a flow that issues a corrected version without that skill.
