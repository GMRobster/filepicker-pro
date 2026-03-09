/**
 * Asset Navigator — main.mjs  v1.1
 * Schnellzugriff auf Assets für FoundryVTT
 * ─────────────────────────────────────────
 * Features:
 *  • Quick Access Overlay (Ctrl+Space, konfigurierbar)
 *  • Favoriten-Ordner + Favoriten-Bilder (persistent)
 *  • Zuletzt verwendete Pfade & Bilder (auto-getrackt)
 *  • Volltext-Suche über alle gemerkten Einträge
 *  • Bookmark-Leiste direkt im FilePicker
 *  • Rechtsklick-Kontextmenü im FilePicker
 *  • Token Image Quick-Picker im Actor-Sheet (★ NEU)
 *  • Zuletzt verwendete Token/Actor-Bilder (★ NEU)
 *  • Auto-Tracking wenn Actor/Token-Bild gesetzt wird (★ NEU)
 */

const MODULE_ID = "filepicker-pro";
const MAX_RECENT_DEFAULT = 20;

// ════════════════════════════════════════
//  Data helpers — Ordner-Favoriten
// ════════════════════════════════════════

function getFavorites() {
  return game.settings.get(MODULE_ID, "favorites") ?? [];
}
function saveFavorites(list) {
  return game.settings.set(MODULE_ID, "favorites", list);
}
function isFavorite(path) {
  return getFavorites().some(f => f.path === path);
}
async function toggleFavorite(path, label = null) {
  const name = label ?? pathBasename(path);
  let favs = getFavorites();
  if (isFavorite(path)) {
    favs = favs.filter(f => f.path !== path);
  } else {
    favs.push({ path, name });
  }
  await saveFavorites(favs);
  refreshPickerBar();
  if (ANOverlay.instance) ANOverlay.instance.render();
}

// ════════════════════════════════════════
//  Data helpers — Verlauf (Ordner)
// ════════════════════════════════════════

function getRecent() {
  return game.settings.get(MODULE_ID, "recent") ?? [];
}
async function pushRecent(path, kind = "folder") {
  if (!path) return;
  const max = game.settings.get(MODULE_ID, "maxRecent") ?? MAX_RECENT_DEFAULT;
  let recent = getRecent().filter(r => r.path !== path);
  recent.unshift({ path, name: pathBasename(path), kind, ts: Date.now() });
  if (recent.length > max) recent = recent.slice(0, max);
  await game.settings.set(MODULE_ID, "recent", recent);
}

// ════════════════════════════════════════
//  Data helpers — Zuletzt verwendete Bilder
// ════════════════════════════════════════

function getRecentImages() {
  return game.settings.get(MODULE_ID, "recentImages") ?? [];
}
async function pushRecentImage(path) {
  if (!path || path === "icons/svg/mystery-man.svg") return;
  const max = game.settings.get(MODULE_ID, "maxRecent") ?? MAX_RECENT_DEFAULT;
  let imgs = getRecentImages().filter(r => r.path !== path);
  imgs.unshift({ path, name: pathBasename(path), ts: Date.now() });
  if (imgs.length > max) imgs = imgs.slice(0, max);
  await game.settings.set(MODULE_ID, "recentImages", imgs);
}

// ════════════════════════════════════════
//  Utility
// ════════════════════════════════════════

function pathBasename(p) {
  if (!p) return "";
  return p.split("/").filter(Boolean).pop() ?? p;
}
function pathDirname(p) {
  if (!p) return "";
  const parts = p.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}
function guessType(path) {
  if (!path) return "folder";
  const ext = path.split(".").pop()?.toLowerCase();
  if (["png","jpg","jpeg","gif","webp","svg","avif"].includes(ext)) return "image";
  if (["mp3","ogg","wav","flac","m4a","opus"].includes(ext))        return "audio";
  if (["mp4","webm","ogv"].includes(ext))                           return "video";
  return "folder";
}
function isImagePath(path) {
  return guessType(path) === "image";
}

// ════════════════════════════════════════
//  Token Image Quick-Picker
// ════════════════════════════════════════

class ANImagePicker {
  static open(onSelect, current = "") {
    document.getElementById("an-img-picker")?.remove();
    const wrap = document.createElement("div");
    wrap.id = "an-img-picker";
    wrap.innerHTML = ANImagePicker._buildHTML(current);
    document.body.appendChild(wrap);
    ANImagePicker._activateListeners(wrap, onSelect, current);
    wrap.querySelector(".an-imgpicker-search")?.focus();
  }

