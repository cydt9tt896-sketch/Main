import { createStore, TakenError } from "./store.js";
import { CURRENCY, FAMILY_ID } from "./config.js";

const $ = (sel) => document.querySelector(sel);
const ME_KEY = `wishlist:${FAMILY_ID}:me`;
const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: CURRENCY });

let store;
let state = { members: {}, lists: {}, items: {}, claims: {} };
let me = safeGet(ME_KEY);
let view = "mine";
let editing = null; // { listId, itemId? } while the item dialog is open
const pendingClaims = new Set(); // gifts being reserved right now (instant feedback)

function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* ignore */ } }

const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");
const fmtPrice = (p) => (p === "" || p == null || isNaN(p) ? "" : money.format(Number(p)));

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2800);
}

// ------------------------------------------------------------------ helpers
const memberNames = () => {
  const names = new Set(Object.values(state.members).map((m) => m.name));
  Object.values(state.lists).forEach((l) => names.add(l.owner));
  return [...names].sort((a, b) => a.localeCompare(b));
};
const byCreated = (a, b) => (a[1].createdAt || 0) - (b[1].createdAt || 0);
const listsOf = (owner) => Object.entries(state.lists).filter(([, l]) => l.owner === owner).sort(byCreated);
const itemsOf = (listId) => Object.entries(state.items).filter(([, i]) => i.listId === listId).sort(byCreated);
// Themes a gift can be tagged with. Keys are stored; labels are shown.
const THEMES = [
  ["sport", "⚽ Sport"], ["tech", "💻 Tech"], ["culture", "📚 Culture"], ["beaute", "💄 Beauté"],
  ["mode", "👕 Mode"], ["maison", "🏠 Maison"], ["voyage", "✈️ Voyage"], ["gourmand", "🍫 Gourmand"],
  ["jeux", "🎲 Jeux"], ["experience", "🎟️ Expérience"],
];
const THEME_LABEL = Object.fromEntries(THEMES);
const SORTS = [
  ["added", "Ordre d'ajout"], ["price-asc", "Prix croissant"], ["price-desc", "Prix décroissant"],
  ["az", "Nom A → Z"], ["za", "Nom Z → A"],
];
let sortBy = safeGet("wishlist:sort") || "added";
let themeFilter = "";
const hasPrice = (it) => it.price !== "" && it.price != null && !isNaN(it.price);
function sortItems(entries) {
  const cmpName = (a, b) => (a[1].title || "").localeCompare(b[1].title || "", "fr", { sensitivity: "base" });
  const cmpPrice = (dir) => (a, b) => {
    const pa = hasPrice(a[1]), pb = hasPrice(b[1]);
    if (pa !== pb) return pa ? -1 : 1; // gifts without a price go last
    return pa ? dir * (Number(a[1].price) - Number(b[1].price)) || cmpName(a, b) : cmpName(a, b);
  };
  const cmp = { "price-asc": cmpPrice(1), "price-desc": cmpPrice(-1), az: cmpName, za: (a, b) => cmpName(b, a) }[sortBy];
  return cmp ? [...entries].sort(cmp) : entries;
}
const shownItems = (listId) => sortItems(itemsOf(listId).filter(([, it]) => !themeFilter || (it.tags || []).includes(themeFilter)));
const tagChips = (tags = []) => tags.filter((t) => THEME_LABEL[t]).map((t) => `<span class="tag theme">${THEME_LABEL[t]}</span>`).join("");
function renderTools() {
  const tools = $("#list-tools");
  tools.hidden = view === "gifting";
  const sel = $("#sort-select");
  if (!sel.options.length) {
    sel.innerHTML = SORTS.map(([k, l]) => `<option value="${k}">${l}</option>`).join("");
    $("#theme-select").innerHTML = `<option value="">Tous les thèmes</option>` + THEMES.map(([k, l]) => `<option value="${k}">${l}</option>`).join("");
  }
  sel.value = sortBy;
  $("#theme-select").value = themeFilter;
}
const sameName = (a, b) => a?.trim().toLowerCase() === b?.trim().toLowerCase();

