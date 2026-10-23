/*
 * The Museum of the Pixel Universe.
 *
 * Two jobs:
 *   1. Exhibits. The history of the universe, computed live from every site: champions, records, a timeline, the laws.
 *   2. The archive. A monthly snapshot of every site's results, committed to this repo as JSON (archive/YYYY-MM.json)
 *      by tools/accession.mjs, nightly via GitHub Actions. The archive is the universe's memory:
 *        - Eras: when a site's rules change, its old results can be read from here instead of keeping old code.
 *        - Conservation: the Museum recomputes archived months with today's code and reports any month whose
 *          history has changed, so an accidental rewrite is caught.
 *
 * A reader of everything; nothing depends on it for its own history. Glacial and the Weather Bureau are required;
 * the Senate, City and Bookmaker are optional (their exhibits and archive sections are marked missing).
 * snapshotMonth() is shared with the Node accession tool, so the browser and the tool always agree.
 *
 * Seeds: none needed. Registers window.PixelUniverse.museum.
 */
(function (root) {
  'use strict';

  const VERSION = '0.1.0';
  const SNAPSHOT_FORMAT = 1;
  const H = 3600000, DAY = 86400000;
  const EPOCH = Date.UTC(2025, 11, 3);
  const OPENS = Date.UTC(2026, 10, 1); // the Museum opens its doors; its collection reaches back to the epoch

  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const ymd = (ms) => { const d = new Date(ms); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
  const iso = (ms) => new Date(ms).toISOString().replace('.000Z', 'Z');
  const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100;
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthKey = (y, m) => y + '-' + pad(m + 1);
  const monthName = (key) => { const [y, m] = key.split('-'); return MONTHS[+m - 1] + ' ' + y; };

  // ---------------------------------------------------------------- upstream
  const U = () => root.PixelUniverse || {};
  const G = () => root.G;
  const ok = (s) => !!(s && (!s.ready || s.ready()));
  const desk = { weather: () => ok(U().climate) && U().climate, senate: () => ok(U().senate) && U().senate, city: () => ok(U().city) && U().city, bookmaker: () => ok(U().bookmaker) && U().bookmaker };
  const ready = () => { const g = G(); return !!(g && g.buildLeague && g.PIXELS && desk.weather()); };
  const pname = (id) => (G().PX[id] ? G().PX[id].name : id);

  let L = null;
  function league(t) {
    if (!L || L.built < t) L = G().buildLeague(t);
    return L;
  }
  const endOf = (r) => r.startMs + r.windowMs;
  const raceName = (r) => (r.kind === 'gp' ? r.name : 'Daily Crawl #' + r.number);

  // ================================================================ exhibits
  /** The Hall of Champions: one portrait per pixel, with its career as it stood at time t. */
  function champions(t) {
    const g = G(), lg = league(t);
    const done = lg.races.filter((r) => endOf(r) <= t);
    return g.PIXELS.map((p) => {
      const s = lg.stats[p.id];
      let peak = 1500, peakAt = null;
      for (const h of s.ratingHistory) if (h.ms <= t && h.r > peak) { peak = h.r; peakAt = h.ms; }
      const gpWins = done.filter((r) => r.kind === 'gp' && r.winner.id === p.id).map((r) => r.name);
      return {
        id: p.id, name: p.name, color: p.color, bio: p.bio,
        starts: s.starts, wins: s.wins, crawlWins: s.crawlWins, gpWins: gpWins.length, gpTitles: gpWins, podiums: s.podiums,
        bestStreak: s.bestStreak, rating: Math.round(lg.rating[p.id]), peak: Math.round(peak), peakAt: peakAt && ymd(peakAt),
        longestNap: s.longestNap.ms, topSpeed: Math.round(s.topSpeed.v), naps: s.naps
      };
    }).sort((a, b) => b.gpWins - a.gpWins || b.wins - a.wins || (a.id < b.id ? -1 : 1));
  }

  /** The Record Books: the standing records of every site. */
  function records(t) {
    const lg = league(t), R = lg.records, out = [];
    const add = (hall, title, holder, value, when) => out.push({ hall, title, holder, value, when });
    const race = (id) => lg.byId[id];
    const dur = (ms) => { const m = Math.round(ms / 60000); return Math.floor(m / 60) + 'h ' + pad(m % 60) + 'm'; };
    if (R.fastestCrawl.raceId) add('Racing', 'Fastest Daily Crawl', pname(R.fastestCrawl.id), dur(R.fastestCrawl.ms), raceName(race(R.fastestCrawl.raceId)));
    if (R.slowestCrawl.raceId) add('Racing', 'Slowest winning Daily Crawl', pname(R.slowestCrawl.id), dur(R.slowestCrawl.ms), raceName(race(R.slowestCrawl.raceId)));
    if (R.fastestGP.raceId) add('Racing', 'Fastest Grand Prix', pname(R.fastestGP.id), dur(R.fastestGP.ms), race(R.fastestGP.raceId).name);
    if (R.closest.raceId) add('Racing', 'Closest finish', pname(R.closest.id), r1(R.closest.px) + ' px', raceName(race(R.closest.raceId)));
    if (R.biggest.raceId) add('Racing', 'Largest winning margin', pname(R.biggest.id), Math.round(R.biggest.px) + ' px', raceName(race(R.biggest.raceId)));
    if (R.leadChanges.raceId) add('Racing', 'Most lead changes', '', R.leadChanges.count + ' changes', raceName(race(R.leadChanges.raceId)));
    if (R.longestNap.raceId) add('Racing', 'Longest nap', pname(R.longestNap.id), dur(R.longestNap.ms), raceName(race(R.longestNap.raceId)));
    if (R.topSpeed.raceId) add('Racing', 'Top speed', pname(R.topSpeed.id), Math.round(R.topSpeed.v) + ' px/h', raceName(race(R.topSpeed.raceId)));
    if (R.streak.raceId) add('Racing', 'Longest Daily Crawl winning streak', pname(R.streak.id), R.streak.count + ' wins', 'ended ' + raceName(race(R.streak.raceId)));
    // the other halls keep their records as events; the latest of each kind is the one that stands
    const latest = (events, keyOf) => { const m = {}; for (const e of events) m[keyOf(e)] = e; return Object.values(m); };
    const Wx = desk.weather();
    if (Wx) {
      const st = Wx.forecasterStats(t);
      add('Weather', 'Longest run of correct forecasts', Wx.forecaster.name, st.best + ' days', '');
      for (const e of latest(Wx.eventsBetween(EPOCH, t).filter((e) => e.type === 'weather.record'), (e) => e.data.kind)) add('Weather', e.headline.split(':')[0], '', e.headline.split(':').slice(1).join(':').split(',')[0].trim(), ymd(Date.parse(e.time)));
    }
    const C = desk.city();
    if (C) for (const e of latest(C.eventsBetween(EPOCH, t).filter((e) => e.type === 'city.record'), () => 'peak')) add('City', 'Record demand', '', r1(e.data.peak) + ' MW', ymd(Date.parse(e.time)));
    const B = desk.bookmaker();
    if (B) for (const e of latest(B.eventsBetween(EPOCH, t).filter((e) => e.type === 'record.payout' || e.type === 'record.longshot'), (e) => e.type))
      add('The Turf', e.type === 'record.payout' ? 'Largest single payout' : 'Longest-priced winner', e.data.resident || pname(e.data.pixel), e.type === 'record.payout' ? e.data.payout + ' W' : e.data.sp.toFixed(2), ymd(Date.parse(e.time)));
    return out;
  }

  /** The Timeline: every event of importance `min` or more, from every site, since the epoch. */
  function timeline(t, min) {
    min = min || 4;
    const out = [];
    const lg = league(t);
    for (const r of lg.races) if (endOf(r) <= t && r.kind === 'gp') {
      const at = r.startMs + r.winner.finishMs;
      out.push({ id: 'glacial:' + r.id + ':finish', time: iso(at), source: 'glacial', type: 'race.finish', importance: 5, headline: pname(r.winner.id) + ' wins the ' + r.name, data: { race: r.id, winner: r.winner.id } });
    }
    if (EPOCH <= t) out.push({ id: 'glacial:first-crawl', time: iso(EPOCH), source: 'glacial', type: 'universe.begins', importance: 5, headline: 'The first Daily Crawl begins, and with it the Pixel Universe', data: {} });
    for (const [k, s] of [['weather', desk.weather()], ['senate', desk.senate()], ['city', desk.city()], ['bookmaker', desk.bookmaker()]]) {
      if (!s) continue;
      for (const e of s.eventsBetween(EPOCH, t)) if (e.importance >= min) out.push(Object.assign({}, e, { source: k === 'weather' ? 'weather' : e.source }));
    }
    out.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
    return out;
  }

  /** The Law Library: what is law now, against the founding defaults, and when each law came in. */
  function laws(t) {
    const S = desk.senate();
    if (!S) return null;
    const now = S.lawsAt(t), founding = S.lawsAt(EPOCH);
    const changed = Object.keys(now).filter((k) => JSON.stringify(now[k]) !== JSON.stringify(founding[k])).map((k) => ({ key: k, now: now[k], founding: founding[k] }));
    const history = S.eventsBetween(EPOCH, t).filter((e) => e.type === 'law.in_effect').map((e) => ({ time: e.time, title: e.data.title, headline: e.headline }));
    return { now, founding, changed, history, firstSitting: S.firstSitting || null };
  }

  // ================================================================ the archive
  /**
   * A snapshot of one calendar month (UTC), as every site computes it today. Pure and deterministic.
   * Sections for sites that are missing or not yet open are recorded as such.
   */
  function snapshotMonth(year, month) {
    const from = Date.UTC(year, month, 1), to = Date.UTC(year, month + 1, 1);
    const key = monthKey(year, month);
    const lg = league(to);
    const sites = {};

    sites.glacial = {
      races: lg.races.filter((r) => endOf(r) > from && endOf(r) <= to).map((r) => ({
        id: r.id, kind: r.kind, name: raceName(r), lineup: r.lineup,
        results: r.results.map((x) => [x.id, x.finishMs === null ? null : Math.round(x.finishMs), r2(x.endX)]),
        winner: r.winner.id, marginPx: r1(r.marginPx),
        ratingDelta: Object.keys(r.ratingDelta).sort().map((id) => [id, r2(r.ratingDelta[id])])
      }))
    };

    const Wx = desk.weather();
    sites.weather = Wx ? {
      days: Wx.historyBetween(from, to).map((d) => {
        const v = d.day - DAY >= EPOCH ? Wx.verify(d.day) : null;
        return [d.date, d.max, d.min, d.rain, d.gust, d.cond, v ? (v.hit ? 1 : 0) : null];
      }),
      events: Wx.eventsBetween(from, to).filter((e) => e.importance >= 3).map((e) => [e.id, e.time, e.headline])
    } : { missing: true };

    const S = desk.senate();
    sites.senate = S ? {
      lawsAtEnd: S.lawsAt(to - 1),
      events: S.eventsBetween(from, to).filter((e) => e.importance >= 2).map((e) => [e.id, e.time, e.headline])
    } : { missing: true };

    const C = desk.city();
    sites.city = C ? {
      days: C.historyBetween(from, to).map((d) => [d.date, d.peak, d.clean, d.blackoutHours, d.unserved]),
      events: C.eventsBetween(from, to).filter((e) => e.importance >= 2).map((e) => [e.id, e.time, e.headline])
    } : { missing: true };

    const B = desk.bookmaker();
    if (!B) sites.bookmaker = { missing: true };
    else if (to <= U().bookmaker.opens) sites.bookmaker = { notOpen: true };
    else {
      const st = B.stateAt(to - 1);
      sites.bookmaker = {
        markets: B.marketsBetween(from, to).map((m) => [m.race, m.winner, m.sp, m.bets, m.taken, m.paid]),
        balancesAtEnd: st.started ? st.regulars.map((r) => [r.name, r.balance]) : []
      };
    }

    const checksums = {};
    for (const k in sites) checksums[k] = hash(JSON.stringify(sites[k])).toString(16);
    const versions = {};
    for (const [k, s] of [['weather', Wx], ['senate', S], ['city', C], ['bookmaker', B]]) if (s) versions[k] = s.version;
    return { format: SNAPSHOT_FORMAT, month: key, from: iso(from), to: iso(to), versions, checksums, sites };
  }

  /** Months that are complete at time t, oldest first, as "YYYY-MM". */
  function completeMonths(t) {
    const out = [];
    let y = 2025, m = 11;
    while (Date.UTC(y, m + 1, 1) <= t) { out.push(monthKey(y, m)); m++; if (m === 12) { m = 0; y++; } }
    return out;
  }

  /**
   * Compares an archived snapshot with the same month recomputed now.
   * For each site: 'intact', 'altered' (history has changed), 'missing' (a desk failed to load now or then),
   * or 'new' (the site has a section now but did not when archived).
   */
  function conserve(archived) {
    const [y, m] = archived.month.split('-').map(Number);
    const live = snapshotMonth(y, m - 1);
    const report = {};
    for (const k of Object.keys(Object.assign({}, archived.checksums, live.checksums))) {
      const a = archived.sites[k], l = live.sites[k];
      if (!a) report[k] = 'new';
      else if (!l || a.missing || l.missing) report[k] = 'missing';
      else report[k] = archived.checksums[k] === live.checksums[k] ? 'intact' : 'altered';
    }
    return { month: archived.month, report, live };
  }

  /** The archive's own news: a new gallery for each month catalogued. Dated, so every reader sees the same. */
  function eventsBetween(from, to) {
    const out = [];
    for (const key of completeMonths(to)) {
      const [y, m] = key.split('-').map(Number);
      const at = Date.UTC(y, m, 1) + H; // an hour after the month closes
      if (at < from || at >= to || at < OPENS) continue;
      out.push({ id: 'museum:gallery:' + key, time: iso(at), source: 'museum', type: 'gallery.opens', importance: 1,
        data: { month: key }, headline: 'The Museum opens its ' + monthName(key) + ' gallery and adds the month to the archive' });
    }
    if (OPENS >= from && OPENS < to) out.unshift({ id: 'museum:opens', time: iso(OPENS), source: 'museum', type: 'museum.opens', importance: 3, data: {},
      headline: 'The Museum of the Pixel Universe opens, with a collection reaching back to the first Daily Crawl' });
    return out;
  }

  root.PixelUniverse = root.PixelUniverse || {};
  root.PixelUniverse.museum = {
    version: VERSION, source: 'museum', startDate: ymd(OPENS), opens: OPENS, epoch: EPOCH, snapshotFormat: SNAPSHOT_FORMAT, ready,
    stateAt: (t) => (ready() ? { time: t, started: t >= EPOCH, months: completeMonths(t) } : { time: t, started: false }),
    eventsBetween, champions, records, timeline, laws, snapshotMonth, completeMonths, conserve, monthName, hash
  };
})(typeof window !== 'undefined' ? window : globalThis);
