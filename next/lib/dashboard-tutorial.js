const DASHBOARD_TUTORIAL_DB_FIELD = "dashboard_tutorial_completed";
const DASHBOARD_TUTORIAL_REPLAY_EVENT = "expenser:replay-dashboard-tutorial";
const PROFILE_SETUP_ROUTE = "/dashboard/profile#setup";

const DASHBOARD_TUTORIAL_STEPS = [
  {
    id: "dashboard",
    route: "/dashboard",
    targetId: "dashboard-welcome",
    placement: "bottom-end",
    layout: "hero",
    eyebrow: "Tutorial | Step 1 of 10",
    title: "Dashboard is your money snapshot",
    body: "Balance, accounts, and recent activity stay in one quick view.",
    helper: "Press Enter for next.",
  },
  {
    id: "stealth",
    route: "/dashboard",
    targetId: "tutorial-stealth-toggle",
    placement: "bottom-end",
    layout: "callout",
    eyebrow: "Privacy switch",
    title: "Stealth mode hides amounts",
    body: "Tap the eye when you want privacy nearby.",
    helper: "Shortcut: press x when you are not typing.",
  },
  {
    id: "transactions",
    route: "/dashboard/transactions",
    targetId: "tutorial-nav-transactions",
    placement: "right-start",
    layout: "callout",
    eyebrow: "Daily entries",
    title: "Transactions hold every entry",
    body: "Spend, income, exchange, gift, and cash entries all land here.",
    helper: "Imported entries show up here first.",
  },
  {
    id: "workflows",
    route: "/dashboard/workflows",
    targetId: "tutorial-nav-workflows",
    placement: "right-start",
    layout: "callout",
    eyebrow: "Repeat stuff faster",
    title: "Workflows save repeat entries",
    body: "Save templates for monthly rent, salary, and subscriptions.",
    helper: "Use this for repeat payments.",
  },
  {
    id: "calendar",
    route: "/dashboard/calendar",
    targetId: "tutorial-nav-calendar",
    placement: "right-start",
    layout: "callout",
    eyebrow: "Date view",
    title: "Calendar shows when money moved",
    body: "Spot timing fast, like salary days or weekend spending.",
    helper: "Open a day for the exact entries.",
  },
  {
    id: "analysis",
    route: "/dashboard/analysis",
    targetId: "tutorial-nav-analysis",
    placement: "right-start",
    layout: "callout",
    eyebrow: "Understand the mess",
    title: "Analysis explains your spending",
    body: "Filter by month, category, method, or search.",
    helper: "Totals stay cleaner around shared exchanges.",
  },
  {
    id: "profile-accounts",
    route: "/dashboard/profile",
    targetId: "tutorial-profile-accounts",
    placement: "left-start",
    layout: "callout",
    eyebrow: "Your money buckets",
    title: "Profile controls your accounts",
    body: "Bank, Cash, and Splitwise live here.",
    helper: "Fewer active methods keep the dashboard cleaner.",
  },
  {
    id: "setup-shortcuts",
    route: PROFILE_SETUP_ROUTE,
    targetId: "tutorial-profile-shortcuts",
    placement: "top-start",
    layout: "callout",
    eyebrow: "Setup",
    title: "Keybindings speed things up",
    body: "Keys 1 to 5 move around. s, x, and d handle setup, stealth, and theme.",
    helper: "Shortcuts pause while you are typing.",
  },
  {
    id: "setup-categories",
    route: PROFILE_SETUP_ROUTE,
    targetId: "tutorial-profile-categories",
    placement: "top-start",
    layout: "callout",
    eyebrow: "Categories",
    title: "Categories keep reports clean",
    body: "Clear labels make charts and filters easier to trust.",
    helper: "Clear labels make imports easier to sort later.",
  },
  {
    id: "theme",
    route: "/dashboard/profile",
    targetId: "tutorial-theme-toggle",
    placement: "right-start",
    layout: "callout",
    eyebrow: "Comfort",
    title: "Dark and light are just taste",
    body: "Use the theme button or press d to switch.",
    helper: "Theme changes the feel, not the data.",
  },
];

function getDashboardTutorialStep(index) {
  return DASHBOARD_TUTORIAL_STEPS[index] ?? null;
}

exports.DASHBOARD_TUTORIAL_DB_FIELD = DASHBOARD_TUTORIAL_DB_FIELD;
exports.DASHBOARD_TUTORIAL_REPLAY_EVENT = DASHBOARD_TUTORIAL_REPLAY_EVENT;
exports.DASHBOARD_TUTORIAL_STEPS = DASHBOARD_TUTORIAL_STEPS;
exports.getDashboardTutorialStep = getDashboardTutorialStep;