// ------------------------------------------------------------------- render
// Don't rebuild the page while a finger or mouse button is down: replacing a
// button mid-tap swallows the tap, which made "Je l'offre !" feel broken while
// pictures were still loading in the background.
let pointerDown = false;
let renderQueued = false;
document.addEventListener("pointerdown", () => { pointerDown = true; }, true);
for (const ev of ["pointerup", "pointercancel"]) {
  document.addEventListener(ev, () => {
    pointerDown = false;
    if (renderQueued) setTimeout(render, 0);
  }, true);
}
// Only touch the DOM when the markup actually changed.
function setHtml(el, html) {
  if (el._html === html) return;
  el._html = html;
  el.innerHTML = html;
}

function render() {
  if (pointerDown) { renderQueued = true; return; }
  renderQueued = false;
  $("#login").hidden = !!me;
  $("#app").hidden = !me;
  $("#whoami").hidden = !me;
  if (!me) return renderLogin();
  $("#whoami-name").textContent = me;
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === view));
  for (const v of ["mine", "family", "gifting"]) $(`#view-${v}`).hidden = v !== view;
  const mine = Object.entries(state.claims).filter(([id, c]) => c.by === me && state.items[id]);
  $("#gifting-count").textContent = mine.length;
  renderTools();
  if (view === "mine") renderMine();
  if (view === "family") renderFamily();
  if (view === "gifting") renderGifting(mine);
}

function renderLogin() {
  setHtml($("#member-buttons"), memberNames()
    .map((n) => `<button class="secondary" data-action="pick-me" data-name="${esc(n)}">${esc(n)}</button>`)
    .join("") || `<p class="muted">L'atelier est encore vide. Sois le premier lutin !</p>`);
}

function renderMine() {
  const lists = listsOf(me);
  setHtml($("#view-mine"), `
    <p class="muted">Ta lettre au Père Noël. Ta famille la voit, mais
    <strong>tu ne sauras jamais qui t'offre quoi</strong> : la surprise reste entière.</p>
    ${lists.map(([id, l]) => `
      <article class="card">
        <div class="list-head">
          <div>
            <h2>${esc(l.title)}</h2>
            ${l.occasion ? `<span class="tag">${esc(l.occasion)}</span>` : ""}
          </div>
          <div class="row">
            <button class="link" data-action="rename-list" data-list="${id}">Renommer</button>
            <button class="link danger" data-action="delete-list" data-list="${id}">Supprimer la lettre</button>
          </div>
        </div>
        <ul class="items">
          ${shownItems(id).map(([itemId, it]) => `
            <li class="item">
              ${itemInfo(it)}
              <div class="actions">
                <button class="link" data-action="edit-item" data-list="${id}" data-item="${itemId}">Modifier</button>
                <button class="link danger" data-action="delete-item" data-item="${itemId}">Retirer</button>
              </div>
            </li>`).join("") || `<li class="empty">${themeFilter && itemsOf(id).length ? "Aucun cadeau dans ce thème." : "Aucun cadeau pour l'instant. Ajoute ton premier vœu !"}</li>`}
        </ul>
        <button data-action="add-item" data-list="${id}">+ Ajouter un cadeau</button>
      </article>`).join("")}
    <form class="card row" data-form="new-list">
      <input name="title" placeholder="Nouvelle lettre, ex. Noël de ${esc(me)}" required maxlength="60" />
      <input name="occasion" placeholder="Occasion (facultatif)" maxlength="30" />
      <button type="submit">Créer la lettre</button>
    </form>`);
}

