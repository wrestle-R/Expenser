/* eslint-env node */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

function requireValue(value, name) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new Error(`${name} is missing or empty`);
  }
  return normalized;
}

function validateSigningConfig({
  keystorePath,
  storePassword,
  keyAlias,
  keyPassword,
  execFileSync: execFileSyncImpl = execFileSync,
}) {
  const resolvedKeystorePath = path.resolve(
    requireValue(keystorePath, "ANDROID_KEYSTORE_FILE")
  );

  if (!fs.existsSync(resolvedKeystorePath)) {
    throw new Error(`Keystore file not found: ${resolvedKeystorePath}`);
  }

  const normalizedStorePassword = requireValue(
    storePassword,
    "ANDROID_KEYSTORE_PASSWORD"
  );
  const normalizedKeyAlias = requireValue(keyAlias, "ANDROID_KEY_ALIAS");
  const normalizedKeyPassword = requireValue(
    keyPassword,
    "ANDROID_KEY_PASSWORD"
  );

  execFileSyncImpl(
    "keytool",
    [
      "-list",
      "-keystore",
      resolvedKeystorePath,
      "-storepass",
      normalizedStorePassword,
      "-alias",
      normalizedKeyAlias,
    ],
    { stdio: "pipe" }
  );

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "expenser-signing-"));
  const tempJarPath = path.join(tempDir, "validation-input.jar");
  const signedJarPath = path.join(tempDir, "validation-signed.jar");
  const tempPayloadPath = path.join(tempDir, "payload.txt");

  try {
    fs.writeFileSync(tempPayloadPath, "Expenser signing validation\n");

    execFileSyncImpl(
      "jar",
      ["--create", "--file", tempJarPath, "-C", tempDir, "payload.txt"],
      { stdio: "pipe" }
    );

    execFileSyncImpl(
      "jarsigner",
      [
        "-keystore",
        resolvedKeystorePath,
        "-storepass",
        normalizedStorePassword,
        "-keypass",
        normalizedKeyPassword,
        "-signedjar",
        signedJarPath,
        tempJarPath,
        normalizedKeyAlias,
      ],
      { stdio: "pipe" }
    );
  } catch (error) {
    throw new Error(
      `ANDROID_KEY_PASSWORD could not decrypt alias "${normalizedKeyAlias}" in ${path.basename(
        resolvedKeystorePath
      )}`
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  const keystorePath =
    process.argv[2] ||
    path.join(__dirname, "..", "android", "app", process.env.ANDROID_KEYSTORE_FILE || "release.keystore");

  try {
    validateSigningConfig({
      keystorePath,
      storePassword: process.env.ANDROID_KEYSTORE_PASSWORD,
      keyAlias: process.env.ANDROID_KEY_ALIAS,
      keyPassword: process.env.ANDROID_KEY_PASSWORD,
    });
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  validateSigningConfig,
};
