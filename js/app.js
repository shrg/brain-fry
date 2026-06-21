// Brain Fry — главный контроллер. Связывает экраны, движок, TTS, хранилище и
// статистику. Логика сессии — §6, статистика — §7.

import { CONFIG, CATEGORY_LABELS, ALL_CATEGORIES } from "./config.js";
import { CURRENCIES } from "./numwords.js";
import { DataStore } from "./storage.js";
import { TTS } from "./tts.js";
import { generateItem, checkAnswer } from "./generator.js";
import { Keypad } from "./keyboard.js";
import { summarize } from "./stats.js";
import { uid } from "./util.js";

const ALL_CURRENCIES = Object.keys(CURRENCIES);
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const store = new DataStore();
const tts = new TTS();
let settings = store.getSettings();

// постоянный выбор категорий/валют — в настройках
settings.categories = settings.categories || ["num3", "num4"];
settings.currencies = settings.currencies || ALL_CURRENCIES.slice();

let keypad = null;

// ---- состояние сессии ----
let session = null; // { id, startTs, count, categories, timerId }
let item = null;    // текущий пример
let attempts = 0;
let wrongCount = 0;
let revealed = false;
let firstSpeechEndTs = 0;
let itemVoice = null;

// =====================================================================
// Навигация
// =====================================================================
function go(screen) {
  $$(".screen").forEach((s) => s.classList.remove("active"));
  $("#screen-" + screen).classList.add("active");
  window.scrollTo(0, 0);
  if (screen === "stats") renderStats();
  if (screen === "settings") renderSettings();
}

// =====================================================================
// SETUP
// =====================================================================
function buildSetup() {
  // чекбоксы категорий
  const list = $("#cat-list");
  list.innerHTML = "";
  for (const cat of ALL_CATEGORIES) {
    const id = "cat-" + cat;
    const row = document.createElement("label");
    row.className = "check-row";
    row.innerHTML =
      '<input type="checkbox" id="' + id + '" value="' + cat + '" ' +
      (settings.categories.indexOf(cat) !== -1 ? "checked" : "") + ' />' +
      '<span>' + CATEGORY_LABELS[cat] + '</span>';
    list.appendChild(row);
    row.querySelector("input").addEventListener("change", onCatChange);
  }

  // чипы валют
  const chips = $("#currency-chips");
  chips.innerHTML = "";
  for (const code of ALL_CURRENCIES) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (settings.currencies.indexOf(code) !== -1 ? " on" : "");
    b.textContent = code;
    b.addEventListener("click", () => {
      const i = settings.currencies.indexOf(code);
      if (i === -1) settings.currencies.push(code);
      else if (settings.currencies.length > 1) settings.currencies.splice(i, 1);
      b.classList.toggle("on");
      persistSettings();
    });
    chips.appendChild(b);
  }
  $("#currency-toggle").addEventListener("click", () => {
    $("#currency-chips").classList.toggle("hidden");
  });

  onCatChange();
}

function selectedCategories() {
  return $$("#cat-list input:checked").map((i) => i.value);
}

function onCatChange() {
  const cats = selectedCategories();
  settings.categories = cats;
  persistSettings();
  $("#currency-box").classList.toggle("hidden", cats.indexOf("currency") === -1);
  const ok = cats.length > 0;
  $("#start-btn").disabled = !ok;
  $("#setup-hint").textContent = ok ? "" : "Выбери хотя бы одну категорию";
}

// =====================================================================
// SESSION (§6)
// =====================================================================
function startSession() {
  const cats = selectedCategories();
  if (!cats.length) return;
  tts.prime(); // §4.2 прайминг по жесту

  session = {
    id: uid(),
    startTs: Date.now(),
    count: 0,
    categories: cats.slice(),
  };
  session.timerId = setInterval(updateTimer, 1000);
  updateTimer();
  $("#progress").textContent = "0";

  go("session");
  keypad.setAllowDot(false);
  nextItem();
}

function nextItem() {
  attempts = 0; wrongCount = 0; revealed = false; firstSpeechEndTs = 0;
  keypad.clear();
  $("#answer-display").innerHTML = "&nbsp;";
  $("#feedback").innerHTML = "&nbsp;";
  $("#feedback").className = "feedback";

  item = generateItem(session.categories, settings.currencies, settings);
  keypad.setAllowDot(item.allowDecimal);

  // фиксируем голос на весь пример (повторы — тем же голосом и скоростью)
  itemVoice = tts.chooseVoice(settings.voiceMode);
  playItem(true);
}

function playItem(isFirst) {
  tts.speak(item.spokenForm, { rate: settings.rate, voice: itemVoice }).then((res) => {
    if (isFirst && firstSpeechEndTs === 0) firstSpeechEndTs = res.endTs;
  });
}

