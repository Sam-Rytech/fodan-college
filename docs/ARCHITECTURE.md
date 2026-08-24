# Fodan College LMS — Architecture

> …that they might have it abundantly

This document is the answer to section 45 of the brief. It explains the system
before the code, and records *why* each decision was taken — particularly the
places where the brief's literal request was changed to something safer.

---

## A. System architecture

A single **Next.js application** using the App Router, deployed as one Node
process in front of one PostgreSQL database and one object store.

```
                    ┌──────────────────────────────────────────┐
   Browser ────────▶│  Next.js (App Router, React 19, TS)      │
   (student /       │                                          │
    admin)          │  ┌────────────────────────────────────┐  │
                    │  │ Server Components — read models    │  │
                    │  │  src/lib/data/*                    │  │
                    │  ├────────────────────────────────────┤  │
                    │  │ Server Actions — write paths       │  │
                    │  │  src/app/**/actions.ts             │  │
                    │  ├────────────────────────────────────┤  │
                    │  │ Route Handlers — bytes & logout    │  │
                    │  │  /api/files/[id], /api/auth/logout │  │
                    │  ├────────────────────────────────────┤  │
                    │  │ Domain services  src/lib/*         │  │
                    │  │  auth · exam · access-codes ·      │  │
                    │  │  storage · audit · notifications   │  │
                    │  └────────────────────────────────────┘  │
                    └───────────┬───────────────────┬──────────┘
                                │ Prisma            │ StorageDriver
                                ▼                   ▼
                        ┌──────────────┐    ┌──────────────────┐
                        │ PostgreSQL   │    │ Local disk (dev) │
                        │              │    │ S3-compatible    │
                        └──────────────┘    │ (production)     │
                                            └──────────────────┘
```

### Why one application rather than a separate API

A separate backend buys independent scaling and language choice. Neither is
needed here: the only client is this web app, the traffic profile is a few
hundred students in one school, and the operational cost of two deployments,
two sets of secrets and a network hop between them is real. What a split
*would* cost is the thing that matters most here — every request would need its
own auth check re-implemented on both sides, which is exactly where
authorisation bugs live.

Instead the boundary is enforced **inside** the codebase:

- `src/lib/**` is server-only. Files that touch secrets, the database or the
  filesystem start with `import 'server-only'`, so an accidental import from a
  client component is a **build error**, not a production leak.
- Client components receive explicitly-shaped data. The examination payload is
  built by a function that *cannot* emit the answer key — see
  `toStudentQuestion` in `src/lib/exam/engine.ts`.

### Request lifecycle for a protected page

1. `layout.tsx` calls a guard (`guardStaff`, `guardStudent`, `guardLearningAccess`).
2. The guard resolves the session once per request (React `cache`), which
   validates the cookie, absolute expiry, idle expiry and account status.
3. The page calls a read model in `src/lib/data/*`, which applies **class/subject
   scoping at the database level** — never in the component.
4. Any mutation goes through a Server Action wrapped in `runAction`, which
   verifies the request origin and converts thrown errors into a safe envelope.

---

## B. Technology stack, and why

