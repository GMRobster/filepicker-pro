# Asset Navigator — FoundryVTT Modul

Kein Klick-Marathon mehr durch den Verzeichnisbaum. Asset Navigator gibt dir schnellen Zugriff auf deine am häufigsten genutzten Asset-Ordner.

---

## Features

### 🚀 Quick Access Overlay (`Ctrl+Space`)
- Öffnet ein Overlay-Panel von überall in Foundry
- **Favoriten-Tab**: Deine manuell gespeicherten Lieblingsordner
- **Zuletzt verwendet**: Automatisch getrackte, kürzlich geöffnete Pfade
- **Suche**: Filtert live über Favoriten + Verlauf
- Tastaturnavigation: `↑`/`↓` + `Enter` zum Öffnen

### ⭐ Favoriten-System
- Rechtsklick auf einen Ordner im FilePicker → „Als Favorit hinzufügen"
- Oder: Stern-Button im Overlay
- Oder: `+`-Button in der Bookmark-Leiste im FilePicker

### 📌 Bookmark-Leiste im FilePicker
- Direkt unterhalb des FilePicker-Headers
- Ein Klick auf einen Chip navigiert sofort zum Ordner
- Kein Scrollen, kein Klicken durch Ebenen

### 🕐 Verlauf (automatisch)
- Jeder im FilePicker geöffnete Ordner wird automatisch getrackt
- Einstellbar: 5–100 Einträge (Standard: 20)
- Verlauf jederzeit löschbar

### ⌨️ Kürzel anpassbar
In den Moduleinstellungen das Tastenkürzel ändern (Standard: `ctrl+space`).  
Format: `ctrl+space`, `alt+a`, `shift+f`, etc.

---

## Installation

### Option A — Manuell (empfohlen für Entwicklung)
1. Diesen Ordner nach `FoundryVTT/Data/modules/asset-navigator/` kopieren
2. Foundry neu starten
3. Modul in den World-Einstellungen aktivieren

### Option B — via module.json URL
In Foundry unter „Module installieren" die URL zur `module.json` eingeben.

---

## Einstellungen

| Einstellung | Beschreibung | Standard |
|---|---|---|
| Anzahl gespeicherter Pfade | Wie viele Verlaufseinträge gespeichert werden | 20 |
| Tastenkürzel | Kürzel zum Öffnen des Overlays | `ctrl+space` |

*Alle Einstellungen sind pro Client (nicht per Welt).*

---

## API

Andere Module können die API nutzen:

```js
const api = game.modules.get("asset-navigator").api;

api.toggleOverlay();          // Overlay öffnen/schließen
api.addFavorite("/path/to/"); // Favorit hinzufügen/entfernen
api.getFavorites();           // Array aller Favoriten
api.getRecent();              // Array zuletzt geöffneter Pfade
```

---

## Kompatibilität

- Foundry VTT v11 — v12
- Alle Systeme (PF2e, DnD5e, etc.)
- Keine externen Abhängigkeiten

---

## Geplante Features (v1.1)
- [ ] Favoriten-Gruppen / Kategorien
- [ ] Drag & Drop aus dem Overlay direkt auf die Szene
- [ ] Vorschau-Thumbnails für Bilder
- [ ] Export/Import der Favoriten als JSON
