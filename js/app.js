/*
 * The galleries. Rendering only: reads PixelUniverse.museum and the archive folder. Only this file calls Date.now().
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const M = window.PixelUniverse && window.PixelUniverse.museum;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const SOURCES = { glacial: 'Glacial', weather: 'Weather Bureau', senate: 'Senate', city: 'Pixel City', bookmaker: 'Bookmaker', museum: 'Museum' };
  const longDate = (s) => { const d = new Date(s); return d.getUTCDate() + ' ' + ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };
  const hm = (ms) => { const m = Math.round(ms / 60000), h = Math.floor(m / 60), r = m % 60; return (h ? h + ' hour' + (h === 1 ? '' : 's') + (r ? ' ' : '') : '') + (r || !h ? r + ' minute' + (r === 1 ? '' : 's') : ''); };
  const now = Date.now();

  // ---------------------------------------------------------------- the Senate's laws, cosmetically (today's)
  function applyLaws() {
    const S = window.PixelUniverse && window.PixelUniverse.senate;
    if (!S || !S.styleVars || (S.ready && !S.ready())) return;
    try { const v = S.styleVars(now, matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); for (const k in v) document.documentElement.style.setProperty(k, v[k]); } catch (e) { /* default look */ }
  }

  // ---------------------------------------------------------------- Hall of Champions
  function hallOfChampions() {
    $('portraits').innerHTML = M.champions(now).map((p) => {
      const titles = p.gpWins ? p.gpWins + ' Grand Prix title' + (p.gpWins === 1 ? '' : 's') : 'No Grand Prix titles yet';
      return '<figure class="portrait">' +
        '<div class="frame"><div class="mat"><div class="pixel" style="background:' + p.color + '" role="img" aria-label="Portrait of ' + esc(p.name) + ', a single ' + esc(p.color) + ' pixel"></div></div></div>' +
        '<figcaption><div class="plaque"><b>' + esc(p.name) + '</b><span>Pixel, ' + esc(p.color.toUpperCase()) + '. Racing since 3 December 2025.</span></div>' +
        '<div class="career"><p>' + titles + (p.gpTitles.length ? ': ' + esc(p.gpTitles.join(', ')) : '') + '.</p>' +
        '<p>' + p.wins + ' wins from ' + p.starts + ' starts. Best run: ' + p.bestStreak + ' Daily Crawls.</p>' +
        '<p>Rating ' + p.rating + (p.peakAt ? ', peak ' + p.peak + ' on ' + longDate(p.peakAt) : ', never yet above its starting 1500') + '.</p>' +
        '<p>Longest nap: ' + hm(p.longestNap) + '.</p>' +
        '<p class="bio">' + esc(p.bio) + '</p></div></figcaption></figure>';
    }).join('');
  }

  // ---------------------------------------------------------------- Record Books
  function recordBooks() {
    const recs = M.records(now);
    const halls = {};
    for (const r of recs) (halls[r.hall] = halls[r.hall] || []).push(r);
    $('recordbooks').innerHTML = '<div class="halls">' + Object.keys(halls).map((h) => '<div><h3>' + esc(h) + '</h3><table class="table"><tbody>' +
      halls[h].map((r) => '<tr><td>' + esc(r.title) + '<span class="sub">' + esc([r.holder, r.when].filter(Boolean).join(', ')) + '</span></td><td class="r value">' + esc(r.value) + '</td></tr>').join('') +
      '</tbody></table></div>').join('') + '</div>';
  }

  // ---------------------------------------------------------------- Hall of Disasters
  function disasters() {
    const C = window.PixelUniverse && window.PixelUniverse.city;
    const el = $('disaster-list');
    if (!C || !C.glitchesBetween || !C.ready()) { el.innerHTML = '<p class="empty">The Hall of Disasters needs Pixel City, which could not be reached.</p>'; return; }
    const done = C.glitchesBetween(C.glitchStart, now).filter((g) => g.end <= now);
    if (!done.length) { el.innerHTML = '<p class="empty">' + (now < C.glitchStart ? 'The hall opens on 1 March 2027. So far, nothing has gone wrong.' : 'No disasters yet. The hall waits.') + '</p>'; return; }
    const chains = {};
    for (const g of done) { const root = g.id.replace(/-\d+$/, ''); (chains[root] = chains[root] || []).push(g); }
    const WHAT = { corruption: 'Buildings rendered as noise; businesses made less, and every patch shop was mobbed for days.', refresh: 'The district went dark, as in a blackout: no power, no trade, and a rattled population.',
      bleed: 'Colours ran across district borders; palette shops did a roaring trade.', stuck: 'Everything stopped: no deliveries reached the shops, and almost nothing was made.', leak: 'The raw colour in store at the export dock was eaten into, and the refineries went short.' };
    const fmt = (ms) => new Date(ms).toISOString().slice(0, 10);
    el.innerHTML = '<div class="disasters">' + Object.keys(chains).sort().reverse().map((k) => {
      const c = chains[k], first = c[0], hours = Math.round((Math.max(...c.map((g) => g.end)) - first.start) / 3600000);
      const path = c.map((g) => g.districtName).join(' \u2192 ');
      return '<figure class="disaster"><div class="exhibit exhibit-' + first.type + '" aria-hidden="true"></div><figcaption><b>' + esc(first.label) + (c.length > 1 ? ', spreading' : '') + '</b>' +
        '<span class="sub">' + esc(fmt(first.start)) + (first.storm ? ', in a storm' : '') + '. ' + hours + ' hours. Severity ' + first.severity + ' of 3.</span>' +
        '<p>' + esc(path) + '</p><p class="sub">' + esc(WHAT[first.type]) + '</p></figcaption></figure>';
    }).join('') + '</div>';
  }

  // ---------------------------------------------------------------- Timeline
  let events = { 4: null, 3: null };
  function timeline() {
    const min = $('more-events').checked ? 3 : 4;
    if (!events[min]) events[min] = M.timeline(now, min);
    const byMonth = {};
    for (const e of events[min]) { const k = e.time.slice(0, 7); (byMonth[k] = byMonth[k] || []).push(e); }
    const keys = Object.keys(byMonth).sort().reverse();
    $('timeline-list').innerHTML = keys.map((k) => '<div class="month"><h3>' + esc(M.monthName(k)) + '</h3><ol>' +
      byMonth[k].slice().reverse().map((e) => { const d = new Date(e.time); return '<li' + (e.importance >= 5 ? ' class="major"' : '') + '><time datetime="' + e.time + '">' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + '</time><span>' + esc(e.headline) + ' <span class="src">' + esc(SOURCES[e.source] || e.source) + '</span></span></li>'; }).join('') +
      '</ol></div>').join('');
  }

  // ---------------------------------------------------------------- Law Library
  const LAW_NAMES = {
    'style.bg': 'Background colour', 'style.surface': 'Panel colour', 'style.link': 'Link colour', 'style.screen': 'Race screen colour',
    'style.display': 'Display typeface', 'style.body': 'Body typeface', 'names.crawl': 'Name of the daily race', 'names.gp': 'Name of the monthly race',
    'names.trophy': 'Name of the trophy', 'commentary.tone': 'Tone of race commentary'
  };
  const lawName = (k) => LAW_NAMES[k] || k.replace(/^policy\./, '').replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
  function lawValue(v) {
    if (v && typeof v === 'object' && 'h' in v) return v.h || v.s || v.l ? 'Hue ' + (v.h > 0 ? '+' : '') + v.h + ', saturation ' + (v.s > 0 ? '+' : '') + v.s + ', lightness ' + (v.l > 0 ? '+' : '') + v.l : 'As Glacial';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }
  function library() {
    const L = M.laws(now);
    if (!L) { $('library').innerHTML = '<p class="intro">The Senate could not be reached, so the library is closed today.</p>'; return; }
    const changed = new Set(L.changed.map((c) => c.key));
    let h = '<p class="intro">' + (L.history.length ? 'The laws of the universe as they stand today, and every law the Senate has brought into force.'
      : 'The Senate has not yet passed a law' + (L.firstSitting ? ' and first sits on ' + esc(longDate(L.firstSitting)) : '') + '. Until it does, the founding laws are in force.') + '</p>';
    h += '<dl class="laws-grid">' + Object.keys(L.now).map((k) => '<div class="law' + (changed.has(k) ? ' changed' : '') + '"><dt>' + esc(lawName(k)) + '</dt><dd>' + esc(lawValue(L.now[k])) + '</dd></div>').join('') + '</dl>';
    if (L.history.length) h += '<div class="scroll"><table class="table"><thead><tr><th>In force from</th><th>Law</th></tr></thead><tbody>' +
      L.history.slice().reverse().map((x) => '<tr><td>' + esc(longDate(x.time)) + '</td><td>' + esc(x.headline.replace(/^Now in effect: /, '')) + '</td></tr>').join('') + '</tbody></table></div>';
    $('library').innerHTML = h;
  }

  // ---------------------------------------------------------------- The Archive
  let collection = [];
  const STATUS = { intact: 'Intact', altered: 'Altered', missing: 'Not checked: desk missing', new: 'New since archived' };
  function statusHtml(report) {
    if (!report) return '<span class="status-intact">Not yet checked</span>';
    const bad = Object.keys(report).filter((k) => report[k] === 'altered');
    if (bad.length) return '<span class="status-altered">Altered: ' + esc(bad.map((k) => SOURCES[k]).join(', ')) + '</span>';
    const odd = Object.keys(report).filter((k) => report[k] !== 'intact');
    return '<span class="status-intact">Intact' + (odd.length ? ' (' + esc(odd.map((k) => SOURCES[k] + ': ' + STATUS[report[k]].toLowerCase()).join('; ')) + ')' : '') + '</span>';
  }
  function archiveTable(nightly) {
    $('archive-table').innerHTML = '<thead><tr><th>Month</th><th>Condition</th><th>Snapshot</th></tr></thead><tbody>' +
      (collection.length ? collection.map((k) => '<tr id="row-' + k + '"><td>' + esc(M.monthName(k)) + '</td><td class="cond">' + statusHtml(nightly && nightly[k]) + '</td><td><a href="archive/' + k + '.json" download>' + k + '.json</a></td></tr>').join('')
        : '<tr><td colspan="3" class="empty">The collection is empty. The first months are catalogued the night after the Museum is published.</td></tr>') + '</tbody>';
  }
  async function loadArchive() {
    let nightly = null;
    try { collection = (await (await fetch('archive/index.json', { cache: 'no-store' })).json()).months || []; } catch (e) { collection = []; }
    try { nightly = (await (await fetch('archive/conservation.json', { cache: 'no-store' })).json()).report; } catch (e) { nightly = null; }
    archiveTable(nightly);
    $('check-all').disabled = !collection.length;
    if (nightly) $('check-status').textContent = 'Showing the last nightly check.';
    // months that could be catalogued by hand
    const missing = M.completeMonths(now).filter((k) => collection.indexOf(k) < 0);
    $('hand-month').innerHTML = missing.length ? missing.map((k) => '<option value="' + k + '">' + esc(M.monthName(k)) + '</option>').join('') : '<option value="">Every complete month is archived</option>';
    $('hand-download').disabled = !missing.length;
  }
  $('check-all').addEventListener('click', async () => {
    $('check-all').disabled = true;
    let altered = 0;
    for (let i = 0; i < collection.length; i++) {
      const k = collection[i];
      $('check-status').textContent = 'Checking ' + M.monthName(k) + ' (' + (i + 1) + ' of ' + collection.length + ')…';
      await new Promise((r) => setTimeout(r, 10));
      try {
        const snap = await (await fetch('archive/' + k + '.json', { cache: 'no-store' })).json();
        const c = M.conserve(snap);
        if (Object.values(c.report).indexOf('altered') >= 0) altered++;
        document.querySelector('#row-' + k + ' .cond').innerHTML = statusHtml(c.report);
      } catch (e) {
        document.querySelector('#row-' + k + ' .cond').textContent = 'Could not be read. Check that archive/' + k + '.json is valid JSON.';
      }
    }
    $('check-status').textContent = altered ? altered + ' month' + (altered === 1 ? ' has' : 's have') + ' been altered. The archive keeps the history as it was; see the README on eras.' : 'Every month in the collection is intact.';
    $('check-all').disabled = false;
  });
  $('hand-download').addEventListener('click', () => {
    const k = $('hand-month').value;
    if (!k) return;
    const [y, m] = k.split('-').map(Number);
    const snap = M.snapshotMonth(y, m - 1);
    snap.accessioned = new Date(now).toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(snap) + '\n'], { type: 'application/json' }));
    a.download = k + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  // ---------------------------------------------------------------- open the doors
  if (!M || !M.ready()) {
    $('notice').hidden = false;
    $('notice').textContent = 'The Museum is closed: Glacial or the Weather Bureau could not be reached, and the collection cannot be shown without them. Reload the page to try again.';
    return;
  }
  const absent = ['senate', 'city', 'bookmaker'].filter((k) => !(window.PixelUniverse[k === 'senate' ? 'senate' : k] && (!window.PixelUniverse[k].ready || window.PixelUniverse[k].ready())));
  if (absent.length) { $('notice').hidden = false; $('notice').textContent = 'The ' + absent.map((k) => SOURCES[k]).join(', ') + ' wing' + (absent.length === 1 ? ' is' : 's are') + ' closed today because ' + (absent.length === 1 ? 'that site' : 'those sites') + ' could not be reached. Reload the page to try again.'; }
  applyLaws();
  $('more-events').addEventListener('change', timeline);
  // hang the galleries one at a time, so the page appears quickly
  const steps = [hallOfChampions, recordBooks, disasters, timeline, library, loadArchive];
  (function next() { const s = steps.shift(); if (!s) return; try { s(); } catch (e) { console.error(e); } setTimeout(next, 0); })();
})();
