# AGENTS.md — Asset & Equipment Management System (AEMS)

> Project instructions for AI coding agents (Claude Code, Codex, GitHub Copilot, etc.).
> Baseline: **Blueprint AEMS R.02, 9 November 2026**. Status: implementation specification, **not** a claim that code, services, or deployments already exist.
> Language for UI and user-facing messages: **Bahasa Indonesia**. Technical identifiers may use English.

## 0. Agent operating contract

1. Read this file, `README.md`, relevant source files, migrations, and tests before changing code. Treat the blueprint as the product source of truth; where the blueprint explicitly marks an item **A (assumption)** or **Q (requires confirmation)**, do not silently present it as approved company policy.
2. Inspect the actual repository and existing GitHub/Supabase/Vercel configurations before editing. **Never assume AEMS uses the ATM-SIG repo, Supabase project, or Vercel project.** Create/use dedicated AEMS resources.
3. Produce a short implementation plan, then implement complete vertical slices: database + RLS + server validation + UI + tests + documentation.
4. Preserve existing features. Avoid unrelated refactors, destructive schema changes, unapproved role changes, and UI regressions.
5. Do not report a test, build, deployment, database migration, or UAT as passed unless actually executed and evidence is available. Report blockers honestly.
6. For non-trivial changes: run typecheck, lint, tests, production build; review migration and permissions; verify Preview before production.
7. Never print secrets, credentials, production connection strings, or sensitive data in logs, commits, PRs, or chat. If a secret is exposed, recommend rotation.
8. Prefer free-tier-compatible infrastructure and avoid adding paid services without explicit approval. Do not assume free tiers provide PITR, sufficient retention, cron frequency, or guaranteed uptime.
9. Make small, reviewable commits and PRs. Do not merge or deploy to production unless the user explicitly authorizes it and all relevant gates pass.
10. If tool access is missing, document precise manual actions; never pretend the change has been applied.

## 1. Product scope

**AEMS** unifies SAP asset master data managed by Accounting with equipment master data managed by Maintenance/Operasional. It supports two-way lookup, flexible equipment hierarchy, temporal mappings, Excel imports, auditability, reporting, and three-role access control.

**MVP modules:** Dashboard; Master Data Aset; Master Data Equipment; Mapping & Hierarki; Equipment Tanpa Mapping; Import Excel; Laporan; Audit Trail; Pengguna/Profil; Administrasi dan Persetujuan Mapping.

**Out of scope for MVP:** direct SAP API/RFC/BAPI/OData integration, work orders, preventive maintenance, spare-part inventory, depreciation/journaling, native Android/iOS, QR/barcode, and PWA (future phase per R.02). Do not add ATM-SIG-specific task manager, WBS, reviewer, or deadline workflows to AEMS.
