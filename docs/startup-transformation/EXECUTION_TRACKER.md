# Admitrack — Startup Transformation & Execution Tracker

**Folder:** `docs/startup-transformation/`
**Last Updated:** 2026-11-27
**Goal:** Track everything completed and everything remaining to turn Admitrack into a secure, structured, production-ready SaaS platform.

---

## Documents in This Folder

| Document | Purpose |
|----------|---------|
| [EXECUTION_TRACKER.md](./EXECUTION_TRACKER.md) | Live checklist of what is done and what remains (this file) |
| [ADMITRACK_STARTUP_AUDIT_REPORT.md](./ADMITRACK_STARTUP_AUDIT_REPORT.md) | Full-stack go-live audit (19 findings across security, tests, CI, UI, mobile, ops) |
| [MIGRATION_MECHANISM.md](./MIGRATION_MECHANISM.md) | Strangler Fig migration strategy, 5 foundations, PDF convergence, and small-team workflow |
| [SCALABILITY_AND_ARCHITECTURE_BLUEPRINT.md](./SCALABILITY_AND_ARCHITECTURE_BLUEPRINT.md) | Target 3-tier architecture, caching, observability, and Flutter refactor blueprint |

---

## Overall Progress

| Stage | Status | Completed | Total |
|-------|--------|-----------|-------|
| **Discovery & Planning** | ✅ Done | 4 | 4 |
| **Sprint 0: P0 Security Lockdown** | ⬜ Not Started | 0 | 10 |
| **Phase 0: 5 Core Foundations** | ⬜ Not Started | 0 | 5 |
| **Sprint 1: Safety Net & Continuous Test Gate** | ⬜ Not Started | 0 | 8 |
| **Phase 1: Module-by-Module Migration (12 Modules)** | ⬜ Not Started | 0 | 12 |
| **API Versioning & Contract Governance** | ⬜ Not Started | 0 | 5 |
| **Production Readiness: Logging, Resilience & Security** | ⬜ Not Started | 0 | 10 |
| **Phase 2: Performance & Future-Proofing** | ⬜ Not Started | 0 | 7 |

---

## ✅ Completed So Far

- [x] **Scalability & Architecture Blueprint** created (`SCALABILITY_AND_ARCHITECTURE_BLUEPRINT.md`)
- [x] **Full-Stack Startup Audit** completed with 19 prioritized findings (`ADMITRACK_STARTUP_AUDIT_REPORT.md`)
- [x] **Strangler Fig Migration Mechanism** & PDF convergence plan designed (`MIGRATION_MECHANISM.md`)
- [x] **Transformation Docs Folder** & live tracker established (`docs/startup-transformation/`)

---

## 🔴 Sprint 0: P0 Security Lockdown (Must Fix Before Any Live Users)

> Target: 1–2 Days. Zero architecture changes — pure security fixes.

- [ ] **Remove hardcoded `JWT_SECRET` fallback** in `src/lib/auth.ts` (crash loudly if missing)
- [ ] **Remove hardcoded `_jwtSecret` & client-side token generation** from `mobile_app/lib/services/api_service.dart`
- [ ] **Delete plaintext admin password backdoor** (`Psd@1986`, `admin`, `admin123`) in `src/app/api/auth/login/route.ts`
- [ ] **Force-rotate production `JWT_SECRET`** and reset admin passwords to strong bcrypt hashes
- [ ] **Restrict CORS** in `next.config.ts` (replace `Access-Control-Allow-Origin: *` with `process.env.ALLOWED_ORIGIN`)
- [ ] **Remove token-in-query-param extraction** (`?token=` / `?auth_token=`) in `src/lib/auth.ts`
- [ ] **Secure `/api/cron/backup`**: remove default `CRON_SECRET` fallback and switch from `?secret=` query param to `Authorization` header
- [ ] **Add startup env validation** (`src/core/config/env.ts` with Zod) so missing secrets crash on boot
- [ ] **Add rate limiting on `/api/auth/login`** (e.g., 5 attempts/min per IP, 10/min per `employeeId`)
- [ ] **Remove hardcoded `localhost` / `10.0.2.2` URLs** in `mobile_app/lib/services/api_service.dart` (use `--dart-define=API_URL=...`)

