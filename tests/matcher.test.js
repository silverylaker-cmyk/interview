/* 환자가 실제로 쓸 법한 말이 증상 사전에서 찾아지는지 확인한다.
 * 실행: node tests/matcher.test.js */
var data = require("../data.js");
var M = require("../matcher.js");
var lex = M.compile(data);

/* [환자 표현, 기대하는 증상 id, (선택) 부위 안에서 쓴 경우 부위 id] */
var CASES = [
  ["귀가 먹먹해요", "ear_fullness"],
  ["귀가 멍멍하고 답답함", "ear_fullness"],
  ["비행기 탄 것처럼 귀가 막혔어요", "ear_fullness"],
  ["귀에서 삐 소리가 나요", "tinnitus"],
  ["삐~~ 하는 소리", "tinnitus"],
  ["귀에서 매미 우는 소리", "tinnitus"],
  ["귀가 웅웅 울려요", "tinnitus"],
  ["이명이 심해졌어요", "tinnitus"],
  ["귀에서 심장 뛰는 소리가 들려요", "tinnitus_puls"],
  ["귀에서 딸깍딸깍 소리", "tinnitus_click"],
  ["귀 안에서 부스럭거려요", "ear_rustle"],
  ["내 목소리가 귀에서 울려요", "autophony"],
  ["숨소리가 크게 들려요", "autophony"],
  ["오른쪽 귀가 잘 안 들려요", "hearing_loss"],
  ["가는귀가 먹었어요", "hearing_loss"],
  ["자고 일어났더니 갑자기 안 들려요", "hearing_sudden"],
  ["말소리가 웅얼웅얼 들려서 자꾸 되물어요", "speech_discrim"],
  ["TV 소리를 자꾸 키워요", "speech_discrim"],
  ["귀가 쑤시고 아파요", "ear_pain"],
  ["귀가 찌릿찌릿해요", "ear_pain"],
  ["귓속이 욱신거려요", "ear_pain"],
  ["귀에서 진물이 나와요", "otorrhea"],
  ["귀에서 고름이 흘러요", "otorrhea"],
  ["귀가 너무 간지러워요", "ear_itch"],
  ["귀지가 꽉 찬 것 같아요", "cerumen"],
  ["귀에 벌레가 들어갔어요", "ear_fb"],
  ["면봉으로 귀 파다가 찔렸어요", "ear_trauma"],
  ["귀에 물 들어간 것 같아요", "ear_water"],
  ["귀 뒤가 부었어요", "ear_postauricular"],
  ["귓바퀴가 빨갛게 부었어요", "auricle_swell"],

  ["코가 꽉 막혀서 숨을 못 쉬겠어요", "nasal_obstruction"],
  ["코막힘이 심해요", "nasal_obstruction"],
  ["콧물이 줄줄 흘러요", "rhinorrhea"],
  ["누런 콧물이 나와요", "rhinorrhea"],
  ["코가 목 뒤로 넘어가요", "pnd"],
  ["가래가 목으로 넘어와요", "pnd"],
  ["재채기를 계속 해요", "sneezing"],
  ["코가 간질간질해요", "nasal_itch"],
  ["코피가 자주 나요", "epistaxis"],
  ["냄새를 못 맡아요", "hyposmia"],
  ["냄새가 안 나요", "hyposmia"],
  ["자꾸 탄내가 나요", "parosmia"],
  ["코에서 썩은 냄새가 나요", "cacosmia"],
  ["광대가 아프고 묵직해요", "facial_pain"],
  ["머리가 지끈지끈 아파요", "headache"],
  ["코 안이 헐었어요", "nasal_dry"],
  ["코딱지가 너무 많이 생겨요", "nasal_crust"],
  ["코를 부딪혀서 다쳤어요", "nasal_trauma"],
  ["아이가 코에 구슬을 넣었어요", "nasal_fb"],
  ["코맹맹이 소리가 나요", "nasal_voice"],
  ["코 안에 물혹이 있대요", "nasal_mass"],

  ["목이 따끔따끔해요", "sore_throat"],
  ["목이 칼칼해요", "throat_scratchy"],
  ["목이 부어서 아파요", "sore_throat"],
  ["침 삼킬 때 아파요", "odynophagia"],
  ["목에 뭐가 걸린 것 같아요", "globus"],
  ["목에 이물감이 있어요", "globus"],
  ["생선 가시가 걸렸어요", "throat_fb"],
  ["목에 가래가 낀 것 같은데 안 뱉어져요", "throat_phlegm"],
  ["자꾸 큼큼 헛기침을 해요", "throat_clearing"],
  ["음식이 잘 안 넘어가요", "dysphagia"],
  ["밥 먹다가 사레가 자주 걸려요", "choking"],
  ["신물이 올라와요", "throat_burn"],
  ["편도가 부었어요", "tonsil_swell"],
  ["목에서 냄새나는 노란 알갱이가 나와요", "tonsillolith"],
  ["목젖이 부었어요", "uvula"],
  ["입이 안 벌어져요", "trismus"],
  ["가래에 피가 섞여 나와요", "hemoptysis"],
  ["목이 조이는 느낌", "throat_tight"],

  ["목소리가 쉬었어요", "hoarseness"],
  ["목이 잠겨요", "hoarseness"],
  ["목소리가 안 나와요", "aphonia"],
  ["노래할 때 삑사리가 나요", "voice_break"],
  ["고음이 안 올라가요", "high_pitch_loss"],
  ["말을 조금만 해도 목이 피곤해요", "vocal_fatigue"],
  ["목소리가 떨려요", "vocal_tremor"],
  ["발음이 어눌해졌어요", "dysarthria"],

  ["기침이 안 멈춰요", "cough"],
  ["마른기침을 콜록콜록", "cough"],
  ["가래가 많이 나와요", "sputum"],
  ["숨이 차요", "dyspnea"],
  ["숨 쉴 때 쌕쌕 소리가 나요", "wheeze"],

  ["입안이 헐었어요", "oral_ulcer"],
  ["혓바늘이 돋았어요", "oral_ulcer"],
  ["혀가 화끈거리고 따가워요", "glossodynia"],
  ["입이 바짝 말라요", "xerostomia"],
  ["입냄새가 심해요", "halitosis"],
  ["맛을 못 느껴요", "hypogeusia"],
  ["입에서 쓴맛이 나요", "dysgeusia"],
  ["혀에 백태가 꼈어요", "coated_tongue"],
  ["입술에 물집이 잡혔어요", "lip_lesion"],
  ["혀에 뭐가 났어요", "oral_mass"],

  ["빙빙 돌아요", "vertigo"],
  ["천장이 빙글빙글 돌아요", "vertigo"],
  ["어지러워요", "vertigo"],
  ["누울 때 어지러워요", "positional_vertigo"],
  ["이석증 같아요", "positional_vertigo"],
  ["일어날 때 핑 돌아요", "presyncope"],
  ["붕 뜬 느낌이에요", "lightheaded"],
  ["걸을 때 휘청거려요", "disequilibrium"],
  ["속이 울렁거리고 토했어요", "nausea"],

  ["입이 돌아갔어요", "facial_palsy"],
  ["한쪽 눈이 안 감겨요", "facial_palsy"],
  ["양치할 때 물이 새요", "facial_palsy"],
  ["눈 밑이 파르르 떨려요", "facial_twitch"],
  ["턱에서 딱딱 소리가 나요", "tmj"],

  ["목에 멍울이 만져져요", "neck_mass"],
  ["턱 밑에 콩알만 한 게 잡혀요", "neck_mass"],
  ["임파선이 부었어요", "lymph_node"],
  ["귀 밑이 부었어요", "parotid_swell"],
  ["갑상선에 혹이 있대요", "thyroid"],

  ["코를 심하게 골아요", "snoring"],
  ["자다가 숨을 안 쉰대요", "apnea"],
  ["입 벌리고 자요", "mouth_breathing"],
  ["낮에 너무 졸려요", "daytime_sleepy"],

  ["열이 나요", "fever"],
  ["으슬으슬 춥고 떨려요", "chills"],
  ["몸살 기운이 있어요", "myalgia"],
  ["감기 걸린 것 같아요", "uri"],

  ["아이가 귀를 자꾸 만져요", "ear_tugging"],
  ["불러도 대답을 안 해요", "poor_response"],
  ["말이 늦어요", "speech_delay"],

  ["보청기 상담하고 싶어요", "v_hearing_aid"],
  ["진단서 떼러 왔어요", "v_document"],
  ["약 타러 왔어요", "v_refill"],

  ["귀 안에서 뭔가 꿈틀거려요", "ear_rustle"],
  ["상대방 말이 로봇처럼 찌그러져 들려요", "dysacusis"],
  ["아이가 코를 자꾸 파요", "nose_rub"],
  ["눈이 아파요", "eye_sx"],

  /* 부위 안에서 짧게 쓴 경우 */
  ["아파요", "ear_pain", "ear"],
  ["가려워요", "ear_itch", "ear"],
  ["막혀요", "nasal_obstruction", "nose"],
  ["피나요", "epistaxis", "nose"],
  ["부었어요", "sore_throat", "throat"],
  ["따가워요", "sore_throat", "throat"]
];

