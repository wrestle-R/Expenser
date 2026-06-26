/* eslint-env jest, node */

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  decodeKeystoreSecret,
  writeKeystoreFromEnv,
} = require('../scripts/decodeAndroidKeystore');

describe('decodeAndroidKeystore', () => {
  it('decodes a wrapped base64 keystore secret', () => {
    const bytes = Buffer.from([0xfe, 0xed, 0xfe, 0xed, 0x00, 0x00, 0x00, 0x02]);
    const wrapped = `${bytes.toString('base64').slice(0, 4)}\n${bytes
      .toString('base64')
      .slice(4)}`;

    expect(decodeKeystoreSecret(wrapped)).toEqual(bytes);
  });

  it('rejects a secret that is not base64', () => {
    expect(() => decodeKeystoreSecret('not a keystore!')).toThrow(
      /valid base64/
    );
  });

  it('rejects decoded PEM text instead of binary keystore bytes', () => {
    const pem = Buffer.from('-----BEGIN PRIVATE KEY-----\nabc\n');

    expect(() => decodeKeystoreSecret(pem.toString('base64'))).toThrow(
      /not binary keystore data/
    );
  });

  it('writes decoded bytes to the requested output path', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'keystore-'));
    const outputPath = path.join(dir, 'release.keystore');
    const bytes = Buffer.from([0xfe, 0xed, 0xfe, 0xed]);

    writeKeystoreFromEnv(
      {
        ANDROID_KEYSTORE_BASE64: bytes.toString('base64'),
      },
      outputPath
    );

    expect(fs.readFileSync(outputPath)).toEqual(bytes);
  });
});
