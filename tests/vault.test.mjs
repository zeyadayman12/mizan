// Automatic tests for Mizan's encryption (vault.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ctx = vm.createContext({ crypto: globalThis.crypto, TextEncoder, TextDecoder, btoa, atob, Uint8Array, console });
vm.runInContext(readFileSync(new URL("../vault.js", import.meta.url), "utf8"), ctx);
const V = vm.runInContext("V", ctx);

const DATA = { incomes: [{ amount: 1000, source: "Dad" }], note: "سرّي" };
// Objects coming out of the sandbox have a different prototype; compare their plain JSON form.
const plain = o => JSON.parse(JSON.stringify(o));

async function makeVault(pin = "1234"){
  const raw = V.newDataKey();
  const code = V.newRecoveryCode();
  const wraps = { pin: await V.wrapPin(raw, pin), rec: await V.wrapRec(raw, code) };
  const blob = await V.seal(await V.importDataKey(raw), DATA, { len: pin.length, wraps });
  return { raw, code, wraps, blob };
}

test("the right PIN opens the data", async () => {
  const { blob } = await makeVault("1234");
  const r = await V.openAny(blob, "1234");
  assert.deepEqual(plain(r.data), DATA);
  assert.equal(r.via, "pin");
});

test("a wrong PIN does not open it", async () => {
  const { blob } = await makeVault("1234");
  await assert.rejects(V.openAny(blob, "1235"));
});

test("the stored file does not contain the data in readable form", async () => {
  const { blob } = await makeVault();
  const text = JSON.stringify(blob);
  assert.ok(!text.includes("Dad") && !text.includes("1000"));
});

test("the recovery code opens it, even typed in lowercase with spaces", async () => {
  const { blob, code } = await makeVault();
  const messy = code.toLowerCase().replace(/-/g, " ");
  const r = await V.openAny(blob, messy);
  assert.deepEqual(plain(r.data), DATA);
  assert.equal(r.via, "rec");
});

test("the lock screen (PIN only) does not accept the recovery code", async () => {
  const { blob, code } = await makeVault();
  await assert.rejects(V.openAny(blob, code, { allowRec: false }));
});

test("changing the PIN keeps the recovery code working", async () => {
  const { raw, wraps, code } = await makeVault("1234");
  const newWraps = { ...wraps, pin: await V.wrapPin(raw, "987654") };
  const blob = await V.seal(await V.importDataKey(raw), DATA, { len: 6, wraps: newWraps });
  assert.deepEqual(plain((await V.openAny(blob, "987654")).data), DATA);
  await assert.rejects(V.openAny(blob, "1234", { allowRec: false }));
  assert.deepEqual(plain((await V.openAny(blob, code)).data), DATA);
});

test("old v1 files (data locked directly by the PIN) still open", async () => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode("4321"), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, base,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(DATA))));
  const v1 = { app: "mizan", v: 1, salt: V.b64(salt), iter: 250000, len: 4, iv: V.b64(iv), ct: V.b64(ct) };
  const r = await V.openAny(v1, "4321");
  assert.deepEqual(plain(r.data), DATA);
  assert.equal(r.via, "v1");
  await assert.rejects(V.openAny(v1, "0000"));
});

test("recovery codes look like XXXX-XXXX-XXXX-XXXX-XXXX with no look-alike letters", () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++){
    const c = V.newRecoveryCode();
    assert.match(c, /^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){4}$/);
    seen.add(c);
  }
  assert.equal(seen.size, 200);
});

test("PIN keys use 600,000 PBKDF2 rounds", async () => {
  const w = await V.wrapPin(V.newDataKey(), "1234");
  assert.equal(w.iter, 600000);
});