const safeImg = (u) => (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(u || "") || /^https:\/\//i.test(u || "") ? u : "");
const thumbTile = (title) => `<div class="thumb tile" aria-hidden="true">${esc((title || "?").trim().charAt(0).toUpperCase())}</div>`;

function itemInfo(it) {
  const url = safeUrl(it.link);
  const title = url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(it.title)} ↗</a>` : esc(it.title);
  const img = safeImg(it.image);
  const thumb = img
    ? `<img class="thumb" src="${esc(img)}" alt="" loading="lazy" data-title="${esc(it.title)}" />`
    : thumbTile(it.title);
  return `
    ${url ? `<a class="thumb-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" tabindex="-1">${thumb}</a>` : thumb}
    <div class="info">
      <div class="title">${title}</div>
      ${it.notes ? `<div class="notes">${esc(it.notes)}</div>` : ""}
      ${it.tags?.length ? `<div class="themes">${tagChips(it.tags)}</div>` : ""}
    </div>
    <div class="price">${fmtPrice(it.price)}</div>`;
}

function renderFamily() {
  const owners = memberNames().filter((n) => !sameName(n, me));
  const blocks = owners.flatMap((owner) => listsOf(owner).map(([id, l]) => {
    const all = itemsOf(id);
    const items = shownItems(id);
    const open = all.filter(([itemId]) => !state.claims[itemId]).length;
    return `
      <article class="card">
        <div class="list-head">
          <div>
            <h2>${esc(l.title)}</h2>
            <span class="tag">${esc(owner)}</span>
            ${l.occasion ? `<span class="tag">${esc(l.occasion)}</span>` : ""}
          </div>
          <span class="muted">${open} sur ${all.length} encore ${open > 1 ? "disponibles" : "disponible"}</span>
        </div>
        <ul class="items">
          ${items.map(([itemId, it]) => {
            const c = state.claims[itemId];
            const mineClaim = c && c.by === me;
            const pending = !c && pendingClaims.has(itemId);
            const cls = c ? (mineClaim ? "item mine" : "item taken") : pending ? "item mine" : "item";
            const action = pending
              ? `<button class="claim-btn" disabled><span class="spinner" aria-hidden="true"></span> Réservation…</button>`
              : !c
                ? `<button class="claim-btn" data-action="claim" data-item="${itemId}">🎁 Je l'offre !</button>`
                : mineClaim
                  ? `<span class="status ok">🎁 C'est toi qui l'offres</span><button class="link" data-action="unclaim" data-item="${itemId}">Libérer</button>`
                  : `<span class="status">Déjà réservé par ${esc(c.by)}</span>`;
            return `<li class="${cls}">${itemInfo(it)}<div class="actions">${action}</div></li>`;
          }).join("") || `<li class="empty">${themeFilter && all.length ? "Aucun cadeau dans ce thème." : "Rien sur cette lettre pour l'instant."}</li>`}
        </ul>
      </article>`;
  }));
  setHtml($("#view-family"), blocks.join("") ||
    `<p class="card muted">Personne d'autre n'a encore écrit sa lettre. Envoie-leur le lien !</p>`);
}

function renderGifting(mine) {
  let total = 0;
  const rows = mine.map(([itemId]) => {
    const it = state.items[itemId];
    const l = state.lists[it.listId] || {};
    total += Number(it.price) || 0;
    return `<li class="item mine">${itemInfo(it)}
      <div class="actions"><span class="tag">pour ${esc(l.owner || "?")}</span>
      <button class="link" data-action="unclaim" data-item="${itemId}">Libérer</button></div></li>`;
  });
  setHtml($("#view-gifting"), `
    <article class="card">
      <div class="list-head"><h2>Ma hotte de lutin</h2><strong>${money.format(total)}</strong></div>
      <ul class="items">${rows.join("") || `<li class="empty">Ta hotte est vide. Va voir « La famille » pour choisir un cadeau.</li>`}</ul>
    </article>`);
}

// ------------------------------------------------------------------ actions
async function run(fn) {
  try { await fn(); } catch (e) {
    if (e instanceof TakenError) toast(`Trop tard ! ${e.by} vient de le réserver.`);
    else { console.error(e); toast("Oups, ça n'a pas marché. Vérifie ta connexion et réessaie."); }
  }
}

// In-page replacement for confirm()/prompt(), which some embedded viewers block.
// Resolves to true/false, or to the typed text when `input` is given (null on cancel).
function ask({ title, input, ok = "OK" }) {
  const d = $("#ask-dialog");
  const field = $("#ask-input");
  $("#ask-title").textContent = title;
  $("#ask-ok").textContent = ok;
  field.hidden = input === undefined;
  field.value = input ?? "";
  d.returnValue = "";
  d.showModal();
  if (!field.hidden) field.select();
  return new Promise((resolve) => {
    d.addEventListener("close", () => {
      const yes = d.returnValue === "ok";
      resolve(input === undefined ? yes : yes ? field.value : null);
    }, { once: true });
  });
}


// Read a shop's product page through Microlink's free link-preview API (no
// key, about 50 lookups a day): its main picture, its name and, when the shop
// publishes it, its price. Returns null when the lookup couldn't run
// (offline, blocked, quota), or an object whose fields may be empty.
const MICROLINK_RULES = [
  ["jsonld", 'script[type="application/ld+json"]', "html", true],
  ["ogprice", 'meta[property="product:price:amount"]', "content"],
  ["ogprice2", 'meta[property="og:price:amount"]', "content"],
  ["itemprice", '[itemprop="price"]', "content"],
  ["itempricetext", '[itemprop="price"]', "text"],
];
function microlinkUrl(link) {
  const q = new URLSearchParams({ url: link });
  for (const [key, selector, attr, all] of MICROLINK_RULES) {
    q.set(`data.${key}.${all ? "selectorAll" : "selector"}`, selector);
    q.set(`data.${key}.attr`, attr);
  }
  return `https://api.microlink.io/?${q}`;
}