  static _getImageItems(query = "") {
    const q = query.toLowerCase();
    const favImgs    = getFavorites().filter(f => isImagePath(f.path)).map(f => ({ ...f, kind: "fav" }));
    const recentImgs = getRecentImages().map(r => ({ ...r, kind: "recent" }));
    const favFolders = getFavorites().filter(f => !isImagePath(f.path)).map(f => ({ ...f, kind: "folder" }));
    const seen = new Set();
    const imgs = [...favImgs, ...recentImgs].filter(item => {
      if (seen.has(item.path)) return false;
      seen.add(item.path);
      return true;
    });
    const filtered = q
      ? imgs.filter(i => i.path.toLowerCase().includes(q) || i.name.toLowerCase().includes(q))
      : imgs;
    return { images: filtered, folders: favFolders };
  }

  static _buildHTML(current) {
    const { images, folders } = ANImagePicker._getImageItems();
    const folderChips = folders.map(f =>
      `<span class="an-bookmark-chip an-imgpicker-folder" data-path="${f.path}" title="${f.path}">
        <i class="fas fa-folder"></i>${f.name}
       </span>`
    ).join("") || `<span style="font-size:10px;color:#88887090;">Keine Ordner-Favoriten</span>`;

    const imgItems = images.length === 0
      ? `<div class="an-empty">Noch keine Bilder. Sie werden automatisch gespeichert sobald du Actor- oder Token-Bilder setzt.</div>`
      : images.map(img => ANImagePicker._buildImgItem(img, img.path === current)).join("");

    return `
      <div id="an-img-picker-backdrop" style="
        position:fixed;inset:0;z-index:10001;display:flex;align-items:flex-start;
        justify-content:center;padding-top:6vh;
        background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);">
        <div class="an-panel" style="width:min(720px,96vw);max-height:80vh;">
          <div style="display:flex;align-items:center;gap:10px;padding:12px 16px 8px;border-bottom:1px solid #2e2e4e;">
            <i class="fas fa-image" style="color:#b090ff;font-size:16px;"></i>
            <span style="font-size:14px;font-weight:700;color:#e0e0f0;flex:1;">Token / Actor Bild wählen</span>
            <button class="an-item-btn an-imgpicker-close" style="opacity:1;font-size:16px;padding:4px 8px;">✕</button>
          </div>
          <div class="an-search-wrap" style="border-bottom:1px solid #2e2e4e;">
            <i class="fas fa-search"></i>
            <input class="an-imgpicker-search" type="text" placeholder="Bild suchen..." autocomplete="off"
              style="flex:1;background:transparent;border:none;outline:none;color:#e0e0f0;font-size:14px;font-family:inherit;" />
            <button class="an-item-btn an-imgpicker-filepicker"
              style="opacity:1;white-space:nowrap;font-size:11px;padding:3px 10px;background:#2e2e50;border-radius:4px;color:#c0b0ff;">
              <i class="fas fa-folder-open"></i> Durchsuchen
            </button>
          </div>
          <div style="padding:6px 12px;border-bottom:1px solid #2e2e4e;display:flex;flex-wrap:wrap;gap:4px;align-items:center;">
            <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#50508090;margin-right:4px;">
              <i class="fas fa-star" style="color:#f0b060;"></i> Ordner
            </span>
            ${folderChips}
          </div>
          <div class="an-imgpicker-grid" style="
            flex:1;overflow-y:auto;padding:10px 12px;
            display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px;">
            ${imgItems}
          </div>
        </div>
      </div>`;
  }

  static _buildImgItem(img, isCurrent) {
    const fav = isFavorite(img.path);
    return `
      <div class="an-img-card ${isCurrent ? "an-img-card--current" : ""}" data-path="${img.path}" title="${img.path}" style="
        position:relative;cursor:pointer;border-radius:6px;overflow:hidden;
        border:2px solid ${isCurrent ? "#b090ff" : "transparent"};
        background:#0e0e1e;transition:border-color .15s,transform .12s;">
        <img src="${img.path}" loading="lazy" style="width:100%;aspect-ratio:1;object-fit:cover;display:block;"
          onerror="this.src='icons/svg/mystery-man.svg'" />
        <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.75));
          padding:14px 4px 3px;font-size:9px;color:#ccc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;">
          ${img.name}
        </div>
        <button class="an-img-fav-btn ${fav ? "an-img-fav-active" : ""}" data-path="${img.path}" style="
          position:absolute;top:3px;right:3px;background:rgba(0,0,0,.5);border:none;border-radius:50%;
          width:20px;height:20px;display:flex;align-items:center;justify-content:center;
          cursor:pointer;font-size:10px;color:${fav ? "#f0b060" : "#ffffff90"};transition:color .15s;"
          title="${fav ? "Favorit entfernen" : "Als Favorit merken"}">
          <i class="fas fa-star"></i>
        </button>
      </div>`;
  }

