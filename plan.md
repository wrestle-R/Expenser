# Expenser Expo And Web Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the unwanted bank-import/setup copy, make pending-review transactions open directly into the correct edit flow, fix Expo transaction category editing, clean up the Expo profile screen, make the Next transactions page responsive on mobile, and add a responsive current-month pie chart to the Expo analysis screen.

**Architecture:** Keep the work split by surface: shared transaction-review behavior where possible, Expo screen-level UX changes in `expo/app/(tabs)/*`, and targeted `next/` dashboard/mobile layout fixes. Reuse the existing API and transaction models instead of inventing a parallel data shape, add the smallest routing/state hooks needed to deep-link from Profile into the Transactions edit modal, and solve the Next transactions responsiveness with viewport-specific layout changes rather than a desktop redesign.

**Tech Stack:** Expo Router, React Native, Next.js App Router, Supabase-backed REST routes, existing `UserContext` state, existing transaction review helpers, and current theme/color tokens.

---

## Scope And Assumptions

- [ ] Treat `bank import` as unwanted user-facing label text on transaction surfaces; preserve the import metadata itself.
- [ ] Treat “click on a transaction with pending review” as applying to Expo transaction list rows, not only the pencil icon.
- [ ] Treat “pending review whenever I click on it it should open for the transactions on the Expo profile page” as a Profile-to-Transactions deep-link requirement that should land on the Transactions tab and open the relevant edit/review state automatically.
- [ ] Treat “no need to show setup on the mobile view of the website” as a `next/` dashboard requirement for small screens only; desktop setup remains available unless the user narrows scope further.
- [ ] Keep existing offline restrictions unless the user explicitly asks to change them; local unsynced temp transactions should still not be editable.

## File Map

- [ ] `expo/app/(tabs)/transactions.tsx`
  Owns the Expo transactions list, row interactions, and the current edit modal that needs category support plus separate pending-review behavior.
- [ ] `expo/app/(tabs)/profile.tsx`
  Owns the duplicate Profile headers, autosave status copy, bank-import/review summary, and the entry point that should deep-link into Transactions review.
- [ ] `expo/app/(tabs)/analysis.tsx`
  Owns the Expo analysis dashboard and needs a responsive current-month pie chart.
- [ ] `expo/context/UserContext.tsx`
  Owns transaction mutations and is the safest place to expose any extra helpers needed by the Expo edit/review flow.
- [ ] `expo/lib/api.ts`
  Already exposes `getCategories()` and can stay the single Expo-side category fetch entry point.
- [ ] `expo/lib/types.ts`
  Holds `IUserCategory` and any extra route/query state types that may be useful for the Expo flow.
- [ ] `expo/lib/transaction-review.ts`
  Shared Expo helper for pending-review display rules; likely the right place for “hide bank import label” display cleanup if the label appears in more than one screen.
- [ ] `expo/app/add-transaction.tsx`
  Reference implementation for the existing Expo transaction form; useful when aligning normal-edit and pending-review edit states.
- [ ] `next/app/dashboard/profile/page.tsx`
  Likely mobile-web setup choke point because the setup panel is rendered inline on the dashboard profile page.
- [ ] `next/components/profile-setup-panel.tsx`
  Owns the visible setup heading/cards and may need responsive hiding or a mobile gate.
- [ ] `next/app/dashboard/transactions/page.tsx`
  Current web transaction list still renders `display.category`, including `Bank import`; it is also the main Next mobile-responsiveness target for the cramped header and transaction-row layout shown in the screenshot.
- [ ] `next/lib/transaction-review.js`
  Shared web helper for transaction display fields; use this if the label removal should happen centrally instead of only in one page.
- [ ] `next/components/ui/dialog.tsx`
  Check this only if the Next transactions add/edit modal also needs mobile width or height containment while fixing the page responsiveness.

## Task 1: Remove User-Facing `Bank import` Transaction Label

**Files:**
- Modify: `expo/lib/transaction-review.ts`
- Modify: `next/lib/transaction-review.js`
- Modify: `next/app/dashboard/transactions/page.tsx`
- Verify whether any direct Expo transaction category label rendering also needs cleanup in `expo/app/(tabs)/transactions.tsx` and `expo/app/(tabs)/index.tsx`

