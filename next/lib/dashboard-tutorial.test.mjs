import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DASHBOARD_TUTORIAL_DB_FIELD,
  DASHBOARD_TUTORIAL_STEPS,
  getDashboardTutorialStep,
} from "./dashboard-tutorial.js";
import { getProfileSetupHref } from "./profile-navigation.js";

test("dashboard tutorial covers the full product tour in order", () => {
  assert.equal(DASHBOARD_TUTORIAL_DB_FIELD, "dashboard_tutorial_completed");

  assert.deepEqual(
    DASHBOARD_TUTORIAL_STEPS.map((step) => step.id),
    [
      "dashboard",
      "stealth",
      "transactions",
      "workflows",
      "calendar",
      "analysis",
      "profile-accounts",
      "setup-shortcuts",
      "setup-categories",
      "theme",
    ]
  );
});

test("dashboard tutorial includes concrete examples and natural copy", () => {
  const combinedCopy = DASHBOARD_TUTORIAL_STEPS.flatMap((step) => [
    step.title,
    step.body,
    step.helper ?? "",
  ]).join(" ");

  for (const phrase of [
    "monthly rent",
    "bank",
    "cash",
    "Splitwise",
    "press enter",
    "dark",
    "light",
  ]) {
    assert.match(combinedCopy, new RegExp(phrase, "i"));
  }

  assert.doesNotMatch(combinedCopy, /sms imports|pending review/i);
  assert.doesNotMatch(combinedCopy, /\b(leverage|utilize|seamlessly|robust|comprehensive)\b/i);
});

test("dashboard tutorial step metadata supports anchored callouts", () => {
  assert.equal(DASHBOARD_TUTORIAL_STEPS.length, 10);

  const firstStep = DASHBOARD_TUTORIAL_STEPS[0];
  assert.equal(firstStep.layout, "hero");
  assert.equal(firstStep.targetId, "dashboard-welcome");
  assert.equal(firstStep.placement, "bottom-end");

  for (const step of DASHBOARD_TUTORIAL_STEPS) {
    assert.equal(typeof step.route, "string");
    assert.equal(typeof step.targetId, "string");
    assert.equal(typeof step.placement, "string");
    assert.equal(typeof step.title, "string");
    assert.equal(typeof step.body, "string");
    assert.ok(step.body.length <= 140);
  }

  const setupSteps = DASHBOARD_TUTORIAL_STEPS.filter((step) => step.id.startsWith("setup-"));
  assert.equal(setupSteps.length, 2);
  assert.ok(setupSteps.every((step) => step.route === getProfileSetupHref()));
});

test("returns tutorial steps by index with safe bounds", () => {
  assert.equal(getDashboardTutorialStep(0)?.id, "dashboard");
  assert.equal(getDashboardTutorialStep(9)?.id, "theme");
  assert.equal(getDashboardTutorialStep(-1), null);
  assert.equal(getDashboardTutorialStep(10), null);
});
