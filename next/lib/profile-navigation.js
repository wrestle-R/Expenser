const PROFILE_SETUP_HASH = "setup";

function getProfileSetupHref() {
  return `/dashboard/profile#${PROFILE_SETUP_HASH}`;
}

exports.PROFILE_SETUP_HASH = PROFILE_SETUP_HASH;
exports.getProfileSetupHref = getProfileSetupHref;