  static _activateListeners(wrap, onSelect, current) {
    const close = () => wrap.remove();
    wrap.querySelector(".an-imgpicker-close")?.addEventListener("click", close);
    wrap.querySelector("#an-img-picker-backdrop")?.addEventListener("click", ev => {
      if (ev.target === wrap.querySelector("#an-img-picker-backdrop")) close();
    });

    wrap.querySelector(".an-imgpicker-search")?.addEventListener("input", ev => {
      const { images } = ANImagePicker._getImageItems(ev.target.value);
      const grid = wrap.querySelector(".an-imgpicker-grid");
      if (!grid) return;
      grid.innerHTML = images.length === 0
        ? `<div class="an-empty" style="grid-column:1/-1;">Keine Ergebnisse.</div>`
        : images.map(img => ANImagePicker._buildImgItem(img, img.path === current)).join("");
      ANImagePicker._bindGridEvents(grid, onSelect, wrap, current);
    });

    wrap.querySelector(".an-imgpicker-filepicker")?.addEventListener("click", () => {
      close();
      const fp = new FilePicker({
        type: "image",
        current: getFavorites().find(f => !isImagePath(f.path))?.path ?? "",
        callback: async path => { await pushRecentImage(path); onSelect(path); },
      });
      fp.render(true);
    });

    wrap.querySelectorAll(".an-imgpicker-folder").forEach(chip => {
      chip.addEventListener("click", () => {
        close();
        const fp = new FilePicker({
          type: "image", current: chip.dataset.path,
          callback: async path => { await pushRecentImage(path); onSelect(path); },
        });
        fp.render(true);
      });
    });

    const grid = wrap.querySelector(".an-imgpicker-grid");
    if (grid) ANImagePicker._bindGridEvents(grid, onSelect, wrap, current);
  }

  static _bindGridEvents(grid, onSelect, wrap, current) {
    grid.querySelectorAll(".an-img-card").forEach(card => {
      card.addEventListener("click", async ev => {
        if (ev.target.closest(".an-img-fav-btn")) return;
        const path = card.dataset.path;
        await pushRecentImage(path);
        onSelect(path);
        wrap.remove();
      });
      card.addEventListener("mouseenter", () => {
        card.style.transform = "scale(1.04)";
        if (card.dataset.path !== current) card.style.borderColor = "#7060a0";
      });
      card.addEventListener("mouseleave", () => {
        card.style.transform = "";
        card.style.borderColor = card.dataset.path === current ? "#b090ff" : "transparent";
      });
    });
    grid.querySelectorAll(".an-img-fav-btn").forEach(btn => {
      btn.addEventListener("click", async ev => {
        ev.stopPropagation();
        await toggleFavorite(btn.dataset.path);
        const isFav = isFavorite(btn.dataset.path);
        btn.style.color = isFav ? "#f0b060" : "#ffffff90";
        btn.classList.toggle("an-img-fav-active", isFav);
      });
    });
  }
}

// ════════════════════════════════════════
//  Actor Sheet Integration
// ════════════════════════════════════════

