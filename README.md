# Community Forum — Saved Posts Take-Home Assessment

A secure, layered, full-stack discussion feed and bookmarks slice built from scratch using TypeScript.

---

## 🚀 Setup Steps

Follow these instructions to install, seed, run, and test the project:

```bash
# 1. Install dependencies
npm install

# 2. Create schema and seed data
npm run db:setup

# 3. Start the API & Web server (Next.js dev server runs both)
npm run dev

# 4. Run unit + API integration tests
npm run test
```

Once started, open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🛠 Technology Stack
- **Language**: TypeScript (strict mode enabled)
- **Framework**: Next.js 15 (App Router)
- **Database**: SQLite (file-based `sqlite.db`)
- **ORM**: Drizzle ORM
- **State Management**: TanStack React Query v5 (with optimistic UI updates)
- **Styling**: Tailwind CSS
- **Testing**: Vitest (for unit & integration tests)
- **Validation**: Zod (for data sanitization)

---

## 📂 Project Architecture

The project enforces clean separation of concerns and layered architecture:

```
src/
├── app/                  # Next.js pages & API Route Handlers
│   ├── api/              # Backend endpoints enforcing 401, 403, 404, OWN authorization boundaries
│   ├── page.tsx          # Main forum client interface (glassmorphic dark-mode)
│   └── layout.tsx        # Global page wrappers (Query, Persona, i18n providers)
├── contexts/             # Client state managers
│   ├── persona.tsx       # Simulates identity/role header injection
│   └── query-provider.tsx# TanStack React Query config
├── db/                   # Database files
│   ├── adapter.ts        # Connects database client queries to business logic interface
│   ├── index.ts          # SQLite database connection setup
│   ├── schema.ts         # Tables: users, courses, enrollments, posts, saved_posts
│   └── seed.ts           # Seeding scripts with 2 courses, 3 students, and initial posts
├── i18n/                 # Localization catalogs
│   ├── context.tsx       # Hook provider managing locales & translation parameters
│   └── translations.ts   # English & Spanish translations (including pluralization)
└── lib/                  # Business & Helper layers
    ├── auth.ts           # Auth context extraction & central API error handler
    └── business-logic.ts # Pure business rules (idempotent saves, soft-deletes, reactivation)
```

---

## 💎 Features Covered

1. **Seed Data**: Populates 2 courses, enrolled students (Alice, Bob, Charlie), a moderator (Mallory), and posts with realistic timestamps.
2. **Access Control**:
   - `401 Unauthenticated`: Triggers if headers are missing.
   - `403 Course Enrollment`: Students can only read or save posts in courses they are enrolled in.
   - `404 Post Not Found`: Return status if the target post does not exist.
   - `OWN Constraint`: Students can only fetch their own saved posts list (never another user's).
   - `Moderators`: Bypasses course boundaries; allowed to see all.
3. **Idempotency & History**:
   - Saving twice returns a `noop` and does not increment saved counts.
   - Un-saving soft-deletes the active record (`isActive = false`).
   - Re-saving reactivates the original record and updates the timestamp rather than creating a duplicate.
4. **Hydrated Flags**: Post lists are fetched with single-query subjoins that compute `hasSaved` and `savesCount` efficiently.
5. **Interactive UI**:
   - **Persona Switcher**: Quick dropdown in the header to switch roles (Alice, Bob, Charlie, Mallory, Guest) in real time to test authorization boundaries instantly.
   - **Locale Switcher**: Toggles UI text and count pluralization (`0 saves` / `1 save` / `10 saves` vs. `0 guardados` / `1 guardado` / `10 guardados`) between English and Spanish.
   - **Optimistic Updates**: Instant UI bookmark toggle state transition.
