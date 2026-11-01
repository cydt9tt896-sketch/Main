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
export const CURRENCY = "EUR";

// Seeded on first run when there are no lists yet. Edit freely in the app.
export const SEED = {
  owner: "Simon",
  list: { title: "Simon's birthday", occasion: "Birthday" },
  // Prices are rough estimates in EUR. Links go to the brand's shop so the
  // giver can pick the exact model, size and colour.
  items: [
    { title: "Golf outfit: long-sleeve polo + pants (technical fabric, hot climate)", link: "https://shop.lululemon.com/search?Ntt=golf", price: 220, notes: "Lululemon or equivalent" },
    { title: "Laptop to run Claude to its full potential", link: "https://www.apple.com/fr/macbook-pro/", price: 2400, notes: "e.g. MacBook Pro 14\"" },
    { title: "Apple Pencil", link: "https://www.apple.com/fr/apple-pencil/", price: 149, notes: "" },
    { title: "Horace fragrance", link: "https://www.horace.co/", price: 45, notes: "" },
    { title: "Horace skincare products", link: "https://www.horace.co/", price: 40, notes: "" },
    { title: "Gustavo Fayet exhibition catalogue, Fondation Louis Vuitton (French edition)", link: "https://www.fondationlouisvuitton.fr/", price: 49, notes: "In French" },
    { title: "On or Nike sneakers", link: "https://www.on.com/", price: 160, notes: "" },
    { title: "Paraboot shoes", link: "https://www.paraboot.com/", price: 430, notes: "" },
    { title: "R.M. Williams boots", link: "https://www.rmwilliams.com/", price: 550, notes: "" },
    { title: "Sebago loafers", link: "https://www.sebago.com/", price: 150, notes: "" },
    { title: "Lululemon travel outfit", link: "https://shop.lululemon.com/", price: 230, notes: "" },
    { title: "Monocle Thailand handbook", link: "https://monocle.com/shop/", price: 25, notes: "" },
    { title: "Apple Watch", link: "https://www.apple.com/fr/watch/", price: 449, notes: "" },
    { title: "WHOOP membership", link: "https://www.whoop.com/", price: 239, notes: "12 months" },
    { title: "Le conflit israélo-palestinien en 100 questions (book)", link: "https://www.fnac.com/SearchResult/ResultList.aspx?Search=le+conflit+isra%C3%A9lo-palestinien+en+100+questions", price: 16, notes: "Tallandier, French" },
    { title: "La Chine en 100 questions (book)", link: "https://www.fnac.com/SearchResult/ResultList.aspx?Search=la+chine+en+100+questions", price: 16, notes: "Tallandier, French" },
  ],
};