function onSubmit(value) {
  if (!session || !item || revealed) return;
  if (value.trim() === "") return;
  attempts++;

  if (checkAnswer(item, value)) {
    const ms = firstSpeechEndTs ? Math.round(performance.now() - firstSpeechEndTs) : null;
    logEvent({ firstTry: wrongCount === 0, skipped: false, msToFirstCorrect: ms });
    flashCorrect();
    session.count++;
    $("#progress").textContent = String(session.count);
    setTimeout(nextItem, 650);
  } else {
    // §6.5 неверно → бесконечный повтор того же числа той же скоростью, ответ скрыт
    wrongCount++;
    keypad.clear();
    $("#answer-display").innerHTML = "&nbsp;";
    flashWrong();
    playItem(false);
  }
}

function skip() {
  if (!session || !item || revealed) return;
  revealed = true;
  logEvent({ firstTry: false, skipped: true, msToFirstCorrect: null });
  $("#answer-display").textContent = item.displayAnswer;
  $("#feedback").textContent = "Ответ: " + item.displayAnswer;
  $("#feedback").className = "feedback skip";
  session.count++;
  $("#progress").textContent = String(session.count);
  setTimeout(nextItem, 1400);
}

function stopSession() {
  if (!session) return;
  tts.cancel();
  clearInterval(session.timerId);
  const endTs = Date.now();
  store.appendSession({
    sessionId: session.id,
    startTs: new Date(session.startTs).toISOString(),
    endTs: new Date(endTs).toISOString(),
    durationMs: endTs - session.startTs,
    categories: session.categories,
    itemCount: session.count,
  });
  const done = session.count;
  session = null; item = null;
  go("stats");
  $("#period-tabs [data-p='day']").click();
  toast(done + " примеров за сессию");
}

function logEvent({ firstTry, skipped, msToFirstCorrect }) {
  store.appendEvent({
    id: uid(),
    ts: new Date().toISOString(),
    category: item.category,
    currency: item.currency,
    answer: item.displayAnswer,
    spokenForm: item.spokenForm,
    voice: itemVoice ? itemVoice.name : "default",
    attempts,
    firstTry,
    skipped,
    msToFirstCorrect,
    sessionId: session.id,
  });
}

function flashCorrect() {
  const f = $("#feedback");
  f.textContent = "✓ Верно";
  f.className = "feedback good";
}
function flashWrong() {
  const f = $("#feedback");
  f.textContent = "✗ Ещё раз";
  f.className = "feedback bad";
  const la = $(".listen-area");
  la.classList.remove("shake"); void la.offsetWidth; la.classList.add("shake");
}

function updateTimer() {
  if (!session) return;
  const s = Math.floor((Date.now() - session.startTs) / 1000);
  const m = Math.floor(s / 60);
  $("#session-timer").textContent = m + ":" + String(s % 60).padStart(2, "0");
}

// =====================================================================
// STATS (§7)
// =====================================================================
let statsPeriod = "week";

function renderStats() {
  const events = store.getEvents();
  const sessions = store.getSessions();
  const sum = summarize(events, sessions, statsPeriod);
  const body = $("#stats-body");

  if (events.length === 0) {
    body.innerHTML = '<div class="card"><p class="hint">Пока нет данных. Проведи сессию — здесь появится прогресс.</p></div>';
    return;
  }

  const mins = Math.round(sum.practice.durationMs / 60000);
  const fmtMs = sum.avgMsToFirstCorrect != null ? (sum.avgMsToFirstCorrect / 1000).toFixed(1) + " с" : "—";
  const fmtAtt = sum.avgAttempts != null ? sum.avgAttempts.toFixed(2) : "—";

  let catRows = "";
  for (const cat of ALL_CATEGORIES) {
    const c = sum.firstTryByCategory[cat];
    if (!c || !c.total) continue;
    const pct = c.pct == null ? "—" : c.pct + "%";
    catRows +=
      '<div class="bar-row"><span class="bar-label">' + CATEGORY_LABELS[cat] + '</span>' +
      '<span class="bar-track"><span class="bar-fill" style="width:' + (c.pct || 0) + '%"></span></span>' +
      '<span class="bar-val">' + pct + ' <small>(' + c.total + ')</small></span></div>';
  }

  const weak = sum.weakest
    ? '<div class="weak">Слабая категория: <b>' + CATEGORY_LABELS[sum.weakest.category] +
      '</b> — ' + sum.weakest.pct + '% с первой</div>'
    : "";

  body.innerHTML =
    '<div class="card metrics">' +
      metric("Практика", mins + " мин") +
      metric("Примеров", sum.practice.itemCount) +
      metric("Сессий", sum.practice.sessionCount) +
      metric("Streak", sum.streak + " дн") +
      metric("Ср. повторов", fmtAtt) +
      metric("Ср. время ответа", fmtMs) +
    '</div>' +
    '<div class="card"><h2>% с первой попытки</h2>' + (catRows || '<p class="hint">Нет данных за период</p>') + weak + '</div>' +
    '<div class="card"><h2>Тренд «% с первой» по неделям</h2>' + trendChart(sum.trend) + '</div>';
}

function metric(label, val) {
  return '<div class="metric"><div class="metric-val">' + val + '</div><div class="metric-label">' + label + '</div></div>';
}

