// Brain Fry — слой хранения (§8). Абстрагирован за StorageAdapter,
// чтобы позже добавить синк-адаптер без переписывания сессии/статистики.

import { CONFIG } from "./config.js";

const KEYS = {
  events: "bf.events",
  sessions: "bf.sessions",
  settings: "bf.settings",
};

// Низкоуровневый адаптер: read/write пар ключ→JSON. Дефолт — localStorage.
export class LocalStorageAdapter {
  read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false; // напр. переполнение квоты — не роняем приложение
    }
  }
}

// Высокоуровневое хранилище данных приложения поверх адаптера.
export class DataStore {
  constructor(adapter) {
    this.adapter = adapter || new LocalStorageAdapter();
  }

  // ---- настройки ----
  getSettings() {
    const def = {
      rate: CONFIG.defaultRate,
      voiceMode: "default", // "default" | "random"
      framing: false,       // §2.4 усложнитель, дефолт ВЫКЛ
    };
    return Object.assign(def, this.adapter.read(KEYS.settings, {}));
  }
  saveSettings(s) { this.adapter.write(KEYS.settings, s); }

  // ---- события (на пример) ----
  getEvents() { return this.adapter.read(KEYS.events, []); }
  appendEvent(ev) {
    const all = this.getEvents();
    all.push(ev);
    this.adapter.write(KEYS.events, all);
  }

  // ---- сессии ----
  getSessions() { return this.adapter.read(KEYS.sessions, []); }
  appendSession(s) {
    const all = this.getSessions();
    all.push(s);
    this.adapter.write(KEYS.sessions, all);
  }

  // ---- экспорт / импорт (§7.4) ----
  exportData() {
    return {
      schemaVersion: CONFIG.schemaVersion,
      exportedAt: new Date().toISOString(),
      events: this.getEvents(),
      sessions: this.getSessions(),
    };
  }

  // mode: "merge" (по id, без дублей) | "replace"
  importData(data, mode = "merge") {
    if (!data || !Array.isArray(data.events) || !Array.isArray(data.sessions)) {
      throw new Error("Файл не похож на экспорт Brain Fry");
    }
    if (mode === "replace") {
      this.adapter.write(KEYS.events, data.events);
      this.adapter.write(KEYS.sessions, data.sessions);
      return { events: data.events.length, sessions: data.sessions.length };
    }
    // merge по id
    const mergeById = (existing, incoming) => {
      const seen = new Set(existing.map((x) => x.id));
      let added = 0;
      for (const item of incoming) {
        if (!seen.has(item.id)) { existing.push(item); seen.add(item.id); added++; }
      }
      return added;
    };
    const events = this.getEvents();
    const sessions = this.getSessions();
    const evAdded = mergeById(events, incoming(data.events));
    const seAdded = mergeById(sessions, incoming(data.sessions));
    this.adapter.write(KEYS.events, events);
    this.adapter.write(KEYS.sessions, sessions);
    return { events: evAdded, sessions: seAdded };
  }

  clearAll() {
    this.adapter.write(KEYS.events, []);
    this.adapter.write(KEYS.sessions, []);
  }
}

function incoming(arr) { return arr; }
