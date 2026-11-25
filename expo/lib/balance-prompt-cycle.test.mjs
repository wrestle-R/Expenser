import assert from "node:assert/strict";
import test from "node:test";
import { createBalancePromptCycle } from "./balance-prompt-cycle.js";

test("overlapping refreshes and later imports prompt once during a foreground visit", async () => {
  const cycle = createBalancePromptCycle();
  const shown = [];
  const present = (alert) => {
    shown.push(alert);
    return true;
  };
  let complete;
  const inFlight = cycle.check(() => new Promise((resolve) => { complete = resolve; }), present);
  await cycle.check(async () => "later", present);
  complete("latest-so-far");
  await inFlight;
  await cycle.check(async () => "later", present);
  assert.deepEqual(shown, ["latest-so-far"]);

  cycle.reset();
  await cycle.check(async () => "later", present);
  assert.deepEqual(shown, ["latest-so-far", "later"]);
});

test("a late result from the previous account or foreground visit cannot open a prompt", async () => {
  const cycle = createBalancePromptCycle();
  let complete;
  const stale = cycle.check(() => new Promise((resolve) => { complete = resolve; }), () => {
    assert.fail("the previous visit opened a balance prompt");
  });
  cycle.reset();
  complete("previous");
  await stale;
  const current = [];
  await cycle.check(async () => "current", (alert) => {
    current.push(alert);
    return true;
  });
  assert.deepEqual(current, ["current"]);
});