function injectActorSheetButton(app, html) {
  const imgSelectors = [
    "img.actor-image", "img.profile-img", "img.actor-portrait",
    ".sheet-header img[data-edit]", "img[data-edit='img']",
  ];
  let imgEl = null;
  for (const sel of imgSelectors) {
    imgEl = html[0]?.querySelector(sel);
    if (imgEl) break;
  }
  if (!imgEl) return;
  if (imgEl.parentElement?.querySelector(".an-actor-btn")) return;

  const wrapper = imgEl.parentElement;
  if (wrapper) wrapper.style.position = "relative";

  const btn = document.createElement("button");
  btn.className = "an-actor-btn";
  btn.type = "button";
  btn.title = "Asset Navigator — Bild Schnellzugriff";
  btn.innerHTML = '<i class="fas fa-bolt"></i>';
  btn.style.cssText = `
    position:absolute;bottom:4px;right:4px;z-index:10;
    background:rgba(20,16,40,0.82);border:1px solid rgba(176,144,255,0.45);
    border-radius:6px;color:#c0b0ff;cursor:pointer;padding:4px 7px;
    font-size:12px;line-height:1;backdrop-filter:blur(2px);
    transition:background .15s,border-color .15s;`;
  btn.addEventListener("mouseenter", () => {
    btn.style.background = "rgba(80,60,140,0.9)";
    btn.style.borderColor = "rgba(176,144,255,0.8)";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = "rgba(20,16,40,0.82)";
    btn.style.borderColor = "rgba(176,144,255,0.45)";
  });
  btn.addEventListener("click", ev => {
    ev.preventDefault(); ev.stopPropagation();
    const actor = app.actor ?? app.document;
    const currentImg = actor?.img ?? imgEl.src ?? "";
    ANImagePicker.open(async chosenPath => {
      if (actor?.update) await actor.update({ img: chosenPath });
      imgEl.src = chosenPath;
      await pushRecentImage(chosenPath);
    }, currentImg);
  });

  wrapper?.appendChild(btn);
}

function injectTokenConfigButton(app, html) {
  const imgInput = html[0]?.querySelector('input[name="texture.src"]')
    ?? html[0]?.querySelector('input[name="img"]');
  if (!imgInput) return;
  if (imgInput.parentElement?.querySelector(".an-token-btn")) return;

  const btn = document.createElement("button");
  btn.className = "an-token-btn";
  btn.type = "button";
  btn.title = "Asset Navigator — Token-Bild Schnellzugriff";
  btn.innerHTML = '<i class="fas fa-bolt"></i> Schnellzugriff';
  btn.style.cssText = `
    margin-left:4px;background:rgba(80,60,140,0.15);
    border:1px solid rgba(176,144,255,0.35);border-radius:4px;
    color:#7060a0;cursor:pointer;padding:3px 8px;font-size:11px;
    white-space:nowrap;transition:background .15s;`;
  btn.addEventListener("click", ev => {
    ev.preventDefault(); ev.stopPropagation();
    ANImagePicker.open(async chosenPath => {
      imgInput.value = chosenPath;
      const preview = html[0]?.querySelector(".token-image img")
        ?? html[0]?.querySelector("img.token-image");
      if (preview) preview.src = chosenPath;
      imgInput.dispatchEvent(new Event("change", { bubbles: true }));
      await pushRecentImage(chosenPath);
    }, imgInput.value ?? "");
  });
  imgInput.insertAdjacentElement("afterend", btn);
}

// Hooks für Actor / Token Sheets
Hooks.on("renderActorSheet", (app, html) => injectActorSheetButton(app, html));
Hooks.on("renderTokenConfig", (app, html) => injectTokenConfigButton(app, html));

// Auto-Tracking
Hooks.on("updateActor", (actor, changes) => { if (changes.img) pushRecentImage(changes.img); });
Hooks.on("updateToken", (token, changes) => {
  const src = changes?.texture?.src ?? changes?.img;
  if (src) pushRecentImage(src);
});

// ════════════════════════════════════════
//  Haupt-Overlay
// ════════════════════════════════════════

class ANOverlay extends Application {
  static instance = null;

