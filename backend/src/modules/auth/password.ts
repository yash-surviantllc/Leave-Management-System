import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions
} from "crypto";

const keyLength = 64;
const scryptOptions: ScryptOptions = {
  N: 16_384,
  r: 8,
  p: 1
};

function deriveKey(
  password: string,
  salt: string,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, key) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await deriveKey(password, salt, scryptOptions);

  return [
    "scrypt",
    String(scryptOptions.N),
    String(scryptOptions.r),
    String(scryptOptions.p),
    salt,
    key.toString("hex")
  ].join(":");
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  const parts = passwordHash.split(":");

  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }

  const [, nValue, rValue, pValue, salt, expectedKeyHex] = parts;
  const n = Number(nValue);
  const r = Number(rValue);
  const p = Number(pValue);
  const expectedKey = Buffer.from(expectedKeyHex, "hex");

  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }

  if (expectedKey.length !== keyLength) {
    return false;
  }

  const key = await deriveKey(password, salt, {
    N: n,
    r,
    p
  });

  return timingSafeEqual(key, expectedKey);
}
