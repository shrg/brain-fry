// Brain Fry — генератор примеров (§2, §6). На вход — включённые категории и
// настройки; на выход — объект примера с готовой английской фразой для TTS.

import { CONFIG } from "./config.js";
import { cardinal, yearForms, currencyToWords, CURRENCIES } from "./numwords.js";
import { randInt, chance, pick, formatMoney } from "./util.js";

const NUMBER_CATS = ["num3", "num4", "num5", "num6"];

// Какой пул обрамляющих фраз использовать для категории.
function framingGroup(category) {
  if (category === "currency") return "price";
  if (category === "year") return "year";
  return "number";
}

// Применить обрамление (§2.4), если включено. Возвращает финальную фразу для TTS.
function applyFraming(category, words, settings) {
  if (!settings.framing) return words;
  if (chance(CONFIG.framing.bareRatio)) return words; // иногда «голое» число
  const tpl = pick(CONFIG.framing.templates[framingGroup(category)]);
  return tpl.replace("{N}", words);
}

// --- числа 3–6 знаков ---
function genNumber(category, settings) {
  const [min, max] = CONFIG.numberRanges[category];
  const n = randInt(min, max);
  const words = cardinal(n, { useAnd: chance(CONFIG.andProbability) });
  return {
    category,
    currency: null,
    expected: n,            // числовое значение для сравнения
    allowDecimal: false,
    displayAnswer: String(n),
    rawWords: words,
    spokenForm: applyFraming(category, words, settings),
  };
}

// --- годы ---
function genYear(settings) {
  const [min, max] = CONFIG.yearRange;
  const y = randInt(min, max);
  const forms = yearForms(y);
  const words = pick(forms); // рандом среди валидных форм (§3.2)
  return {
    category: "year",
    currency: null,
    expected: y,
    allowDecimal: false,
    displayAnswer: String(y),
    rawWords: words,
    spokenForm: applyFraming("year", words, settings),
  };
}

// --- валюты ---
function genCurrency(enabledCurrencies, settings) {
  const code = pick(enabledCurrencies);
  const meta = CURRENCIES[code];
  const [min, max] = CONFIG.currencyRanges[code];
  const units = randInt(min, max);
  // копейки только для USD/EUR/GBP; иногда 0 (тогда озвучка без дробной части)
  const sub = meta.hasCents ? (chance(0.7) ? randInt(0, 99) : 0) : 0;

  const words = currencyToWords(
    { code, units, sub },
    { useAnd: chance(CONFIG.andProbability) }
  );
  const expected = meta.hasCents ? units + sub / 100 : units;
  return {
    category: "currency",
    currency: code,
    expected,
    allowDecimal: meta.hasCents,
    displayAnswer: formatMoney(units, sub, meta.hasCents),
    rawWords: words,
    spokenForm: applyFraming("currency", words, settings),
  };
}

/**
 * Сгенерировать один пример из включённых категорий.
 * @param {string[]} categories  включённые категории (num3..num6, currency, year)
 * @param {string[]} currencies  включённые коды валют (если выбрана categery currency)
 * @param {object} settings      настройки (framing, ...)
 */
export function generateItem(categories, currencies, settings) {
  const cat = pick(categories);
  if (cat === "year") return genYear(settings);
  if (cat === "currency") return genCurrency(currencies, settings);
  if (NUMBER_CATS.indexOf(cat) !== -1) return genNumber(cat, settings);
  throw new Error("generateItem: неизвестная категория " + cat);
}

/**
 * Проверка ответа (§6): точное совпадение; валюты с копейками — как числа
 * (200.5 == 200.50). Возвращает true/false.
 */
export function checkAnswer(item, inputStr) {
  const s = String(inputStr).trim();
  if (s === "") return false;
  if (item.allowDecimal) {
    const v = parseFloat(s);
    if (!Number.isFinite(v)) return false;
    return Math.abs(v - item.expected) < 0.005;
  }
  // целое: запрещаем точку/мусор
  if (!/^\d+$/.test(s)) return false;
  return parseInt(s, 10) === item.expected;
}