/* 엉뚱하게 걸리면 안 되는 말: [환자 표현, 확실한 일치로 나오면 안 되는 증상 id] */
var NOT = [
  ["목요일부터 아팠어요", "sore_throat"],
  ["혹시 약만 받을 수 있나요", "neck_mass"],
  ["코가 아파요", "nose_rub"],
  ["콧물이 새벽에 줄줄 나요", "facial_palsy"],
  ["담배를 피워요", "sputum"],
  ["머리가 멍해요", "ear_fullness"],
  ["코가 막히고 혈압약을 먹어요", "epistaxis"],
  ["점점 커져요", "skin_lesion"],
  ["귀찮아요", "ear_pain"]
];

var fail = 0;
NOT.forEach(function (c) {
  var hit = M.search(lex, c[0], { limit: 20 }).filter(function (r) { return r.sure && r.item.id === c[1]; });
  if (hit.length) { fail++; console.log("✗ \"" + c[0] + "\" 가 " + c[1] + " 로 잘못 일치"); }
});
CASES.forEach(function (c) {
  var opts = { limit: 3 };
  if (c[2]) { opts.area = c[2]; opts.ctx = lex.areaById[c[2]].ctx; }
  var res = M.search(lex, c[0], opts);
  var ids = res.map(function (r) { return r.item.id; });
  if (ids.indexOf(c[1]) === -1) {
    fail++;
    console.log("✗ \"" + c[0] + "\" → " + (ids.join(", ") || "(없음)") + "   기대: " + c[1]);
  }
});

/* 사전 자체 점검: id 중복, 부위 · 추가질문 이름 오타 */
var seen = {};
data.S.forEach(function (row) {
  if (seen[row[0]]) { fail++; console.log("✗ id 중복: " + row[0]); }
  seen[row[0]] = 1;
  row[1].split(",").forEach(function (a) {
    if (!lex.areaById[a]) { fail++; console.log("✗ 없는 부위: " + row[0] + " → " + a); }
  });
  ((row[6] || {}).q || []).forEach(function (q) {
    if (!data.Q[q]) { fail++; console.log("✗ 없는 추가질문: " + row[0] + " → " + q); }
  });
});

console.log("증상 " + data.S.length + "개 · 표현 " + (CASES.length + NOT.length) + "개 점검 · 실패 " + fail + "개");
process.exit(fail ? 1 : 0);