---

## 🟢 Phase 0: Build the 5 Foundations (Zero Risk to Existing Features)

> Target: ~3 Days. Built alongside existing code; nothing imports them until module migration starts.

- [ ] **Foundation 1: Centralized Auth Gate (`src/middleware.ts`)** — protect `/api/*` routes in one place
- [ ] **Foundation 2: API Wrapper (`src/core/api/with-api-handler.ts`)** — unified auth, role checks, Zod body validation, structured JSON logging, and request ID error handling
- [ ] **Foundation 3: Zod DTO Pattern (`src/core/dtos/`)** — create first reference DTO (`student.dto.ts`)
- [ ] **Foundation 4: Service + Repository Pattern (`src/modules/students/`)** — create reference `student.repo.ts`, `student.service.ts`, and `src/core/guards/data-scope.ts`
- [ ] **Foundation 5: Design System (`shadcn/ui` + `src/shared/components/`)** — initialize Tailwind/shadcn primitives and shared `RoleSidebar`, `RoleBottomNav`, `DataTable`, `FilterBar`, `PageHeader`

---

## 🛡️ Sprint 1: Safety Net & Continuous Test Gate

> Target: ~3 Days. Required before refactoring business modules.
> **Rule:** Every major change (foundation, module migration, or schema update) must run the automated test suite before merging so regressions are caught immediately.

- [ ] **Set up Vitest** (`package.json` test script + `vitest.config.ts`)
- [ ] **Write Auth & Login tests** (valid login, invalid password, disabled account, missing token, role rejection)
- [ ] **Write Student CRUD & Data-Isolation tests** (employee isolation, college scoping, telecaller scoping, duplicate phone check)
- [ ] **Set up Flutter test suite** (`flutter_test` for `OfflineService` queue and API error handling)
- [ ] **Enforce "Test After Every Major Change" Gate** (run full `vitest` + `tsc --noEmit` + `eslint` after every major change locally and in PR CI)
- [ ] **Add Next.js CI workflow** (`.github/workflows/ci.yml`: `tsc --noEmit`, `npm run lint`, `npx vitest run`, `npx prisma validate`)
- [ ] **Add `/api/health` endpoint** (DB ping + memory/uptime status) + configure UptimeRobot / BetterUptime
- [ ] **Integrate Sentry** (free tier) for unhandled server, web, and Flutter exceptions

---

## 🔄 Phase 1: Module-by-Module Migration (Strangler Fig)

> Rule: **One module per sprint.** Each module must pass:
> `1. Tests for current behavior` → `2. Service + Repo + DTO` → `3. Thin route (/api/v1/)` → `4. UI refactor (<200 lines)` → `5. Delete old code`

| # | Module | 1. Tests | 2. Service/Repo/DTO | 3. Thin Route | 4. UI (<200 lines) | 5. Cleanup | Status |
|---|--------|----------|---------------------|---------------|--------------------|------------|--------|
| 1 | **Auth** (`login`, `logout`, `me`, `session`) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ Not Started |
| 2 | **Config** (`config`, `cache.ts` → Redis/Upstash) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ Not Started |
| 3 | **Students** (`students/route.ts` 552 lines, `[id]`, `filters`, `stats`) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ Not Started |
| 4 | **Visits** (`village_visits`, `institution-visits`) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ Not Started |
| 5 | **Reports / PDF Convergence** (unify 4 PDF implementations into 1 server API) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ Not Started |
| 6 | **Follow-ups** (`followups`) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ Not Started |
| 7 | **Telecaller** (`telecaller/*`) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ Not Started |
| 8 | **Key Persons & Relatives** (`key-persons`, `relatives`) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ Not Started |
| 9 | **Tasks** (`employee/tasks`) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ Not Started |
| 10 | **College Admin** (`college/dashboard` 91KB, `team`, `schools`) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ Not Started |
| 11 | **AGM** (`agm/*`) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ Not Started |
| 12 | **Super Admin** (`admin/*`, `users`, `colleges`) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ Not Started |

