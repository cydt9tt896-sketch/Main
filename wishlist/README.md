# Family Wishlists

A tiny shared wishlist app for birthdays and Christmas.

- **Everyone curates their own lists**: gift name, link to the shop, price, notes.
- **Everyone else sees them live** and taps **"I'll gift this"** to secure a gift.
  The gift immediately shows as *Taken* for everybody else, so nothing gets bought twice.
  Two people tapping at the same moment can't both win (the claim is a database transaction).
- **The surprise is kept**: on your own lists you never see what's been claimed or by whom.
- **My gifts to buy** shows what you've picked across all lists, with a running total.

It's plain HTML/CSS/JS (no build step) and runs on any static host.

## Try it right now (demo mode)

```sh
cd wishlist
python3 -m http.server 8000
# open http://localhost:8000 in two tabs, pick different names, claim a gift in one tab
```

Out of the box `config.js` has `FIREBASE_CONFIG = null`, so data is stored in your browser only.
It still syncs live between tabs, which is enough to see how it feels. The first run seeds
**Simon's birthday** list with placeholder gifts you can edit or remove.

## Share it with the family (free)

1. Create a project at <https://console.firebase.google.com> (the free Spark plan is plenty).
2. **Build → Firestore Database → Create database** (production mode, any region).
3. **Rules** tab: paste the contents of `firestore.rules` and publish.
4. **Project settings → Your apps → Web app (</>)**: register an app and copy the `firebaseConfig`.
5. Paste it into `config.js` as `FIREBASE_CONFIG`, and change `FAMILY_ID` to something hard to guess
   (e.g. `cerruti-xmas-7f3k`). Set `CURRENCY` if you don't use USD.
6. Host the `wishlist/` folder on GitHub Pages, Netlify or Firebase Hosting and send the link around.

## Notes and limits of the prototype

- Identity is "pick your name", with no passwords. Fine for a family; anyone with the link can see the lists.
- Claims are hidden from the owner in the app, but a tech-savvy owner could still find them in the
  browser's developer tools. Proper hiding needs sign-in plus per-user security rules, a good next step.
- Data model (Firestore, under `families/{FAMILY_ID}/`): `members`, `lists`, `items`, and `claims`
  (one doc per item id, which is what makes a gift claimable only once).
