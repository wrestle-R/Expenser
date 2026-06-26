/* eslint-env jest, node */

const path = require("path");

const {
  validateSigningConfig,
} = require("../scripts/validateAndroidSigning");

describe("validateAndroidSigning", () => {
  it("runs store-password, alias, and key-password checks", () => {
    const execFileSync = jest.fn();

    validateSigningConfig({
      keystorePath: path.join(__dirname, "..", "android", "app", "debug.keystore"),
      storePassword: "android",
      keyAlias: "androiddebugkey",
      keyPassword: "android",
      execFileSync,
    });

    expect(execFileSync).toHaveBeenCalledTimes(2);
    expect(execFileSync.mock.calls[0][0]).toBe("keytool");
    expect(execFileSync.mock.calls[0][1]).toEqual(
      expect.arrayContaining([
        "-list",
        "-keystore",
        path.join(__dirname, "..", "android", "app", "debug.keystore"),
        "-storepass",
        "android",
        "-alias",
        "androiddebugkey",
      ])
    );
    expect(execFileSync.mock.calls[1][0]).toBe("keytool");
    expect(execFileSync.mock.calls[1][1]).toEqual(
      expect.arrayContaining([
        "-importkeystore",
        "-srckeystore",
        path.join(__dirname, "..", "android", "app", "debug.keystore"),
        "-srcstorepass",
        "android",
        "-srcalias",
        "androiddebugkey",
        "-srckeypass",
        "android",
      ])
    );
  });

  it("rethrows a precise error when the private key password is wrong", () => {
    const keystorePath = path.join(
      __dirname,
      "..",
      "android",
      "app",
      "debug.keystore"
    );
    const execFileSync = jest
      .fn()
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {
        throw new Error("java.security.UnrecoverableKeyException");
      });

    expect(() =>
      validateSigningConfig({
        keystorePath,
        storePassword: "store-pass",
        keyAlias: "release",
        keyPassword: "wrong-pass",
        execFileSync,
      })
    ).toThrow(/ANDROID_KEY_PASSWORD/i);
  });
});
