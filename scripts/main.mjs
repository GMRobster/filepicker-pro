/**
 * FilePicker Pro — main.mjs  v4.0
 * Foundry VTT V13
 * ─────────────────────────────────────────
 * Eigene Favoriten-Leiste links im FilePicker:
 *  • Farbige, benannte Tabs pro Ordner
 *  • Klick → direkt navigieren
 *  • + Button oder Rechtsklick → Ordner hinzufügen
 *  • Stift → Name + Farbe bearbeiten
 *  • Gespeichert in game.user flags
 */

const MODULE_ID = "filepicker-pro";
const FLAG_KEY  = "favorites";

const PRESET_COLORS = [
  "#e05c5c", "#e08c3c", "#d4b84a", "#6ab46a",
  "#4a9fd4", "#7c6cd4", "#c46aaa", "#6abcbc",
  "#a0a0a0", "#d4d4d4",
];

// ════════════════════════════════════════
//  Daten — in User-Flags gespeichert
// ════════════════════════════════════════

async function getFavorites() {
  return (await game.user.getFlag(MODULE_ID, FLAG_KEY)) ?? [];
}

async function saveFavorites(list) {
  await game.user.setFlag(MODULE_ID, FLAG_KEY, list);
}

async function addFavorite(path) {
  const favs = await getFavorites();
  if (favs.some(f => f.path === path)) return; // schon drin
  const name  = pathBasename(path);
  const color = PRESET_COLORS[favs.length % PRESET_COLORS.length];
  favs.push({ path, name, color });
  await saveFavorites(favs);
  return favs;
}

async function removeFavorite(path) {
  const favs = await getFavorites();
  await saveFavorites(favs.filter(f => f.path !== path));
}

async function updateFavorite(path, name, color) {
  const favs = await getFavorites();
  const entry = favs.find(f => f.path === path);
  if (entry) { entry.name = name; entry.color = color; }
  await saveFavorites(favs);
}

// ════════════════════════════════════════
//  Utility
// ════════════════════════════════════════

function pathBasename(p) {
  return p?.split("/").filter(Boolean).pop() ?? p ?? "";
}

function isImage(path) {
  const ext = path?.split(".").pop()?.toLowerCase();
  return ["png","jpg","jpeg","gif","webp","svg","avif"].includes(ext);
}

function getCurrentPath(app) {
  return app.element?.querySelector('input[name="target"]')?.value ?? "";
}

// ════════════════════════════════════════
//  Sidebar bauen
// ════════════════════════════════════════

async function injectSidebar(app) {
  const root = app.element;
  if (!root) return;

  // Verhindere Doppel-Injection — aber aktualisiere wenn schon da
  const existing = root.querySelector(".fpp-sidebar");
  if (existing) {
    await refreshSidebar(existing, app);
    return;
  }

  // Body-Bereich finden
  const body = root.querySelector("section.body");
  if (!body) return;

  // Wrapper
  const wrapper = document.createElement("div");
  wrapper.className = "fpp-wrapper";
  body.parentNode.insertBefore(wrapper, body);
  wrapper.appendChild(body);

  // Sidebar
  const sidebar = document.createElement("div");
  sidebar.className = "fpp-sidebar";
  wrapper.insertBefore(sidebar, body);

  await refreshSidebar(sidebar, app);
}

async function refreshSidebar(sidebar, app) {
  const favs       = await getFavorites();
  const currentPath = getCurrentPath(app);

  sidebar.innerHTML = buildSidebarHTML(favs, currentPath);
  activateListeners(sidebar, app, favs, currentPath);
}

