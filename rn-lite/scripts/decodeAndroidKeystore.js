/* eslint-env node */

const fs = require('fs');
const path = require('path');

const BASE64_PADDING = new RegExp('=+$');

function normalizeBase64Secret(secret) {
  const value = String(secret || '').replace(/\s+/g, '');

  if (!value) {
    throw new Error('ANDROID_KEYSTORE_BASE64 is empty or missing');
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw new Error('ANDROID_KEYSTORE_BASE64 must be valid base64');
  }

  return value;
}

function looksLikeText(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 128));
  if (sample.includes(0)) {
    return false;
  }

  let printable = 0;
  for (const byte of sample) {
    if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126)) {
      printable += 1;
    }
  }

  return sample.length > 0 && printable / sample.length > 0.9;
}

function looksLikeKeystoreContainer(buffer) {
  const isJks =
    buffer.length >= 4 &&
    buffer[0] === 0xfe &&
    buffer[1] === 0xed &&
    buffer[2] === 0xfe &&
    buffer[3] === 0xed;
  const isPkcs12DerSequence = buffer.length >= 2 && buffer[0] === 0x30;

  return isJks || isPkcs12DerSequence;
}

function decodeKeystoreSecret(secret) {
  const normalized = normalizeBase64Secret(secret);
  const decoded = Buffer.from(normalized, 'base64');
  const encodedAgain = decoded.toString('base64');

  if (
    encodedAgain.replace(BASE64_PADDING, '') !==
    normalized.replace(BASE64_PADDING, '')
  ) {
    throw new Error('ANDROID_KEYSTORE_BASE64 must be valid base64');
  }

  if (looksLikeText(decoded)) {
    throw new Error(
      'ANDROID_KEYSTORE_BASE64 decoded to text, not binary keystore data',
    );
  }

  if (!looksLikeKeystoreContainer(decoded)) {
    throw new Error(
      'ANDROID_KEYSTORE_BASE64 decoded data does not look like a JKS or PKCS12 keystore',
    );
  }

  return decoded;
}

function writeKeystoreFromEnv(env, outputPath) {
  const decoded = decodeKeystoreSecret(env.ANDROID_KEYSTORE_BASE64);
  fs.mkdirSync(path.dirname(outputPath), {recursive: true});
  fs.writeFileSync(outputPath, decoded);
}

if (require.main === module) {
  const outputPath = process.argv[2];

  if (!outputPath) {
    console.error('Usage: node scripts/decodeAndroidKeystore.js <output-path>');
    process.exit(1);
  }

  try {
    writeKeystoreFromEnv(process.env, outputPath);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  decodeKeystoreSecret,
  writeKeystoreFromEnv,
};
