/**
 * FilePicker Pro — main.mjs  v2.0
 * Erweitert den nativen Foundry FilePicker um eine Sidebar
 * mit Favoriten und Verlauf.
 *
 * Konzept:
 *  • Der native FilePicker bleibt vollständig erhalten
 *  • Links wird eine schmale Sidebar eingefügt
 *  • Sidebar hat zwei Tabs: Favoriten | Verlauf
 *  • Klick auf Eintrag navigiert direkt zu diesem Ordner
 *  • Stern-Button speichert den aktuellen Ordner als Favorit
 *  • Alles wird per client-setting persistent gespeichert
 */

const MODULE_ID = "filepicker-pro";
const MAX_RECENT = 20;

// ════════════════════════════════════════
//  Einstellungen & Datenzugriff
// ════════════════════════════════════════

function getFavorites() {
  return game.settings.get(MODULE_ID, "favorites") ?? [];
}

async function saveFavorites(list) {
  await game.settings.set(MODULE_ID, "favorites", list);
}

function getRecent() {
  return game.settings.get(MODULE_ID, "recent") ?? [];
}

async function pushRecent(path) {
  if (!path || path === "") return;
  let recent = getRecent().filter(r => r !== path);
  recent.unshift(path);
  if (recent.length > MAX_RECENT) recent = recent.slice(0, MAX_RECENT);
  await game.settings.set(MODULE_ID, "recent", recent);
}

function isFavorite(path) {
  return getFavorites().includes(path);
}

async function toggleFavorite(path) {
  let favs = getFavorites();
  if (isFavorite(path)) {
    favs = favs.filter(f => f !== path);
  } else {
    favs.unshift(path);
  }
  await saveFavorites(favs);
}

function shortName(path) {
  if (!path) return "";
  return path.split("/").filter(Boolean).pop() ?? path;
}

// ════════════════════════════════════════
//  Sidebar in den FilePicker injizieren
// ════════════════════════════════════════

/**
 * Wird bei jedem renderFilePicker aufgerufen.
 * Baut die Sidebar und hängt sie links neben den Browser.
 */
async function injectSidebar(app, html) {
  const root = html[0];
  if (!root) return;

  // Aktuellen Pfad tracken
  const currentPath = app.result?.target ?? "";
  if (currentPath) await pushRecent(currentPath);

  // Wenn Sidebar schon da ist, nur aktualisieren (bei Navigation)
  const existingSidebar = root.querySelector(".fpp-sidebar");
  if (existingSidebar) {
    refreshSidebar(existingSidebar, app, currentPath);
    return;
  }

  // Wrapper darf auch nur einmal existieren
  if (root.querySelector(".fpp-wrapper")) return;

  // FilePicker-Body finden — verschiedene Foundry-Versionen haben unterschiedliche Strukturen
  const body = root.querySelector(".filepicker-body");
  if (!body) return; // Kein Body gefunden, nichts tun

  // Wrapper um body + sidebar
  const wrapper = document.createElement("div");
  wrapper.className = "fpp-wrapper";
  body.parentNode.insertBefore(wrapper, body);
  wrapper.appendChild(body);

  // Sidebar bauen und links einfügen
  const sidebar = buildSidebar(app, currentPath);
  wrapper.insertBefore(sidebar, body);
}

function buildSidebar(app, currentPath) {
  const sidebar = document.createElement("div");
  sidebar.className = "fpp-sidebar";
  sidebar.innerHTML = renderSidebarHTML(currentPath);
  activateSidebarListeners(sidebar, app, currentPath);
  return sidebar;
}