| Layer | Choice | Reason |
|---|---|---|
| Framework | **Next.js 15, App Router** | Server Components mean class-scoped queries run on the server and the answer key never crosses the wire. Server Actions give mutations CSRF protection by default. One deployable unit. |
| Language | **TypeScript, `strict` + `noUncheckedIndexedAccess`** | The enumerated values (roles, statuses, material types) are string columns for database portability; strict typing is what keeps them honest. |
| UI | **React 19 + Tailwind CSS v4** | Tailwind v4's CSS-first `@theme` means the whole design system is CSS custom properties — re-theming is one file. No runtime CSS-in-JS cost on a slow connection. |
| Components | **Radix primitives + in-house layer** | Radix supplies correct focus trapping, `aria-modal` and keyboard handling for dialogs, menus and tabs. Everything visual is ours, so the platform does not look like a template. |
| Database | **PostgreSQL** (SQLite for local dev) | Real constraints, real indexes, real transactions. The schema deliberately avoids native enums, `Json` and array columns so the *same* schema file runs on SQLite — `npm run db:use:sqlite` — and a developer needs nothing installed. |
| ORM | **Prisma 6** | Generated types make the read models type-safe end to end; `$transaction` gives exam scoring atomicity. |
| Auth | **Custom opaque server sessions** | See section E. |
| Hashing | **bcrypt (`bcryptjs`)** | Pure JavaScript, no native build step — deploys unchanged on Windows, Linux and serverless. Argon2id is stronger and the swap touches one file (`src/lib/password.ts`). |
| DOCX | **mammoth** | Pure JS, no Office runtime. Converting to HTML (rather than raw text) preserves Word's automatic list numbering, which raw extraction destroys. |
| Charts | **Recharts** | SVG, responsive, accessible tooltips; themed from the same CSS variables. |
| Validation | **Zod** | One schema validates *and* sanitises, so a handler cannot accidentally use the raw string. |
| Tests | **Vitest** | Fast, no transpile config, runs the pure domain logic (parser, scoring, policy, RBAC) without a browser. |
| Fonts | **System stack** | No web-font fetch. A failed font request must never delay a lesson or an examination timer on a slow connection. |

---

## C. Database schema

29 tables. Full definitions in `prisma/schema.prisma`; the relationships:

```
Role ──< RolePermission >── Permission ──< UserPermission >── User
                                                              │
  ┌───────────────────────────────────────────────────────────┤
  │                                                           │
  ▼                                                           ▼
StudentProfile ──▶ SchoolClass ──< ClassSubject >── Subject   Session
  │                    │                              │       PasswordResetToken
  │                    │                              │       VerificationToken
  │                    ├──< Topic >───────────────────┤       LoginAttempt
  │                    │      │                       │       Notification
  │                    │      ▼                       │       AuditLog
  │                    │  LearningMaterial ──▶ StoredFile
  │                    │      │
  │                    │      └──< LessonProgress >── User
  │                    │
  │                    ├──< Examination >─────────────┤
  │                    │       │                              AdminClassAssignment
  │                    │       ├──< ExamQuestion >──< ExamOption
  │                    │       │         ▲                    AdminSubjectAssignment
  │                    │       ├──< ExamAttempt >──< ExamAnswer
  │                    │       │         │
  │                    │       │         └──▶ Result (1:1)
  │                    │       └──< ExamImport ──▶ StoredFile
  │                    │
  │                    └──< ForumCategory >──< ForumPost >──< ForumReply
  │                                                │              │
  └──< AccessCode                                  └──< ForumReport
                                    Task ──< TaskHistory      SystemSetting
```

### Decisions worth defending

**`user_roles` collapsed to `User.roleId`.** The brief lists a join table. In
this domain a person is a student *or* an administrator — never both — so a
join table would model a cardinality that cannot occur, and every query would
carry a needless join. Granularity comes from `UserPermission`, which is
strictly more expressive than multi-role: the Super Admin can grant *or
explicitly deny* any single capability to one Mini Admin without inventing a
new role.

**`Result` exists alongside `ExamAttempt`.** This is deliberate denormalisation.
`Result` is an immutable projection written once at scoring time, carrying
`classId` and `subjectId` so class and subject analytics are a single indexed
read instead of a four-table join on every dashboard tile. It also means a
result survives independently of later changes to the attempt row.

**No native enums.** Every enumerated column is a `String`, validated in exactly
one place (`src/lib/constants.ts` + the Zod schemas). This is what allows one
schema file to run on both PostgreSQL and SQLite, and it removes the migration
pain of altering a PostgreSQL enum type.

**Append-only tables.** `AuditLog`, `TaskHistory` and `LoginAttempt` have no
update or delete path anywhere in the application. In production the database
role should additionally be granted `INSERT, SELECT` only on `audit_logs` —
see `docs/SECURITY.md`.

---

## D. Folder structure

