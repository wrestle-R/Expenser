# Expenser React Native CLI: Offline-First Migration Masterplan

## Document Purpose

This document is a full implementation blueprint for upgrading the current React Native CLI app into a production-grade, offline-first app that:

- Matches the existing Expo app feature set and visual quality
- Improves reliability, performance, and data consistency in poor/no network
- Keeps configuration externalized (no hardcoded backend/auth secrets)
- Is deeply customizable for future growth

This is intentionally detailed and designed to be executed in phases with measurable checkpoints.

---

## Current State Summary

### What exists today

- Expo app in `expo/` has the complete product behavior:
  - Auth + guarded navigation
  - Home/dashboard
  - Transactions CRUD + edit
  - Workflows CRUD + apply-to-transaction flow
  - Profile settings + theme
  - Basic offline queue/sync behavior and status banners
- React Native CLI app in `reactnative/` is a starter app shell with minimal UI.

### Why migrate to RN CLI for this use case

- Better native control for performance tuning and offline storage strategy
- More predictable native behavior in background/network edge cases
- Ability to optimize startup, persistence, and sync engine at a lower level

---

## Product Goals

### Functional goals

- Achieve near-complete feature parity with Expo app screens and actions
- Offline-capable for all core write flows:
  - Add transaction
  - Edit transaction (with conflict handling)
  - Delete transaction
  - Add workflow
  - Delete workflow
  - Profile updates where feasible
- Smooth sync recovery when connectivity returns

### Quality goals

- Fast cold start from local cache (no blank/blocked screen)
- No data loss during app termination, crash, or network flap
- Predictable UI state under online/offline transitions
- Highly polished visual language ("sexy" look) while preserving usability

### Non-goals for first major milestone

- Full local-first auth replacement of Clerk
- Full multi-device real-time reconciliation UI
- Desktop/web parity in the same codebase

---

## Environment and Secret Handling (No Hardcoding)

Use environment-driven configuration in RN CLI. Do not embed API URL or Clerk key literals in business logic.

### Required runtime keys

- `API_URL`
- `CLERK_PUBLISHABLE_KEY`

### Recommended setup

- Use `react-native-config` (or equivalent) with per-flavor env files:
  - `.env.development`
  - `.env.staging`
  - `.env.production`
- Keep one typed configuration module:
  - `src/config/env.ts`
- Add startup validation:
  - Fail-fast in dev when key missing
  - Graceful fallback UI in prod with actionable error

### Migration mapping from Expo env