// "1 299,00 €" → 1299, "149.99" → 149.99, "1,299.00" → 1299
function parsePrice(v) {
  if (v == null) return null;
  if (typeof v === "number") return v > 0 ? v : null;
  let t = String(v).replace(/[^\d.,]/g, "");
  if (!t) return null;
  const lastComma = t.lastIndexOf(","), lastDot = t.lastIndexOf(".");
  const dec = Math.max(lastComma, lastDot);
  if (dec >= 0 && t.length - dec - 1 <= 2) {
    t = t.slice(0, dec).replace(/[.,]/g, "") + "." + t.slice(dec + 1);
  } else {
    t = t.replace(/[.,]/g, "");
  }
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

// Find a Product in the page's structured data (schema.org JSON-LD).
function productFromJsonLd(blocks) {
  const found = { price: null, image: "", name: "" };
  const visit = (node) => {
    if (!node || typeof node !== "object" || (found.price && found.image)) return;
    if (Array.isArray(node)) return node.forEach(visit);
    const type = [].concat(node["@type"] || []).join(" ");
    if (/Product/i.test(type)) {
      const offers = [].concat(node.offers || []);
      for (const o of offers) {
        const p = parsePrice(o?.price ?? o?.lowPrice ?? o?.priceSpecification?.price);
        if (p && !found.price) found.price = p;
      }
      const img = [].concat(node.image || [])[0];
      const imgUrl = typeof img === "string" ? img : img?.url || img?.contentUrl;
      if (!found.image && /^https:\/\//i.test(imgUrl || "")) found.image = imgUrl;
      if (!found.name && typeof node.name === "string") found.name = node.name;
    }
    Object.values(node).forEach((v) => typeof v === "object" && visit(v));
  };
  for (const raw of [].concat(blocks || [])) {
    try { visit(JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw))); } catch { /* skip bad block */ }
  }
  return found;
}

