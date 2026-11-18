// Same encryption as the iPhone app (SyncCenter.swift): PBKDF2-SHA256 → AES-256-GCM.
// The envelope is {"v":1,"salt":base64,"data":base64(nonce12 + ciphertext + tag16)}.
"use strict";
const FCrypto = (() => {
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = (bytes) => { let s = ""; const a = new Uint8Array(bytes); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => Uint8Array.from(atob(s.replace(/\s+/g, "")), (c) => c.charCodeAt(0));
  const random = (n) => crypto.getRandomValues(new Uint8Array(n));

  async function deriveKey(secret, salt, iterations = 210000) {
    const base = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, base, 256);
    return new Uint8Array(bits);
  }
  const aesKey = (raw) => crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);

  async function seal(plainBytes, rawKey, salt) {
    const iv = random(12);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(rawKey), plainBytes));
    const combined = new Uint8Array(12 + ct.length); combined.set(iv); combined.set(ct, 12);
    return JSON.stringify({ v: 1, salt: b64(salt), data: b64(combined) });
  }
  function saltOf(envelopeText) { return unb64(JSON.parse(envelopeText).salt); }
  async function open(envelopeText, rawKey) {
    const e = JSON.parse(envelopeText);
    const all = unb64(e.data);
    try {
      return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: all.subarray(0, 12) }, await aesKey(rawKey), all.subarray(12)));
    } catch { throw new Error("wrong-password"); }
  }
  async function sha256hex(s) {
    const h = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)));
    return [...h].map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  return { enc, dec, b64, unb64, random, deriveKey, seal, open, saltOf, sha256hex };
})();