Current Expo variables:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`

RN CLI equivalent should be normalized to:

- `API_URL`
- `CLERK_PUBLISHABLE_KEY`

### Validation contract

At boot, validate:

- `API_URL` is valid `http/https` URL
- `CLERK_PUBLISHABLE_KEY` exists and has expected prefix pattern

If invalid:

- Show diagnostics screen in dev
- Log sanitized error event
- Prevent unsafe network requests

---

## Architecture Target (Offline-First by Design)

## 1) Layered architecture

### App/UI layer

- Navigation, screens, components, theming
- No direct network/storage calls

### Domain layer

- Use-cases:
  - `createTransaction`
  - `updateTransaction`
  - `deleteTransaction`
  - `createWorkflow`
  - `syncNow`
- Contains policy decisions (offline queueing, merge strategy)

### Data layer

- Repositories (single source of truth API for domain)
- Local data source (SQLite/MMKV/WatermelonDB strategy)
- Remote data source (HTTP API)
- Sync queue engine

## 2) Source of truth policy

- Local database is always render source
- Network updates local db; UI reacts from db only
- Writes apply to local immediately, then queue remote intent

## 3) Event model

Each mutating action emits queue events:

- `CREATE_TRANSACTION`
- `UPDATE_TRANSACTION`
- `DELETE_TRANSACTION`
- `CREATE_WORKFLOW`
- `DELETE_WORKFLOW`
- `UPDATE_PROFILE`

Queue events include:

- Event id (uuid)
- Entity id
- Payload
- Retry metadata
- Created timestamp
- Idempotency key

---

## Data Persistence Upgrade Plan

Current Expo approach relies mainly on AsyncStorage JSON blobs and pending arrays.

### Why upgrade

- JSON blob rewrite scales poorly with list size
- Higher corruption risk for concurrent writes
- Difficult conflict resolution/versioning

### Recommended local stack (priority order)

1. SQLite-backed storage (preferred)
- Strong consistency
- Query flexibility
- Easier pagination and partial sync

2. MMKV for tiny, hot-key values
- theme, last sync timestamp, feature flags, session hints

3. AsyncStorage only as compatibility fallback

### Suggested local schema

#### tables: `transactions`
- `id` TEXT PK
- `server_id` TEXT NULL
- `user_id` TEXT
- `type` TEXT
- `amount` REAL
- `description` TEXT
- `category` TEXT
- `payment_method` TEXT
- `split_amount` REAL NULL
- `date_iso` TEXT
- `created_at_iso` TEXT
- `updated_at_iso` TEXT
- `sync_state` TEXT (`pending|synced|failed|conflict`)
- `is_deleted` INTEGER (0/1)
- `version` INTEGER

#### tables: `workflows`
- Similar structure with workflow-specific fields

#### tables: `profile`
- user profile singleton per user id

#### tables: `sync_queue`
- `event_id` TEXT PK
- `event_type` TEXT
- `entity_type` TEXT
- `entity_local_id` TEXT
- `payload_json` TEXT
- `idempotency_key` TEXT
- `attempt_count` INTEGER
- `next_retry_at` INTEGER
- `last_error` TEXT NULL
- `status` TEXT (`queued|processing|done|deadletter`)
- `created_at` INTEGER

#### tables: `sync_metadata`
- `last_successful_sync_at`
- `last_full_pull_at`
- `last_network_state`

---

## Sync Engine 2.0 Design

## Principles

- Never lose user writes
- Always deterministic ordering
- Exponential backoff with jitter
- Idempotent server operations where possible

## Execution model

1. Connectivity observed (NetInfo + debounce)
2. Background worker starts if not running
3. Queue drained in FIFO by entity/version
4. On success:
- Mark event done
- Update local row with server ids/version
5. On retryable failure:
- Increase attempt count
- Schedule retry with backoff
6. On non-retryable failure:
- Mark deadletter
- Surface clear UX action

## Conflict resolution policy

For update collisions:

- Prefer server-version compare if backend supports `updatedAt/version`
- Default strategy:
  - Field-level merge for non-overlapping changes
  - Last-write-wins fallback for same field
- Mark `conflict` state and show non-blocking conflict center entry

## Network timeout/retry guidance

- Request timeout: 8-12s
- Retry budget: 5 attempts
- Backoff: `base * 2^attempt + jitter`

Suggested formula:

`delay_ms = min(30000, 1000 * 2^attempt + random(0, 250))`

## Pull strategy

- Initial pull after auth ready
- Periodic pull every 30-60s only when app active and online
- Opportunistic pull after queue drain
- Avoid aggressive 3s loops for battery and backend load

---

## Auth + Offline Boot Strategy

Current Expo has auth timeout fallback behavior; keep this philosophy.

## Target behavior

- App should never stay blocked waiting for auth/network indefinitely
- Startup sequence:

1. Render shell + splash-safe placeholders
2. Load local cache immediately
3. Attempt auth initialization with timeout window
4. If timeout:
- Enter degraded local mode UI
- Allow viewing cached data and queued actions where safe
5. Recover automatically when auth/network return

## Tokens and session

- Store auth tokens using secure native storage
- Keep token refresh isolated in auth service
- Data layer receives token via injected getter, never from UI

---

## Navigation and Screen Parity Plan

Recreate Expo route structure as stack + tabs in RN CLI.

### Tab shell parity

- Home
- Transactions
- Workflows
- Profile

### Modal flows parity

- Add Transaction
- Add Workflow
- Confirm delete dialogs

### Auth flows parity

- Sign in
- Sign up
- Auth guard redirects

### Screen-by-screen parity checklist

#### Home
- Greeting + user name
- Total balance card
- Payment method cards
- Quick actions from workflows
- Recent transactions preview
- Pull-to-refresh + online indicator

#### Transactions
- Paginated list
- Edit action (when synced)
- Delete confirmation
- Pending sync badges
- Empty state CTA

#### Workflows
- Create/list/delete
- Apply workflow to prefill add-transaction
- Empty state CTA

#### Profile
- Name/occupation/payment methods
- Theme toggle
- Offline sync state hints
- Sign out with local data reset strategy

---

## Visual Design Direction (Sexy, Modern, Intentional)

Keep familiar product identity while making RN CLI visuals more premium.

## Design language

- Strong typography hierarchy
- Card depth via subtle elevation + border contrast
- Purposeful color accents by financial meaning:
  - Income: green family
  - Expense: red/orange family
  - Neutral surfaces: soft graphite and off-white

## Motion system

- Staggered reveal on first list render
- Intentional transitions for add/edit modals
- Micro-animations for sync states (pulse/rotate, low amplitude)

## Component polish checklist

- Buttons: clear pressed states + haptics
- Inputs: floating/active states and error hints
- Cards: consistent corner radius scale
- Icons: one style family, strict sizing rhythm
- Shadows: platform-adaptive tokens (iOS shadow + Android elevation)

## Accessibility baseline

- Dynamic text support
- Touch targets >= 44dp
- Contrast checks for light/dark
- VoiceOver/TalkBack labels on key controls

---

## Performance Optimization Plan

## Startup

- Render from local cache first, network second
- Defer non-critical async work after first paint
- Lazy-load heavy screens/components

## Lists

- Use optimized list virtualization (FlashList recommended)
- Stable keys and memoized row renderers
- Batched state updates from sync engine

## State management

- Avoid giant context re-renders for every sync tick
- Slice state by domain and select minimally

## Storage I/O

- Use transactional writes for queue + entity updates
- Avoid full-table rewrites for single item changes

## Metrics to track

- Cold start time to usable UI
- Time-to-first-cached-render
- Queue drain latency
- Frame drops on tab switches and list scroll

---

## Suggested Project Structure in RN CLI

```
reactnative/
  src/
    app/
      navigation/
      providers/
      bootstrap/
    config/
      env.ts
      featureFlags.ts
    domain/
      transactions/
      workflows/
      profile/
      sync/
    data/
      db/
      repositories/
      remote/
      local/
      queue/
    ui/
      screens/
      components/
      theme/
      animations/
    services/
      auth/
      network/
      notifications/
      logging/
    utils/
      date/
      currency/
      ids/
  assets/
