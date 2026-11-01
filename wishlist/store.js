// Data layer. Two interchangeable backends with the same API:
//   - LocalStore:   demo mode, localStorage + live sync between tabs
//   - FirebaseStore: Firestore, live sync between every family member
//
// State shape handed to subscribers:
//   { members: {id: {name}},
//     lists:   {id: {owner, title, occasion, createdAt}},
//     items:   {id: {listId, title, link, price, notes, createdAt}},
//     claims:  {itemId: {by, at}} }
//
// A claim is stored under the item's id, so an item can only ever have one.

import { FIREBASE_CONFIG, FAMILY_ID, SEED } from "./config.js";

const COLLECTIONS = ["members", "lists", "items", "claims"];
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export class TakenError extends Error {
  constructor(by) { super("Already taken"); this.by = by; }
}

// ---------------------------------------------------------------- demo mode
class LocalStore {
  constructor() {
    this.key = `wishlist:${FAMILY_ID}`;
    this.listeners = new Set();
    this.channel = "BroadcastChannel" in window ? new BroadcastChannel(this.key) : null;
    this.channel?.addEventListener("message", () => this.emit());
    window.addEventListener("storage", (e) => { if (e.key === this.key) this.emit(); });
    this.mode = "demo";
  }
  read() {
    try {
      const raw = JSON.parse(localStorage.getItem(this.key));
      if (raw) return raw;
    } catch { /* fall through */ }
    return { members: {}, lists: {}, items: {}, claims: {} };
  }
  write(mutator) {
    const s = this.read();
    const result = mutator(s);
    localStorage.setItem(this.key, JSON.stringify(s));
    this.channel?.postMessage("changed");
    this.emit();
    return result;
  }
  emit() { const s = this.read(); this.listeners.forEach((cb) => cb(s)); }
  subscribe(cb) { this.listeners.add(cb); cb(this.read()); return () => this.listeners.delete(cb); }

  async init() { if (Object.keys(this.read().lists).length === 0) await seed(this); }
  async addMember(name) { const id = uid(); this.write((s) => { s.members[id] = { name }; }); return id; }
  async addList(owner, title, occasion) {
    const id = uid();
    this.write((s) => { s.lists[id] = { owner, title, occasion, createdAt: Date.now() }; });
    return id;
  }
  async updateList(id, patch) { this.write((s) => { Object.assign(s.lists[id], patch); }); }
  async deleteList(id) {
    this.write((s) => {
      delete s.lists[id];
      for (const [itemId, it] of Object.entries(s.items)) {
        if (it.listId === id) { delete s.items[itemId]; delete s.claims[itemId]; }
      }
    });
  }
  async addItem(listId, data) {
    const id = uid();
    this.write((s) => { s.items[id] = { listId, ...data, createdAt: Date.now() }; });
    return id;
  }
  async updateItem(id, patch) { this.write((s) => { Object.assign(s.items[id], patch); }); }
  async deleteItem(id) { this.write((s) => { delete s.items[id]; delete s.claims[id]; }); }
  async claim(itemId, by) {
    this.write((s) => {
      const existing = s.claims[itemId];
      if (existing && existing.by !== by) throw new TakenError(existing.by);
      s.claims[itemId] = { by, at: Date.now() };
    });
  }
  async unclaim(itemId, by) {
    this.write((s) => { if (s.claims[itemId]?.by === by) delete s.claims[itemId]; });
  }
}

// ------------------------------------------------------------ Firebase mode
class FirebaseStore {
  constructor(fb) {
    this.fb = fb;
    this.mode = "firebase";
    this.state = { members: {}, lists: {}, items: {}, claims: {} };
    this.listeners = new Set();
    this.loaded = new Set();
    const app = fb.initializeApp(FIREBASE_CONFIG);
    this.db = fb.getFirestore(app);
    this.root = fb.doc(this.db, "families", FAMILY_ID);
  }
  col(name) { return this.fb.collection(this.root, name); }
  ref(name, id) { return this.fb.doc(this.root, name, id); }

  init() {
    // Resolve once every collection has delivered its first snapshot.
    return new Promise((resolve) => {
      for (const name of COLLECTIONS) {
        this.fb.onSnapshot(this.col(name), (snap) => {
          const map = {};
          snap.forEach((d) => { map[d.id] = d.data(); });
          this.state = { ...this.state, [name]: map };
          this.loaded.add(name);
          if (this.loaded.size === COLLECTIONS.length) {
            this.listeners.forEach((cb) => cb(this.state));
            if (!this.ready) {
              this.ready = true;
              (Object.keys(this.state.lists).length === 0 ? seed(this) : Promise.resolve()).then(resolve);
            }
          }
        });
      }
    });
  }
  subscribe(cb) {
    this.listeners.add(cb);
    if (this.ready) cb(this.state);
    return () => this.listeners.delete(cb);
  }
  async add(name, data) { const id = uid(); await this.fb.setDoc(this.ref(name, id), data); return id; }

  addMember(name) { return this.add("members", { name }); }
  addList(owner, title, occasion) { return this.add("lists", { owner, title, occasion, createdAt: Date.now() }); }
  updateList(id, patch) { return this.fb.updateDoc(this.ref("lists", id), patch); }
  async deleteList(id) {
    const batch = this.fb.writeBatch(this.db);
    batch.delete(this.ref("lists", id));
    for (const [itemId, it] of Object.entries(this.state.items)) {
      if (it.listId === id) { batch.delete(this.ref("items", itemId)); batch.delete(this.ref("claims", itemId)); }
    }
    await batch.commit();
  }
  addItem(listId, data) { return this.add("items", { listId, ...data, createdAt: Date.now() }); }
  updateItem(id, patch) { return this.fb.updateDoc(this.ref("items", id), patch); }
  async deleteItem(id) {
    const batch = this.fb.writeBatch(this.db);
    batch.delete(this.ref("items", id));
    batch.delete(this.ref("claims", id));
    await batch.commit();
  }
  // Transaction: two people clicking "I'll gift this" at the same moment
  // cannot both win. The loser gets a TakenError.
  claim(itemId, by) {
    const ref = this.ref("claims", itemId);
    return this.fb.runTransaction(this.db, async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists() && snap.data().by !== by) throw new TakenError(snap.data().by);
      tx.set(ref, { by, at: Date.now() });
    });
  }
  unclaim(itemId, by) {
    const ref = this.ref("claims", itemId);
    return this.fb.runTransaction(this.db, async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists() && snap.data().by === by) tx.delete(ref);
    });
  }
}

async function seed(store) {
  await store.addMember(SEED.owner);
  const listId = await store.addList(SEED.owner, SEED.list.title, SEED.list.occasion);
  for (const item of SEED.items) await store.addItem(listId, item);
}

export async function createStore() {
  if (!FIREBASE_CONFIG) {
    const s = new LocalStore();
    await s.init();
    return s;
  }
  const v = "10.12.2";
  const [appMod, fsMod] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${v}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${v}/firebase-firestore.js`),
  ]);
  const s = new FirebaseStore({ ...appMod, ...fsMod });
  await s.init();
  return s;
}
