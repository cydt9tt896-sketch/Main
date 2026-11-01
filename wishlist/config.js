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
export const FAMILY_ID = "family-835f49be";

// Currency used to display prices.
export const CURRENCY = "EUR";

// Seeded on first run when there are no lists yet. Edit freely in the app.
export const SEED = {
  owner: "Simon",
  list: { title: "Simon's birthday", occasion: "Birthday" },
  // Prices are rough estimates in EUR. Pictures are filled in automatically
  // from each link the first time the app runs online (see app.js).
  items: [
    { title: "Golf outfit: long-sleeve polo + pants (technical fabric, hot climate)", link: "https://shop.lululemon.com/c/men-golf-clothes/n11m2dzoxc7", price: 220, notes: "Lululemon or equivalent" },
    { title: "Laptop to run Claude to its full potential", link: "https://www.apple.com/fr/macbook-pro/", price: 2400, notes: "e.g. MacBook Pro 14\"" },
    { title: "Apple Pencil", link: "https://www.apple.com/fr/apple-pencil/", price: 149, notes: "", image: "https://www.apple.com/fr/apple-pencil/images/meta/apple-pencil__e54ff7ft4f0i_og.png" },
    { title: "Horace fragrance", link: "https://www.sephora.fr/p/ethorace---eau-de-parfum-boisee--douce--fraiche-843588.html", price: 45, notes: "" },
    { title: "Horace skincare products", link: "https://www.horace.co/", price: 40, notes: "" },
    { title: "Gustave Fayet exhibition catalogue, Fondation Louis Vuitton (French edition)", link: "https://www.simonandschuster.com/books/Gustave-Fayet-Creator/Angeline-Scherf/9782073158840", price: 45, notes: "In French" },
    { title: "On or Nike sneakers", link: "https://www.on.com/", price: 160, notes: "" },
    { title: "Paraboot shoes", link: "https://www.paraboot.com/?p=514260", price: 430, notes: "e.g. the Michael derby" },
    { title: "R.M. Williams boots", link: "https://www.patinaproject.com/rm-williams/comfort-craftsman-boot", price: 550, notes: "e.g. Comfort Craftsman" },
    { title: "Sebago loafers", link: "https://www.mrporter.com/en-gb/mens/product/sebago/shoes/loafers/classic-dan-leather-penny-loafers/46376663162838923", price: 150, notes: "e.g. Classic Dan penny loafer" },
    { title: "Lululemon travel outfit", link: "https://shop.lululemon.com/", price: 230, notes: "" },
    { title: "Monocle Thailand handbook", link: "https://monocle.com/culture/books/thailand-handbook/", price: 50, notes: "" },
    { title: "Apple Watch", link: "https://www.apple.com/fr/watch/", price: 449, notes: "" },
    { title: "WHOOP membership", link: "https://www.whoop.com/", price: 239, notes: "12 months" },
    { title: "Le conflit israélo-palestinien en 100 questions (book)", link: "https://openlibrary.org/books/OL60764342M", price: 16, notes: "Tallandier, French" },
    { title: "La Chine en 100 questions (book)", link: "https://www.fnac.com/SearchResult/ResultList.aspx?Search=la+chine+en+100+questions", price: 16, notes: "Tallandier, French" },
  ],
};