```

---

## Dependency Planning

Pick exact versions based on RN version compatibility matrix.

### Core

- Navigation stack/tabs packages
- Safe area + gesture handler + reanimated
- React Native screens

### Offline/data

- SQLite library for RN CLI
- MMKV for small key-value data
- NetInfo

### Auth

- Clerk RN package and secure storage dependencies

### UX

- Haptics alternative for RN CLI
- Icon set package
- Optional animation helper libraries

### Testing

- Jest + React Native Testing Library
- Mock adapters for storage/network/auth

---

## Migration Phases (Execution Roadmap)

## Phase 0: Foundations (1-2 days)

- Establish `src/` modular architecture
- Add env config + validation
- Add logging and error boundary baseline
- Add design tokens (colors/spacing/radius/typography)

Exit criteria:

- App launches with validated env
- Theming provider functional
- Navigation shell visible

## Phase 1: Data layer and offline engine (3-5 days)

- Implement local database schema
- Implement repository interfaces
- Build queue engine with retry/backoff
- Add sync worker + network observer

Exit criteria:

- Can create transaction offline and persist across restart
- Queue survives kill/restart
- Sync drains when network returns

## Phase 2: Feature parity screens (4-7 days)

- Home screen parity
- Transactions screen parity (including edit/delete)
- Workflows parity
- Profile parity

Exit criteria:

- Core flows match Expo behavior
- Pending/sync statuses clearly reflected in UI

## Phase 3: Polish and optimization (3-5 days)

- Motion and micro-interactions
- List and render optimization
- Accessibility and edge-case hardening
- Battery/network load tuning

Exit criteria:

- Smooth 60fps interactions on target devices
- No major offline data bugs in soak tests

## Phase 4: Release hardening (2-4 days)

- Crash/analytics instrumentation
- Regression suite
- QA checklist pass
- Staged rollout and rollback playbook

Exit criteria:

- Candidate build approved for production

---

## Detailed Feature Migration Matrix

## From Expo behavior to RN CLI implementation

### Transactions create flow

Current Expo:

- Creates local temp transaction first
- Queues pending entry
- Tries immediate sync when online

RN CLI target:

- Local DB insert in transaction table (`sync_state=pending`)
- Queue event insert in same DB transaction
- UI updates from selector immediately
- Background worker attempts remote create

### Transactions edit flow

Current Expo:

- Blocks editing pending temp rows
- Allows edit online for synced rows

RN CLI target:

- Keep block for unsynced rows initially
- Add optional advanced mode later for local edit queue

### Deletes

Current Expo:

- Pending deletes queue

RN CLI target:

- Soft-delete local row immediately (`is_deleted=1`)
- Queue delete event
- Hard prune after remote success and retention window

### Profile updates

RN CLI target:

- Local optimistic update for non-critical fields
- Queue update if offline (if backend semantics allow)

### Balance calculations

RN CLI target:

- Derive live balances from local transactions table + profile base
- Avoid race by single source query rather than multiple ad hoc states

---

## Customization Strategy (Future-Proof)

Build for easy product evolution.

## Theme tokens

Make all visual primitives configurable:

- Colors by semantic role
- Typography scale
- Radius scale
- Spacing scale
- Shadows/elevation levels

## Feature flags

Use local/remote flags for:

- Experimental sync strategy
- New list layouts
- Notification behavior

## Business rules registry

Externalize categories/payment methods defaults via config maps.

## Per-user preferences

Persist user-level preferences:

- Currency format
- Date format
- Start tab
- Compact vs comfortable list density

---

## Error Handling and Resilience

## Error classes

- `NetworkError`
- `AuthError`
- `ValidationError`
- `ConflictError`
- `StorageError`

## UX behavior

- Non-blocking toasts for transient failures
- Persistent banners for degraded states
- Retry CTA where user action is useful

## Logging

Structured logs with context fields:

- feature
- action
- entity_id
- queue_event_id
- network_state

Never log secrets/tokens.

---

## Notification Strategy in RN CLI

Expo notifications implementation should be translated to native-compatible RN CLI approach.

## Notification use-cases

- Unsynced data reminder
- Data stale reminder

## Rules

- Only schedule reminders when pending queue > 0
- Cancel reminders immediately after successful sync
- Avoid duplicate notification spam by dedupe keys

---

## Testing Strategy (Must-have)

## Unit tests

- Queue reducer/state transitions
- Retry/backoff calculations
- Conflict resolver logic
- Balance derivation utilities

## Integration tests

- Offline create -> app restart -> online sync success
- Failed sync -> retry -> eventual success
- Delete queue and replay correctness

## UI tests

- Core screen rendering from cached data
- Online/offline banner transitions
- Add/edit/delete actions under unstable network

## Device matrix

- Android low-end, mid, high
- iOS older + current

## Network simulation scenarios

- No network at launch
- Flaky network during queue drain
- API timeout bursts
- Auth token refresh failure

---

## Security and Privacy

- Tokens in secure storage only
- Minimize PII in local db where possible
- Encrypt highly sensitive local fields if required by policy
- Sanitized logs in production

---

## Rollout Plan

## Internal alpha

- Team-only builds
- Monitor crash-free sessions, sync error rate, queue deadletters

## Beta

- Controlled user group
- Compare parity against Expo baseline behavior

## Production

- Staged rollout by percentage
- Keep rollback version ready

## Success metrics

- Sync success rate > 99%
- Queue deadletter rate < 0.5%
- Startup to cached render under target threshold
- Significant reduction in offline-related support issues

---

## Risks and Mitigations

### Risk: queue duplication or double-write
Mitigation:

- idempotency keys
- unique constraints on local events

### Risk: conflict confusion in UX
Mitigation:

- clear conflict badge + resolve action
- minimal but explicit conflict copy

### Risk: performance regressions from over-notifying state
Mitigation:

- memoized selectors
- event batching
- list virtualization tuning

### Risk: env misconfiguration across flavors
Mitigation:

- startup validation + CI env checks

---

## Concrete Work Breakdown (Actionable Checklist)

## Setup and core infra

- [ ] Add env management package and flavor files
- [ ] Create typed env module with runtime validation
- [ ] Introduce app-level error boundary and logger
- [ ] Set up navigation container and route groups

## Data and sync

- [ ] Implement local DB schema migrations
- [ ] Implement repositories for profile/transactions/workflows
- [ ] Implement queue writer with atomic transactions
- [ ] Implement sync worker with backoff + deadletter
- [ ] Add network observer and app-state triggers

## UI parity

- [ ] Home screen parity components
- [ ] Transactions list + edit modal + delete confirmation
- [ ] Workflows list/create/delete
- [ ] Profile settings + payment method controls
- [ ] Sync status banner + pending indicators

## Quality and polish

- [ ] Animation pass for key transitions
- [ ] Accessibility labels and touch target audit
- [ ] Performance profiling and optimization pass
- [ ] Dark/light parity checks

## Testing and release

- [ ] Add queue and sync unit/integration tests
- [ ] Add offline scenario E2E scripts
- [ ] QA pass against parity matrix
- [ ] Release checklist and rollback guide

---

## Suggested Milestone Acceptance Criteria

### Milestone A: Offline reliability

- User can add transactions/workflows completely offline
- Data survives force close and device reboot
- Pending count is accurate and visible

### Milestone B: Sync robustness

- Queue drains automatically when online
- Retries back off correctly without UI freeze
- No duplicate server records from replay

### Milestone C: Experience parity + polish

- All major Expo flows available in RN CLI
- Visual quality is premium and coherent
- Interaction smoothness acceptable on mid-tier devices

---

## Notes on Existing Expo Patterns to Preserve

Preserve these successful patterns conceptually while improving internals:

- Cache-first startup
- Auth timeout fallback for offline/degraded mode
- Clear online/offline indicators
- Pending sync visibility in list items and banners
- Manual refresh capability

Refactor these for scalability/performance:

- Frequent polling loops
- Large AsyncStorage blob writes
- Broad context-driven rerenders

---

## Final Guidance

The strongest path is not a direct file-to-file copy from Expo to RN CLI.

The correct approach is:

1. Rebuild architecture first (data + sync + state boundaries)
2. Port features on top of stable offline foundation
3. Finish with visual and interaction polish

This ordering ensures the RN CLI app feels not just similar to Expo, but meaningfully better: faster startup, stronger offline trust, smoother UX, and cleaner long-term maintainability.