function renderSidebarHTML(currentPath) {
  const favs   = getFavorites();
  const recent = getRecent();
  const isFav  = isFavorite(currentPath);

  // Favoriten-Liste
  const favItems = favs.length === 0
    ? `<div class="fpp-empty">Noch keine Favoriten.<br><small>Stern oben anklicken.</small></div>`
    : favs.map(path => `
        <div class="fpp-item fpp-fav-item ${path === currentPath ? "fpp-item--active" : ""}" data-path="${path}" title="${path}">
          <i class="fas fa-folder fpp-item-icon"></i>
          <span class="fpp-item-label">${shortName(path)}</span>
          <button class="fpp-item-remove" data-path="${path}" title="Favorit entfernen">
            <i class="fas fa-times"></i>
          </button>
        </div>`
      ).join("");

  // Verlauf-Liste
  const recentItems = recent.length === 0
    ? `<div class="fpp-empty">Noch kein Verlauf.</div>`
    : recent.map(path => `
        <div class="fpp-item fpp-recent-item ${path === currentPath ? "fpp-item--active" : ""}" data-path="${path}" title="${path}">
          <i class="fas fa-clock fpp-item-icon"></i>
          <span class="fpp-item-label">${shortName(path)}</span>
        </div>`
      ).join("");

  return `
    <!-- Aktueller Ordner + Stern -->
    <div class="fpp-current">
      <button class="fpp-star-btn ${isFav ? "fpp-star-btn--active" : ""}" data-path="${currentPath}"
        title="${isFav ? "Aus Favoriten entfernen" : "Aktuellen Ordner als Favorit speichern"}">
        <i class="fas fa-star"></i>
      </button>
      <span class="fpp-current-label" title="${currentPath}">${shortName(currentPath) || "Wurzel"}</span>
    </div>

    <!-- Tabs -->
    <div class="fpp-tabs">
      <button class="fpp-tab fpp-tab--active" data-tab="favorites">
        <i class="fas fa-star"></i> Favoriten
        <span class="fpp-badge">${favs.length}</span>
      </button>
      <button class="fpp-tab" data-tab="recent">
        <i class="fas fa-clock"></i> Verlauf
      </button>
    </div>

    <!-- Tab-Inhalte -->
    <div class="fpp-tab-content fpp-tab-content--active" data-content="favorites">
      <div class="fpp-list">${favItems}</div>
    </div>
    <div class="fpp-tab-content" data-content="recent">
      <div class="fpp-list">${recentItems}</div>
      ${recent.length > 0 ? `<button class="fpp-clear-btn"><i class="fas fa-trash-alt"></i> Verlauf löschen</button>` : ""}
    </div>
  `;
}

function activateSidebarListeners(sidebar, app, currentPath) {
  // Tab-Wechsel
  sidebar.querySelectorAll(".fpp-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      sidebar.querySelectorAll(".fpp-tab").forEach(t => t.classList.remove("fpp-tab--active"));
      sidebar.querySelectorAll(".fpp-tab-content").forEach(c => c.classList.remove("fpp-tab-content--active"));
      tab.classList.add("fpp-tab--active");
      sidebar.querySelector(`.fpp-tab-content[data-content="${tab.dataset.tab}"]`)
        ?.classList.add("fpp-tab-content--active");
    });
  });

  // Stern-Button — aktuellen Ordner favorisieren
  sidebar.querySelector(".fpp-star-btn")?.addEventListener("click", async (ev) => {
    const path = ev.currentTarget.dataset.path;
    if (!path) return;
    await toggleFavorite(path);
    refreshSidebar(sidebar, app, path);
  });

  // Klick auf Favorit → navigieren
  sidebar.querySelectorAll(".fpp-fav-item").forEach(item => {
    item.addEventListener("click", async ev => {
      if (ev.target.closest(".fpp-item-remove")) return;
      const path = item.dataset.path;
      await pushRecent(path);
      app.browse(path);
    });
  });

  // Favorit entfernen
  sidebar.querySelectorAll(".fpp-item-remove").forEach(btn => {
    btn.addEventListener("click", async ev => {
      ev.stopPropagation();
      const path = btn.dataset.path;
      await toggleFavorite(path);
      refreshSidebar(sidebar, app, currentPath);
    });
  });

  // Klick auf Verlauf-Eintrag → navigieren
  sidebar.querySelectorAll(".fpp-recent-item").forEach(item => {
    item.addEventListener("click", async () => {
      const path = item.dataset.path;
      await pushRecent(path);
      app.browse(path);
    });
  });

  // Verlauf löschen
  sidebar.querySelector(".fpp-clear-btn")?.addEventListener("click", async () => {
    await game.settings.set(MODULE_ID, "recent", []);
    refreshSidebar(sidebar, app, currentPath);
  });
}

function refreshSidebar(sidebar, app, currentPath) {
  sidebar.innerHTML = renderSidebarHTML(currentPath);
  activateSidebarListeners(sidebar, app, currentPath);
}

// ════════════════════════════════════════
//  Hook
// ════════════════════════════════════════

Hooks.on("renderFilePicker", (app, html) => {
  injectSidebar(app, html);
});

// ════════════════════════════════════════
//  Init
// ════════════════════════════════════════

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "favorites", {
    scope: "client",
    config: false,
    type: Array,
    default: [],
  });

  game.settings.register(MODULE_ID, "recent", {
    scope: "client",
    config: false,
    type: Array,
    default: [],
  });

  console.log(`%c[FilePicker Pro] %cgeladen ✓`, "color:#60c0f0;font-weight:bold", "color:#80c090");
});

Hooks.once("ready", () => {
  console.log(`%c[FilePicker Pro] %cbereit`, "color:#60c0f0;font-weight:bold", "color:#80c090");
});
