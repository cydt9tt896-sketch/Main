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
          ${itemsOf(id).map(([itemId, it]) => `
            <li class="item">
              ${itemInfo(it)}
              <div class="actions">
                <button class="link" data-action="edit-item" data-list="${id}" data-item="${itemId}">Modifier</button>
                <button class="link danger" data-action="delete-item" data-item="${itemId}">Retirer</button>
              </div>
            </li>`).join("") || `<li class="empty">Aucun cadeau pour l'instant. Ajoute ton premier vœu !</li>`}
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
    </div>
    <div class="price">${fmtPrice(it.price)}</div>`;
}

function renderFamily() {
  const owners = memberNames().filter((n) => !sameName(n, me));
  const blocks = owners.flatMap((owner) => listsOf(owner).map(([id, l]) => {
    const items = itemsOf(id);
    const open = items.filter(([itemId]) => !state.claims[itemId]).length;
    return `
      <article class="card">
        <div class="list-head">
          <div>
            <h2>${esc(l.title)}</h2>
            <span class="tag">${esc(owner)}</span>
            ${l.occasion ? `<span class="tag">${esc(l.occasion)}</span>` : ""}
          </div>
          <span class="muted">${open} sur ${items.length} encore ${open > 1 ? "disponibles" : "disponible"}</span>
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
          }).join("") || `<li class="empty">Rien sur cette lettre pour l'instant.</li>`}
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

// Shrink a picked photo so it stays small enough to store with the gift.
function resizeImage(file, max = 480) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Pas une image")); };
    img.src = url;
  });
}

// Look up a product photo from a shop link with Microlink's free link-preview
// API (no key needed, about 50 lookups a day). Returns "" when nothing is
// found, or null when the lookup couldn't run (offline, blocked, quota).
async function findImageForLink(link) {
  if (!safeUrl(link)) return "";
  try {
    const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(link)}`);
    if (res.status === 429) return null; // daily free quota used up
    const json = await res.json();
    const img = json?.data?.image?.url || json?.data?.logo?.url || "";
    return /^https:\/\//i.test(img) ? img : "";
  } catch { return null; }
}

let pendingImage = ""; // picture shown in the gift dialog
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
  f.elements.photo.value = "";
  f.elements.imageUrl.value = it.image && !it.image.startsWith("data:") ? it.image : "";
  showDialogImage(it.image);
  $("#item-dialog-title").textContent = itemId ? "Modifier le cadeau" : "Ajouter un cadeau";
  $("#item-dialog").showModal();
  f.elements.title.focus();
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action], .tab, #switch-user, #item-cancel, #photo-remove, #photo-find");
  if (!btn) return;
  if (btn.classList.contains("tab")) { view = btn.dataset.view; return render(); }
  if (btn.id === "switch-user") { me = null; safeSet(ME_KEY, null); return render(); }
  if (btn.id === "photo-find") {
    const f = $("#item-form");
    btn.disabled = true;
    btn.textContent = "Recherche…";
    findImageForLink(f.elements.link.value.trim()).then((img) => {
      btn.disabled = false;
      btn.textContent = "Trouver la photo depuis le lien";
      if (img) { showDialogImage(img); f.elements.imageUrl.value = img; }
      else if (img === null) toast("Impossible de chercher une photo pour l'instant. Envoie plutôt une capture d'écran.");
      else toast("Aucune photo trouvée pour ce lien. Envoie plutôt une capture d'écran.");
    });
    return;
  }
  if (btn.id === "photo-remove") {
    showDialogImage("");
    $("#item-form").elements.photo.value = "";
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

document.addEventListener("change", async (e) => {
  if (e.target.name === "photo" && e.target.files?.[0]) {
    try {
      showDialogImage(await resizeImage(e.target.files[0]));
      e.target.form.elements.imageUrl.value = "";
    } catch { toast("Ce fichier n'est pas une image lisible. Essaie un JPG ou un PNG."); }
  } else if (e.target.name === "imageUrl") {
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
      image: safeImg(pendingImage),
    };
    const { listId, itemId } = editing || {};
    $("#item-dialog").close();
    editing = null;
    if (!data.title || !listId) return;
    run(async () => {
      const id = itemId || (await store.addItem(listId, data));
      if (itemId) await store.updateItem(itemId, data);
      if (!data.image && data.link) {
        const img = await findImageForLink(data.link);
        if (img && state.items[id] && !state.items[id].image) await store.updateItem(id, { image: img });
      }
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
  const todo = Object.entries(state.items).filter(([, it]) => it.link && !it.image && !it.imageTried).slice(0, 20);
  for (const [id] of todo) {
    const img = await findImageForLink(state.items[id]?.link);
    if (img === null) return; // offline or blocked: try again next visit
    const it = state.items[id];
    if (it && !it.image) await store.updateItem(id, img ? { image: img } : { imageTried: true }).catch(() => {});
  }
}