  constructor() {
    super();
    ANOverlay.instance = this;
    this._tab = "favorites";
    this._query = "";
    this._focusIdx = 0;
    this._searchResults = [];
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "filepicker-pro-overlay", popOut: false, resizable: false,
    });
  }

  _getItems() {
    if (this._tab === "favorites") return getFavorites().map(f => ({ ...f, type: guessType(f.path) }));
    if (this._tab === "recent")    return getRecent().map(r => ({ ...r, type: guessType(r.path) }));
    if (this._tab === "images")    return getRecentImages().map(r => ({ ...r, type: "image" }));
    if (this._tab === "search")    return this._searchResults;
    return [];
  }

  async render() {
    let el = document.getElementById("filepicker-pro-overlay");
    if (!el) {
      el = document.createElement("div");
      el.id = "filepicker-pro-overlay";
      document.body.appendChild(el);
    }
    el.innerHTML = this._buildHTML();
    el.classList.remove("hidden");
    this._activateListeners(el);
    el.querySelector(".an-search-input")?.focus();
    return this;
  }

  close() { document.getElementById("filepicker-pro-overlay")?.classList.add("hidden"); }

  toggle() {
    const el = document.getElementById("filepicker-pro-overlay");
    if (!el || el.classList.contains("hidden")) this.render();
    else this.close();
  }

  _buildHTML() {
    const items = this._getItems();
    const L = k => game.i18n.localize(k);
    const tabs = [
      { id: "favorites", icon: "fa-star",     label: L("ASSETNAVIGATOR.Favorites") },
      { id: "recent",    icon: "fa-clock",    label: L("ASSETNAVIGATOR.Recent") },
      { id: "images",    icon: "fa-portrait", label: "Token-Bilder" },
    ];
    const tabsHTML = tabs.map(t =>
      `<div class="an-tab ${this._tab === t.id ? "active" : ""}" data-tab="${t.id}">
        <i class="fas ${t.icon}"></i> ${t.label}
       </div>`
    ).join("");

    const emptyMsgs = {
      favorites: L("ASSETNAVIGATOR.NoFavorites"),
      recent:    L("ASSETNAVIGATOR.NoRecent"),
      images:    "Noch keine Bilder. Sie werden automatisch gespeichert wenn du Actor/Token-Bilder setzt.",
      search:    "Keine Ergebnisse.",
    };
    const itemsHTML = items.length === 0
      ? `<div class="an-empty">${emptyMsgs[this._tab] ?? ""}</div>`
      : items.map((item, idx) => this._buildItem(item, idx)).join("");

    let extra = "";
    if (this._tab === "recent" && items.length > 0) {
      extra = `<div class="an-section-header" style="display:flex;justify-content:flex-end;">
        <button class="an-item-btn an-clear-recent" style="opacity:1;font-size:10px;padding:2px 8px;">
          <i class="fas fa-trash-alt"></i> ${L("ASSETNAVIGATOR.ClearRecent")}
        </button></div>`;
    }
    if (this._tab === "images" && items.length > 0) {
      extra = `<div class="an-section-header" style="display:flex;justify-content:space-between;align-items:center;">
        <span>${items.length} Bilder</span>
        <button class="an-item-btn an-clear-images" style="opacity:1;font-size:10px;padding:2px 8px;">
          <i class="fas fa-trash-alt"></i> Verlauf löschen
        </button></div>`;
    }
    if (this._tab === "search" && this._query) {
      extra = `<div class="an-section-header">${this._searchResults.length} Treffer für „${this._query}"</div>`;
    }

    return `
      <div class="an-panel">
        <div class="an-search-wrap">
          <i class="fas fa-search"></i>
          <input class="an-search-input" type="text" placeholder="${L("ASSETNAVIGATOR.Search")}" value="${this._query}" autocomplete="off"/>
          <span class="an-kbd">Esc</span>
        </div>
        <div class="an-tabs">${tabsHTML}</div>
        <div class="an-list-wrap">${extra}${itemsHTML}</div>
      </div>`;
  }

  _buildItem(item, idx) {
    const iconMap  = { folder:"fa-folder", image:"fa-image", audio:"fa-music", video:"fa-film" };
    const colorMap = { folder:"#f0b060",   image:"#60c0f0",  audio:"#80e0a0", video:"#f07880"  };
    const typeIcon  = iconMap[item.type]  ?? "fa-folder";
    const typeColor = colorMap[item.type] ?? "#8888b8";
    const fav   = isFavorite(item.path);
    const L     = k => game.i18n.localize(k);
    const isImg = item.type === "image";
    const thumb = isImg
      ? `<img src="${item.path}" style="width:32px;height:32px;object-fit:cover;border-radius:4px;flex-shrink:0;" loading="lazy" onerror="this.style.display='none'"/>`
      : `<span class="an-item-icon" style="color:${typeColor};font-size:14px;width:32px;text-align:center;flex-shrink:0;"><i class="fas ${typeIcon}"></i></span>`;

    return `
      <div class="an-item ${idx === this._focusIdx ? "focused" : ""}" data-path="${item.path}" data-type="${item.type}">
        ${thumb}
        <span class="an-item-label" title="${item.path}">${item.name || pathBasename(item.path)}</span>
        <span class="an-item-path">${item.path}</span>
        <span class="an-item-actions">
          ${isImg ? `<button class="an-item-btn an-btn-use-token" data-path="${item.path}" title="Als Token-Bild verwenden" style="color:#a080ff;"><i class="fas fa-user-circle"></i></button>` : ""}
          <button class="an-item-btn an-btn-fav ${fav ? "fav-active" : ""}" data-path="${item.path}" title="${fav ? L("ASSETNAVIGATOR.RemoveFavorite") : L("ASSETNAVIGATOR.AddFavorite")}"><i class="fas fa-star"></i></button>
          <button class="an-item-btn an-btn-copy" data-path="${item.path}" title="${L("ASSETNAVIGATOR.CopyPath")}"><i class="fas fa-copy"></i></button>
          <button class="an-item-btn an-btn-open" data-path="${item.path}" title="${L("ASSETNAVIGATOR.OpenInPicker")}"><i class="fas fa-external-link-alt"></i></button>
        </span>
      </div>`;
  }

  _activateListeners(html) {
    html.addEventListener("click", ev => { if (ev.target === html) this.close(); });

    html.querySelectorAll(".an-tab").forEach(t => t.addEventListener("click", () => {
      this._tab = t.dataset.tab; this._focusIdx = 0; this.render();
    }));

    const input = html.querySelector(".an-search-input");
    if (input) {
      input.addEventListener("input", ev => {
        this._query = ev.target.value;
        if (this._query) { this._tab = "search"; this._doSearch(); }
        else { this._tab = "favorites"; this.render(); }
      });
      input.addEventListener("keydown", ev => {
        const items = this._getItems();
        if (ev.key === "Escape") { this.close(); return; }
        if (ev.key === "ArrowDown") { ev.preventDefault(); this._focusIdx = Math.min(this._focusIdx+1, items.length-1); this.render(); }
        if (ev.key === "ArrowUp")   { ev.preventDefault(); this._focusIdx = Math.max(this._focusIdx-1, 0); this.render(); }
        if (ev.key === "Enter")     { const item = items[this._focusIdx]; if (item) this._openPath(item.path, item.type); }
      });
    }

    html.querySelectorAll(".an-item").forEach(item => {
      item.addEventListener("click", ev => {
        if (ev.target.closest(".an-item-actions")) return;
        this._openPath(item.dataset.path, item.dataset.type);
      });
    });

    html.querySelectorAll(".an-btn-fav").forEach(btn => btn.addEventListener("click", async ev => {
      ev.stopPropagation(); await toggleFavorite(btn.dataset.path); this.render();
    }));
    html.querySelectorAll(".an-btn-copy").forEach(btn => btn.addEventListener("click", ev => {
      ev.stopPropagation();
      navigator.clipboard.writeText(btn.dataset.path);
      ui.notifications.info(`Pfad kopiert: ${btn.dataset.path}`);
    }));
    html.querySelectorAll(".an-btn-open").forEach(btn => btn.addEventListener("click", ev => {
      ev.stopPropagation(); this._openPath(btn.dataset.path, btn.closest(".an-item")?.dataset.type);
    }));
    html.querySelectorAll(".an-btn-use-token").forEach(btn => btn.addEventListener("click", ev => {
      ev.stopPropagation();
      this.close();
      ANImagePicker.open(async chosenPath => {
        await pushRecentImage(chosenPath);
        const openSheet = Object.values(ui.windows ?? {}).find(w => w.actor);
        if (openSheet?.actor) await openSheet.actor.update({ img: chosenPath });
      }, btn.dataset.path);
    }));

    html.querySelector(".an-clear-recent")?.addEventListener("click", async () => {
      await game.settings.set(MODULE_ID, "recent", []); this.render();
    });
    html.querySelector(".an-clear-images")?.addEventListener("click", async () => {
      await game.settings.set(MODULE_ID, "recentImages", []); this.render();
    });
  }

  async _doSearch() {
    const q = this._query.toLowerCase();
    const all = [
      ...getFavorites().map(f => ({ ...f, type: guessType(f.path) })),
      ...getRecent().map(r => ({ ...r, type: guessType(r.path) })),
      ...getRecentImages().map(r => ({ ...r, type: "image" })),
    ];
    const seen = new Set();
    this._searchResults = all.filter(item => {
      if (seen.has(item.path)) return false;
      seen.add(item.path);
      return item.path.toLowerCase().includes(q) || (item.name ?? "").toLowerCase().includes(q);
    });
    this._focusIdx = 0;
    this.render();
  }

  async _openPath(path, type) {
    this.close();
    if (type === "image") await pushRecentImage(path);
    else await pushRecent(path);
    const fp = new FilePicker({
      type: type === "image" ? "image" : "any",
      current: type === "image" ? pathDirname(path) : path,
      callback: async selected => { if (isImagePath(selected)) await pushRecentImage(selected); },
    });
    fp.render(true);
  }
}

