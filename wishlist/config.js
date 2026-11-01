// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
// Leave FIREBASE_CONFIG as null to run in DEMO MODE: everything is stored in
// this browser only, but it still updates live across tabs, so you can try
// claiming from two windows side by side.
//
// To share with the family for real, create a free Firebase project, enable
// Firestore, and paste the web app config here (see README.md).
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCsTbnp654H1eTXuTDuWFBpsDh8IlZ0xRM",
  authDomain: "family-wishlist-f6a65.firebaseapp.com",
  projectId: "family-wishlist-f6a65",
  storageBucket: "family-wishlist-f6a65.firebasestorage.app",
  messagingSenderId: "61522857465",
  appId: "1:61522857465:web:919f7402fc6871e4490128",
};
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
  list: { title: "Anniversaire de Simon", occasion: "Anniversaire" },
  // Prices are rough estimates in EUR. Pictures are filled in automatically
  // from each link the first time the app runs online (see app.js).
  items: [
    { title: "Tenue de golf : polo manches longues + pantalon (tissu technique, climat chaud)", link: "https://shop.lululemon.com/c/men-golf-clothes/n11m2dzoxc7", price: 220, notes: "Lululemon ou équivalent" },
    { title: "Un ordinateur pour faire tourner Claude à fond", link: "https://www.apple.com/fr/macbook-pro/", price: 2400, notes: "ex. MacBook Pro 14\"" },
    { title: "Apple Pencil", link: "https://www.apple.com/fr/apple-pencil/", price: 149, notes: "", image: "https://www.apple.com/fr/apple-pencil/images/meta/apple-pencil__e54ff7ft4f0i_og.png" },
    { title: "Parfum Horace", link: "https://www.sephora.fr/p/ethorace---eau-de-parfum-boisee--douce--fraiche-843588.html", price: 45, notes: "" },
    { title: "Soins pour la peau Horace", link: "https://www.horace.co/", price: 40, notes: "" },
    { title: "Catalogue de l'exposition Gustave Fayet, Fondation Louis Vuitton (en français)", link: "https://www.simonandschuster.com/books/Gustave-Fayet-Creator/Angeline-Scherf/9782073158840", price: 45, notes: "En français" },
    { title: "Baskets On ou Nike", link: "https://www.on.com/", price: 160, notes: "" },
    { title: "Chaussures Paraboot", link: "https://www.paraboot.com/?p=514260", price: 430, notes: "ex. le derby Michael" },
    { title: "Bottines R.M. Williams", link: "https://www.patinaproject.com/rm-williams/comfort-craftsman-boot", price: 550, notes: "ex. Comfort Craftsman" },
    { title: "Mocassins Sebago", link: "https://www.mrporter.com/en-gb/mens/product/sebago/shoes/loafers/classic-dan-leather-penny-loafers/46376663162838923", price: 150, notes: "ex. le mocassin Classic Dan" },
    { title: "Tenue de voyage Lululemon", link: "https://shop.lululemon.com/", price: 230, notes: "" },
    { title: "Guide Monocle de la Thaïlande", link: "https://monocle.com/culture/books/thailand-handbook/", price: 50, notes: "" },
    { title: "Apple Watch", link: "https://www.apple.com/fr/watch/", price: 449, notes: "" },
    { title: "Abonnement WHOOP", link: "https://www.whoop.com/", price: 239, notes: "12 mois" },
    { title: "Le conflit israélo-palestinien en 100 questions (livre)", link: "https://openlibrary.org/books/OL60764342M", price: 16, notes: "Tallandier" },
    { title: "La Chine en 100 questions (livre)", link: "https://www.fnac.com/SearchResult/ResultList.aspx?Search=la+chine+en+100+questions", price: 16, notes: "Tallandier" },
  ],
};
