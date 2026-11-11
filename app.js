/* 이비인후과 문진 — 화면과 동작
 * 환자 화면은 한글, 완료 뒤 의료진 화면은 영어 의학용어로 보여 준다.
 * 입력 내용은 이 기기의 메모리에만 있고 어디에도 전송 · 저장하지 않는다. */
(function () {
  "use strict";
  var D = window.ENT_DATA, M = window.ENT_MATCH, lex = M.compile(D);
  var app = document.getElementById("app");

  var STEPS = ["areas", "symptoms", "details", "history", "review"];
  var STEP_NAME = { areas: "불편한 곳", symptoms: "증상 고르기", details: "자세히", history: "건강 정보", review: "확인" };

  var SIDE = [["R", "오른쪽", "Rt."], ["L", "왼쪽", "Lt."], ["B", "양쪽", "Bilateral"]];
  var DUR = [["d0", "오늘", "since today"], ["d3", "2~3일", "2–3 days"], ["d7", "4~7일", "4–7 days"], ["w2", "1~2주", "1–2 weeks"], ["w4", "2~4주", "2–4 weeks"], ["m3", "1~3개월", "1–3 months"], ["m12", "3개월~1년", "3–12 months"], ["y1", "1년 넘음", "> 1 year"]];
  var SEV = [["1", "조금 불편", "mild"], ["2", "꽤 불편", "moderate"], ["3", "못 참을 정도", "severe"]];
  var COURSE = [["const", "계속 그래요", "constant"], ["inter", "있다 없다 해요", "intermittent"], ["prog", "점점 심해져요", "progressive"], ["impr", "나아지는 중", "improving"], ["recur", "자주 재발해요", "recurrent"]];
  var SMOKE = [["never", "안 피워요", "Never smoker"], ["ex", "끊었어요", "Ex-smoker"], ["cur", "피워요", "Current smoker"]];
  var ALCOHOL = [["no", "안 마셔요", "None"], ["some", "가끔", "Occasional"], ["often", "자주 (주 3회 이상)", "Frequent (≥3×/week)"]];
  var PREG = [["no", "해당 없음", "Not pregnant"], ["yes", "임신 중", "Pregnant"], ["maybe", "가능성 있음", "Possibly pregnant"], ["lact", "수유 중", "Breastfeeding"]];
  var SEX = [["M", "남", "M"], ["F", "여", "F"]];
  var INFORMANT = [["self", "본인", "self"], ["guardian", "보호자", "guardian/caregiver"]];

  var state;
  function fresh() {
    return {
      step: "areas", areas: {}, sel: {}, free: [], order: [], det: {}, main: null, durAll: null,
      pending: {}, freeSeq: 0, sample: false,
      info: { name: "", age: "", sex: "", informant: "self" },
      hx: { pmh: {}, meds: {}, allergy: {}, surg: {}, recent: {} }, none: {}, etc: {},
      life: { smoke: "", alcohol: "", voice: false, noise: false, preg: "" },
      extra: ""
    };
  }

  /* ───── 도우미 ───── */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function find(list, v) { for (var i = 0; i < list.length; i++) if (list[i][0] === v) return list[i]; return null; }
  function idx(list, v) { for (var i = 0; i < list.length; i++) if (list[i][0] === v) return i; return -1; }
  function keys(o) { return Object.keys(o).filter(function (k) { return o[k]; }); }
  function det(id) { return state.det[id] || (state.det[id] = { q: {} }); }
  function freeById(id) { for (var i = 0; i < state.free.length; i++) if (state.free[i].id === id) return state.free[i]; return null; }
  function count() { return state.order.length; }
  function isVisit(id) { var it = lex.byId[id]; return !!it && it.areas[0] === "visit"; }

  function entries() {
    return state.order.map(function (id) {
      var it = lex.byId[id];
      return it ? { id: id, item: it } : { id: id, free: freeById(id) };
    }).filter(function (e) { return e.item || e.free; });
  }
  function mainId() {
    if (state.main && state.order.indexOf(state.main) !== -1) return state.main;
    var first = state.order.filter(function (id) { return !isVisit(id); })[0];
    return first || state.order[0] || null;
  }

  function toggle(id) {
    if (state.sel[id]) {
      delete state.sel[id]; delete state.det[id];
      state.order = state.order.filter(function (x) { return x !== id; });
    } else {
      state.sel[id] = true; state.order.push(id);
      if (state.durAll) det(id).dur = state.durAll;
    }
  }
  function addFree(key, text) {
    text = String(text || "").trim();
    if (!text) return;
    var id = "f" + (++state.freeSeq);
    state.free.push({ id: id, area: key === "main" ? "" : key, text: text });
    state.order.push(id);
    if (state.durAll) det(id).dur = state.durAll;
  }
  function removeEntry(id) {
    if (state.sel[id]) return toggle(id);
    state.free = state.free.filter(function (f) { return f.id !== id; });
    state.order = state.order.filter(function (x) { return x !== id; });
    delete state.det[id];
  }
  function searchOpts(key, extra) {
    var o = extra || {};
    if (key !== "main" && lex.areaById[key]) { o.area = key; o.ctx = lex.areaById[key].ctx; }
    return o;
  }
  /* 직접 쓴 말에서 사전이 확실히 찾아낸 증상 (아직 고르지 않은 것만) */
  function hints(f) {
    return M.search(lex, f.text, searchOpts(f.area || "main", { limit: 4, min: 100 }))
      .filter(function (r) { return !state.sel[r.item.id]; })
      .map(function (r) { return r.item; });
  }

  /* ───── 공통 조각 ───── */
  function chip(label, pressed, attrs, cls) {
    return '<button type="button" class="chip ' + (cls || "") + '" aria-pressed="' + (pressed ? "true" : "false") + '" ' + attrs + ">" + esc(label) + "</button>";
  }
  function optRow(title, list, cur, attrs) {
    return '<div class="row"><p class="row-t">' + esc(title) + '</p><div class="chips">' + list.map(function (o) {
      return chip(o[1], cur === o[0], attrs + ' data-v="' + o[0] + '"', "sm");
    }).join("") + "</div></div>";
  }

  function resultsHtml(key) {
    var text = (state.pending[key] || "").trim();
    if (!text) return "";
    var res = M.search(lex, text, searchOpts(key, { limit: 6 }));
    /* 확실한 후보가 있으면 어설픈 후보는 감춘다 */
    if (res.some(function (r) { return r.sure; })) res = res.filter(function (r) { return r.score >= 60; });
    var h = "";
    if (res.length) {
      h += '<p class="sugg-t">혹시 이 증상인가요? 맞는 것을 눌러 주세요.</p><div class="chips">' + res.map(function (r) {
        var a = lex.areaById[r.item.areas[0]];
        return '<button type="button" class="chip" aria-pressed="' + (state.sel[r.item.id] ? "true" : "false") + '" data-act="pick" data-key="' + key + '" data-id="' + r.item.id + '"><span class="chip-area">' + esc(a.ko) + "</span>" + esc(r.item.ko) + "</button>";
      }).join("") + "</div>";
    }
    h += '<button type="button" class="asis" data-act="addfree" data-key="' + key + '">「' + esc(text) + "」 적은 그대로 전달하기</button>";
    h += '<p class="hint">맞는 것이 없어도 괜찮습니다. 적은 그대로 의사에게 전달됩니다.</p>';
    return h;
  }
  function searchBox(key, label, placeholder) {
    return '<div class="search"><label for="s-' + key + '">' + esc(label) + '</label>' +
      '<div class="search-in"><input id="s-' + key + '" type="text" inputmode="text" autocomplete="off" enterkeyhint="done" data-search="' + key + '" placeholder="' + esc(placeholder) + '" value="' + esc(state.pending[key] || "") + '">' +
      '<button type="button" class="btn ghost" data-act="addfree" data-key="' + key + '">추가</button></div>' +
      '<div class="results" id="r-' + key + '" aria-live="polite">' + resultsHtml(key) + "</div></div>";
  }
  function pickedList(ids, title) {
    if (!ids.length) return "";
    return '<div class="picked"><p class="row-t">' + esc(title) + '</p><ul>' + ids.map(function (id) {
      var it = lex.byId[id], f = it ? null : freeById(id);
      return '<li><span>' + (it ? esc(it.ko) : '<q>' + esc(f.text) + "</q>") + '</span><button type="button" class="x" data-act="remove" data-id="' + id + '" aria-label="빼기">빼기</button></li>';
    }).join("") + "</ul></div>";
  }

  /* ───── 1. 불편한 곳 ───── */
  function viewAreas() {
    var h = '<h1 tabindex="-1">어디가 불편해서 오셨나요?</h1><p class="lead">해당하는 곳을 모두 눌러 주세요. 다음 화면에서 증상을 고릅니다.</p>';
    h += '<div class="tiles">' + D.AREAS.map(function (a) {
      return '<button type="button" class="tile" aria-pressed="' + (state.areas[a.id] ? "true" : "false") + '" data-act="area" data-id="' + a.id + '"><span class="tile-n">' + esc(a.ko) + '</span><span class="tile-eg">' + esc(a.eg) + "</span></button>";
    }).join("") + "</div>";
    h += searchBox("main", "잘 모르겠으면 말로 써 주세요", "예: 귀가 먹먹하고 삐 소리가 나요");
    h += pickedList(state.order, "지금까지 고른 증상");
    h += '<p class="foot">입력한 내용은 이 기기 화면에만 표시되며 저장 · 전송되지 않습니다. <button type="button" class="link" data-act="sample">작성 예시 결과 보기</button></p>';
    return h;
  }

  /* ───── 2. 증상 고르기 ───── */
  function areaSection(a) {
    var groups = [], map = {};
    lex.items.forEach(function (it) {
      var pos = it.areas.indexOf(a.id);
      if (pos === -1) return;
      var g = pos === 0 ? it.group : "함께 보는 증상";
      if (!map[g]) { map[g] = []; groups.push(g); }
      map[g].push(it);
    });
    var gi = groups.indexOf("함께 보는 증상");
    if (gi !== -1) { groups.splice(gi, 1); groups.push("함께 보는 증상"); }
    var h = '<section class="area" id="a-' + a.id + '"><h2>' + esc(a.ko) + "</h2>";
    groups.forEach(function (g) {
      h += '<div class="group"><p class="group-t">' + esc(g) + '</p><div class="chips">' + map[g].map(function (it) {
        return chip(it.ko, state.sel[it.id], 'data-act="toggle" data-id="' + it.id + '"');
      }).join("") + "</div></div>";
    });
    var mine = state.free.filter(function (f) { return f.area === a.id; }).map(function (f) { return f.id; });
    h += pickedList(mine, "직접 쓴 증상");
    h += searchBox(a.id, "찾는 증상이 없나요? 직접 써 주세요", "여기에 없는 증상을 적어 주세요");
    return h + "</section>";
  }
  function viewSymptoms() {
    var chosen = D.AREAS.filter(function (a) { return state.areas[a.id]; });
    var h = '<h1 tabindex="-1">어떤 증상이 있나요?</h1><p class="lead">해당하는 것을 모두 눌러 주세요. 비슷한 것만 있어도 괜찮습니다.</p>';
    var outside = state.order.filter(function (id) {
      var it = lex.byId[id];
      if (it) return !it.areas.some(function (x) { return state.areas[x]; });
      var f = freeById(id); return f && !state.areas[f.area];
    });
    h += pickedList(outside, "말로 써서 고른 증상");
    h += chosen.map(areaSection).join("");
    if (!chosen.length) h += searchBox("main", "증상을 말로 써 주세요", "예: 귀가 먹먹하고 삐 소리가 나요");
    h += '<button type="button" class="btn ghost wide" data-act="go" data-v="areas">다른 곳도 불편해요 · 부위 더 고르기</button>';
    return h;
  }

  /* ───── 3. 자세히 ───── */
  function detailCard(e, many) {
    var d = det(e.id), it = e.item, h = '<section class="card">';
    h += '<div class="card-h"><h2>' + (it ? esc(it.ko) : "<q>" + esc(e.free.text) + "</q>") + "</h2>";
    if (!it) h += '<span class="tag">직접 쓴 증상</span>';
    h += "</div>";
    if (many) h += chip("가장 불편한 증상이에요", mainId() === e.id && !!state.main, 'data-act="main" data-id="' + e.id + '"', "sm star");
    if (!it) {
      var hs = hints(e.free);
      if (hs.length) h += '<div class="row"><p class="row-t">혹시 이런 증상인가요? 맞으면 눌러 주세요.</p><div class="chips">' + hs.map(function (x) { return chip(x.ko, false, 'data-act="toggle" data-id="' + x.id + '"', "sm"); }).join("") + "</div></div>";
    }
    var a = 'data-act="det" data-id="' + e.id + '" ';
    if (!it || it.lat) h += optRow("어느 쪽인가요?", SIDE, d.side, a + 'data-f="side"');
    h += optRow("언제부터인가요?", DUR, d.dur, a + 'data-f="dur"');
    h += optRow("얼마나 불편한가요?", SEV, d.sev, a + 'data-f="sev"');
    h += optRow("어떤 식으로 나타나나요?", COURSE, d.course, a + 'data-f="course"');
    if (it) it.q.forEach(function (qk) {
      var q = D.Q[qk];
      h += '<div class="row"><p class="row-t">' + esc(q.ko) + ' <span class="multi">여러 개 선택 가능</span></p><div class="chips">' + q.opts.map(function (o, i) {
        return chip(o[0], d.q[qk + ":" + i], 'data-act="detq" data-id="' + e.id + '" data-q="' + qk + '" data-v="' + i + '"', "sm");
      }).join("") + "</div></div>";
    });
    return h + "</section>";
  }
  function viewDetails() {
    var es = entries().filter(function (e) { return !isVisit(e.id); });
    var h = '<h1 tabindex="-1">조금 더 알려 주세요</h1><p class="lead">아는 것만 눌러 주세요. 모르는 것은 그냥 넘어가도 됩니다.</p>';
    if (!es.length) return h + '<p class="empty">추가로 여쭤볼 것이 없습니다. 다음으로 넘어가 주세요.</p>';
    if (es.length > 1) h += '<section class="card soft">' + optRow("모든 증상이 비슷한 때 시작됐다면 여기서 한 번에 골라 주세요", DUR, state.durAll, 'data-act="durall"') + "</section>";
    return h + es.map(function (e) { return detailCard(e, es.length > 1); }).join("");
  }

  /* ───── 4. 건강 정보 ───── */
  function hxGroup(g) {
    var def = D.HX[g];
    return '<section class="card"><h2>' + esc(def.ko) + '</h2><div class="chips">' +
      chip("없어요", state.none[g], 'data-act="hxnone" data-g="' + g + '"', "sm") +
      def.opts.map(function (o) { return chip(o[1], state.hx[g][o[0]], 'data-act="hx" data-g="' + g + '" data-v="' + o[0] + '"', "sm"); }).join("") +
      '</div><label class="etc" for="etc-' + g + '">그 밖에 (직접 쓰기)</label><input id="etc-' + g + '" type="text" autocomplete="off" data-bind="etc.' + g + '" value="' + esc(state.etc[g] || "") + '"></section>';
  }
  function viewHistory() {
    var i = state.info, l = state.life;
    var h = '<h1 tabindex="-1">건강 정보를 알려 주세요</h1><p class="lead">약 처방과 검사에 필요한 내용입니다. 해당하는 것만 눌러 주세요.</p>';
    h += '<section class="card"><h2>진료 받는 분</h2><div class="fields">' +
      '<div><label for="i-name">이름</label><input id="i-name" type="text" autocomplete="off" data-bind="info.name" value="' + esc(i.name) + '"></div>' +
      '<div><label for="i-age">나이 (만)</label><input id="i-age" type="text" inputmode="numeric" autocomplete="off" data-bind="info.age" value="' + esc(i.age) + '"></div></div>' +
      optRow("성별", SEX, i.sex, 'data-act="set" data-f="info.sex"') +
      optRow("지금 작성하는 분", INFORMANT, i.informant, 'data-act="set" data-f="info.informant"') + "</section>";
    h += hxGroup("pmh") + hxGroup("meds") + hxGroup("allergy") + hxGroup("surg");
    h += '<section class="card"><h2>' + esc(D.HX.recent.ko) + '</h2><div class="chips">' + D.HX.recent.opts.map(function (o) {
      return chip(o[1], state.hx.recent[o[0]], 'data-act="hx" data-g="recent" data-v="' + o[0] + '"', "sm");
    }).join("") + "</div></section>";
    h += '<section class="card"><h2>생활 습관</h2>' +
      optRow("담배", SMOKE, l.smoke, 'data-act="set" data-f="life.smoke"') +
      optRow("술", ALCOHOL, l.alcohol, 'data-act="set" data-f="life.alcohol"') +
      '<div class="row"><p class="row-t">해당하면 눌러 주세요</p><div class="chips">' +
      chip("목을 많이 쓰는 일을 해요 (교사 · 상담 · 노래)", l.voice, 'data-act="flip" data-f="life.voice"', "sm") +
      chip("시끄러운 곳에서 일해요 · 이어폰을 오래 써요", l.noise, 'data-act="flip" data-f="life.noise"', "sm") + "</div></div>" +
      (i.sex === "F" ? optRow("임신 · 수유", PREG, l.preg, 'data-act="set" data-f="life.preg"') : "") + "</section>";
    h += '<section class="card"><h2>의사에게 더 하고 싶은 말</h2><label class="etc" for="extra">걱정되는 점, 원하는 검사나 치료 등 무엇이든 적어 주세요</label><textarea id="extra" rows="3" data-bind="extra">' + esc(state.extra) + "</textarea></section>";
    return h;
  }

  /* ───── 5. 확인 (한글) ───── */
  function koDetail(e) {
    var d = det(e.id), p = [], o;
    if ((o = find(SIDE, d.side))) p.push(o[1]);
    if ((o = find(DUR, d.dur))) p.push(o[1] === "오늘" ? "오늘부터" : o[1] + " 전부터");
    if ((o = find(SEV, d.sev))) p.push(o[1]);
    if ((o = find(COURSE, d.course))) p.push(o[1]);
    if (e.item) e.item.q.forEach(function (qk) { D.Q[qk].opts.forEach(function (x, i) { if (d.q[qk + ":" + i]) p.push(x[0]); }); });
    return p.join(" · ");
  }
  function koHx(g) {
    if (state.none[g]) return "없음";
    var p = D.HX[g].opts.filter(function (o) { return state.hx[g][o[0]]; }).map(function (o) { return o[1]; });
    if (state.etc[g]) p.push(state.etc[g]);
    return p.join(", ");
  }
  function viewReview() {
    var m = mainId(), h = '<h1 tabindex="-1">적은 내용을 확인해 주세요</h1><p class="lead">맞으면 아래 <b>작성 완료</b>를 눌러 주세요.</p>';
    h += '<section class="card"><div class="card-h"><h2>증상</h2><button type="button" class="link" data-act="go" data-v="symptoms">고치기</button></div><ul class="rv">' + entries().map(function (e) {
      var dt = koDetail(e);
      return "<li><b>" + (e.item ? esc(e.item.ko) : "<q>" + esc(e.free.text) + "</q>") + "</b>" + (e.id === m && count() > 1 ? ' <span class="tag">가장 불편</span>' : "") + (dt ? "<br><span>" + esc(dt) + "</span>" : "") + "</li>";
    }).join("") + '</ul><button type="button" class="link" data-act="go" data-v="details">자세한 내용 고치기</button></section>';
    var rows = [["이름", state.info.name], ["나이", state.info.age ? "만 " + state.info.age + "세" : ""], ["성별", (find(SEX, state.info.sex) || [])[1]],
      [D.HX.pmh.ko, koHx("pmh")], [D.HX.meds.ko, koHx("meds")], [D.HX.allergy.ko, koHx("allergy")], [D.HX.surg.ko, koHx("surg")], [D.HX.recent.ko, koHx("recent")],
      ["담배", (find(SMOKE, state.life.smoke) || [])[1]], ["술", (find(ALCOHOL, state.life.alcohol) || [])[1]], ["더 하고 싶은 말", state.extra]];
    h += '<section class="card"><div class="card-h"><h2>건강 정보</h2><button type="button" class="link" data-act="go" data-v="history">고치기</button></div><dl class="kv">' + rows.map(function (r) {
      return "<dt>" + esc(r[0]) + "</dt><dd>" + (r[1] ? esc(r[1]) : '<span class="na">적지 않음</span>') + "</dd>";
    }).join("") + "</dl></section>";
    return h;
  }

  /* ───── 의료진 화면 (영어) ───── */
  function enHx(g) {
    if (state.none[g]) return "None";
    var p = D.HX[g].opts.filter(function (o) { return state.hx[g][o[0]]; }).map(function (o) { return o[2]; });
    if (state.etc[g]) p.push("other (pt's words): \"" + state.etc[g] + '"');
    return p.join(", ");
  }
  function alerts() {
    var out = [], has = function (id) { return !!state.sel[id]; };
    var durAt = function (id) { return idx(DUR, det(id).dur); };
    var push = function (s) { if (out.indexOf(s) === -1) out.push(s); };
    state.order.forEach(function (id) { var it = lex.byId[id]; if (it && it.flag) push(it.flag); });
    if (has("hoarseness") && durAt("hoarseness") >= 4) push("Hoarseness > 2 weeks — laryngoscopy indicated");
    if (has("lymph_node") && durAt("lymph_node") >= 4) push("Lymphadenopathy > 2 weeks — r/o malignancy (US ± FNA)");
    if (has("oral_ulcer") && durAt("oral_ulcer") >= 4) push("Oral ulcer > 2 weeks — r/o malignancy (consider biopsy)");
    if (has("sore_throat") && durAt("sore_throat") >= 5) push("Sore throat > 1 month — examine pharynx/larynx for neoplasm");
    var bleedRisk = state.hx.meds.anticoag || state.hx.meds.antiplatelet || state.hx.pmh.bleeding;
    if ((has("epistaxis") || has("bloody_mucus") || has("oral_bleed") || has("hemoptysis") || has("ear_bleed")) && bleedRisk) push("Bleeding symptom on anticoagulant/antiplatelet or with bleeding disorder");
    var es = det("epistaxis").side, os = det("nasal_obstruction").side;
    if (has("epistaxis") && has("nasal_obstruction") && es && es !== "B" && es === os) push("Unilateral nasal obstruction with epistaxis — r/o sinonasal neoplasm");
    if (has("facial_palsy") && (has("ear_vesicle") || has("ear_pain") || has("ear_postauricular"))) push("Facial palsy with otalgia/vesicles — r/o Ramsay Hunt syndrome");
    ["hearing_loss", "tinnitus"].forEach(function (id) {
      var s = det(id).side;
      if (has(id) && (s === "R" || s === "L")) push("Unilateral hearing loss/tinnitus — audiometry; consider retrocochlear evaluation if asymmetric");
    });
    var hn = ["hoarseness", "neck_mass", "lymph_node", "dysphagia", "oral_mass", "hemoptysis", "odynophagia"].filter(has);
    if (state.life.smoke === "cur" && hn.length) push("Current smoker with " + hn.map(function (id) { return lex.byId[id].en.toLowerCase(); }).join(", ") + " — head & neck malignancy work-up");
    if (state.life.preg === "yes" || state.life.preg === "maybe") push((state.life.preg === "yes" ? "Pregnant" : "Possibly pregnant") + " — caution with medication and imaging");
    if (state.life.preg === "lact") push("Breastfeeding — caution with medication");
    if (keys(state.hx.allergy).length || state.etc.allergy) push("Allergy reported: " + enHx("allergy"));
    return out;
  }
  function enDetail(e) {
    var d = det(e.id), p = [], o;
    if ((o = find(SIDE, d.side))) p.push(o[2]);
    if ((o = find(DUR, d.dur))) p.push(o[2]);
    if ((o = find(SEV, d.sev))) p.push(o[2]);
    if ((o = find(COURSE, d.course))) p.push(o[2]);
    if (e.item) e.item.q.forEach(function (qk) { D.Q[qk].opts.forEach(function (x, i) { if (d.q[qk + ":" + i]) p.push(x[1]); }); });
    return p;
  }
  function summary() {
    var now = new Date(), pad = function (n) { return (n < 10 ? "0" : "") + n; };
    var m = mainId(), i = state.info, l = state.life;
    var es = entries();
    var sym = es.filter(function (e) { return e.item && !isVisit(e.id); });
    var visits = es.filter(function (e) { return e.item && isVisit(e.id); });
    var frees = es.filter(function (e) { return e.free; });
    sym.sort(function (a, b) { return (b.id === m) - (a.id === m); });
    var cc = "";
    var me = es.filter(function (e) { return e.id === m; })[0];
    if (me) {
      var d = det(m), side = find(SIDE, d.side), dur = find(DUR, d.dur);
      cc = (me.item ? me.item.en : '"' + me.free.text + '" (pt\'s words)') + (side ? ", " + side[2] : "") + (dur ? (dur[0] === "d0" ? ", " : ", for ") + dur[2] : "");
    }
    var social = [];
    var o;
    if ((o = find(SMOKE, l.smoke))) social.push(o[2]);
    if ((o = find(ALCOHOL, l.alcohol))) social.push("Alcohol: " + o[2].toLowerCase());
    if (l.voice) social.push("Heavy/professional voice use");
    if (l.noise) social.push("Noise exposure (occupational/earphones)");
    return {
      when: now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) + " " + pad(now.getHours()) + ":" + pad(now.getMinutes()),
      pt: [i.name, i.age ? i.age + " y" : "", (find(SEX, i.sex) || [])[2]].filter(Boolean).join(" · ") || "(not entered)",
      informant: i.informant === "guardian" ? "guardian/caregiver" : "",
      alerts: alerts(), cc: cc, main: m,
      sym: sym.map(function (e) { return { id: e.id, en: e.item.en, ko: e.item.ko, area: lex.areaById[e.item.areas[0]].en, det: enDetail(e) }; }),
      visits: visits.map(function (e) { return e.item.en; }),
      frees: frees.map(function (e) {
        return { id: e.id, text: e.free.text, area: e.free.area ? lex.areaById[e.free.area].en : "", det: enDetail(e), hints: hints(e.free).map(function (x) { return x.en; }) };
      }),
      hx: [["PMH", enHx("pmh")], ["Medications", enHx("meds")], ["Allergies", enHx("allergy")], ["ENT surgical Hx", enHx("surg")], ["Recent events", enHx("recent")], ["Social", social.join("; ")],
        ["Pregnancy", i.sex === "F" && l.preg ? find(PREG, l.preg)[2] : ""]].filter(function (r) { return r[0] !== "Pregnancy" || r[1]; }),
      extra: state.extra
    };
  }
  function summaryText(s) {
    var L = ["ENT INTAKE SUMMARY  " + s.when, "Patient: " + s.pt + (s.informant ? "  (informant: " + s.informant + ")" : ""), ""];
    if (s.alerts.length) { L.push("ALERTS"); s.alerts.forEach(function (a) { L.push("  ! " + a); }); L.push(""); }
    if (s.visits.length) { s.visits.forEach(function (v) { L.push(v); }); L.push(""); }
    L.push("CC: " + (s.cc || "-"), "");
    if (s.sym.length) {
      L.push("HPI (patient-selected)");
      s.sym.forEach(function (x, n) {
        L.push("  " + (n + 1) + ". " + x.en + (x.det.length ? " — " + x.det.join("; ") : ""));
        L.push("     Pt: \"" + x.ko + "\"");
      });
      L.push("");
    }
    if (s.frees.length) {
      L.push("PATIENT'S OWN WORDS (verbatim, not translated)");
      s.frees.forEach(function (f) {
        L.push("  - \"" + f.text + "\"" + (f.area ? " [" + f.area + "]" : "") + (f.det.length ? " — " + f.det.join("; ") : ""));
        if (f.hints.length) L.push("    Keyword match (unconfirmed): " + f.hints.join(", "));
      });
      L.push("");
    }
    s.hx.forEach(function (r) { L.push(r[0] + ": " + (r[1] || "not answered")); });
    if (s.extra) L.push("", "Note to doctor (verbatim): \"" + s.extra + "\"");
    return L.join("\n");
  }
  function viewDoctor() {
    var s = summary();
    var h = '<div class="handoff"><p><b>작성이 끝났습니다.</b> 이 화면을 접수 직원이나 의사에게 보여 주세요.</p></div>';
    h += '<article class="chart" lang="en">';
    h += '<header class="chart-h"><div><p class="eyebrow">ENT intake summary' + (state.sample ? " · SAMPLE DATA" : "") + '</p><h1 tabindex="-1">' + esc(s.pt) + "</h1></div><p class=\"mono\">" + esc(s.when) + (s.informant ? "<br>informant: " + esc(s.informant) : "") + "</p></header>";
    if (s.alerts.length) h += '<section class="alerts"><h2>Alerts</h2><ul>' + s.alerts.map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") + "</ul></section>";
    if (s.visits.length) h += '<section class="sec"><h2>Visit</h2><ul class="plain">' + s.visits.map(function (v) { return "<li>" + esc(v.replace(/^Visit: /, "")) + "</li>"; }).join("") + "</ul></section>";
    h += '<section class="sec"><h2>CC</h2><p class="cc">' + esc(s.cc || "—") + "</p></section>";
    if (s.sym.length) {
      h += '<section class="sec"><h2>HPI <span>patient-selected</span></h2><ol class="hpi">' + s.sym.map(function (x) {
        return '<li><p class="term">' + esc(x.en) + (x.id === s.main && s.sym.length + s.frees.length > 1 ? ' <span class="badge">chief</span>' : "") + "</p>" +
          (x.det.length ? '<p class="meta">' + x.det.map(esc).join(' <i>·</i> ') + "</p>" : "") +
          '<p class="ko" lang="ko">' + esc(x.area) + " — “" + esc(x.ko) + "”</p></li>";
      }).join("") + "</ol></section>";
    }
    if (s.frees.length) {
      h += '<section class="sec"><h2>Patient\'s own words <span>verbatim, not translated</span></h2><ul class="hpi">' + s.frees.map(function (f) {
        return '<li><p class="term" lang="ko">“' + esc(f.text) + "”" + (f.id === s.main && s.sym.length + s.frees.length > 1 ? ' <span class="badge">chief</span>' : "") + "</p>" +
          (f.det.length || f.area ? '<p class="meta">' + [f.area].concat(f.det).filter(Boolean).map(esc).join(' <i>·</i> ') + "</p>" : "") +
          (f.hints.length ? '<p class="ko">Keyword match (unconfirmed): ' + f.hints.map(esc).join(", ") + "</p>" : "") + "</li>";
      }).join("") + "</ul></section>";
    }
    h += '<section class="sec"><h2>History</h2><dl class="kv">' + s.hx.map(function (r) {
      return "<dt>" + esc(r[0]) + "</dt><dd>" + (r[1] ? esc(r[1]) : '<span class="na">not answered</span>') + "</dd>";
    }).join("") + "</dl></section>";
    if (s.extra) h += '<section class="sec"><h2>Note to doctor <span>verbatim</span></h2><p lang="ko">“' + esc(s.extra) + "”</p></section>";
    h += "</article>";
    h += '<div class="actions"><button type="button" class="btn" data-act="copy">Copy as text</button>' +
      (window.ENT_NO_PRINT ? "" : '<button type="button" class="btn ghost" data-act="print">Print</button>') +
      '<button type="button" class="btn ghost" data-act="go" data-v="review">수정하기</button>' +
      '<button type="button" class="btn ghost danger" data-act="reset">새 환자 시작</button></div>' +
      '<p class="hint" id="copy-msg" role="status"></p><textarea id="copy-out" class="copy-out" rows="12" readonly hidden></textarea>';
    return h;
  }

  /* ───── 그리기 ───── */
  var VIEWS = { areas: viewAreas, symptoms: viewSymptoms, details: viewDetails, history: viewHistory, review: viewReview, doctor: viewDoctor };
  function bars() {
    var doc = state.step === "doctor", n = STEPS.indexOf(state.step);
    var top = '<header class="top"><div class="wrap top-in"><p class="brand">이비인후과 문진</p>' +
      (doc ? '<p class="step">의료진용 요약</p>' : '<p class="step"><b>' + (n + 1) + "</b> / " + STEPS.length + " · " + STEP_NAME[state.step] + "</p>") + "</div>" +
      (doc ? "" : '<div class="prog" role="progressbar" aria-valuemin="1" aria-valuemax="' + STEPS.length + '" aria-valuenow="' + (n + 1) + '"><i style="width:' + ((n + 1) / STEPS.length * 100) + '%"></i></div>') + "</header>";
    if (doc) return [top, ""];
    var c = count(), can = state.step === "areas" ? (c > 0 || keys(state.areas).length > 0) : c > 0;
    var nextLabel = state.step === "review" ? "작성 완료" : "다음";
    var msg = c ? "고른 증상 " + c + "개" : (state.step === "areas" ? "불편한 곳을 눌러 주세요" : "증상을 하나 이상 골라 주세요");
    var bottom = '<footer class="bottom"><div class="wrap bottom-in"><p class="count" aria-live="polite">' + msg + "</p>" +
      (n > 0 ? '<button type="button" class="btn ghost" data-act="prev">이전</button>' : "") +
      '<button type="button" class="btn next" data-act="next"' + (can ? "" : " disabled") + ">" + nextLabel + "</button></div></footer>";
    return [top, bottom];
  }
  function sig(el) { var d = el.dataset; return [d.act, d.id, d.f, d.v, d.g, d.q, d.key].join("|"); }
  function render(moved) {
    var act = document.activeElement, keep = act && act.dataset && act.dataset.act ? sig(act) : null;
    var keepId = act && act.id ? act.id : null;
    var b = bars();
    app.innerHTML = b[0] + '<main class="wrap main' + (state.step === "doctor" ? " is-doc" : "") + '">' + VIEWS[state.step]() + "</main>" + b[1];
    if (moved) {
      window.scrollTo(0, 0);
      var h1 = app.querySelector("h1"); if (h1) h1.focus({ preventScroll: true });
      return;
    }
    if (keep) {
      var els = app.querySelectorAll("[data-act]");
      for (var i = 0; i < els.length; i++) if (sig(els[i]) === keep) { els[i].focus({ preventScroll: true }); return; }
    }
    if (keepId) { var el = document.getElementById(keepId); if (el) el.focus({ preventScroll: true }); }
  }
  function go(step) { state.step = step; render(true); }

  function setPath(path, v) {
    var p = path.split("."), o = state;
    for (var i = 0; i < p.length - 1; i++) o = o[p[i]];
    o[p[p.length - 1]] = v;
  }
  function getPath(path) { return path.split(".").reduce(function (o, k) { return o[k]; }, state); }

  var resetArmed = 0;
  var ACT = {
    area: function (d) { state.areas[d.id] = !state.areas[d.id]; },
    toggle: function (d) { toggle(d.id); },
    pick: function (d) { if (!state.sel[d.id]) toggle(d.id); state.pending[d.key] = ""; },
    addfree: function (d) { addFree(d.key, state.pending[d.key]); state.pending[d.key] = ""; },
    remove: function (d) { removeEntry(d.id); },
    main: function (d) { state.main = state.main === d.id ? null : d.id; },
    det: function (d) { var x = det(d.id); x[d.f] = x[d.f] === d.v ? null : d.v; },
    detq: function (d) { var x = det(d.id), k = d.q + ":" + d.v; x.q[k] = !x.q[k]; },
    durall: function (d) {
      var prev = state.durAll; state.durAll = prev === d.v ? null : d.v;
      state.order.forEach(function (id) { var x = det(id); if (!x.dur || x.dur === prev) x.dur = state.durAll; });
    },
    hx: function (d) { state.hx[d.g][d.v] = !state.hx[d.g][d.v]; if (state.hx[d.g][d.v]) state.none[d.g] = false; },
    hxnone: function (d) { state.none[d.g] = !state.none[d.g]; if (state.none[d.g]) { state.hx[d.g] = {}; state.etc[d.g] = ""; } },
    set: function (d) { setPath(d.f, getPath(d.f) === d.v ? "" : d.v); },
    flip: function (d) { setPath(d.f, !getPath(d.f)); },
    go: function (d) { go(d.v); return true; },
    prev: function () { go(STEPS[STEPS.indexOf(state.step) - 1]); return true; },
    next: function () {
      var n = STEPS.indexOf(state.step);
      if (state.step === "areas" && !keys(state.areas).length && count()) go("details");
      else go(n === STEPS.length - 1 ? "doctor" : STEPS[n + 1]);
      return true;
    },
    sample: function () { loadSample(); go("doctor"); return true; },
    print: function () { window.print(); return true; },
    copy: function () {
      var text = summaryText(summary()), msg = document.getElementById("copy-msg"), out = document.getElementById("copy-out");
      var fallback = function () { out.hidden = false; out.value = text; out.focus(); out.select(); msg.textContent = "Select all and copy the text below."; };
      try {
        navigator.clipboard.writeText(text).then(function () { msg.textContent = "Copied. Paste into the chart."; }, fallback);
      } catch (e) { fallback(); }
      return true;
    },
    reset: function (d, el) {
      if (Date.now() - resetArmed < 5000) { resetArmed = 0; state = fresh(); render(true); return true; }
      resetArmed = Date.now(); el.textContent = "지우고 새로 시작할까요? 한 번 더 누르세요";
      return true;
    }
  };

  app.addEventListener("click", function (ev) {
    var el = ev.target.closest("[data-act]");
    if (!el || el.disabled) return;
    var fn = ACT[el.dataset.act];
    if (fn && !fn(el.dataset, el)) render(false);
  });
  app.addEventListener("input", function (ev) {
    var t = ev.target;
    if (t.dataset.search) {
      state.pending[t.dataset.search] = t.value;
      document.getElementById("r-" + t.dataset.search).innerHTML = resultsHtml(t.dataset.search);
    } else if (t.dataset.bind) {
      setPath(t.dataset.bind, t.value);
      var g = t.dataset.bind.split(".");
      if (g[0] === "etc" && t.value && state.none[g[1]]) { state.none[g[1]] = false; render(false); }
    }
  });
  app.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter" && !ev.isComposing && ev.target.dataset.search) {
      ev.preventDefault();
      ACT.addfree({ key: ev.target.dataset.search });
      render(false);
    }
  });

  function loadSample() {
    state = fresh(); state.sample = true;
    state.areas = { ear: true, dizzy: true };
    ["hearing_sudden", "tinnitus", "ear_fullness", "vertigo", "nausea"].forEach(toggle);
    addFree("ear", "전화 받을 때 왼쪽으로는 상대방 말이 로봇처럼 찌그러져 들려요");
    state.main = "hearing_sudden";
    state.det.hearing_sudden = { side: "L", dur: "d3", sev: "3", course: "const", q: {} };
    state.det.tinnitus = { side: "L", dur: "d3", sev: "2", course: "const", q: { "tinnitus:0": true, "tinnitus:4": true } };
    state.det.ear_fullness = { side: "L", dur: "d3", sev: "2", q: {} };
    state.det.vertigo = { dur: "d3", sev: "2", course: "inter", q: { "vertigoDur:2": true, "vertigoTrig:3": true } };
    state.det.nausea = { dur: "d3", sev: "1", q: {} };
    state.det[state.free[0].id] = { side: "L", dur: "d3", q: {} };
    state.info = { name: "김○○", age: "58", sex: "M", informant: "self" };
    state.hx.pmh = { htn: true, dm: true }; state.hx.meds = { antihtn: true, dmmed: true, antiplatelet: true };
    state.none = { allergy: true, surg: true }; state.hx.recent = { stress: true };
    state.life = { smoke: "ex", alcohol: "some", voice: false, noise: true, preg: "" };
    state.extra = "예전에도 한 번 비슷했는데 그때는 며칠 만에 좋아졌어요.";
  }

  /* 열려 있는 화면이 새 버전으로 바뀔 때 입력 내용을 이어 받는다 (아티팩트 뷰어 전용, 없으면 무시) */
  function start(d) { state = d && d.step && d.hx ? d : fresh(); render(false); }
  var hot = window.claude && window.claude.hot;
  try { if (hot && hot.snapshot) hot.snapshot(function () { return state; }); } catch (e) { /* 무시 */ }
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || null);
})();