- [ ] Decide whether the cleanup should be helper-level or screen-level.
  Preferred approach: remove or suppress the fallback label in the shared transaction-review helpers so pending imported transactions keep their description/review badge but do not show `Bank import` as a visible category.

- [ ] Update the Expo transaction display helper so pending imported items no longer surface `Bank import` as a user-facing category label.
  Keep the existing `Pending details` description fallback and do not alter `reviewStatus`.

- [ ] Update the web transaction display helper or the transactions page badge rendering so imported pending items do not render a `Bank import` category badge.
  Preserve other real categories and preserve the `Pending review` badge.

- [ ] Run a repo search for remaining user-facing `Bank import` transaction labels.
  Limit the cleanup to visible UX strings, not parser defaults or backend metadata.

- [ ] Verify the behavior manually on both surfaces.
  Expected result: imported/pending transactions still exist and still carry pending-review state, but the specific label `Bank import` is no longer shown in transaction rows/cards.

## Task 2: Make Expo Pending-Review Transactions Open Straight Into Review/Edit

**Files:**
- Modify: `expo/app/(tabs)/transactions.tsx`
- Modify: `expo/app/(tabs)/profile.tsx`
- Possibly modify: `expo/lib/types.ts`

- [ ] Convert Expo transaction rows from passive display rows into pressable rows.
  Pressing a non-local row should open the edit modal; pressing a pending-review row should open the review-focused version of that modal immediately.

- [ ] Keep the existing offline/temp guard in place.
  If a transaction is local or still uses a temp id, the row should not promise editable review behavior that the backend cannot support yet.

- [ ] Add a route/state contract for opening the Transactions tab in “review this transaction now” mode.
  Recommended shape: push to `/transactions` with a query param such as `editId=<transactionId>` or `reviewId=<transactionId>` and let the screen auto-open the modal once the list is hydrated.

- [ ] Add a Profile-side CTA for pending review.
  The current Expo profile screen already shows bank review counts in the Bank SMS Import card. Make that review area actionable so tapping it routes to the Transactions screen and opens the relevant review/edit flow instead of leaving the user on Profile.

- [ ] Make the auto-open robust against initial loading.
  The Transactions screen should wait until the transaction list is loaded, locate the target transaction, and then open the modal once. It should also clear the one-shot route param/state afterward so the modal does not reopen on every revisit.

- [ ] Verify the exact requested behavior.
  Expected result: tapping a pending-review transaction row opens directly into editing/review, and tapping the pending-review entry point on Expo Profile lands in Transactions with the correct transaction open.

## Task 3: Add Category Support To The Expo Edit Modal And Split Normal Edit Vs Pending Review UX

**Files:**
- Modify: `expo/app/(tabs)/transactions.tsx`
- Modify: `expo/lib/api.ts` or consume the existing `getCategories()` from this file
- Possibly modify: `expo/context/UserContext.tsx`
- Reference: `expo/app/add-transaction.tsx`

- [ ] Fetch category options for Expo transaction editing.
  Use the existing `/api/categories` client in `expo/lib/api.ts` instead of hardcoding another category source.

- [ ] Define the category source of truth for both transaction types.
  Include built-in fallback categories already used by the app, then merge in user-created categories from `/api/categories` so the modal can edit real saved values instead of forcing `income` or `expense`.

- [ ] Add category state to the Expo edit modal.
  The modal currently only tracks type, amount, description, payment method, and split amount. Add explicit `editCategory` state and initialize it from the transaction being edited.

- [ ] Stop overwriting the category on save.
  The current save path sends `category: editType === "income" ? "income" : "expense"`. Replace that with the selected category value so edits preserve or correct the real category.

- [ ] Split the modal UX into two modes.
  Normal edit mode:
  Show the full edit form with the current transaction fields and category selector.
  Pending-review mode:
  Present review-oriented copy and field emphasis so the user understands they are completing missing imported details rather than just doing a normal edit.