function trendChart(trend) {
  const W = 320, H = 120, pad = 24;
  const pts = trend.filter((b) => b.pct != null);
  if (pts.length < 2) return '<p class="hint">Нужно больше недель с практикой для графика.</p>';
  const n = trend.length;
  const x = (i) => pad + (i * (W - 2 * pad)) / (n - 1);
  const y = (v) => H - pad - (v / 100) * (H - 2 * pad);
  let d = "", dots = "";
  let started = false;
  trend.forEach((b, i) => {
    if (b.pct == null) return;
    d += (started ? " L" : "M") + x(i).toFixed(1) + " " + y(b.pct).toFixed(1);
    dots += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(b.pct).toFixed(1) + '" r="3.5" fill="#ff5a36"/>';
    started = true;
  });
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="trend">' +
    '<line x1="' + pad + '" y1="' + y(0) + '" x2="' + (W - pad) + '" y2="' + y(0) + '" stroke="#34202b"/>' +
    '<line x1="' + pad + '" y1="' + y(100) + '" x2="' + (W - pad) + '" y2="' + y(100) + '" stroke="#34202b" stroke-dasharray="3 3"/>' +
    '<text x="2" y="' + (y(100) + 4) + '" fill="#b59a93" font-size="9">100%</text>' +
    '<text x="6" y="' + (y(0) + 4) + '" fill="#b59a93" font-size="9">0%</text>' +
    '<path d="' + d + '" fill="none" stroke="#ff5a36" stroke-width="2.5"/>' + dots + '</svg>';
}

function bindStats() {
  $$("#period-tabs .tab").forEach((t) => {
    t.addEventListener("click", () => {
      $$("#period-tabs .tab").forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      statsPeriod = t.dataset.p;
      renderStats();
    });
  });

  $("#export-btn").addEventListener("click", () => {
    const data = store.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "brain-fry-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  $("#import-btn").addEventListener("click", () => $("#import-file").click());
  $("#import-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const res = store.importData(data, "merge");
        toast("Импортировано: +" + res.events + " событий");
        renderStats();
      } catch (err) {
        toast("Ошибка импорта: " + err.message);
      }
      $("#import-file").value = "";
    };
    reader.readAsText(file);
  });
}

// =====================================================================
// SETTINGS (§5.4)
// =====================================================================
function renderSettings() {
  // пресеты скорости (кнопки, не ползунок)
  const rp = $("#rate-presets");
  rp.innerHTML = "";
  for (const p of CONFIG.ratePresets) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (Math.abs(settings.rate - p.value) < 0.001 ? " on" : "");
    b.textContent = p.label;
    b.addEventListener("click", () => {
      settings.rate = p.value; persistSettings(); renderSettings();
    });
    rp.appendChild(b);
  }

  // режим голоса
  const vm = $("#voice-modes");
  vm.innerHTML = "";
  [["default", "По умолчанию"], ["random", "Случайный"]].forEach(([mode, label]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (settings.voiceMode === mode ? " on" : "");
    b.textContent = label;
    b.addEventListener("click", () => {
      settings.voiceMode = mode; persistSettings(); renderSettings();
    });
    vm.appendChild(b);
  });

  // обрамляющие фразы
  $("#framing-toggle").checked = !!settings.framing;

  // диагностика голосов
  const all = tts.allEnVoices();
  const usable = new Set(tts.usableVoices().map((v) => v.name));
  const diag = $("#voice-diag");
  if (!all.length) {
    diag.innerHTML = '<p class="hint">Голоса ещё не подгрузились или их 0. На iOS список бывает коротким — это норма, озвучка идёт системным голосом.</p>';
  } else {
    diag.innerHTML = '<p class="hint">Найдено английских: ' + all.length +
      ', из них годных для тренировки: ' + usable.size + '.</p>' +
      all.map((v) =>
        '<div class="vrow' + (usable.has(v.name) ? "" : " novelty") + '">' +
        '<span>' + v.name + (usable.has(v.name) ? "" : " <small>(прикол)</small>") + '</span>' +
        '<span class="hint">' + v.lang + '</span></div>'
      ).join("");
  }
}

function bindSettings() {
  $("#framing-toggle").addEventListener("change", (e) => {
    settings.framing = e.target.checked; persistSettings();
  });
  $("#clear-btn").addEventListener("click", () => {
    if (confirm("Удалить всю статистику? Это необратимо. Сначала лучше сделать экспорт.")) {
      store.clearAll(); toast("Статистика очищена"); renderStats();
    }
  });
}

// =====================================================================
// Общее
// =====================================================================
function persistSettings() { store.saveSettings(settings); }

let toastTimer = null;
function toast(msg) {
  let t = $("#toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

function init() {
  keypad = new Keypad($("#keypad"), { onChange: (v) => {
    if (!revealed) $("#answer-display").textContent = v || " ";
  }, onSubmit });

  buildSetup();
  bindStats();
  bindSettings();

  $("#start-btn").addEventListener("click", startSession);
  $("#repeat-btn").addEventListener("click", () => { if (item && !revealed) playItem(false); });
  $("#skip-btn").addEventListener("click", skip);
  $("#stop-btn").addEventListener("click", stopSession);
  $$("[data-go]").forEach((b) => b.addEventListener("click", () => go(b.dataset.go)));

  // регистрация service worker (оффлайн-оболочка)
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
}

init();
