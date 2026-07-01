import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PROFILE_SETUP_HASH,
  getProfileSetupHref,
} from "./profile-navigation.js";

test("profile setup href targets the setup section anchor", () => {
  assert.equal(PROFILE_SETUP_HASH, "setup");
  assert.equal(getProfileSetupHref(), "/dashboard/profile#setup");
});