---

## 🔌 API Versioning & Contract Governance

> Ensures web, mobile (Flutter), and external integrations (SPX) never break each other on deploys.

- [ ] **Versioned `/api/v1/` Namespace** — route all migrated and new endpoints under `/api/v1/*` (matching `/api/integrations/spx/v1/*`)
- [ ] **Standardized Response & Error Envelope** — consistent JSON shape (`{ success, data }` / `{ error, code, requestId }`) enforced by `withApiHandler()`
- [ ] **Legacy Route Deprecation Policy** — keep unversioned `/api/*` routes working with `Deprecation` / `Sunset` headers until old mobile builds are phased out
- [ ] **Mobile App Version Gate** — enforce `X-App-Version` / `/api/app-version` compatibility checks so outdated APKs prompt for update before hitting breaking `/api/v2/` changes
- [ ] **OpenAPI / Swagger Generation** — auto-generate API docs directly from Zod DTOs

---

## 🏭 Production Readiness: Logging, Resilience & Security

> Not to implement right now, but tracked here so nothing is forgotten before scaling.

- [ ] **Structured Logging (Pino)** — replace `console.log`/`console.error` with JSON logs (`timestamp`, `level`, `requestId`, `userId`, `route`, `latencyMs`)
- [ ] **PII & Secret Log Redaction** — ensure passwords, JWTs, phone numbers, and tokens are never printed in logs
- [ ] **Correlation ID (`x-request-id`) Tracing** — propagate request ID across middleware, services, DB errors, and client error responses
- [ ] **Next.js Error Boundaries** — add `src/app/error.tsx`, `src/app/global-error.tsx`, and `src/app/not-found.tsx` (currently missing)
- [ ] **Prisma Versioned Migrations** — baseline `prisma/migrations/` (currently missing) and run `prisma migrate deploy` in CI instead of ad-hoc `db push`
- [ ] **Security Headers** — add `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Strict-Transport-Security` in `next.config.ts` / `middleware.ts`
- [ ] **DB Retry & Timeout Wrapper** — exponential backoff (up to 3 retries) for transient Supabase/Supavisor connection drops
- [ ] **Audit Trail for Sensitive Actions** — log who created/disabled users, reassigned students, or admitted students
- [ ] **Subscription & Plan Limit Enforcement** — enforce `College.maxStudents`, `maxEmployees`, `maxTelecallers`, `maxAgms`, and `subscriptionEnd` in service layer
- [ ] **Dependency & Secret Scanning** — enable GitHub Dependabot, `npm audit`, and secret-scanning alerts

---

## 🚀 Phase 2: Performance, Mobile & Future-Proofing

- [ ] **Cursor-based pagination** on student & visit list endpoints (`cursor: { id }`)
- [ ] **Distributed Redis/Upstash cache** replacing `src/lib/cache.ts` in-memory `Map`
- [ ] **Prisma connection pool tuning** (`pgbouncer=true&connection_limit=10`, dev query logging)
- [ ] **Offload heavy jobs** (backups via GitHub Actions / Supabase `pg_dump`; heavy PDFs via background queue)
- [ ] **Flutter modernization**: split `api_service.dart` (1,820 lines) by feature, adopt Riverpod/Bloc, add auto-sync for `OfflineService` queue
- [ ] **Playwright E2E smoke suite** (Login → Add Student → View List → Generate Report → Logout)
- [ ] **Future-proofing**: Supabase Row-Level Security (RLS), feature flags, product analytics (PostHog)

---

## 📝 Change Log

| Date | What Changed | By |
|------|-------------|-----|
| 2026-11-27 | Created `docs/startup-transformation/` with Audit Report, Migration Mechanism, Blueprint, and Execution Tracker | Initial Setup |
