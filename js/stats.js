// Brain Fry — статистика (§7). Принцип: храним сырой лог, агрегируем на лету.

import { ALL_CATEGORIES } from "./config.js";

// Границы периода относительно now. period: day|week|month|all
export function periodStart(period, now = new Date()) {
  if (period === "all") return 0;
  const d = new Date(now);
  if (period === "day") { d.setHours(0, 0, 0, 0); return d.getTime(); }
  if (period === "week") {
    d.setHours(0, 0, 0, 0);
    const dow = (d.getDay() + 6) % 7; // понедельник = 0
    d.setDate(d.getDate() - dow);
    return d.getTime();
  }
  if (period === "month") { d.setHours(0, 0, 0, 0); d.setDate(1); return d.getTime(); }
  return 0;
}

function inPeriod(tsIso, from) {
  return new Date(tsIso).getTime() >= from;
}

// % с первой попытки по категориям (главный индикатор, §7.3)
export function firstTryByCategory(events) {
  const acc = {};
  for (const cat of ALL_CATEGORIES) acc[cat] = { first: 0, total: 0 };
  for (const e of events) {
    if (!acc[e.category]) acc[e.category] = { first: 0, total: 0 };
    acc[e.category].total++;
    if (e.firstTry) acc[e.category].first++;
  }
  const out = {};
  for (const cat of Object.keys(acc)) {
    const { first, total } = acc[cat];
    out[cat] = { total, pct: total ? Math.round((first / total) * 100) : null };
  }
  return out;
}

// Слабая категория = минимальный % с первой (при достаточной выборке)
export function weakestCategory(byCat, minSample = 3) {
  let worst = null;
  for (const cat of Object.keys(byCat)) {
    const c = byCat[cat];
    if (c.total >= minSample && c.pct != null) {
      if (!worst || c.pct < worst.pct) worst = { category: cat, pct: c.pct, total: c.total };
    }
  }
  return worst;
}

// streak дней подряд с хотя бы одной сессией, считая до сегодня (§7.3)
export function dayStreak(sessions, now = new Date()) {
  if (!sessions.length) return 0;
  const days = new Set(
    sessions.map((s) => {
      const d = new Date(s.startTs);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
  );
  const dayMs = 86400000;
  let cursor = new Date(now); cursor.setHours(0, 0, 0, 0);
  let streak = 0;
  // если сегодня нет — допускаем старт со вчера (streak ещё «жив»)
  if (!days.has(cursor.getTime())) cursor = new Date(cursor.getTime() - dayMs);
  while (days.has(cursor.getTime())) { streak++; cursor = new Date(cursor.getTime() - dayMs); }
  return streak;
}

// Недельный тренд «% с первой» за последние N недель (для графика, §7.3)
export function weeklyFirstTryTrend(events, weeks = 8, now = new Date()) {
  const weekMs = 7 * 86400000;
  const start = periodStart("week", now);
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const from = start - i * weekMs;
    const to = from + weekMs;
    buckets.push({ from, to, first: 0, total: 0 });
  }
  for (const e of events) {
    const t = new Date(e.ts).getTime();
    for (const b of buckets) {
      if (t >= b.from && t < b.to) {
        b.total++; if (e.firstTry) b.first++;
        break;
      }
    }
  }
  return buckets.map((b) => ({
    from: b.from,
    pct: b.total ? Math.round((b.first / b.total) * 100) : null,
    total: b.total,
  }));
}

// Полная сводка под выбранный период.
export function summarize(events, sessions, period, now = new Date()) {
  const from = periodStart(period, now);
  const evP = events.filter((e) => inPeriod(e.ts, from));
  const seP = sessions.filter((s) => inPeriod(s.startTs, from));

  const durationMs = seP.reduce((a, s) => a + (s.durationMs || 0), 0);
  const itemCount = evP.length;
  const sessionCount = seP.length;

  const attemptsArr = evP.map((e) => e.attempts).filter((x) => Number.isFinite(x));
  const msArr = evP.map((e) => e.msToFirstCorrect).filter((x) => Number.isFinite(x) && x >= 0);
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

  const byCat = firstTryByCategory(evP);

  return {
    period,
    practice: { durationMs, itemCount, sessionCount },
    firstTryByCategory: byCat,
    avgAttempts: avg(attemptsArr),
    avgMsToFirstCorrect: avg(msArr),
    weakest: weakestCategory(byCat),
    streak: dayStreak(sessions, now), // streak — всегда по всем сессиям
    trend: weeklyFirstTryTrend(events, 8, now), // тренд — на всей истории
  };
}
