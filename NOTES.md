# NOTES.md — Community Forum: Saved Posts Implementation

This file details the design decisions, trade-offs, and future improvements for the Saved Posts assessment.

---

## 1. Key Design Decisions

### Database & Schema Design
- **SQLite + Drizzle ORM**: To ensure a frictionless local review, I selected SQLite. Database tables map directly to standard SQL. Drizzle Kit's migrations and schemas allow immediate programmatic and CLI seeding.
- **Unique Constraint (`user_id`, `post_id`)**: A composite primary key on the `saved_posts` table prevents database-level duplication.
- **Soft-Delete with Reactivation**: Un-saving a post updates the `is_active` flag to `false` instead of deleting the row (preserving record history). Re-saving the same post updates `is_active` back to `true` and refreshes the `saved_at` timestamp.

### Layered Separation of Concerns
1. **Business Logic Layer (`src/lib/business-logic.ts`)**: Decoupled from the database framework and HTTP runtime. It takes a mockable `BusinessLogicAdapter` interface, making validation, authorization checks, and saving/un-saving logic 100% unit-testable in memory.
2. **API Route Handlers (`src/app/api/...`)**: Parse request parameters and simulate auth checks (translating exceptions like `AuthError` into structured JSON with accurate HTTP status codes: `401`, `403`, `404`).
3. **Database Adapter (`src/db/adapter.ts`)**: Bridges Drizzle's CRUD statements with the abstract `BusinessLogicAdapter` expected by the business logic.

### Authentication & Authorization
- **Stubbed Auth Headers**: Authentic identity is stubbed via request headers (`x-user-id` and `x-role`). In real systems, a middleware would populate these headers after decrypting a signed JWT token or session.
- **Access Boundary Enforcements**:
  - **401 Unauthenticated**: Checked by ensuring `x-user-id` is present and maps to a valid record.
  - **403 Course Enrollment Boundary**: Prior to reading, saving, or un-saving, we check if the user is a `student` and enrolled in the post's course. Moderators are bypassed automatically.
  - **403 OWN Constraint**: When requesting saved posts, students can only request their own saved lists (checked by matching the `userId` query parameter with the authenticated header).

### Efficient Flag Hydration
Instead of querying bookmark states individually per post (the N+1 query problem), flags are computed efficiently in a single query by performing subquery joins:
- `savesCount`: Join a subquery that groups active saves by `postId`.
- `hasSaved`: Join a subquery that filters active saves for the requesting `userId`.
- Uses SQLite `coalesce` to fallback to default `0` values, which are mapped to standard JavaScript integers and booleans.

---

## 2. Trade-offs & Descoped Features
Given the 4–6 hour take-home window, I made the following intentional trade-offs:
- **Client-Side Switcher over Real Authentication**: Rather than setting up complex Auth0, NextAuth, or session cookies, I built an interactive header **Persona Switcher**. It sets the headers in client fetch requests, making it visually obvious how authorization rules function.
- **In-Memory UI State vs Full Server Pagination Component**: While the API supports limit/offset pagination, the UI renders the fetched page size directly to keep components simple and clean.
- **Simple React Context for i18n**: Instead of importing heavy i18next frameworks with complex async configuration, I wrote a lightweight i18n context containing structured translation objects for English and Spanish, supporting parameter injection (`{count}`) and pluralization.

---

## 3. What I'd Do Next (With Another Day)
1. **Full Authentication Integration**: Replace the header Persona Switcher with iron-clad cookie session management or NextAuth, mapping simulated roles to auth providers.
2. **Real-time Synchronization**: Use WebSockets or Server-Sent Events to push bookmark count increments immediately across all logged-in users.
3. **Infinite Scroll Pagination**: Integrate infinite scrolling with React Query `useInfiniteQuery` for a smoother user experience in feeds.
4. **End-to-End Testing**: Write Playwright integration tests to click through the Persona Switcher and visually test optimistic UI transitions, network failures, and layout responsiveness.
