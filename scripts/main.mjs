/**
 * FilePicker Pro — main.mjs  v3.0
 * Foundry VTT V13
 * ─────────────────────────────────────────
 * Features:
 *  1. Quicklinks umbenennen — eigener Name statt vollem Pfad
 *  2. Hover-Vorschau — großes Popup (300px+) beim Überfahren von Bildern
 */

const MODULE_ID = "filepicker-pro";

// ════════════════════════════════════════
//  Einstellungen
// ════════════════════════════════════════

function getCustomNames() {
  return game.settings.get(MODULE_ID, "customNames") ?? {};
}

async function setCustomName(path, name) {
  const names = getCustomNames();
  if (name.trim() === "") {
    delete names[path];
  } else {
    names[path] = name.trim();
  }
  await game.settings.set(MODULE_ID, "customNames", names);
}

// ════════════════════════════════════════
//  Feature 1: Quicklinks umbenennen
// ════════════════════════════════════════

function enhanceQuicklinks(element) {
  const items = element.querySelectorAll(".quick-link-item");
  if (!items.length) return;

  const customNames = getCustomNames();

  items.forEach(item => {
    const path = item.getAttribute("target");
    if (!path) return;

    // Doppelte Injection verhindern
    if (item.dataset.fppEnhanced) return;
    item.dataset.fppEnhanced = "1";

    const titleEl = item.querySelector(".quick-title");
    if (!titleEl) return;

    // Immer vollen Pfad als Tooltip
    item.title = path;

    // Eigenen Namen anzeigen falls vorhanden, sonst letzten Ordnernamen
    const customName = customNames[path];
    if (customName) {
      titleEl.innerHTML = `
        <span class="fpp-ql-name">${customName}</span>
        <span class="fpp-ql-path">${path}</span>
      `;
    } else {
      const short = path.split("/").filter(Boolean).pop() ?? path;
      // Kontext: vorletzter Ordner falls Name mehrdeutig
      const parts  = path.split("/").filter(Boolean);
      const parent = parts.length > 1 ? parts[parts.length - 2] : null;
      titleEl.innerHTML = parent
        ? `<span class="fpp-ql-name">${short}</span><span class="fpp-ql-path">${parent}</span>`
        : `<span class="fpp-ql-name">${short}</span>`;
    }

    // Stift-Button zum Umbenennen
    if (!item.querySelector(".fpp-rename-btn")) {
      const btn = document.createElement("button");
      btn.className = "fpp-rename-btn";
      btn.type = "button";
      btn.title = "Eigenen Namen vergeben";
      btn.innerHTML = '<i class="fas fa-pencil"></i>';
      btn.addEventListener("click", ev => {
        ev.stopPropagation();
        ev.preventDefault();
        openRenameDialog(path, customNames[path] ?? "", async newName => {
          await setCustomName(path, newName);
          // Neu rendern
          delete item.dataset.fppEnhanced;
          enhanceQuicklinks(element);
        });
      });
      item.appendChild(btn);
    }
  });
}

