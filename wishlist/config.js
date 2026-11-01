// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
// Leave FIREBASE_CONFIG as null to run in DEMO MODE: everything is stored in
// this browser only, but it still updates live across tabs, so you can try
// claiming from two windows side by side.
//
// To share with the family for real, create a free Firebase project, enable
// Firestore, and paste the web app config here (see README.md).
export const FIREBASE_CONFIG = null;
// export const FIREBASE_CONFIG = {
//   apiKey: "…",
//   authDomain: "your-project.firebaseapp.com",
//   projectId: "your-project",
//   appId: "…",
// };

// Name of the family space. Use something hard to guess: anyone who knows
// the site URL *and* this name can see the lists.
export const FAMILY_ID = "family";

// Currency used to display prices.
export const CURRENCY = "USD";

// Seeded on first run when there are no lists yet. Edit freely in the app.
export const SEED = {
  owner: "Simon",
  list: { title: "Simon's birthday", occasion: "Birthday" },
  items: [
    { title: "Placeholder: wireless earbuds", link: "https://example.com/earbuds", price: 129, notes: "Any colour" },
    { title: "Placeholder: a good cookbook", link: "https://example.com/cookbook", price: 35, notes: "" },
    { title: "Placeholder: running shoes", link: "https://example.com/shoes", price: 110, notes: "Size 43" },
    { title: "Placeholder: board game", link: "https://example.com/boardgame", price: 45, notes: "" },
    { title: "Placeholder: coffee subscription", link: "https://example.com/coffee", price: 60, notes: "3 months" },
  ],
};