```
fodan-college/
├── prisma/
│   ├── schema.prisma          # single schema; provider swapped by script
│   └── seed.ts                # reference data + optional demo data
├── scripts/
│   └── set-db-provider.mjs    # postgresql ⇄ sqlite
├── public/brand/
│   └── fodan-logo.png         # the crest, used everywhere
├── docs/
│   ├── ARCHITECTURE.md        # this file
│   ├── SECURITY.md
│   ├── EXAM_DOCX_FORMAT.md
│   ├── ADMIN_GUIDE.md
│   ├── STUDENT_GUIDE.md
│   ├── DEPLOYMENT.md
│   └── QA_SCENARIOS.md
├── src/
│   ├── app/
│   │   ├── layout.tsx         # theme + toasts + skip link
│   │   ├── page.tsx           # public landing page
│   │   ├── (auth)/            # login, register, forgot/reset password
│   │   ├── change-password/   # forced password change (outside the shell)
│   │   ├── student/           # the whole student experience
│   │   ├── manage/            # Super Admin + Mini Admin, one tree
│   │   ├── forum/             # shared by every role
│   │   └── api/
│   │       ├── files/[fileId]/route.ts   # authenticated file delivery
│   │       └── auth/logout/route.ts
│   ├── components/
│   │   ├── brand/             # crest, lockup, report letterhead
│   │   ├── ui/                # design system
│   │   ├── layout/            # shell, navigation, notification bell
│   │   ├── student/  charts/  forum/  notifications/  profile/
│   └── lib/
│       ├── constants.ts       # every enumerated value, once
│       ├── env.ts             # validated configuration, fails fast
│       ├── db.ts  crypto.ts  password.ts  password-policy.ts
│       ├── errors.ts  actions.ts  rate-limit.ts  sanitize.ts
│       ├── audit.ts  notifications.ts  settings.ts  access-codes.ts
│       ├── validation.ts      # Zod schemas (validate + sanitise)
│       ├── auth/              # session, rbac, guards, service, types
│       ├── exam/              # question-parser, docx, engine
│       ├── storage/           # driver interface, local, s3
│       └── data/              # read models: student.ts, admin.ts
└── tests/                     # Vitest suites
```

---

## E. Authentication & RBAC

### Sessions, not JWTs

The cookie carries **256 bits of CSPRNG output** and no claims. Only its
HMAC-SHA256 (keyed by `AUTH_SECRET`, domain-separated per purpose) is stored, so
a database dump cannot be replayed as a live session.

Chosen over a self-contained JWT because **revocation must be immediate**:
disabling an account, resetting a password or signing out everywhere has to take
effect on the very next request. A stateless token cannot promise that without a
blocklist — at which point it is a session with extra steps.

Two independent expiries are enforced on every read:

- **absolute** — `expiresAt`, fixed at creation (default 12 hours);
- **idle** — `lastSeenAt` + `SESSION_IDLE_TIMEOUT_MINUTES` (default 2 hours).

`lastSeenAt` is only written once a minute, so an active session does not cost a
write per request.

### Roles and permissions

```
effective(user) = SUPER_ADMIN ? ALL
                : rolePermissions(user.roleId)
                    ∪ { p : userPermission(p).granted }
                    ∖ { p : ¬userPermission(p).granted }
```

Twelve permissions, matching the brief exactly:

`manage_students` · `manage_admins`* · `manage_classes` · `manage_subjects` ·
`upload_materials` · `manage_exams` · `view_results` · `manage_forum` ·
`manage_tasks` · `view_audit_logs`* · `manage_codes` · `manage_settings`*

\* never delegatable to a Mini Admin.

The Super Admin **implicitly** holds everything, so a permission added in a
future release is never missing from the bootstrap account.

### Scoping — fail closed

A Mini Admin with **no** class assignment is scoped to **nothing**, not to
everything (`classScopeFilter` returns `{ classId: { in: [] } }`). An unassigned
administrator sees an empty workspace, which is the safe reading.

### Guards

Two flavours, kept separate on purpose:

- `require*` **throws** an `AppError` — for Server Actions and route handlers.
- `guard*` **redirects** — for pages and layouts, where the right response is to
  send the visitor somewhere they are allowed to be.

