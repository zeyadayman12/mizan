# Mizan · ميزان

**Every pound in its place.**

Mizan is a private, offline money-splitting app. When money comes in, whether an allowance, Eidiya, a gift, or pay from an event, you type the amount and Mizan splits it right away into your pots: sadaqah, savings (turned into gold), your spending money, and anything else you add.

It runs on a phone (installed to the home screen) or a laptop, needs no internet, and never sends data anywhere. Everything is encrypted on the device with the user's PIN.

> Status: in development. Not published yet.

---

## Features

| Area | What it does |
|---|---|
| **Automatic split** | Sadaqah and savings come off the full amount first. The rest is shared between your own pots by percentage, and "Me" receives any rounding leftovers so the total is always exact. |
| **Your own pots** | Add pots with a name, icon, color, and share (%). The share is taken from "Me", so the total always stays at 100%. Pots can be edited, reset to 0, or removed. |
| **Your own sources** | Add where money comes from (e.g. Dad, Eidiya, an event) straight from the Money-in screen. Any source can have its own split. |
| **Extra sadaqah** | Raise sadaqah for a single income, with a clear warning. Only that entry changes. |
| **10-minute undo** | A money-in entry can be undone for 10 minutes, measured from the moment it was saved (it keeps counting when the app is closed). After that it becomes final. |
| **Savings jar** | A jar on Home fills with green as your savings (cash + gold) approach a target you set. Coins drop in and an encouraging message appears when you save. |
| **Sadaqah blessing** | Giving sadaqah shows «ما نقصت صدقةٌ من مال» and «تقبّل الله». |
| **Gold rule** | For every 500 EGP saved, Mizan reminds you to buy 250 EGP of gold. It tracks grams, karat, and what the gold is worth at today's price. |
| **Zakat check** | Compares savings plus gold against the nisab (85 g of 21k gold, per Egypt's Dar al-Ifta) and tracks the lunar year. |
| **Goals** | Things to buy, with optional dates. Mizan says whether you're on track and how much more per month you'd need. |
| **Loans** | Money you lent or borrowed, with partial repayments. |
| **Monthly report** | Where money came from, what was saved and spent, and the change from last month. |
| **Privacy** | PIN lock (4–8 digits), auto-lock, AES-256-GCM encryption, a recovery code for a forgotten PIN, encrypted backups, and a reminder to save a backup every week. |
| **Languages** | English and Arabic (full right-to-left layout). |
| **Look & feel** | Black & gold theme, animations, and a glow on the active tab. |

## Running it

**Laptop (Windows):** keep all files in one folder and double-click `Open Mizan.cmd`. Mizan opens in its own Microsoft Edge app window. You can also open `index.html` in any modern browser.

**Phone:** open **https://zeyadayman12.github.io/mizan/** once. After you open it in Safari and choose **Share → Add to Home Screen**, it works fully offline.

Data is stored in the browser on each device. Use **Settings → Save a backup** to keep a copy and to move data between devices.

## Project files

```
index.html            the screens (HTML + CSS + JavaScript)
engine.js             the money math: splits, balances, gold, zakat, goals (no screens)
vault.js              encryption: PIN, recovery code, backups (no screens)
tests/                automatic tests for engine.js and vault.js
sw.js                 offline cache (service worker)
manifest.webmanifest  install info for phones
icon-*.png            app icons
Open Mizan.cmd        Windows launcher (app window)
docs/ROADMAP.md       what we plan to improve before publishing
CHANGELOG.md          version history
```

## Tests

```
npm test
```

Runs the automatic tests (Node.js 20+ needed, nothing to install). They check that every split adds up exactly, that sadaqah rounds up, that balances, the gold rule, zakat, goals, and the undo window behave correctly, and that the encryption opens only with the right PIN or recovery code.

## Security design

- **Envelope encryption.** The data is encrypted with a random 256-bit data key (AES-256-GCM). The data key is stored twice, each copy wrapped by a key derived from a secret:
  - the **PIN** (PBKDF2-SHA256, 600,000 rounds)
  - the **recovery code**: 20 random characters, about 100 bits (PBKDF2-SHA256, 200,000 rounds)
- Either secret opens the data. Changing the PIN only re-wraps the data key, so the recovery code keeps working.
- Backups use the same format, so they open with the PIN or the recovery code on any device.
- After 5 wrong PINs, the app makes you wait longer and longer between tries.
- **Limits:** a short PIN still protects mainly against someone opening the app. Someone who copies the encrypted data could try every PIN offline, which is slow at 600,000 rounds each, but a 4-digit PIN has only 10,000 options. Use 6–8 digits for better protection.

## Religious calculations

Sadaqah, gold, and zakat features are tools to help you keep track. They are not religious rulings. Nisab defaults to 85 g of 21k gold per Egypt's Dar al-Ifta. For your own situation, ask a qualified scholar.

## Credits

Designed and product-owned by **Zeyad Ayman**. Built with AI-assisted development using Claude (Anthropic) as the coding assistant.
