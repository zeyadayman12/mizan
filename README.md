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
| **Gold rule** | For every 500 EGP saved, Mizan reminds you to buy 250 EGP of gold. It tracks grams, karat, and what the gold is worth at today's price. |
| **Zakat check** | Compares savings plus gold against the nisab (85 g of 21k gold, per Egypt's Dar al-Ifta) and tracks the lunar year. |
| **Goals** | Things to buy, with optional dates. Mizan says whether you're on track and how much more per month you'd need. |
| **Loans** | Money you lent or borrowed, with partial repayments. |
| **Monthly report** | Where money came from, what was saved and spent, and the change from last month. |
| **Privacy** | PIN lock, auto-lock, AES-256-GCM encryption with a key derived by PBKDF2-SHA256 (250,000 iterations), encrypted backups. |
| **Languages** | English and Arabic (full right-to-left layout). |
| **Look & feel** | Black & gold theme, animations, and a glow on the active tab. |

## Running it

**Laptop (Windows):** keep all files in one folder and double-click `Open Mizan.cmd`. Mizan opens in its own Microsoft Edge app window. You can also open `index.html` in any modern browser.

**Phone:** open **https://zeyadayman12.github.io/mizan/** once. After you open it in Safari and choose **Share → Add to Home Screen**, it works fully offline.

Data is stored in the browser on each device. Use **Settings → Save a backup** to keep a copy and to move data between devices.

## Project files

```
index.html            the whole app (HTML + CSS + JavaScript)
sw.js                 offline cache (service worker)
manifest.webmanifest  install info for phones
icon-*.png            app icons
Open Mizan.cmd        Windows launcher (app window)
docs/ROADMAP.md       what we plan to improve before publishing
CHANGELOG.md          version history
```

## Security notes

- Data is encrypted at rest. The app cannot open it without the PIN.
- A 4–6 digit PIN mainly protects against someone opening the app. It is **not** strong against someone who copies the encrypted data and guesses every PIN offline. A longer passcode option is on the roadmap.
- Forgetting the PIN means the data cannot be recovered. A recovery code is on the roadmap.

## Religious calculations

Sadaqah, gold, and zakat features are tools to help you keep track. They are not religious rulings. Nisab defaults to 85 g of 21k gold per Egypt's Dar al-Ifta. For your own situation, ask a qualified scholar.

## Credits

Designed and product-owned by **Zeyad Ayman**. Built with AI-assisted development using Claude (Anthropic) as the coding assistant.