// ════════════════════════════════════════
//  FilePicker — Bookmark-Leiste
// ════════════════════════════════════════

let _lastPickerApp = null;

function refreshPickerBar() {
  if (_lastPickerApp?.rendered) injectPickerBar(_lastPickerApp);
}

function injectPickerBar(app) {
  _lastPickerApp = app;
  const html = app.element?.[0];
  if (!html) return;
  html.querySelector(".an-picker-bar")?.remove();

  const favs = getFavorites().filter(f => !isImagePath(f.path));
  const bar  = document.createElement("div");
  bar.className = "an-picker-bar";

  const label = document.createElement("span");
  label.className = "an-picker-bar-label";
  label.innerHTML = '<i class="fas fa-star" style="color:#f0b060;margin-right:3px;"></i>';
  bar.appendChild(label);

  if (favs.length === 0) {
    const hint = document.createElement("span");
    hint.style.cssText = "font-size:10px;color:#88887090;";
    hint.textContent = "Noch keine Favoriten";
    bar.appendChild(hint);
  } else {
    favs.forEach(fav => {
      const chip = document.createElement("span");
      chip.className = "an-bookmark-chip";
      chip.title = fav.path;
      chip.innerHTML = `<i class="fas fa-folder"></i>${fav.name || pathBasename(fav.path)}`;
      chip.addEventListener("click", async () => { await pushRecent(fav.path); app.browse(fav.path); });
      bar.appendChild(chip);
    });
  }

  const addBtn = document.createElement("button");
  addBtn.className = "an-picker-add-btn";
  addBtn.title = "Aktuellen Ordner als Favorit speichern";
  addBtn.innerHTML = '<i class="fas fa-plus"></i>';
  addBtn.addEventListener("click", async () => {
    const current = app.result?.target ?? app.activeSource ?? "";
    if (current) { await toggleFavorite(current); injectPickerBar(app); }
  });
  bar.appendChild(addBtn);

  const insertAfter = html.querySelector(".directory-breadcrumb")
    ?? html.querySelector("ol.breadcrumb")
    ?? html.querySelector(".filepicker-header");
  if (insertAfter) insertAfter.insertAdjacentElement("afterend", bar);
  else html.querySelector(".filepicker-body")?.prepend(bar);
}

