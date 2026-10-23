const { withAppBuildGradle } = require('expo/config-plugins');
const snippet = `
// Track shared financial code outside the Lite project for incremental release bundles.
tasks.configureEach { task ->
    if (task.name == "createBundleReleaseJsAndAssets") {
        task.inputs.files(fileTree(new File(rootProject.projectDir, "../../expo")) {
            include "lib/**", "context/**", "constants/**", "components/SyncStatusBanner.tsx", "env.ts"
        }).withPathSensitivity(org.gradle.api.tasks.PathSensitivity.RELATIVE)
    }
}
`;
module.exports = (config) => withAppBuildGradle(config, (result) => {
  if (!result.modResults.contents.includes('// Track shared financial code')) result.modResults.contents += snippet;
  return result;
});
module.exports.gradleSnippet = snippet;