function openRenameDialog(path, currentName, onSave) {
  // Bestehenden Dialog schließen
  document.querySelector(".fpp-rename-dialog")?.remove();

  const dialog = document.createElement("div");
  dialog.className = "fpp-rename-dialog";
  dialog.innerHTML = `
    <div class="fpp-rename-backdrop"></div>
    <div class="fpp-rename-box">
      <div class="fpp-rename-header">
        <i class="fas fa-pencil"></i> Quicklink umbenennen
      </div>
      <div class="fpp-rename-path">${path}</div>
      <input class="fpp-rename-input" type="text" value="${currentName}"
        placeholder="Eigener Name (leer = Standard)" autocomplete="off" />
      <div class="fpp-rename-actions">
        <button class="fpp-rename-cancel">Abbrechen</button>
        <button class="fpp-rename-save">Speichern</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const input = dialog.querySelector(".fpp-rename-input");
  input.focus();
  input.select();

  dialog.querySelector(".fpp-rename-backdrop").addEventListener("click", () => dialog.remove());
  dialog.querySelector(".fpp-rename-cancel").addEventListener("click", () => dialog.remove());
  dialog.querySelector(".fpp-rename-save").addEventListener("click", () => {
    onSave(input.value);
    dialog.remove();
  });
  input.addEventListener("keydown", ev => {
    if (ev.key === "Enter")  { onSave(input.value); dialog.remove(); }
    if (ev.key === "Escape") { dialog.remove(); }
  });
}

// ════════════════════════════════════════
//  Feature 2: Hover-Vorschau
// ════════════════════════════════════════

let _previewEl = null;
let _previewTimer = null;

function createPreviewElement() {
  if (_previewEl) return _previewEl;
  const el = document.createElement("div");
  el.id = "fpp-preview";
  el.innerHTML = `
    <img class="fpp-preview-img" />
    <div class="fpp-preview-name"></div>
  `;
  document.body.appendChild(el);
  _previewEl = el;
  return el;
}

function showPreview(imgSrc, name, x, y) {
  const el = createPreviewElement();
  const img = el.querySelector(".fpp-preview-img");
  const label = el.querySelector(".fpp-preview-name");

  img.src = imgSrc;
  label.textContent = name;

  // Position — rechts vom Cursor, mit Randkorrektur
  const pw = 320;
  const ph = 340;
  let left = x + 16;
  let top  = y - 20;

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

function injectHoverPreview(element) {
  const fileList = element.querySelector("ul.files-list");
  if (!fileList) return;
  if (fileList.dataset.fppHover) return;
  fileList.dataset.fppHover = "1";

  fileList.addEventListener("mouseover", ev => {
    const li = ev.target.closest("li.file[data-path]");
    if (!li) { hidePreview(); return; }

    const path = li.dataset.path;
    if (!isImage(path)) { hidePreview(); return; }

    clearTimeout(_previewTimer);
    _previewTimer = setTimeout(() => {
      showPreview(path, li.dataset.name ?? pathBasename(path), ev.clientX, ev.clientY);
    }, 200); // kurze Verzögerung damit es nicht bei jedem Pixel flackert
  });

  fileList.addEventListener("mousemove", ev => {
    if (_previewEl?.classList.contains("fpp-preview--visible")) {
      const pw = 320;
      const ph = 340;
      let left = ev.clientX + 16;
      let top  = ev.clientY - 20;
      if (left + pw > window.innerWidth)  left = ev.clientX - pw - 16;
      if (top  + ph > window.innerHeight) top  = window.innerHeight - ph - 10;
      if (top < 10) top = 10;
      _previewEl.style.left = left + "px";
      _previewEl.style.top  = top  + "px";
    }
  });

  fileList.addEventListener("mouseleave", () => hidePreview());

  // Auch beim Klick (Datei auswählen) Vorschau schließen
  fileList.addEventListener("click", () => hidePreview());
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

// ════════════════════════════════════════
//  Hook — FilePicker rendern
// ════════════════════════════════════════

Hooks.on("renderFilePicker", (app, html) => {
  // html ist in V13 ein HTMLElement, kein jQuery-Objekt
  const root = html instanceof HTMLElement ? html : html[0];
  if (!root) return;

  enhanceQuicklinks(root);
  injectHoverPreview(root);
});

// V13 ApplicationV2 feuert ein anderes Event
Hooks.on("renderApplication", (app, html) => {
  if (app.constructor.name !== "FilePicker") return;
  const root = html instanceof HTMLElement ? html : html[0];
  if (!root) return;
  enhanceQuicklinks(root);
  injectHoverPreview(root);
});

// ════════════════════════════════════════
//  Init
// ════════════════════════════════════════

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "customNames", {
    scope: "client",
    config: false,
    type: Object,
    default: {},
  });

  console.log(`%c[FilePicker Pro] %cgeladen ✓`, "color:#60c0f0;font-weight:bold", "color:#80c090");
});

Hooks.once("ready", () => {
  console.log(`%c[FilePicker Pro] %cbereit`, "color:#60c0f0;font-weight:bold", "color:#80c090");
});