// ════════════════════════════════════════
//  FilePicker — Kontextmenü
// ════════════════════════════════════════

function injectContextMenu(app) {
  const html = app.element?.[0];
  if (!html) return;
  html.addEventListener("contextmenu", ev => {
    const dirItem = ev.target.closest(".directory-item");
    if (!dirItem) return;
    ev.preventDefault(); ev.stopPropagation();
    const path = dirItem.dataset.path ?? dirItem.querySelector("a")?.dataset.path ?? "";
    if (path) showContextMenu(ev, path);
  }, true);
}

function showContextMenu(ev, path) {
  document.querySelectorAll(".an-context-menu").forEach(el => el.remove());
  const menu = document.createElement("div");
  menu.className = "an-context-menu";
  menu.style.cssText = `
    position:fixed;left:${ev.clientX}px;top:${ev.clientY}px;
    background:#1a1a2e;border:1px solid #4a4a6a;border-radius:6px;
    box-shadow:0 8px 32px rgba(0,0,0,.6);z-index:99999;
    min-width:210px;padding:4px 0;font-size:13px;`;
  const fav  = isFavorite(path);
  const isImg = isImagePath(path);
  const entries = [
    {
      icon: "fa-star", color: fav ? "#f0b060" : "#c8c8e8",
      label: fav ? "Favorit entfernen" : "Als Favorit speichern",
      action: () => toggleFavorite(path),
    },
    { icon: "fa-copy", label: "Pfad kopieren",
      action: () => { navigator.clipboard.writeText(path); ui.notifications.info(`Kopiert: ${path}`); },
    },
    ...(isImg ? [{ icon: "fa-user-circle", color: "#a080ff", label: "Als Token-Bild merken",
      action: () => pushRecentImage(path) }] : []),
  ];
  entries.forEach(entry => {
    const row = document.createElement("div");
    row.style.cssText = `display:flex;align-items:center;gap:8px;padding:7px 14px;cursor:pointer;color:${entry.color ?? "#c8c8e8"};transition:background .1s;`;
    row.innerHTML = `<i class="fas ${entry.icon}" style="width:14px;text-align:center;color:${entry.color ?? "#8888b8"};"></i>${entry.label}`;
    row.addEventListener("mouseenter", () => row.style.background = "#262640");
    row.addEventListener("mouseleave", () => row.style.background = "transparent");
    row.addEventListener("click", () => { entry.action(); menu.remove(); refreshPickerBar(); });
    menu.appendChild(row);
  });
  document.body.appendChild(menu);
  const close = ev2 => { if (!menu.contains(ev2.target)) { menu.remove(); document.removeEventListener("mousedown", close); } };
  setTimeout(() => document.addEventListener("mousedown", close), 10);
}

