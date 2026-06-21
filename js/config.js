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

  // §2.4 обрамляющие фразы
  framing: {
    bareRatio: 0.35, // доля «голых» чисел, когда обрамление включено
    // шаблоны с плейсхолдером {N}; без посторонних чисел
    templates: {
      price: [
        "That'll be {N}, please",
        "The total comes to {N}",
        "It costs {N} all together",
        "{N}, please",
      ],
      year: [
        "Back in {N}",
        "It was the year {N}",
        "That happened in {N}",
      ],
      number: [
        "We shipped {N} units",
        "About {N} of them",
        "The count was {N}",
      ],
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