- [ ] Decide which controls differ between the two modes.
  Recommended minimum:
  Normal edit keeps the current title and neutral save CTA.
  Pending-review mode uses a review-specific title, keeps category/description prominent, and can hide optional controls that do not help complete the import review.

- [ ] Preserve existing validation.
  Keep split-amount validation, keep offline edit restrictions, and keep save error toasts.

- [ ] Verify end-to-end.
  Expected result: Expo edit modal always exposes category, saved edits persist the chosen category, and pending-review transactions clearly open in a different review-oriented state from normal transactions.

## Task 4: Clean Up The Expo Profile Screen Copy And Review Entry Points

**Files:**
- Modify: `expo/app/(tabs)/profile.tsx`

- [ ] Remove the duplicate Profile heading block.
  Keep the top app header that already says `Profile`.
  Remove the second large `Profile` heading and the subtitle `Manage your personal information, imports, and tabs`.

- [ ] Remove the idle autosave helper copy.
  Delete the `Changes save automatically` message while keeping useful transient statuses like `Saving changes...`, `Saved`, or `Autosave failed` if they are still needed.

- [ ] Re-check spacing after the header removal.
  The user card should become the first major section under the top bar without leaving an awkward empty gap.

- [ ] Turn the review count area into a clear action.
  The Bank SMS Import section already shows `Bank events needing review`. Make that value or its surrounding row/button act as the navigation trigger into Transactions review flow from Task 2.

- [ ] Keep setup-related profile content separate from this copy cleanup.
  This task should not redesign the whole screen; it should only remove the requested duplicate text and connect the pending-review action cleanly.

## Task 5: Hide Setup On Mobile Web Dashboard Profile

**Files:**
- Modify: `next/app/dashboard/profile/page.tsx`
- Possibly modify: `next/components/profile-setup-panel.tsx`

- [ ] Identify the exact mobile setup surface that is currently visible.
  In the current code, setup lives inside the lower `ProfileSetupPanel` on `/dashboard/profile`. Confirm whether this is the only mobile-web setup UI the user is referring to before implementation starts.

- [ ] Gate setup rendering for mobile widths.
  Recommended approach: hide the setup panel section on small screens using existing responsive classes, while keeping the desktop profile/setup anchor flow intact.

- [ ] Preserve desktop behavior and anchor safety.
  If `/dashboard/profile#setup` is opened on mobile after the section is hidden, fail gracefully instead of leaving the page broken. The page should still render normally even if the hidden section is not visible.

- [ ] Check for leftover setup-only text on mobile.
  If the page still renders a setup heading, separator, or blank container after hiding the panel, remove the leftover wrapper on small screens too.

- [ ] Verify responsive behavior.
  Expected result: mobile web dashboard does not show the setup section, while tablet/desktop retains the existing setup panel unless the user later asks to remove it everywhere.

## Task 6: Add A Responsive Current-Month Pie Chart To Expo Analysis

**Files:**
- Modify: `expo/app/(tabs)/analysis.tsx`
- Possibly modify: `expo/package.json` if an explicit chart dependency is required

- [ ] Confirm the chart data contract.
  The chart should use only the current month’s active transactions, not the full transaction history currently used by the screen summary.

- [ ] Decide the chart grouping.
  Recommended grouping: expense totals by category for the current calendar month, because a pie chart communicates category distribution better than income-vs-expense totals that already exist in the summary cards.

- [ ] Add current-month filtering before chart aggregation.
  Exclude deleted transactions, keep the current split-expense net calculation rules, and make sure only the current month contributes to the pie slices.

- [ ] Choose the rendering path.
  Preferred path: use a lightweight React Native pie chart based on `react-native-svg` if needed.
  Fallback path: build a simple ring/pie visualization manually only if dependency cost is lower than bringing in a chart helper.

- [ ] Build a responsive chart card.
  Requirements:
  Look good on narrow phones.
  Avoid label collisions.
  Use the existing light/dark color tokens.
  Provide a no-data empty state for months without expense categories.

- [ ] Keep existing analysis summaries aligned with the new time window where appropriate.
  If the page copy or subtitle currently implies all-time counts, update the chart section label clearly so the user understands the pie chart is current-month only even if the top cards remain broader.