// ════════════════════════════════════════
//  FilePicker Hook
// ════════════════════════════════════════

Hooks.on("renderFilePicker", async (app, html) => {
  const target = app.result?.target;
  if (target) await pushRecent(target);
  injectPickerBar(app);
  injectContextMenu(app);
  const origCallback = app.options?.callback;
  if (origCallback) {
    app.options.callback = async (path, fp) => {
      if (isImagePath(path)) await pushRecentImage(path);
      return origCallback(path, fp);
    };
  }
});

// ════════════════════════════════════════
//  Tastenkürzel
// ════════════════════════════════════════

function parseShortcut(str) {
  const parts = str.toLowerCase().split("+");
  return { ctrl: parts.includes("ctrl"), alt: parts.includes("alt"), shift: parts.includes("shift"), key: parts[parts.length-1] };
}
function matchesShortcut(ev, sc) {
  const key = ev.key.toLowerCase() === " " ? "space" : ev.key.toLowerCase();
  return ev.ctrlKey === sc.ctrl && ev.altKey === sc.alt && ev.shiftKey === sc.shift && key === sc.key;
}

// ════════════════════════════════════════
//  Sidebar-Button
// ════════════════════════════════════════

Hooks.on("getSceneControlButtons", controls => {
  const basic = controls.find(c => c.name === "basic");
  if (basic) basic.tools.push({
    name: "filepicker-pro", title: "Asset Navigator (Ctrl+Space)",
    icon: "fas fa-folder-open", button: true,
    onClick: () => _overlay?.toggle(),
  });
});

// ════════════════════════════════════════
//  Init & Ready
// ════════════════════════════════════════

let _overlay = null;

Hooks.once("init", () => {
  const arr = { scope: "client", config: false, type: Array, default: [] };
  game.settings.register(MODULE_ID, "favorites",    arr);
  game.settings.register(MODULE_ID, "recent",       arr);
  game.settings.register(MODULE_ID, "recentImages", arr);
  game.settings.register(MODULE_ID, "maxRecent", {
    name: "Anzahl gespeicherter Pfade",
    hint: "Wie viele Einträge im Verlauf (Ordner & Bilder) gespeichert werden.",
    scope: "client", config: true, type: Number, default: MAX_RECENT_DEFAULT,
    range: { min: 5, max: 100, step: 5 },
  });
  game.settings.register(MODULE_ID, "shortcut", {
    name: "Tastenkürzel",
    hint: "Tastenkombination für das Quick-Access-Overlay (z.B. ctrl+space, alt+a).",
    scope: "client", config: true, type: String, default: "ctrl+space",
  });
  console.log(`%c[Asset Navigator] %cgeladen ✓`, "color:#b090ff;font-weight:bold", "color:#80c090");
});

Hooks.once("ready", () => {
  _overlay = new ANOverlay();
  document.addEventListener("keydown", ev => {
    const sc = parseShortcut(game.settings.get(MODULE_ID, "shortcut"));
    if (matchesShortcut(ev, sc)) {
      if (["INPUT","TEXTAREA"].includes(document.activeElement?.tagName)) return;
      ev.preventDefault();
      _overlay.toggle();
    }
    if (ev.key === "Escape") {
      const el = document.getElementById("filepicker-pro-overlay");
      if (el && !el.classList.contains("hidden")) { _overlay.close(); ev.stopPropagation(); }
    }
  });
  game.modules.get(MODULE_ID).api = {
    toggleOverlay:   () => _overlay.toggle(),
    openImagePicker: (cb, current) => ANImagePicker.open(cb, current),
    addFavorite:     path => toggleFavorite(path),
    getFavorites, getRecent, getRecentImages,
  };
  console.log(`%c[Asset Navigator] %cbereit — Ctrl+Space zum Öffnen`, "color:#b090ff;font-weight:bold", "color:#80c090");
});