function buildSidebarHTML(favs, currentPath) {
  const tabs = favs.map((fav, i) => {
    const isActive = fav.path === currentPath;
    return `
      <div class="fpp-tab ${isActive ? "fpp-tab--active" : ""}"
        data-idx="${i}" data-path="${fav.path}"
        style="--fpp-color: ${fav.color};"
        title="${fav.path}">
        <span class="fpp-tab-color-bar"></span>
        <span class="fpp-tab-label">${fav.name}</span>
        <span class="fpp-tab-actions">
          <button class="fpp-btn-edit" data-idx="${i}" title="Umbenennen / Farbe ändern">
            <i class="fas fa-pencil"></i>
          </button>
          <button class="fpp-btn-remove" data-idx="${i}" data-path="${fav.path}" title="Entfernen">
            <i class="fas fa-times"></i>
          </button>
        </span>
      </div>`;
  }).join("");

  const empty = favs.length === 0
    ? `<div class="fpp-empty">Noch keine Favoriten.<br><small>+ oder Rechtsklick auf einen Ordner.</small></div>`
    : "";

  return `
    <div class="fpp-sidebar-header">
      <span class="fpp-sidebar-title">
        <i class="fas fa-star"></i> Favoriten
      </span>
      <button class="fpp-btn-add" title="Aktuellen Ordner hinzufügen">
        <i class="fas fa-plus"></i>
      </button>
    </div>
    <div class="fpp-tab-list">
      ${empty}
      ${tabs}
    </div>
  `;
}

function activateListeners(sidebar, app, favs, currentPath) {
  // + Button → aktuellen Ordner hinzufügen
  sidebar.querySelector(".fpp-btn-add")?.addEventListener("click", async () => {
    const path = getCurrentPath(app);
    if (!path) return;
    await addFavorite(path);
    await refreshSidebar(sidebar, app);
  });

  // Tab-Klick → navigieren
  sidebar.querySelectorAll(".fpp-tab").forEach(tab => {
    tab.addEventListener("click", async ev => {
      if (ev.target.closest(".fpp-tab-actions")) return;
      const path = tab.dataset.path;
      app.browse(path);
    });
  });

  // Bearbeiten-Button
  sidebar.querySelectorAll(".fpp-btn-edit").forEach(btn => {
    btn.addEventListener("click", async ev => {
      ev.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      const fav = favs[idx];
      if (!fav) return;
      openEditDialog(fav, async (newName, newColor) => {
        await updateFavorite(fav.path, newName, newColor);
        await refreshSidebar(sidebar, app);
      });
    });
  });

  // Entfernen-Button
  sidebar.querySelectorAll(".fpp-btn-remove").forEach(btn => {
    btn.addEventListener("click", async ev => {
      ev.stopPropagation();
      await removeFavorite(btn.dataset.path);
      await refreshSidebar(sidebar, app);
    });
  });
}

// ════════════════════════════════════════
//  Edit-Dialog
// ════════════════════════════════════════

