// Brain Fry — конфигурация. Всё, что ТЗ просит «вынести в конфиг»: диапазоны,
// веса, фразы-обрамления, вероятности, пресеты скорости, блок-лист голосов.

export const CONFIG = {
  schemaVersion: 1,

  // §2.1 разрядность чисел -> [min, max]
  numberRanges: {
    num3: [100, 999],
    num4: [1000, 9999],
    num5: [10000, 99999],
    num6: [100000, 999999],
  },

  // §2.2 валюты -> [min, max] целой части
  currencyRanges: {
    VND: [10000, 5000000],
    KRW: [1000, 500000],
    JPY: [100, 100000],
    LKR: [100, 100000],
    THB: [10, 50000],
    CNY: [1, 10000],
    USD: [1, 10000],
    EUR: [1, 10000],
    GBP: [1, 10000],
  },

  // §2.3 годы
  yearRange: [1800, 2099],

  // §3.1 вероятность британского «and» на озвучку
  andProbability: 0.5,

  // §2.4 обрамляющие фразы. Комбинаторика: intro + {число} + outro.
  // intro и outro склеиваются случайно → сотни сочетаний из компактных пулов.
  // Фразы НЕ содержат других чисел. outro уже включают свою пунктуацию/пробел.
  framing: {
    bareRatio: 0.2,      // доля «голых» чисел, когда обрамление включено
    introChance: 0.85,   // вероятность, что будет «начало» (иначе число в начале)
    outroChance: 0.55,   // вероятность, что будет «концовка»
    pools: {
      price: {
        intro: [
          "That'll be", "That will be", "The total comes to", "The total is",
          "That comes to", "It comes to", "Your total is", "It costs",
          "That'll cost you", "Comes to", "That's", "It's",
          "The grand total is", "That brings it to", "All together it's",
        ],
        outro: [
          ", please", ", thanks", ", thank you", " all together", " in total",
          " even", " exactly", " on the dot", ", if you don't mind", " all in",
        ],
      },
      year: {
        intro: [
          "Back in", "It was", "It was the year", "That happened in",
          "Sometime around", "Way back in", "All the way back in",
          "It all started in", "This was in", "Around", "It began in",
          "History was made in", "We're talking about", "Long ago, in",
        ],
        outro: [
          ", believe it or not", ", if memory serves", ", long ago",
          ", of all years", ", as it happens", " or thereabouts",
        ],
      },
      number: {
        intro: [
          "We shipped", "We counted", "There were", "We had", "They sent",
          "I counted", "We received", "About", "Roughly", "Some", "Nearly",
          "We ordered", "The count was", "We're expecting", "We found",
        ],
        outro: [
          " units", " of them", " in total", " all told", " items",
          " pieces", " in all", " or so", " altogether",
        ],
      },
    },
  },

  // §4 скорость речи — пресеты-кнопки (без ползунка)
  ratePresets: [
    { label: "0.7×", value: 0.7 },
    { label: "0.85×", value: 0.85 },
    { label: "1×", value: 1.0 },
    { label: "1.15×", value: 1.15 },
  ],
  defaultRate: 1.0,

  // §4.1 «приколы»-голоса macOS/iOS — исключаем из случайного выбора,
  // т.к. поют/роботят и портят восприятие числа (диагностика всё равно их показывает)
  noveltyVoices: [
    "Albert", "Bad News", "Bahh", "Bells", "Boing", "Bubbles", "Cellos",
    "Wobble", "Fred", "Good News", "Jester", "Junior", "Kathy", "Organ",
    "Pipe Organ", "Superstar", "Ralph", "Trinoids", "Whisper", "Zarvox",
    "Deranged", "Hysterical", "Princess",
  ],
};

// Понятные названия категорий для UI и статистики
export const CATEGORY_LABELS = {
  num3: "3-значные",
  num4: "4-значные",
  num5: "5-значные",
  num6: "6-значные",
  currency: "Валюты",
  year: "Годы",
};

export const ALL_CATEGORIES = ["num3", "num4", "num5", "num6", "currency", "year"];
