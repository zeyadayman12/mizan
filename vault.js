/* Mizan vault: encryption with a PIN and a recovery code.

   How it works (envelope encryption, like password managers):
   - The data is encrypted with a random 256-bit DATA KEY using AES-256-GCM.
   - The data key is stored twice, each copy "wrapped" (encrypted) by a key made from a secret:
       wraps.pin  : key derived from the PIN            (PBKDF2-SHA256, 600,000 rounds)
       wraps.rec  : key derived from the recovery code  (PBKDF2-SHA256, 200,000 rounds)
   - Either secret unwraps the data key, and the data key opens the data.
   - Changing the PIN only re-wraps the data key; the recovery code keeps working.

   Old format (v1): the data was encrypted directly with a key derived from the PIN.
   openAny() still opens it so the app can upgrade it.

   Works in browsers and in Node 18+ (for the tests). No screens, no storage here. */
"use strict";

const V = (() => {
  const ITER_PIN = 600000, ITER_REC = 200000;
  const subtle = globalThis.crypto.subtle;
  const te = new TextEncoder(), td = new TextDecoder();
  const b64 = u8 => { let s = ""; for (const c of u8) s += String.fromCharCode(c); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const rand = n => globalThis.crypto.getRandomValues(new Uint8Array(n));

  async function kek(secret, salt, iter){
    const base = await subtle.importKey("raw", te.encode(secret), "PBKDF2", false, ["deriveKey"]);
    return subtle.deriveKey({ name:"PBKDF2", salt, iterations:iter, hash:"SHA-256" }, base, { name:"AES-GCM", length:256 }, false, ["encrypt","decrypt"]);
  }
  async function gcmEncrypt(key, bytes){
    const iv = rand(12);
    const ct = new Uint8Array(await subtle.encrypt({ name:"AES-GCM", iv }, key, bytes));
    return { iv:b64(iv), ct:b64(ct) };
  }
  async function gcmDecrypt(key, box){
    return new Uint8Array(await subtle.decrypt({ name:"AES-GCM", iv:unb64(box.iv) }, key, unb64(box.ct)));
  }

  /* ---- data key ---- */
  const newDataKey = () => rand(32);
  const importDataKey = raw => subtle.importKey("raw", raw, { name:"AES-GCM" }, false, ["encrypt","decrypt"]);

  /* ---- wrap / unwrap the data key with a secret ---- */
  async function wrap(raw, secret, iter){
    const salt = rand(16);
    const box = await gcmEncrypt(await kek(secret, salt, iter), raw);
    return { salt:b64(salt), iter, ...box };
  }
  async function unwrap(w, secret){                     // throws if the secret is wrong
    return gcmDecrypt(await kek(secret, unb64(w.salt), w.iter), w);
  }
  const wrapPin = (raw, pin) => wrap(raw, pin, ITER_PIN);
  const wrapRec = (raw, code) => wrap(raw, normCode(code), ITER_REC);

  /* ---- data ---- */
  async function seal(dataKey, obj, header){             // header = { len, wraps }
    const box = await gcmEncrypt(dataKey, te.encode(JSON.stringify(obj)));
    return { app:"mizan", v:2, len:header.len, wraps:header.wraps, ...box };
  }
  async function open(dataKey, blob){ return JSON.parse(td.decode(await gcmDecrypt(dataKey, blob))); }

  /* Try to open a stored blob or backup with a secret (PIN or recovery code).
     Returns { data, raw, via } where raw is the data key (null for old v1 blobs). Throws if nothing works. */
  async function openAny(blob, secret, { allowRec = true } = {}){
    if (blob && blob.v === 2 && blob.wraps){
      const tries = [["pin", blob.wraps.pin, secret]];
      if (allowRec && blob.wraps.rec) tries.push(["rec", blob.wraps.rec, normCode(secret)]);
      for (const [via, w, sec] of tries){
        if (!w) continue;
        try { const raw = await unwrap(w, sec); return { data: await open(await importDataKey(raw), blob), raw, via }; }
        catch (e) { /* try the next one */ }
      }
      throw new Error("wrong secret");
    }
    if (blob && blob.salt && blob.ct){                    // old v1 format
      const key = await kek(secret, unb64(blob.salt), blob.iter || 250000);
      return { data: await open(key, blob), raw: null, via: "v1" };
    }
    throw new Error("not a Mizan file");
  }

  /* ---- recovery code: 20 characters, about 100 bits, no look-alike letters ---- */
  const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // 32 symbols: no I, O, 0, 1
  function newRecoveryCode(){
    const r = rand(20); let s = "";
    for (let i = 0; i < 20; i++){ s += ALPHA[r[i] & 31]; if (i % 4 === 3 && i < 19) s += "-"; }
    return s;
  }
  function normCode(x){ return String(x || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
  const looksLikeCode = x => normCode(x).length === 20;

  return { ITER_PIN, ITER_REC, b64, unb64, newDataKey, importDataKey, wrapPin, wrapRec, unwrap,
           seal, open, openAny, newRecoveryCode, normCode, looksLikeCode };
})();
if (typeof module !== "undefined") module.exports = V;