- [ ] Verify on multiple viewport sizes.
  Expected result: the Expo analysis screen shows a polished current-month pie chart that remains readable and balanced on smaller devices.

## Task 7: Fix Next Transactions Page Responsiveness On Mobile

**Files:**
- Modify: `next/app/dashboard/transactions/page.tsx`
- Possibly modify: `next/components/ui/dialog.tsx` if the add/edit modal still overflows on small screens after page-level fixes

- [ ] Reproduce the exact mobile layout issues from the screenshot.
  Focus on:
  header copy and action buttons competing for horizontal space,
  transaction metadata badges/date/amount collapsing awkwardly,
  edit and delete icons staying too close to the amount block,
  and any horizontal squeeze or overflow inside the card rows.

- [ ] Rework the page header for narrow screens without redesigning desktop.
  Recommended approach:
  let the title/description stack cleanly,
  let `Refresh` and `Add Transaction` wrap or stack with full-width buttons on mobile,
  and preserve the current desktop toolbar layout from `sm` upward.

- [ ] Rework each transaction row into a small-screen-first layout.
  Recommended approach:
  keep the icon and description block on the first line,
  move badges/date into a wrapping metadata row,
  and place amount plus action buttons in a separate row on mobile so they are no longer fighting for the same width.

- [ ] Prevent badge/date/amount collisions.
  The current combination of payment-method badge, category badge, date, amount, and action icons should never force unreadable squeezing on narrow screens. Prefer vertical separation on mobile over aggressive shrinking.

- [ ] Keep desktop density intact.
  Do not turn the desktop transactions list into a tall mobile card layout everywhere; scope the structural changes to small screens and preserve the current desktop scanability.

- [ ] Check add/edit/delete dialog behavior while on mobile.
  If the transactions dialogs still overflow or feel unusable on small screens, add the minimum responsive modal-width or modal-height fixes needed as part of this task.

- [ ] Verify against the supplied screenshot symptoms.
  Expected result: on mobile, the transactions page header reads cleanly, action buttons fit comfortably, transaction rows do not feel cramped, and amount/date/actions remain readable without overlap or awkward compression.

## Task 8: Validation Pass

**Files:**
- Verify changes across `expo/` and `next/`

- [ ] Run targeted static checks for the web app.
  Run from `next/`: `npm run lint`

- [ ] Run targeted static checks for the Expo app.
  Run from `expo/`: `npm run lint`

- [ ] If TypeScript is available in the current workflow, run type checks where practical.
  Run from `expo/`: `npx tsc --noEmit`
  Run from `next/`: `npx tsc --noEmit`

- [ ] Manually verify the requested UX flows.
  Web mobile:
  `/dashboard/profile` should not show setup on small screens.
  Web transactions:
  imported pending rows should not show `Bank import`.
  header and transaction rows should be readable and properly spaced on small screens.
  Expo transactions:
  tapping a pending-review row should open the review/edit modal.
  Expo profile:
  duplicate Profile text and idle autosave copy should be gone.
  Expo analysis:
  current-month pie chart should render cleanly and handle empty states.

- [ ] Run a final repo search for leftover request-specific strings.
  Search for:
  `Changes save automatically`
  `Manage your personal information, imports, and tabs`
  unexpected user-facing `Bank import`

## Acceptance Checklist

- [ ] `Bank import` is no longer shown as a user-facing label on transactions.
- [ ] Pending-review transactions in Expo open directly into the correct edit/review modal.
- [ ] Expo Profile can send the user into the Transactions review flow.
- [ ] Expo edit transaction modal includes category editing and preserves the chosen category on save.
- [ ] Pending-review edit UX is visibly different from normal edit UX.
- [ ] Expo Profile only shows the single desired header and no idle autosave helper text.
- [ ] Mobile web dashboard no longer shows setup.
- [ ] Next transactions page is responsive on mobile and no longer looks cramped like the supplied screenshot.
- [ ] Expo Analysis includes a responsive current-month pie chart.
- [ ] Lint/type checks pass, or any remaining failures are documented before merge.