// Returns { image, price, title } or { error } where error is "quota"
// (Microlink's free daily limit is used up), "blocked" (the shop refused to
// be read) or "network".
async function fetchLinkInfo(link) {
  if (!safeUrl(link)) return { image: "", price: null, title: "" };
  try {
    const res = await fetch(microlinkUrl(link));
    if (res.status === 429) return { error: "quota" };
    const json = await res.json().catch(() => ({}));
    if (json?.status !== "success") {
      console.warn("Microlink", res.status, json?.code, json?.message);
      return { error: /RATE|LIMIT|QUOTA/i.test(json?.code || "") ? "quota" : "blocked" };
    }
    const d = json.data || {};
    const ld = productFromJsonLd(d.jsonld);
    const price = ld.price ?? parsePrice(d.ogprice) ?? parsePrice(d.ogprice2) ?? parsePrice(d.itemprice) ?? parsePrice(d.itempricetext);
    const image = ld.image || d.image?.url || d.logo?.url || "";
    const title = (ld.name || d.title || "").trim();
    return { image: /^https:\/\//i.test(image) ? image : "", price, title };
  } catch (e) { console.warn("Microlink", e); return { error: "network" }; }
}

async function findImageForLink(link) {
  const info = await fetchLinkInfo(link);
  if (info.error === "blocked") return ""; // this shop can't be read: don't retry
  return info.error ? null : info.image;
}

let pendingImage = ""; // picture shown in the gift dialog
let imageRemoved = false; // the person removed the picture on purpose
function showDialogImage(src) {
  pendingImage = src || "";
  const prev = $("#photo-preview");
  prev.hidden = !pendingImage;
  if (pendingImage) prev.querySelector("img").src = pendingImage;
}

function openItemDialog(listId, itemId) {
  editing = { listId, itemId };
  const f = $("#item-form");
  const it = itemId ? state.items[itemId] : {};
  f.elements.title.value = it.title || "";
  f.elements.link.value = it.link || "";
  f.elements.price.value = it.price ?? "";
  f.elements.notes.value = it.notes || "";
  const tags = it.tags || [];
  f.querySelectorAll('input[name="tag"]').forEach((c) => { c.checked = tags.includes(c.value); });
  f.elements.imageUrl.value = it.image && !it.image.startsWith("data:") ? it.image : "";
  showDialogImage(it.image);
  imageRemoved = false;
  $("#item-dialog-title").textContent = itemId ? "Modifier le cadeau" : "Ajouter un cadeau";
  $("#item-dialog").showModal();
  f.elements.title.focus();
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action], .tab, #switch-user, #item-cancel, #photo-remove");
  if (!btn) return;
  if (btn.classList.contains("tab")) { view = btn.dataset.view; return render(); }
  if (btn.id === "switch-user") { me = null; safeSet(ME_KEY, null); return render(); }
  if (btn.id === "photo-remove") {
    imageRemoved = true;
    showDialogImage("");
    $("#item-form").elements.imageUrl.value = "";
    return;
  }
  if (btn.id === "item-cancel") { editing = null; return $("#item-dialog").close(); }

  const { action, list, item, name } = btn.dataset;
  switch (action) {
    case "pick-me": me = name; safeSet(ME_KEY, me); view = "mine"; return render();
    case "add-item": return openItemDialog(list);
    case "edit-item": return openItemDialog(list, item);
    case "delete-item":
      ask({ title: `Retirer « ${state.items[item]?.title} » ?`, ok: "Retirer" })
        .then((yes) => yes && run(() => store.deleteItem(item)));
      return;
    case "rename-list": {
      ask({ title: "Renommer la lettre", input: state.lists[list]?.title, ok: "Enregistrer" })
        .then((t) => t && t.trim() && run(() => store.updateList(list, { title: t.trim() })));
      return;
    }
    case "delete-list":
      ask({ title: `Supprimer « ${state.lists[list]?.title} » et tous ses cadeaux ?`, ok: "Supprimer" })
        .then((yes) => yes && run(() => store.deleteList(list)));
      return;
    case "claim": {
      // Show the reservation straight away; the database confirms a moment later.
      pendingClaims.add(item);
      render();
      return run(async () => {
        try {
          await store.claim(item, me);
          toast("C'est noté ! Ce cadeau est dans ta hotte 🎁");
        } finally {
          pendingClaims.delete(item);
          render();
        }
      });
    }
    case "unclaim": return run(async () => { await store.unclaim(item, me); toast("Cadeau libéré."); });
  }
});