Hiding a navigation item is presentation. The guard on the page is the
protection. Both exist; only one is trusted.

### Privacy between administrators

`canViewAdminProfile` encodes the brief's rule directly: a Mini Admin may read
their own record and (with `manage_students`) student records — never another
administrator's. `canModifyUser` prevents self-modification, prevents any change
to a Super Admin, and `canCreateRole` makes creating a second Super Admin
impossible through the application.

---

## F. Access-code design

| Stage | What happens |
|---|---|
| **Generate** | 8 characters from a 27-symbol unambiguous alphabet (no `0/O`, `1/I/L`, `5/S`, `2/Z`) drawn with `crypto.randomInt` — ≈38 bits. Prefixed with a readable, non-secret segment: `FDN-JSS1-ABCD1234`. |
| **Store** | Only `HMAC-SHA256(code, key='access-code')`. Plus `codePrefix` and `codeLast4` for support lookup. **The plaintext is shown to the issuing administrator exactly once** and can never be recovered. |
| **Bind** | `studentId` is set at creation. The code belongs to one account. |
| **Expire** | `expiresAt`, default 30 days (configurable in Settings). A background sweep in the `/manage` layout flips lapsed codes to `EXPIRED`. |
| **Redeem** | Hash lookup → *is it mine?* → *is it live?* → conditional `updateMany` that re-asserts `status = ACTIVE`, so two simultaneous submissions cannot both consume a single-use code. |
| **Revoke** | Terminal. Regeneration issues a fresh code and revokes the old one in the same operation. |

Presenting **another student's code** fails with the brief's exact message —
"This activation code is not assigned to this account." — and is written to the
audit log at `WARNING` severity, because it usually means a code was shared.

Redemption is rate-limited per account (8 attempts / 15 minutes) on top of a
code space far too sparse to guess.

---

## G. DOCX examination parser

Two layers, split so the hard part is testable without fixture binaries:

**`src/lib/exam/docx.ts`** — Word → plain text. Uses mammoth's HTML conversion
rather than `extractRawText`, because raw extraction discards Word's *automatic*
list numbering; a paper typed with the numbered-list button would arrive as an
unnumbered wall of text. A small hand-written flattener walks the generated
markup, re-materialises `<ol>` numbers, and flattens tables (question papers are
often laid out in two columns).

**`src/lib/exam/question-parser.ts`** — pure text → structured questions. No
I/O, no dependencies, fully unit-tested.

### The format

```
1. What is the capital of Nigeria?
A. Lagos
*B. Abuja
C. Ibadan
D. Kano
```

The asterisk immediately before the correct option is the answer key.

**Tolerated variations**, because real documents are typed by people:
`*B.` · `* B.` · `B. *Abuja` · `B. Abuja *` · `1.` `1)` `Q1.` `Question 1:` ·
`A.` `A)` `(A)` `A -` · smart quotes, en dashes, `✱ ＊` look-alikes ·
question text wrapped over several lines · blank lines anywhere.

### Validation before publication

An import produces a preview screen. **Errors block publication**:

- no correct option marked
- more than one correct option marked
- fewer than two options
- empty question or option text
- a repeated option letter

**Warnings** are shown but do not block: duplicate question text, an unusual
option count, non-sequential source numbering, repeated option text.

Every issue carries a line number and a plain-English fix, so the administrator
edits the DOCX rather than guessing.

---

## H. Page map

### Public
| Route | Purpose |
|---|---|
| `/` | Landing page — subjects, how it works, call to action |
| `/login` · `/register` | Authentication; redirects a signed-in visitor away |
| `/forgot-password` · `/reset-password` | Self-service recovery |

### Everyone signed in
| Route | Purpose |
|---|---|
| `/change-password` | Outside the shell — a forced change cannot be navigated around |
| `/forum` · `/forum/[slug]` · `/forum/[slug]/[postId]` | Class discussion |

