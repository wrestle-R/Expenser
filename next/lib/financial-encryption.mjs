import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

const FORMAT_VERSION = 1;
const ALGORITHM = "aes-256-gcm";
const KEY_ID = /^[a-zA-Z0-9_-]{1,64}$/;
const CONTEXT_PREFIX = "expenser-financial";

function decodeBase64Url(value, expectedBytes) {
  if (typeof value !== "string") throw new Error("Invalid encryption encoding");
  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value ||
      (expectedBytes !== undefined && decoded.length !== expectedBytes)) {
    throw new Error("Invalid encryption encoding");
  }
  return decoded;
}

function authenticatedContext(record, keyId) {
  const { kind, ownerId, recordId } = record;
  if (![kind, ownerId, recordId].every((part) => typeof part === "string" && part.length > 0)) {
    throw new Error("Financial record identity is required");
  }
  return Buffer.from(JSON.stringify([CONTEXT_PREFIX, FORMAT_VERSION, keyId, kind, ownerId, recordId]));
}

export function createFinancialCipher({ activeKeyId, keys, lookupKey }) {
  if (!KEY_ID.test(activeKeyId) || !keys || typeof keys !== "object") {
    throw new Error("Financial encryption keyring is invalid");
  }
  const indexKey = decodeBase64Url(lookupKey, 32);
  const encryptionKeys = new Map();
  for (const [keyId, encodedKey] of Object.entries(keys)) {
    const key = decodeBase64Url(encodedKey, 32);
    if (!KEY_ID.test(keyId) || indexKey.equals(key)) {
      throw new Error("Financial encryption keys must be independent");
    }
    encryptionKeys.set(keyId, key);
  }
  const activeKey = encryptionKeys.get(activeKeyId);
  if (!activeKey) throw new Error("The active financial encryption key is missing");

  return {
    seal(record, fields) {
      const nonce = randomBytes(12);
      const cipher = createCipheriv(ALGORITHM, activeKey, nonce, { authTagLength: 16 });
      cipher.setAAD(authenticatedContext(record, activeKeyId));
      const ciphertext = Buffer.concat([cipher.update(JSON.stringify(fields), "utf8"), cipher.final()]);
      return {
        version: FORMAT_VERSION,
        keyId: activeKeyId,
        nonce: nonce.toString("base64url"),
        ciphertext: ciphertext.toString("base64url"),
        tag: cipher.getAuthTag().toString("base64url"),
      };
    },
    open(record, envelope) {
      if (envelope?.version !== FORMAT_VERSION) throw new Error("Unsupported financial encryption format");
      const key = encryptionKeys.get(envelope.keyId);
      if (!key) throw new Error("The financial encryption key for this record is missing");
      try {
        const nonce = decodeBase64Url(envelope.nonce, 12);
        const decipher = createDecipheriv(ALGORITHM, key, nonce, { authTagLength: 16 });
        decipher.setAAD(authenticatedContext(record, envelope.keyId));
        decipher.setAuthTag(decodeBase64Url(envelope.tag, 16));
        const fields = Buffer.concat([
          decipher.update(decodeBase64Url(envelope.ciphertext)),
          decipher.final(),
        ]);
        return JSON.parse(fields.toString("utf8"));
      } catch {
        throw new Error("Financial record authentication failed");
      }
    },
    lookup(ownerId, purpose, value) {
      if (![ownerId, purpose, value].every((part) => typeof part === "string" && part.length > 0)) {
        throw new Error("Financial lookup identity is required");
      }
      return createHmac("sha256", indexKey)
        .update(JSON.stringify([CONTEXT_PREFIX, ownerId, purpose, value]))
        .digest("base64url");
    },
  };
}

export function loadFinancialCipher(env = process.env) {
  let keys;
  try {
    keys = JSON.parse(env.FINANCIAL_ENCRYPTION_KEYRING ?? "");
  } catch {
    throw new Error("FINANCIAL_ENCRYPTION_KEYRING must contain a JSON keyring");
  }
  return createFinancialCipher({
    activeKeyId: env.FINANCIAL_ENCRYPTION_ACTIVE_KEY,
    keys,
    lookupKey: env.FINANCIAL_LOOKUP_KEY,
  });
}
