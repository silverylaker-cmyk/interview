/* 환자가 쓴 말 → 증상 사전 항목 찾기
 * 띄어쓰기 · 조사 · 어미가 달라도 찾도록, 문장을 붙여 쓴 뒤 패턴 조각이 들어 있는지 본다. */
(function (root) {
  function norm(s) {
    return String(s || "").toLowerCase().replace(/[\s.,!?~…·ㆍ\-—_'"“”‘’()\[\]{}<>\/\\:;^*+=|`@#$%&]/g, "");
  }

  function compile(data) {
    var macros = data.MACROS;
    var areaById = {};
    data.AREAS.forEach(function (a) { areaById[a.id] = a; });
    var items = data.S.map(function (row) {
      var opt = row[6] || {};
      var patterns = row[5].map(function (p) {
        return p.split("+").map(function (part) {
          var alts = [];
          part.split("|").forEach(function (alt) {
            if (macros[alt]) macros[alt].split("|").forEach(function (m) { alts.push(m); });
            else alts.push(norm(alt));
          });
          return alts.filter(Boolean);
        });
      });
      return {
        id: row[0], areas: row[1].split(","), group: row[2], ko: row[3], en: row[4],
        patterns: patterns, label: norm(row[3]),
        lat: !!opt.lat, flag: opt.flag || "", q: opt.q || []
      };
    });
    var byId = {};
    items.forEach(function (it) { byId[it.id] = it; });
    return { items: items, byId: byId, areaById: areaById };
  }

  /* 한두 글자 조각(목 · 코 · 귀 · 혹 …)이 엉뚱한 낱말에 걸리지 않도록 가려 둘 낱말 */
  var CONFUSERS = /목요일|목욕|목적|목표|목록|목사|코로나|코스|코트|귀찮|귀여|귀국|귀하|입원|입장|입구|입학|입사|입금|혹시|침대|침착|점점|점심|말씀|손님|발생|발견|발표|볼때|볼일|물론|물어|담배|상담|담당/g;
  function mask(q) { return q.replace(CONFUSERS, function (w) { return new Array(w.length + 1).join("□"); }); }

  function longest(alts, q, qm) {
    var best = 0;
    for (var i = 0; i < alts.length; i++) {
      var a = alts[i];
      if (a.length > best && (a.length >= 3 ? q : qm).indexOf(a) !== -1) best = a.length;
    }
    return best;
  }

  /* 점수: 100 이상 = 패턴 전체 일치(확실), 그 아래 = 일부만 일치(후보) */
  function score(item, q, qm) {
    var best = 0;
    for (var p = 0; p < item.patterns.length; p++) {
      var parts = item.patterns[p], hit = 0, len = 0, strong = 0;
      for (var i = 0; i < parts.length; i++) {
        var l = longest(parts[i], q, qm);
        if (l) { hit++; len += l; if (l >= 2) strong += l; }
      }
      var s = 0;
      if (hit === parts.length) s = 100 + len * 5;
      else if (strong) s = 20 + strong * 3;
      else if (q.length >= 1) {
        for (var j = 0; j < parts.length && !s; j++) {
          for (var k = 0; k < parts[j].length; k++) {
            if (parts[j][k].length >= 2 && parts[j][k].indexOf(q) !== -1) { s = 10 + q.length; break; }
          }
        }
      }
      if (s > best) best = s;
    }
    if (q.length >= 1 && item.label.indexOf(q) !== -1) best = Math.max(best, 60 + q.length * 2);
    return best;
  }

  /* text: 환자가 쓴 말. ctx: 부위 안에서 쓴 경우 그 부위 낱말(예: "귀")을 앞에 붙여 "아파요"만 써도 찾게 한다. */
  function search(lex, text, opts) {
    opts = opts || {};
    var q = norm(text);
    if (!q) return [];
    var qm = mask(q), c = opts.ctx ? norm(opts.ctx) : "";
    var out = [];
    lex.items.forEach(function (it) {
      var s = score(it, q, qm);
      if (c) {
        var sc = score(it, c + q, c + qm);
        if (sc > 0) sc += (opts.area && it.areas.indexOf(opts.area) !== -1) ? 15 : -30;
        if (sc > s) s = sc;
      }
      if (opts.area && it.areas.indexOf(opts.area) !== -1 && s > 0) s += 5;
      if (s >= (opts.min || 10)) out.push({ item: it, score: s, sure: s >= 100 });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, opts.limit || 8);
  }

  var api = { norm: norm, compile: compile, search: search };
  root.ENT_MATCH = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
