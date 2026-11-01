import { createStore, TakenError } from "./store.js";
import { CURRENCY, FAMILY_ID } from "./config.js";

const $ = (sel) => document.querySelector(sel);
const ME_KEY = `wishlist:${FAMILY_ID}:me`;
const money = new Intl.NumberFormat(undefined, { style: "currency", currency: CURRENCY });

let store;
let state = { members: {}, lists: {}, items: {}, claims: {} };
let me = safeGet(ME_KEY);
let view = "mine";
let editing = null; // { listId, itemId? } while the item dialog is open

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
function render() {
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
  $("#member-buttons").innerHTML = memberNames()
    .map((n) => `<button class="secondary" data-action="pick-me" data-name="${esc(n)}">${esc(n)}</button>`)
    .join("") || `<p class="muted">No one here yet. Be the first!</p>`;
}

function renderMine() {
  const lists = listsOf(me);
  $("#view-mine").innerHTML = `
    <p class="muted">Add what you'd love to get. Your family sees these lists, but
    <strong>you never see who's buying what</strong>, so the surprise is kept.</p>
    ${lists.map(([id, l]) => `
      <article class="card">
        <div class="list-head">
          <div>
            <h2>${esc(l.title)}</h2>
            ${l.occasion ? `<span class="tag">${esc(l.occasion)}</span>` : ""}
          </div>
          <div class="row">
            <button class="link" data-action="rename-list" data-list="${id}">Rename</button>
            <button class="link danger" data-action="delete-list" data-list="${id}">Delete list</button>
          </div>
        </div>
        <ul class="items">
          ${itemsOf(id).map(([itemId, it]) => `
            <li class="item">
              ${itemInfo(it)}
              <div class="actions">
                <button class="link" data-action="edit-item" data-list="${id}" data-item="${itemId}">Edit</button>
                <button class="link danger" data-action="delete-item" data-item="${itemId}">Remove</button>
              </div>
            </li>`).join("") || `<li class="empty">No gifts yet.</li>`}
        </ul>
        <button data-action="add-item" data-list="${id}">+ Add a gift</button>
      </article>`).join("")}
    <form class="card row" data-form="new-list">
      <input name="title" placeholder="New list, e.g. ${esc(me)}'s Christmas" required maxlength="60" />
      <input name="occasion" placeholder="Occasion (optional)" maxlength="30" />
      <button type="submit">Create list</button>
    </form>`;
}

function itemInfo(it) {
  const url = safeUrl(it.link);
  const title = url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(it.title)} ↗</a>` : esc(it.title);
  return `
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
          <span class="muted">${open} of ${items.length} still available</span>
        </div>
        <ul class="items">
          ${items.map(([itemId, it]) => {
            const c = state.claims[itemId];
            const mineClaim = c && c.by === me;
            const cls = c ? (mineClaim ? "item mine" : "item taken") : "item";
            const action = !c
              ? `<button data-action="claim" data-item="${itemId}">I'll gift this</button>`
              : mineClaim
                ? `<span class="status ok">🎁 You're gifting this</span><button class="link" data-action="unclaim" data-item="${itemId}">Release</button>`
                : `<span class="status">Taken by ${esc(c.by)}</span>`;
            return `<li class="${cls}">${itemInfo(it)}<div class="actions">${action}</div></li>`;
          }).join("") || `<li class="empty">Nothing on this list yet.</li>`}
        </ul>
      </article>`;
  }));
  $("#view-family").innerHTML = blocks.join("") ||
    `<p class="card muted">No one else has shared a list yet. Send them the link!</p>`;
}

function renderGifting(mine) {
  let total = 0;
  const rows = mine.map(([itemId]) => {
    const it = state.items[itemId];
    const l = state.lists[it.listId] || {};
    total += Number(it.price) || 0;
    return `<li class="item mine">${itemInfo(it)}
      <div class="actions"><span class="tag">for ${esc(l.owner || "?")}</span>
      <button class="link" data-action="unclaim" data-item="${itemId}">Release</button></div></li>`;
  });
  $("#view-gifting").innerHTML = `
    <article class="card">
      <div class="list-head"><h2>Gifts you're buying</h2><strong>${money.format(total)}</strong></div>
      <ul class="items">${rows.join("") || `<li class="empty">You haven't picked anything yet. Head to Family lists.</li>`}</ul>
    </article>`;
}

// ------------------------------------------------------------------ actions
async function run(fn) {
  try { await fn(); } catch (e) {
    if (e instanceof TakenError) toast(`Too late! ${e.by} just took that one.`);
    else { console.error(e); toast("Something went wrong. Please try again."); }
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

function openItemDialog(listId, itemId) {
  editing = { listId, itemId };
  const f = $("#item-form");
  const it = itemId ? state.items[itemId] : {};
  f.elements.title.value = it.title || "";
  f.elements.link.value = it.link || "";
  f.elements.price.value = it.price ?? "";
  f.elements.notes.value = it.notes || "";
  $("#item-dialog-title").textContent = itemId ? "Edit gift" : "Add a gift";
  $("#item-dialog").showModal();
  f.elements.title.focus();
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action], .tab, #switch-user, #item-cancel");
  if (!btn) return;
  if (btn.classList.contains("tab")) { view = btn.dataset.view; return render(); }
  if (btn.id === "switch-user") { me = null; safeSet(ME_KEY, null); return render(); }
  if (btn.id === "item-cancel") { editing = null; return $("#item-dialog").close(); }

  const { action, list, item, name } = btn.dataset;
  switch (action) {
    case "pick-me": me = name; safeSet(ME_KEY, me); view = "mine"; return render();
    case "add-item": return openItemDialog(list);
    case "edit-item": return openItemDialog(list, item);
    case "delete-item":
      ask({ title: `Remove "${state.items[item]?.title}"?`, ok: "Remove" })
        .then((yes) => yes && run(() => store.deleteItem(item)));
      return;
    case "rename-list": {
      ask({ title: "Rename list", input: state.lists[list]?.title, ok: "Save" })
        .then((t) => t && t.trim() && run(() => store.updateList(list, { title: t.trim() })));
      return;
    }
    case "delete-list":
      ask({ title: `Delete "${state.lists[list]?.title}" and all its gifts?`, ok: "Delete list" })
        .then((yes) => yes && run(() => store.deleteList(list)));
      return;
    case "claim": return run(async () => { await store.claim(item, me); toast("It's yours to gift 🎉"); });
    case "unclaim": return run(() => store.unclaim(item, me));
  }
});

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
    };
    const { listId, itemId } = editing || {};
    $("#item-dialog").close();
    editing = null;
    if (!data.title || !listId) return;
    run(() => (itemId ? store.updateItem(itemId, data) : store.addItem(listId, data)));
  }
});

// --------------------------------------------------------------------- boot
(async () => {
  try {
    store = await createStore();
  } catch (e) {
    console.error(e);
    document.body.insertAdjacentHTML("beforeend", `<p class="card narrow">Couldn't connect to the database. Check config.js.</p>`);
    return;
  }
  if (store.mode === "demo") {
    const b = $("#mode-banner");
    b.hidden = false;
    b.innerHTML = `<strong>Demo mode:</strong> data lives in this browser only. Open this page in a second tab, pick a different name, and watch claims update live. Connect Firebase in <code>config.js</code> to share with family.`;
  }
  store.subscribe((s) => { state = s; render(); });
})();