function openEditDialog(fav, onSave) {
  document.querySelector(".fpp-dialog")?.remove();

  const colorSwatches = PRESET_COLORS.map(c => `
    <button class="fpp-color-swatch ${c === fav.color ? "fpp-color-swatch--active" : ""}"
      data-color="${c}" style="background:${c};" title="${c}">
    </button>`
  ).join("");

  const dialog = document.createElement("div");
  dialog.className = "fpp-dialog";
  dialog.innerHTML = `
    <div class="fpp-dialog-backdrop"></div>
    <div class="fpp-dialog-box">
      <div class="fpp-dialog-header">
        <i class="fas fa-pencil"></i> Favorit bearbeiten
      </div>
      <div class="fpp-dialog-path">${fav.path}</div>
      <label class="fpp-dialog-label">Name</label>
      <input class="fpp-dialog-input" type="text" value="${fav.name}"
        placeholder="Eigener Name" autocomplete="off" />
      <label class="fpp-dialog-label">Farbe</label>
      <div class="fpp-color-picker">
        ${colorSwatches}
        <input class="fpp-color-custom" type="color" value="${fav.color}" title="Eigene Farbe" />
      </div>
      <div class="fpp-dialog-preview">
        <div class="fpp-dialog-preview-tab" style="--fpp-color:${fav.color};">
          <span class="fpp-tab-color-bar"></span>
          <span class="fpp-preview-label">${fav.name}</span>
        </div>
      </div>
      <div class="fpp-dialog-actions">
        <button class="fpp-dialog-cancel">Abbrechen</button>
        <button class="fpp-dialog-save">Speichern</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const input    = dialog.querySelector(".fpp-dialog-input");
  const preview  = dialog.querySelector(".fpp-preview-label");
  const previewTab = dialog.querySelector(".fpp-dialog-preview-tab");
  const colorCustom = dialog.querySelector(".fpp-color-custom");
  let selectedColor = fav.color;

  input.focus(); input.select();

  // Live-Vorschau Name
  input.addEventListener("input", () => { preview.textContent = input.value || fav.name; });

  // Farb-Swatches
  dialog.querySelectorAll(".fpp-color-swatch").forEach(sw => {
    sw.addEventListener("click", () => {
      dialog.querySelectorAll(".fpp-color-swatch").forEach(s => s.classList.remove("fpp-color-swatch--active"));
      sw.classList.add("fpp-color-swatch--active");
      selectedColor = sw.dataset.color;
      previewTab.style.setProperty("--fpp-color", selectedColor);
      colorCustom.value = selectedColor;
    });
  });

  // Eigene Farbe
  colorCustom.addEventListener("input", () => {
    selectedColor = colorCustom.value;
    previewTab.style.setProperty("--fpp-color", selectedColor);
    dialog.querySelectorAll(".fpp-color-swatch").forEach(s => s.classList.remove("fpp-color-swatch--active"));
  });

  // Schließen
  dialog.querySelector(".fpp-dialog-backdrop").addEventListener("click", () => dialog.remove());
  dialog.querySelector(".fpp-dialog-cancel").addEventListener("click",   () => dialog.remove());
  dialog.querySelector(".fpp-dialog-save").addEventListener("click", () => {
    onSave(input.value.trim() || fav.name, selectedColor);
    dialog.remove();
  });
  input.addEventListener("keydown", ev => {
    if (ev.key === "Enter")  { onSave(input.value.trim() || fav.name, selectedColor); dialog.remove(); }
    if (ev.key === "Escape") { dialog.remove(); }
  });
}

// ════════════════════════════════════════
//  Rechtsklick auf Ordner im Datei-Raster
// ════════════════════════════════════════

function injectContextMenu(app) {
  const root = app.element;
  if (!root) return;
  if (root.dataset.fppCtx) return;
  root.dataset.fppCtx = "1";

  root.addEventListener("contextmenu", async ev => {
    // Ordner im Raster
    const dirItem = ev.target.closest("li[data-path]:not([data-file])");
    if (!dirItem) return;

    ev.preventDefault();
    ev.stopPropagation();

    const path = dirItem.dataset.path;
    if (!path) return;

    const favs    = await getFavorites();
    const already = favs.some(f => f.path === path);

    showContextMenu(ev.clientX, ev.clientY, path, already, app);
  }, true);
}

function showContextMenu(x, y, path, already, app) {
  document.querySelector(".fpp-ctx")?.remove();

  const menu = document.createElement("div");
  menu.className = "fpp-ctx";
  menu.style.cssText = `left:${x}px;top:${y}px;`;
  menu.innerHTML = `
    <div class="fpp-ctx-item fpp-ctx-fav" data-action="fav">
      <i class="fas ${already ? "fa-star-half-alt" : "fa-star"}"></i>
      ${already ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
    </div>
    <div class="fpp-ctx-item" data-action="copy">
      <i class="fas fa-copy"></i> Pfad kopieren
    </div>
  `;

  document.body.appendChild(menu);

  menu.querySelector("[data-action='fav']").addEventListener("click", async () => {
    if (already) {
      await removeFavorite(path);
    } else {
      await addFavorite(path);
    }
    menu.remove();
    const sidebar = app.element?.querySelector(".fpp-sidebar");
    if (sidebar) await refreshSidebar(sidebar, app);
  });

  menu.querySelector("[data-action='copy']").addEventListener("click", () => {
    navigator.clipboard.writeText(path);
    ui.notifications.info(`Kopiert: ${path}`);
    menu.remove();
  });

  const close = ev => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("mousedown", close); } };
  setTimeout(() => document.addEventListener("mousedown", close), 10);
}

// ════════════════════════════════════════
//  Hover-Vorschau (bleibt erhalten)
// ════════════════════════════════════════

let _previewEl    = null;
let _previewTimer = null;

function createPreviewEl() {
  if (_previewEl) return _previewEl;
  const el = document.createElement("div");
  el.id = "fpp-preview";
  el.innerHTML = `<img class="fpp-preview-img"/><div class="fpp-preview-name"></div>`;
  document.body.appendChild(el);
  _previewEl = el;
  return el;
}

function showPreview(src, name, x, y) {
  const el  = createPreviewEl();
  el.querySelector(".fpp-preview-img").src = src;
  el.querySelector(".fpp-preview-name").textContent = name;
  const pw = 300, ph = 320;
  let left = x + 16, top = y - 20;
  if (left + pw > window.innerWidth)  left = x - pw - 16;
  if (top  + ph > window.innerHeight) top  = window.innerHeight - ph - 10;
  if (top < 10) top = 10;
  el.style.left = left + "px";
  el.style.top  = top  + "px";
  el.classList.add("fpp-preview--visible");
}

function hidePreview() {
  clearTimeout(_previewTimer);
  _previewEl?.classList.remove("fpp-preview--visible");
}

function injectHoverPreview(app) {
  const root = app.element;
  if (!root) return;
  const fileList = root.querySelector("ul.files-list");
  if (!fileList || fileList.dataset.fppHover) return;
  fileList.dataset.fppHover = "1";

  fileList.addEventListener("mouseover", ev => {
    const li = ev.target.closest("li.file[data-path]");
    if (!li || !isImage(li.dataset.path)) { hidePreview(); return; }
    clearTimeout(_previewTimer);
    _previewTimer = setTimeout(() =>
      showPreview(li.dataset.path, li.dataset.name ?? pathBasename(li.dataset.path), ev.clientX, ev.clientY)
    , 200);
  });
  fileList.addEventListener("mousemove", ev => {
    if (!_previewEl?.classList.contains("fpp-preview--visible")) return;
    const pw = 300, ph = 320;
    let left = ev.clientX + 16, top = ev.clientY - 20;
    if (left + pw > window.innerWidth)  left = ev.clientX - pw - 16;
    if (top  + ph > window.innerHeight) top  = window.innerHeight - ph - 10;
    if (top < 10) top = 10;
    _previewEl.style.left = left + "px";
    _previewEl.style.top  = top  + "px";
  });
  fileList.addEventListener("mouseleave", hidePreview);
  fileList.addEventListener("click", hidePreview);
}

// ════════════════════════════════════════
//  V13: _onRender patchen
// ════════════════════════════════════════

function patchFilePicker() {
  const FP = foundry.applications?.apps?.FilePicker?.implementation;
  if (!FP) { console.warn("[FilePicker Pro] FilePicker nicht gefunden."); return; }

  const original = FP.prototype._onRender;
  FP.prototype._onRender = async function(context, options) {
    if (original) original.call(this, context, options);
    await injectSidebar(this);
    injectHoverPreview(this);
    injectContextMenu(this);
  };

  console.log(`%c[FilePicker Pro] %cFilePicker gepacht ✓`, "color:#60c0f0;font-weight:bold", "color:#80c090");
}

// ════════════════════════════════════════
//  Init
// ════════════════════════════════════════

Hooks.once("init", () => {
  patchFilePicker();
  console.log(`%c[FilePicker Pro] %cgeladen ✓`, "color:#60c0f0;font-weight:bold", "color:#80c090");
});
