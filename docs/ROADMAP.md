# Roadmap to publishing

This is our working list. Each item gets done and checked off. Real usage decides the order.

## Now
- [x] Put the project on GitHub (private)
- [ ] Use Mizan with real money for one month and write down what's missing or annoying

## 1. Protect people's data
- [x] Backup reminders (weekly), plus a visible "last backup" date
- [x] Recovery code shown once at setup, so a forgotten PIN isn't total loss
- [x] Longer PIN (up to 8 digits) and stronger key stretching (600,000 rounds)
- [ ] Optional encrypted sync between phone and laptop

## 2. Make it for everyone
- [ ] First-time setup: language, currency, sadaqah %, gold rule on/off, zakat on/off
- [ ] Support currencies other than EGP

## 3. Engineering
- [x] Automatic tests for the split engine, balances, and encryption (`npm test`)
- [~] Split `index.html` into organized files: math (`engine.js`) and encryption (`vault.js`) are out; styles, screens, and translations still to go
- [ ] Continue the work in Claude Code on the laptop

## 4. Test with real people
- [ ] 3–5 friends or family use it without help; note where they get stuck

## 5. Publish
- [ ] Check the name "Mizan" isn't taken by another finance app
- [ ] Privacy page (nothing leaves the device)
- [ ] Scholar review of the sadaqah, gold, and zakat wording
- [x] Web version on GitHub Pages (for personal use on iPhone)
- [ ] App stores later (Google Play: $25 once; Apple: $99/year)
