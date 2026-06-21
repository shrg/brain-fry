// Brain Fry — движок «число → английская фраза» (§3 ТЗ)
// Чистые детерминированные функции. Вся случайность (выбор формы года,
// вставка "and", выбор валюты) — снаружи, чтобы модуль покрывался юнит-тестами.

"use strict";

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

// ---------------------------------------------------------------------------
// 3.1 Кардинальные числительные
// ---------------------------------------------------------------------------

// Слова для двузначного остатка 0..99 (без сотен).
function twoDigits(n) {
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)];
  const o = n % 10;
  return o ? t + "-" + ONES[o] : t; // "eighty-four"
}

// Слова для группы 0..999. useAnd → британское "and" между сотнями и остатком.
function chunk(n, useAnd) {
  const parts = [];
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h) parts.push(ONES[h], "hundred");
  if (r) {
    if (h && useAnd) parts.push("and");
    parts.push(twoDigits(r));
  }
  return parts.join(" ");
}

/**
 * Кардинальное числительное → английские слова.
 * @param {number} n  целое >= 0 (поддержка до миллиардов)
 * @param {object} [opts]
 * @param {boolean} [opts.useAnd=false]  британская вставка "and" (§3.1)
 */
export function cardinal(n, opts = {}) {
  const useAnd = !!opts.useAnd;
  if (!Number.isFinite(n) || n < 0) throw new Error("cardinal: ожидалось целое >= 0, получено " + n);
  n = Math.floor(n);
  if (n === 0) return "zero";

  const scales = [
    ["billion", 1000000000],
    ["million", 1000000],
    ["thousand", 1000],
  ];

  const groups = [];      // куски слева направо
  let lastGroupVal = 0;   // значение младшей (последней) ненулевой группы
  let higherExists = false;

  for (const [name, div] of scales) {
    if (n >= div) {
      const g = Math.floor(n / div);
      groups.push(chunk(g, useAnd) + " " + name);
      higherExists = true;
      n %= div;
    }
  }
  if (n > 0) {
    lastGroupVal = n;
    // Британское "and" перед младшей группой < 100, если есть старшие группы.
    // Пример: 4012 → "four thousand and twelve".
    if (useAnd && higherExists && n < 100) {
      groups.push("and " + chunk(n, useAnd));
    } else {
      groups.push(chunk(n, useAnd));
    }
  }
  return groups.join(" ");
}

// ---------------------------------------------------------------------------
// 3.2 Годы — все валидные формы произношения
// ---------------------------------------------------------------------------

// Парная форма для 1000–2099: "nineteen eighty-four", "nineteen oh five",
// "nineteen hundred", "twenty twenty-four".
function pairedYear(year) {
  const hi = Math.floor(year / 100); // век, напр. 19, 20
  const lo = year % 100;             // 0..99
  const hiWords = twoDigits(hi);     // "nineteen", "twenty"
  if (lo === 0) return hiWords + " hundred";          // 1900 → nineteen hundred
  if (lo < 10) return hiWords + " oh " + ONES[lo];    // 1905 → nineteen oh five
  return hiWords + " " + twoDigits(lo);               // 1984 → nineteen eighty-four
}

/**
 * Все валидные английские формы произношения года → массив строк (без дублей).
 * Снаружи выбираем случайную с учётом весов (§3.2). Детерминированно.
 * @param {number} year  напр. 1800..2099
 */
export function yearForms(year) {
  if (!Number.isInteger(year)) throw new Error("yearForms: ожидался целый год, получено " + year);
  const forms = [];
  const add = (s) => { if (s && forms.indexOf(s) === -1) forms.push(s); };

  if (year >= 1000 && year <= 1999) {
    add(pairedYear(year));            // основная парная форма
    add(cardinal(year));              // реже — чисто кардинальная
    add(cardinal(year, { useAnd: true }));
  } else if (year === 2000) {
    add("two thousand");
  } else if (year >= 2001 && year <= 2009) {
    const u = year % 10;
    add("two thousand " + ONES[u]);            // two thousand seven
    add("two thousand and " + ONES[u]);        // two thousand and seven
    add("twenty oh " + ONES[u]);               // twenty oh seven
  } else if (year >= 2010 && year <= 2099) {
    const lo = year % 100;
    add("twenty " + twoDigits(lo));            // twenty twenty-four
    add(cardinal(year));                       // two thousand twenty-four
    add(cardinal(year, { useAnd: true }));     // two thousand and twenty-four
  } else {
    // вне 1000–2099 — фолбэк на кардинальную, формы как у обычного числа
    add(cardinal(year));
  }
  return forms;
}

// ---------------------------------------------------------------------------
// 3.3 Денежные фразы
// ---------------------------------------------------------------------------

// Метаданные валют (§2.2 / §3.3). invariant → форма не склоняется.
// hasCents → есть дробная часть; sub — слова субъединицы.
export const CURRENCIES = {
  VND: { one: "dong", many: "dong", invariant: true, hasCents: false },
  KRW: { one: "won", many: "won", invariant: true, hasCents: false },
  JPY: { one: "yen", many: "yen", invariant: true, hasCents: false },
  LKR: { one: "rupee", many: "rupees", invariant: false, hasCents: false },
  THB: { one: "baht", many: "baht", invariant: true, hasCents: false },
  CNY: { one: "yuan", many: "yuan", invariant: true, hasCents: false },
  USD: { one: "dollar", many: "dollars", invariant: false, hasCents: true, sub: { one: "cent", many: "cents" } },
  EUR: { one: "euro", many: "euros", invariant: false, hasCents: true, sub: { one: "cent", many: "cents" } },
  GBP: { one: "pound", many: "pounds", invariant: false, hasCents: true, sub: { one: "penny", many: "pence" } },
};

function unitName(meta, count) {
  if (meta.invariant) return meta.one;
  return count === 1 ? meta.one : meta.many;
}
function subName(sub, count) {
  return count === 1 ? sub.one : sub.many; // penny/pence, cent/cents
}

/**
 * Денежная сумма → английская фраза (§3.3).
 * @param {object} arg
 * @param {string} arg.code   код валюты из CURRENCIES
 * @param {number} arg.units  целая часть (>= 1 по диапазонам §2.2)
 * @param {number} [arg.sub=0]  копейки/центы/пенсы 0..99 (только для hasCents валют)
 * @param {object} [opts]
 * @param {boolean} [opts.useAnd=false]  "and" внутри кардинального числа целой части
 */
export function currencyToWords(arg, opts = {}) {
  const meta = CURRENCIES[arg.code];
  if (!meta) throw new Error("currencyToWords: неизвестная валюта " + arg.code);
  const units = Math.floor(arg.units);
  const sub = meta.hasCents ? Math.floor(arg.sub || 0) : 0;
  const useAnd = !!opts.useAnd;

  const head = cardinal(units, { useAnd }) + " " + unitName(meta, units);
  // Дробная часть: только если есть копейки и они != 0 (§3.3 — без "and zero cents").
  if (meta.hasCents && sub > 0) {
    return head + " and " + cardinal(sub) + " " + subName(meta.sub, sub);
  }
  return head;
}

// Удобный парсер ввода "200.50" → {units:200, sub:50} (для валют с копейками).
export function parseAmount(str) {
  const [i, f = ""] = String(str).trim().split(".");
  const units = parseInt(i, 10) || 0;
  const sub = f === "" ? 0 : parseInt((f + "00").slice(0, 2), 10) || 0;
  return { units, sub };
}