document.addEventListener("input", (e) => {
  if (e.target.name === "imageUrl" && safeImg(e.target.value.trim())) showDialogImage(e.target.value.trim());
});

document.addEventListener("change", async (e) => {
  if (e.target.id === "sort-select") { sortBy = e.target.value; safeSet("wishlist:sort", sortBy); return render(); }
  if (e.target.id === "theme-select") { themeFilter = e.target.value; return render(); }
  if (e.target.name === "imageUrl") {
    const v = e.target.value.trim();
    if (!v || safeImg(v)) showDialogImage(v);
    else toast("Colle un lien qui commence par https://");
  }
});

// A picture link that fails to load falls back to the letter tile.
document.addEventListener("error", (e) => {
  const img = e.target;
  if (img.tagName === "IMG" && img.classList.contains("thumb")) img.outerHTML = thumbTile(img.dataset.title);
}, true);

document.addEventListener("submit", (e) => {
  const f = e.target;
  if (f.id === "new-member-form") {
    e.preventDefault();
    const name = $("#new-member-name").value.trim();
    if (!name) return;
    const existing = memberNames().find((n) => sameName(n, name));
    run(async () => {
      if (!existing) await store.addMember(name);
      me = existing || name;
      safeSet(ME_KEY, me);
      render();
    });
  } else if (f.dataset.form === "new-list") {
    e.preventDefault();
    const title = f.elements.title.value.trim();
    if (title) run(() => store.addList(me, title, f.elements.occasion.value.trim()));
  } else if (f.id === "item-form") {
    e.preventDefault();
    const data = {
      title: f.elements.title.value.trim(),
      link: f.elements.link.value.trim(),
      price: f.elements.price.value === "" ? "" : Number(f.elements.price.value),
      notes: f.elements.notes.value.trim(),
      tags: [...f.querySelectorAll('input[name="tag"]:checked')].map((c) => c.value),
      image: safeImg(pendingImage),
      ...(imageRemoved && !pendingImage ? { imageTried: true } : {}),
    };
    const { listId, itemId } = editing || {};
    $("#item-dialog").close();
    editing = null;
    if (!data.title || !listId) return;
    run(async () => {
      const id = itemId || (await store.addItem(listId, data));
      if (itemId) await store.updateItem(itemId, data);
    });
  }
});

// --------------------------------------------------------------------- boot
(async () => {
  try {
    store = await createStore();
  } catch (e) {
    console.error(e);
    document.body.insertAdjacentHTML("beforeend", `<p class="card narrow">Impossible de rejoindre l'atelier. Vérifie ta connexion et recharge la page.</p>`);
    return;
  }
  if (store.mode === "demo") {
    const b = $("#mode-banner");
    b.hidden = false;
    b.innerHTML = `<strong>Mode démo :</strong> les données restent dans ce navigateur. Ouvre la page dans un deuxième onglet avec un autre prénom pour voir les réservations en direct.`;
  }
  // Show the story open on the first visit, folded afterwards.
  const story = $("#story");
  if (story) {
    if (safeGet("wishlist:storySeen")) story.open = false;
    safeSet("wishlist:storySeen", "1");
  }
  store.subscribe((s) => { state = s; render(); });
  await translateOriginalGifts();
  await tagOriginalGifts();
  fillMissingPictures();
})();