### Student
| Route | Purpose |
|---|---|
| `/student` | Dashboard; shows the class-selection or activation prompt when needed |
| `/student/select-class` · `/student/activate` | The two steps before learning opens |
| `/student/subjects` · `/student/subjects/[slug]` | Browse by structure |
| `/student/lessons` · `/student/lessons/[id]` | Flat list; the lesson viewer |
| `/student/exams` · `/student/exams/[id]` · `/student/exams/[id]/take` | List, briefing, the paper |
| `/student/results` · `/student/results/[attemptId]` | Results and question review |
| `/student/notifications` · `/student/profile` | |

### Administrators (`/manage`, permission-filtered)
`/manage` (role-aware dashboard) · `/manage/students[/id]` · `/manage/admins[/id]` ·
`/manage/classes` · `/manage/subjects` · `/manage/materials[/new]` ·
`/manage/examinations[/import][/id]` · `/manage/results[/exam/id]` ·
`/manage/codes` · `/manage/tasks` · `/manage/forum` · `/manage/audit` ·
`/manage/settings` · `/manage/notifications` · `/manage/profile`

---

## I. Security architecture

Detailed in **`docs/SECURITY.md`**. Summary of the controls:

- **Passwords** — bcrypt cost 12; never stored, transmitted or displayed in
  readable form. **Plaintext visibility is deliberately not implemented** — see
  the note below.
- **Enumeration** — one message for every sign-in failure; a dummy bcrypt
  comparison when the account does not exist so timing does not differ; the
  disabled-account check happens *after* the password verifies.
- **Brute force** — per-identifier and per-IP rate limits, plus a per-account
  lockout that survives IP rotation.
- **Sessions** — opaque, hashed, dual expiry, revoked on password change.
- **CSRF** — Server Actions carry Next's built-in Origin check; `runAction`
  re-verifies explicitly, and the logout route is POST-only with its own check.
- **XSS** — user content is stored as plain text and rendered into React
  elements, never HTML. `dangerouslySetInnerHTML` appears exactly once in the
  codebase, for the pre-hydration theme script.
- **SQL injection** — every query goes through Prisma's parameterised builder.
- **Uploads** — extension allowlist, MIME check, **magic-number check**, size
  limits per type, generated storage keys, executable extensions rejected
  outright, files stored outside the web root.
- **File access** — one authenticated route; permission re-evaluated on every
  request; 404 (not 403) on denial so ids cannot be probed.
- **Exam integrity** — server-side scoring only; the answer key never enters a
  student payload; deadline enforced server-side; attempt limits re-checked on
  every call; a student cannot read another student's attempt.
- **Headers** — CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Permissions-Policy`.
- **Audit** — append-only, scrubbed metadata, IP recording configurable.

### The one place the brief was changed

> "the Super Admin should be able to see an administrator's password even if
> they change it"

**Not implemented, and never will be.** It would require storing plaintext or
reversible ciphertext, turning one database leak into total compromise of every
account — including accounts whose owners re-use that password elsewhere.

The underlying need is met safely: the Super Admin can **reset** any password,
the reset is audited at `CRITICAL`, every session of the affected account is
destroyed, and the account must choose a new password at next sign-in. The brief
itself endorses this in section 3; it is recorded here because it is the single
most important deviation.

---

## J. Implementation roadmap

| Phase | Scope | State |
|---|---|---|
| 1 | Architecture, project structure, design system | ✅ |
| 2 | Database schema, migrations, seed | ✅ |
| 3 | Authentication, sessions, RBAC, guards | ✅ |
| 4 | Registration, class selection, access codes | ✅ |
| 5 | Student dashboard, subjects, lessons, progress | ✅ |
| 6 | Admin dashboards, students, admins, classes, subjects, materials | ✅ |
| 7 | DOCX import with validation screen | ✅ |
| 8 | Examination engine | ✅ |
| 9 | Results and analytics | ✅ |
| 10 | Forum with moderation | ✅ |
| 11 | Task management and audit log | ✅ |
| 12 | Notifications | ✅ |
| 13 | Security hardening | ✅ |
| 14 | Automated tests + manual QA scenarios | ✅ |
| 15 | Deployment preparation | ✅ |

Known limitations are recorded honestly in `README.md` under **Not yet built** —
nothing in the interface pretends to work when it does not.