// One-time switch of Simon's original English gift names to French (the list
// was first created in English). Only exact matches change, so anything
// edited by hand is left alone.
const FR_TITLES = new Map([["Golf outfit: long-sleeve polo + pants (technical fabric, hot climate)", "Tenue de golf : polo manches longues + pantalon (tissu technique, climat chaud)"], ["Laptop to run Claude to its full potential", "Un ordinateur pour faire tourner Claude à fond"], ["Horace fragrance", "Parfum Horace"], ["Horace skincare products", "Soins pour la peau Horace"], ["Gustave Fayet exhibition catalogue, Fondation Louis Vuitton (French edition)", "Catalogue de l'exposition Gustave Fayet, Fondation Louis Vuitton (en français)"], ["On or Nike sneakers", "Baskets On ou Nike"], ["Paraboot shoes", "Chaussures Paraboot"], ["R.M. Williams boots", "Bottines R.M. Williams"], ["Sebago loafers", "Mocassins Sebago"], ["Lululemon travel outfit", "Tenue de voyage Lululemon"], ["Monocle Thailand handbook", "Guide Monocle de la Thaïlande"], ["WHOOP membership", "Abonnement WHOOP"], ["Le conflit israélo-palestinien en 100 questions (book)", "Le conflit israélo-palestinien en 100 questions (livre)"], ["La Chine en 100 questions (book)", "La Chine en 100 questions (livre)"], ["Simon's birthday", "Anniversaire de Simon"]]);
const FR_NOTES = new Map([["Lululemon or equivalent", "Lululemon ou équivalent"], ["e.g. MacBook Pro 14\"", "ex. MacBook Pro 14\""], ["In French", "En français"], ["e.g. the Michael derby", "ex. le derby Michael"], ["e.g. Comfort Craftsman", "ex. Comfort Craftsman"], ["e.g. Classic Dan penny loafer", "ex. le mocassin Classic Dan"], ["12 months", "12 mois"], ["Tallandier, French", "Tallandier"], ["Tallandier, French", "Tallandier"]]);
async function translateOriginalGifts() {
  for (const [id, it] of Object.entries(state.items)) {
    const title = FR_TITLES.get(it.title);
    const notes = FR_NOTES.get(it.notes);
    if (title || notes) {
      await store.updateItem(id, { ...(title && { title }), ...(notes && { notes }) }).catch(() => {});
    }
  }
  for (const [id, l] of Object.entries(state.lists)) {
    const title = FR_TITLES.get(l.title);
    if (title) await store.updateList(id, { title, occasion: l.occasion === "Birthday" ? "Anniversaire" : l.occasion }).catch(() => {});
  }
}

// Once per visit, look up pictures for gifts that have a shop link but no
// picture yet. A gift is only tried once (imageTried), so this stays cheap.
async function fillMissingPictures() {
  // Only my own gifts, a few per visit, so the free daily limit stays
  // available for the "Remplir" button.
  const todo = Object.entries(state.items)
    .filter(([, it]) => it.link && !it.image && !it.imageTried && sameName(state.lists[it.listId]?.owner, me))
    .slice(0, 5);
  for (const [id] of todo) {
    const img = await findImageForLink(state.items[id]?.link);
    if (img === null) return; // offline or blocked: try again next visit
    const it = state.items[id];
    if (it && !it.image) await store.updateItem(id, img ? { image: img } : { imageTried: true }).catch(() => {});
  }
}

// One-time themes for Simon's original gifts. Only gifts that have never had
// themes set (no tags field at all) are touched.
const ORIGINAL_TAGS = [
  [/^Tenue de golf/, ["sport", "mode"]], [/^Un ordinateur/, ["tech"]], [/^Apple Pencil/, ["tech"]],
  [/^Parfum Horace/, ["beaute"]], [/^Soins pour la peau Horace/, ["beaute"]], [/^Catalogue de l'exposition/, ["culture"]],
  [/^Baskets On ou Nike/, ["sport", "mode"]], [/^Chaussures Paraboot/, ["mode"]], [/^Bottines R\.M\. Williams/, ["mode"]],
  [/^Mocassins Sebago/, ["mode"]], [/^Tenue de voyage Lululemon/, ["mode", "voyage"]], [/^Guide Monocle/, ["culture", "voyage"]],
  [/^Apple Watch/, ["tech", "sport"]], [/^Abonnement WHOOP/, ["tech", "sport"]], [/en 100 questions/, ["culture"]],
];
async function tagOriginalGifts() {
  for (const [id, it] of Object.entries(state.items)) {
    if (it.tags !== undefined) continue;
    const hit = ORIGINAL_TAGS.find(([re]) => re.test(it.title || ""));
    if (hit) await store.updateItem(id, { tags: hit[1] }).catch(() => {});
  }
}
