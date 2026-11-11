/* 이비인후과 문진 증상 사전
 *
 * 한 줄 = 증상 하나:
 *   [id, 부위(쉼표로 여러 개), 묶음, 환자에게 보이는 한글 표현, 의사에게 보이는 영어 용어, 검색어 패턴[], 옵션]
 *
 * 검색어 패턴 문법 (matcher.js 가 해석):
 *   "먹먹|멍멍"            → 둘 중 하나라도 문장에 있으면 일치
 *   "귀|귓+$아픔"          → '+' 로 나눈 모든 조각이 문장에 있어야 일치
 *   $아픔 같은 $매크로      → 아래 MACROS 의 활용형 묶음으로 치환
 *
 * 옵션: lat(좌우 구분 질문), flag(의사용 주의 문구), q(추가 질문 묶음 이름들)
 */
(function (root) {
  var MACROS = {
    "$아픔": "아프|아파|아픈|아팠|아픔|통증|쑤시|쑤셔|쑤심|욱신|찌릿|따끔|콕콕|지끈|얼얼|쓰라|쓰려|뻐근|시큰|저릿|아리",
    "$가려움": "가렵|가려|간지|간질|근질|근지",
    "$부음": "붓|부었|부어|부은|부풀|붓기|부종|부음|퉁퉁",
    "$피": "피가|피나|피난|피섞|피묻|피를|피도|출혈|핏",
    "$막힘": "막히|막혀|막힌|막힘|막혔|답답|꽉찬|꽉찼|꽉차",
    "$혹": "혹|멍울|몽우리|덩어리|덩이|종양|물혹|결절|뾰루지|종기|볼록|불룩|튀어나",
    "$귀": "귀|귓",
    "$코": "코|콧",
    "$입": "입|혀|혓|구강",
    "$냄새": "냄새|악취|구린|썩은|비린|쉰내|고린"
  };

  var AREAS = [
    { id: "ear", ko: "귀", en: "Ear", eg: "아픔 · 먹먹함 · 소리 · 진물 · 안 들림", ctx: "귀" },
    { id: "nose", ko: "코", en: "Nose", eg: "코막힘 · 콧물 · 재채기 · 코피 · 냄새", ctx: "코" },
    { id: "throat", ko: "목 안 (목구멍)", en: "Throat", eg: "따가움 · 걸린 느낌 · 삼키기 · 편도", ctx: "목" },
    { id: "voice", ko: "목소리", en: "Voice", eg: "쉼 · 갈라짐 · 안 나옴 · 발음", ctx: "목소리" },
    { id: "cough", ko: "기침 · 가래 · 숨", en: "Cough / Airway", eg: "기침 · 가래 · 숨참 · 쌕쌕", ctx: "" },
    { id: "mouth", ko: "입 · 혀 · 입술", en: "Oral cavity", eg: "헐음 · 혀 통증 · 입마름 · 맛 · 입냄새", ctx: "입" },
    { id: "dizzy", ko: "어지럼", en: "Dizziness", eg: "빙빙 · 핑 · 휘청 · 울렁", ctx: "어지럼" },
    { id: "face", ko: "얼굴 · 턱", en: "Face / Jaw", eg: "마비 · 떨림 · 얼굴 통증 · 턱 소리", ctx: "얼굴" },
    { id: "neck", ko: "목 겉 (멍울 · 붓기)", en: "Neck", eg: "혹 · 임파선 · 귀밑 · 턱밑 · 갑상선", ctx: "목" },
    { id: "sleep", ko: "코골이 · 잠", en: "Sleep", eg: "코골이 · 숨 멈춤 · 입 벌리고 잠 · 졸림", ctx: "잠" },
    { id: "general", ko: "열 · 몸살 · 온몸", en: "General", eg: "열 · 오한 · 몸살 · 두통 · 감기 기운", ctx: "" },
    { id: "child", ko: "아이 (보호자가 본 모습)", en: "Pediatric (caregiver-observed)", eg: "귀를 만짐 · 보챔 · 말이 늦음 · 입 벌리고 잠", ctx: "아이" },
    { id: "visit", ko: "검사 · 상담 · 다른 용무", en: "Visit purpose", eg: "검사 결과 · 약 처방 · 서류 · 수술 상담", ctx: "" }
  ];

  /* 추가 질문 묶음: [한글, 영어] */
  var Q = {
    painChar: { ko: "어떻게 아픈가요?", opts: [["욱신욱신 · 쑤셔요", "throbbing"], ["찌릿 · 콕콕 찔러요", "sharp/stabbing"], ["묵직하게 아파요", "dull"], ["화끈 · 따가워요", "burning"], ["누르면 아파요", "tender to touch"]] },
    discharge: { ko: "어떤 것이 나오나요?", opts: [["맑은 물", "serous/watery"], ["누런 고름", "purulent"], ["끈적한 것", "mucoid"], ["피가 섞임", "bloody"], ["냄새가 남", "foul-smelling"]] },
    rhinorrhea: { ko: "콧물이 어떤가요?", opts: [["맑은 물 같아요", "watery/clear"], ["끈적 · 하얘요", "mucoid"], ["누렇거나 초록색", "purulent (yellow-green)"], ["피가 섞여요", "blood-tinged"], ["냄새가 나요", "foul-smelling"]] },
    obstruction: { ko: "어떻게 막히나요?", opts: [["항상 막혀요", "constant"], ["양쪽이 번갈아", "alternating sides"], ["누우면 심해요", "worse when supine"], ["밤 · 아침에 심해요", "worse at night/morning"], ["환절기 · 특정 계절에", "seasonal"]] },
    tinnitus: { ko: "어떤 소리인가요?", opts: [["삐— (높은 소리)", "high-pitched ringing"], ["윙 · 웅— (낮은 소리)", "low-pitched humming/buzzing"], ["쏴 · 쉬— (바람 · 물소리)", "hissing/rushing"], ["매미 · 귀뚜라미 소리", "cicada/cricket-like"], ["조용할 때 · 밤에 심해요", "worse in quiet/at night"], ["잠을 못 잘 정도", "disturbs sleep"]] },
    onsetMode: { ko: "어떻게 시작됐나요?", opts: [["갑자기", "sudden onset"], ["서서히", "gradual onset"], ["좋았다 나빴다 해요", "fluctuating"]] },
    hearing: { ko: "어떤 때 불편한가요?", opts: [["갑자기 안 들려요", "sudden onset"], ["서서히 나빠졌어요", "gradual onset"], ["좋았다 나빴다 해요", "fluctuating"], ["시끄러운 곳에서 특히", "worse in background noise"], ["전화 통화가 어려워요", "difficulty on the phone"]] },
    vertigoDur: { ko: "한 번 어지러우면 얼마나 가나요?", opts: [["몇 초 ~ 1분", "lasts seconds to 1 min"], ["몇 분 ~ 몇십 분", "lasts minutes"], ["몇 시간", "lasts hours"], ["하루 종일 계속", "continuous (>24 h)"]] },
    vertigoTrig: { ko: "언제 어지러운가요?", opts: [["눕거나 돌아누울 때", "on lying down/rolling over in bed"], ["고개를 숙이거나 젖힐 때", "on looking up/bending down"], ["일어설 때", "on standing up"], ["가만히 있어도", "spontaneous (at rest)"], ["걸을 때", "when walking"]] },
    cough: { ko: "어떤 기침인가요?", opts: [["마른기침", "dry"], ["가래 기침", "productive"], ["밤 · 새벽에 심해요", "nocturnal"], ["누우면 심해요", "worse when supine"], ["말할 때 · 찬 공기에", "triggered by talking/cold air"], ["식사 후에", "postprandial"]] },
    sputum: { ko: "가래가 어떤가요?", opts: [["하얗거나 맑아요", "white/clear"], ["누래요", "yellow"], ["초록색", "green"], ["피가 섞여요", "blood-tinged"], ["끈적해서 안 뱉어져요", "tenacious"]] },
    massLoc: { ko: "어디에 있나요?", opts: [["턱 밑", "submandibular"], ["귀 밑 · 귀 앞", "parotid/periauricular"], ["목 옆", "lateral neck"], ["목 앞 가운데", "anterior midline"], ["쇄골 위", "supraclavicular"], ["뒷목", "posterior neck"]] },
    massChar: { ko: "어떤가요?", opts: [["누르면 아파요", "tender"], ["안 아파요", "non-tender"], ["점점 커져요", "enlarging"], ["커졌다 작아졌다", "fluctuating in size"], ["딱딱해요", "hard"], ["말랑해요", "soft"], ["여러 개", "multiple"]] },
    epistaxis: { ko: "코피가 어떻게 나나요?", opts: [["가끔", "occasional"], ["거의 매일", "almost daily"], ["10분 넘게 안 멈춰요", "prolonged (>10 min)"], ["지금도 나요", "active bleeding now"], ["코를 후빈 뒤에", "after nose picking"], ["목 뒤로 넘어가요", "posterior drainage of blood"]] },
    fever: { ko: "체온이 얼마였나요?", opts: [["37.5 ~ 38도", "37.5–38.0°C"], ["38 ~ 39도", "38.0–39.0°C"], ["39도 이상", "≥39.0°C"], ["안 재 봤어요", "not measured"]] },
    timing: { ko: "언제 심한가요?", opts: [["아침에", "worse in the morning"], ["밤에", "worse at night"], ["식사 후에", "worse after meals"], ["말을 많이 한 뒤", "worse after voice use"]] },
    swallow: { ko: "무엇이 안 넘어가나요?", opts: [["물 · 음료", "liquids"], ["밥 · 고기 같은 덩어리", "solids"], ["알약", "pills"]] },
    snore: { ko: "얼마나 고나요?", opts: [["매일", "nightly"], ["피곤하거나 술 마신 날만", "only when tired/after alcohol"], ["옆방에서도 들릴 정도", "loud (audible in the next room)"], ["같이 자는 사람이 알려 줌", "reported by bed partner"]] },
    smell: { ko: "언제부터, 얼마나?", opts: [["감기 · 코로나 뒤부터", "post-viral (URI/COVID-19)"], ["머리를 다친 뒤부터", "post-traumatic"], ["전혀 못 맡아요", "complete loss"], ["조금은 맡아요", "partial loss"], ["좋았다 나빴다 해요", "fluctuating"]] }
  };

  var S = [
    /* ───────── 귀 ───────── */
    ["ear_pain", "ear", "아픔", "귀가 아파요", "Otalgia", ["$귀+$아픔", "이통", "귓속+$아픔"], { lat: 1, q: ["painChar"] }],
    ["ear_pain_touch", "ear", "아픔", "귀를 만지거나 당기면 아파요", "Tragal tenderness / pain on auricular traction", ["$귀+만지|당기|누르|건드|이어폰+$아픔", "귓바퀴+$아픔"], { lat: 1 }],
    ["ear_pain_chew", "ear,face", "아픔", "씹거나 입 벌릴 때 귀 앞이 아파요", "Preauricular pain on mastication (r/o TMJ disorder)", ["씹|입벌|하품+$귀+$아픔", "귀앞+$아픔"], { lat: 1 }],
    ["ear_pain_swallow", "ear,throat", "아픔", "침 삼킬 때 귀까지 아파요", "Referred otalgia on swallowing", ["삼키|삼킬|넘길+$귀+$아픔"], { lat: 1 }],
    ["ear_postauricular", "ear", "아픔", "귀 뒤가 아프거나 부었어요", "Postauricular pain/swelling", ["귀뒤|귀뒷|귀뒤쪽+$아픔|$부음|$혹"], { lat: 1, flag: "Postauricular pain/swelling — r/o mastoiditis; may precede facial palsy" }],

    ["ear_fullness", "ear", "먹먹함", "귀가 먹먹해요 · 막힌 느낌이에요", "Aural fullness", ["먹먹|멍멍|벙벙", "$귀+$막힘", "$귀+꽉|압력|압박|멍한|멍해|멍하|멍멍", "이충만|이폐쇄", "$귀+비행기|터널"], { lat: 1 }],
    ["ear_water", "ear", "먹먹함", "귀에 물이 들어간 느낌 · 찰랑거려요", "Sensation of fluid in the ear", ["$귀+물이|물들|물찬|물속|찰랑|출렁|꿀렁"], { lat: 1 }],
    ["ear_pop", "ear", "먹먹함", "귀가 뻥 뚫리지 않아요 · 침 삼키면 딱딱 소리가 나요", "Difficulty equalizing ear pressure / crackling on swallowing (Eustachian tube dysfunction sx)", ["$귀+뚫리|뚫려|뚫어|펑|뻥", "삼키|삼킬|침+$귀+딱|소리"], { lat: 1 }],
    ["ear_baro", "ear", "먹먹함", "비행기 · 다이빙 · 수영 뒤부터 귀가 이상해요", "Ear symptoms after flight/diving/swimming (r/o barotrauma, otitis externa)", ["비행기|다이빙|잠수|스쿠버|수영|물놀이|워터파크+$귀"], { lat: 1 }],

    ["tinnitus", "ear", "소리", "귀에서 소리가 나요 (삐— · 윙— · 웅—)", "Tinnitus", ["이명|귀울림|귀울음", "$귀+소리가나|소리나|소리가들|울려|울림|울리|울어|삐|윙|웅|쉬|쏴|찡", "삐소리|윙소리|웅소리|삐하는|윙하는|웅하는|위잉|우웅|삐이", "매미|귀뚜라미|벌레우는|기계소리|전기소리|전선|바람소리|물흐르는소리|김빠지는"], { lat: 1, q: ["tinnitus"] }],
    ["tinnitus_puls", "ear", "소리", "귀에서 심장 뛰는 소리 · 맥박 소리가 나요", "Pulsatile tinnitus", ["$귀+심장|맥박|두근|쿵쿵|쿵쾅|박동|욱욱|쉭쉭", "박동성"], { lat: 1, flag: "Pulsatile tinnitus — consider vascular evaluation" }],
    ["tinnitus_click", "ear", "소리", "귀에서 딸깍 · 딱딱 · 두두둑 소리가 나요", "Clicking tinnitus (r/o middle-ear/palatal myoclonus)", ["$귀+딸깍|딱딱|두두둑|따닥|타닥|톡톡|틱틱|딱소리|덜그럭|떨리는소리|파르르"], { lat: 1 }],
    ["ear_rustle", "ear", "소리", "귀 안에서 부스럭 · 바스락거려요 (뭐가 움직이는 느낌)", "Rustling noise / moving sensation in the ear canal (r/o cerumen, hair, foreign body)", ["$귀+부스럭|바스락|버석|사각|움직이|움직여|굴러|달그락|서걱|꿈틀|꼼지락|기어다|기어가"], { lat: 1 }],
    ["autophony", "ear", "소리", "내 목소리 · 숨소리가 귀에서 울려요", "Autophony", ["내목소리|제목소리|자기목소리|말소리|숨소리+울려|울림|울리|크게들|들려", "동굴|자성강청|이관개방"], { lat: 1 }],

    ["hearing_loss", "ear", "듣기", "소리가 잘 안 들려요", "Hearing loss", ["안들|못들|잘안들|안들려|들리지않|귀가어두|가는귀|귀먹|난청|청력", "$귀+작게들|멀게들|희미"], { lat: 1, q: ["hearing"] }],
    ["hearing_sudden", "ear", "듣기", "갑자기 한쪽 귀가 안 들려요", "Sudden hearing loss", ["갑자기|갑작|자고일어나|어느날+안들|못들|먹먹|청력", "돌발성"], { lat: 1, flag: "Sudden hearing loss — urgent audiometry (SSNHL treatment window)" }],
    ["speech_discrim", "ear", "듣기", "소리는 들리는데 말이 또렷하지 않아요 (웅얼거리게 들림, 자꾸 되물음)", "Poor speech discrimination (hears but cannot understand)", ["웅얼|웅웅거리게들|또렷|말귀|못알아듣|못알아들|되묻|되물|뭐라고|티비소리|TV소리|텔레비전소리|볼륨|분간|분별"], {}],
    ["hyperacusis", "ear", "듣기", "소리가 너무 크게 · 울려서 들려요, 소리에 예민해요", "Hyperacusis / sound sensitivity", ["소리+예민|민감|크게들|시끄럽게|거슬|괴로", "청각과민", "소리+울려들|울려서|쩌렁|깨지는"], { lat: 1 }],
    ["dysacusis", "ear", "듣기", "소리가 이상하게 (찌그러져 · 두 개로) 들려요", "Distorted hearing (dysacusis / diplacusis)", ["소리|말이|말소리|목소리|음악|들려|들리|들림+찌그러|이상하게들|두개로|겹쳐|로봇|기계음|음정이다르|음이다르|갈라져들|깨져들|깨지는"], { lat: 1 }],

    ["otorrhea", "ear", "진물 · 가려움", "귀에서 물 · 진물 · 고름이 나와요", "Otorrhea", ["$귀+진물|고름|물이나|물나|물이흘|흘러|농|분비물|축축|젖어|귀젖|뭐가나|노란물|누런", "이루"], { lat: 1, q: ["discharge"] }],
    ["ear_bleed", "ear", "진물 · 가려움", "귀에서 피가 나요", "Otorrhagia (bleeding from the ear)", ["$귀+$피"], { lat: 1 }],
    ["ear_odor", "ear", "진물 · 가려움", "귀에서 냄새가 나요", "Malodorous ear / foul-smelling otorrhea", ["$귀+$냄새"], { lat: 1 }],
    ["ear_itch", "ear", "진물 · 가려움", "귀가 가려워요 · 간지러워요", "Ear pruritus", ["$귀+$가려움"], { lat: 1 }],
    ["cerumen", "ear", "진물 · 가려움", "귀지가 많아요 · 귀지가 막은 것 같아요", "Cerumen (impaction suspected)", ["귀지|귓밥|귀밥|귀청소|귀파"], { lat: 1 }],
    ["ear_dry", "ear", "진물 · 가려움", "귀 안이 건조하고 각질 · 딱지가 생겨요", "Ear canal dryness / scaling / crusting", ["$귀+건조|각질|딱지|비듬|허옇|벗겨|껍질"], { lat: 1 }],

    ["ear_fb", "ear", "다침 · 겉모습", "귀에 뭐가 들어갔어요 (벌레 · 솜 · 이물질)", "Foreign body in the ear", ["$귀+들어갔|들어간|들어가|벌레|면봉솜|솜이|구슬|이물|이어폰팁|이어팁|빠지지|안빠져|박혔"], { lat: 1 }],
    ["ear_trauma", "ear", "다침 · 겉모습", "귀를 다쳤어요 (귀 파다가 · 맞아서 · 부딪혀서)", "Ear trauma (r/o tympanic membrane perforation)", ["$귀+다쳤|다쳐|다친|찔렸|찔러|찔린|맞았|맞고|부딪|긁혔|찢어|파다가|후비다", "뺨+맞", "고막+터|찢|구멍|천공"], { lat: 1 }],
    ["auricle_swell", "ear", "다침 · 겉모습", "귓바퀴 · 귓불이 붓고 빨개요", "Auricular swelling/erythema (r/o perichondritis, hematoma)", ["귓바퀴|귓불|귓볼|귀겉|귀바깥|귓등+$부음|빨개|빨갛|벌개|열감|뜨거", "$귀+$부음"], { lat: 1 }],
    ["ear_lump", "ear", "다침 · 겉모습", "귀 · 귀 주변에 혹 · 뾰루지가 생겼어요", "Auricular/periauricular mass or furuncle", ["$귀+$혹|여드름|곪|났어"], { lat: 1 }],
    ["preauricular_sinus", "ear", "다침 · 겉모습", "귀 앞 작은 구멍에서 진물 · 냄새가 나거나 부었어요", "Preauricular sinus — infection suspected", ["귀앞|귀옆|귀위+구멍", "이루공|전이개|누공"], { lat: 1 }],
    ["ear_vesicle", "ear", "다침 · 겉모습", "귀에 물집이 생겼어요", "Auricular vesicles", ["$귀+물집|수포|포진", "대상포진+$귀"], { lat: 1, flag: "Auricular vesicles — r/o herpes zoster oticus (Ramsay Hunt)" }],
    ["ear_piercing", "ear", "다침 · 겉모습", "귀 뚫은 곳이 곪았어요 · 살이 튀어나왔어요", "Ear piercing site infection / keloid", ["귀걸이|피어싱|귀뚫|켈로이드"], { lat: 1 }],
    ["ear_numb", "ear,face", "다침 · 겉모습", "귀 주변 감각이 이상해요 · 저려요", "Periauricular paresthesia", ["$귀+저려|저리|감각|먹먹한감각|남의살|찌릿찌릿"], { lat: 1 }],

    /* ───────── 코 ───────── */
    ["nasal_obstruction", "nose", "막힘 · 콧물", "코가 막혀요", "Nasal obstruction", ["$코+$막힘|숨쉬기|숨을못|숨이안|맹맹|안뚫|꽉", "코막힘|코맥힘|비폐색"], { lat: 1, q: ["obstruction"] }],
    ["rhinorrhea", "nose", "막힘 · 콧물", "콧물이 나요", "Rhinorrhea", ["콧물|코물|비루", "$코+흘러|흘리|줄줄|질질|주르륵|뚝뚝|나와|훌쩍"], { lat: 1, q: ["rhinorrhea"] }],
    ["pnd", "nose,throat", "막힘 · 콧물", "콧물이 목 뒤로 넘어가요", "Postnasal drip", ["후비루", "$코|콧물|가래+목뒤|목으로|뒤로|넘어가|넘어와|넘어감|삼켜|내려가", "목뒤+넘어|걸려|끈적"], {}],
    ["sneezing", "nose", "막힘 · 콧물", "재채기가 자주 나요", "Sneezing", ["재채기|재체기|제채기|에취|엣취"], {}],
    ["nasal_itch", "nose", "막힘 · 콧물", "코가 가려워요 · 간질간질해요", "Nasal itching", ["$코+$가려움"], {}],
    ["eye_itch", "nose", "막힘 · 콧물", "눈이 가렵고 눈물이 나요", "Ocular itching / tearing (allergic eye sx)", ["눈+$가려움|눈물|충혈|빨개|비비"], {}],
    ["blow_unrelieved", "nose", "막힘 · 콧물", "코를 풀어도 시원하지 않아요 · 안 나와요", "Unrelieved nasal blowing / retained secretion", ["$코+풀어도|풀어|풀면+안나|시원|그대로|안뚫", "코풀"], {}],
    ["sniffing", "nose,child", "막힘 · 콧물", "코를 자꾸 훌쩍 · 킁킁거려요", "Habitual sniffing / snorting", ["훌쩍|킁킁|킁거|들이마시|코먹|코를먹"], {}],
    ["spray_dependence", "nose", "막힘 · 콧물", "코 뿌리는 약을 안 쓰면 막혀요", "Topical decongestant dependence (r/o rhinitis medicamentosa)", ["스프레이|뿌리는약|뿌리는거|오트리빈|화이투벤|비염약+없으면|안쓰면|계속|의존|중독|끊"], {}],
    ["unilat_foul_rhinorrhea", "nose", "막힘 · 콧물", "한쪽 코에서만 냄새나는 콧물이 나와요", "Unilateral foul-smelling rhinorrhea", ["한쪽|한쪽만|한쪽코+콧물|누런|$냄새"], { lat: 1, flag: "Unilateral foul rhinorrhea — r/o foreign body, fungal/odontogenic sinusitis, neoplasm" }],
    ["csf_like", "nose", "막힘 · 콧물", "고개를 숙이면 맑은 물이 코에서 뚝뚝 떨어져요", "Clear watery rhinorrhea on bending forward", ["고개+숙이|숙일+물|뚝뚝|떨어", "맹물|수돗물처럼"], { lat: 1, flag: "Positional clear rhinorrhea — r/o CSF leak" }],

    ["epistaxis", "nose,child", "코피 · 냄새", "코피가 나요", "Epistaxis", ["코피|비출혈", "$코+$피"], { lat: 1, q: ["epistaxis"] }],
    ["bloody_mucus", "nose", "코피 · 냄새", "콧물 · 코딱지에 피가 섞여 나와요", "Blood-tinged nasal discharge / crusts", ["콧물|코딱지|코풀+$피|빨간|붉은"], { lat: 1 }],
    ["hyposmia", "nose", "코피 · 냄새", "냄새를 잘 못 맡아요", "Hyposmia / anosmia", ["냄새+못맡|안맡|못맡|안나|못느|안느|모르|둔해|떨어|없어", "후각|무후각"], { q: ["smell"] }],
    ["parosmia", "nose", "코피 · 냄새", "이상한 냄새가 나요 (탄내 · 썩은내 · 없는 냄새)", "Parosmia / phantosmia", ["탄내|타는냄새|썩은내|걸레냄새|하수구|화학약품|담배냄새+나", "냄새+이상|다르게|바뀌|변했|역하", "이취|환취"], {}],
    ["cacosmia", "nose", "코피 · 냄새", "코 안에서 나쁜 냄새가 나요", "Cacosmia (foul odor from the nose)", ["$코+$냄새"], { lat: 1 }],
    ["nasal_voice", "nose,voice", "코피 · 냄새", "코맹맹이 소리가 나요", "Hyponasal speech", ["코맹맹|코멩멩|코막힌소리|코먹은소리|비음|콧소리"], {}],

    ["facial_pain", "nose,face", "얼굴 · 머리", "얼굴 (광대 · 이마 · 눈 사이)이 아프거나 묵직해요", "Facial pain/pressure", ["광대|이마|미간|눈사이|눈밑|눈썹|볼|뺨|얼굴+$아픔|묵직|무거|뻐근|눌리|압박|욱씬", "고개+숙이|숙일+$아픔|쏠리|묵직"], { lat: 1 }],
    ["headache", "nose,general,dizzy", "얼굴 · 머리", "머리가 아파요 · 무거워요", "Headache", ["두통|편두통", "머리|뒷골|관자놀이|정수리+$아픔|무거|무겁|깨질|띵|지끈|조이"], {}],
    ["periorbital", "nose,face", "얼굴 · 머리", "눈 주위가 붓거나 물체가 겹쳐 보여요", "Periorbital swelling / diplopia", ["눈주위|눈두덩|눈꺼풀|눈가+$부음", "겹쳐보|두개로보|복시|시력+떨어|흐려"], { lat: 1, flag: "Periorbital swelling/visual change — r/o orbital complication of sinusitis" }],
    ["epiphora", "nose,face", "얼굴 · 머리", "눈물이 계속 흘러요", "Epiphora", ["눈물+계속|자꾸|흘러|줄줄|고여"], { lat: 1 }],
    ["upper_tooth_pain", "nose,mouth", "얼굴 · 머리", "윗니 · 잇몸까지 아파요", "Maxillary dental pain (r/o odontogenic/maxillary sinusitis)", ["윗니|윗잇몸|어금니|치아|이빨|이가+$아픔|욱신|시려|시큰|흔들"], { lat: 1 }],

    ["nasal_dry", "nose", "코 안 · 겉모습", "코 안이 건조하고 따가워요 · 헐었어요", "Nasal dryness / mucosal soreness", ["$코+건조|마르|말라|바짝|따가|따갑|헐었|헐어|쓰라|화끈|당겨|당기"], {}],
    ["nasal_crust", "nose", "코 안 · 겉모습", "코딱지가 많이 생겨요 · 코 안에 딱지가 앉아요", "Nasal crusting", ["코딱지|코딱쥐|코딱찌", "$코+딱지|가피"], {}],
    ["nasal_vestibulitis", "nose", "코 안 · 겉모습", "코 안 · 콧구멍 입구에 뾰루지가 나고 아파요", "Nasal vestibulitis / furuncle", ["$코+뾰루지|종기|여드름|곪|고름", "코안|콧속|코속|콧구멍|코끝|콧볼|콧망울+$아픔|$부음|$혹"], { lat: 1 }],
    ["nasal_mass", "nose", "코 안 · 겉모습", "코 안에 혹 (물혹)이 있어요 · 뭐가 만져져요", "Intranasal mass (r/o nasal polyp)", ["$코+$혹|용종|폴립|살이|만져", "코안|콧속+뭐가"], { lat: 1 }],
    ["nasal_trauma", "nose", "코 안 · 겉모습", "코를 다쳤어요 (부딪힘 · 맞음)", "Nasal trauma (r/o nasal bone fracture)", ["$코+다쳤|다쳐|다친|부딪|맞았|맞고|부러|골절|깨졌|넘어져|찧"], {}],
    ["nasal_deformity", "nose", "코 안 · 겉모습", "코가 휘었어요 · 모양이 변했어요", "External nasal deformity", ["$코+휘었|휘어|휜|삐뚤|비뚤|모양|내려앉|주저앉|꺼졌", "비중격|만곡"], {}],
    ["nasal_fb", "nose,child", "코 안 · 겉모습", "코에 뭐가 들어갔어요", "Nasal foreign body", ["$코+들어갔|들어간|들어가|넣었|넣은|이물|구슬|콩|휴지|장난감|박혔"], { lat: 1 }],
    ["nasal_cold_air", "nose", "코 안 · 겉모습", "숨 쉴 때 코가 시려요 · 너무 뻥 뚫린 느낌이에요", "Nasal coldness / excessive airflow sensation (r/o atrophic rhinitis, empty nose)", ["$코+시려|시리|시림|시큰|찬바람|휑|너무뚫|허전"], {}],
    ["nasal_ext_pain", "nose", "코 안 · 겉모습", "코 겉 (콧등 · 코끝)이 아프거나 빨개요", "External nasal pain / erythema", ["콧등|코끝|코겉|콧대|코뼈+$아픔|빨개|빨갛|$부음", "$코+$아픔"], {}],

    /* ───────── 목 안 ───────── */
    ["sore_throat", "throat", "아픔", "목이 아파요 · 따가워요", "Sore throat", ["인후통|목감기|목몸살", "목|목구멍|목안|목속+$아픔|따가|따갑|따끔|칼칼|쓰라|쓰려|매워|맵|부었|부어|헐었|찢어지|갈라지는|타는", "칼칼"], { lat: 1, q: ["timing"] }],
    ["odynophagia", "throat", "아픔", "침 · 음식을 삼킬 때 아파요", "Odynophagia", ["삼키|삼킬|넘기|넘길|침삼|먹을때|마실때+$아픔|따가|따갑|따끔|힘들", "연하통"], { lat: 1 }],
    ["throat_scratchy", "throat", "아픔", "목이 칼칼하고 간질간질해요", "Scratchy throat / throat tickle", ["목|목구멍|목안+$가려움|칼칼|깔깔|까끌|까칠|껄끄|텁텁|매캐"], {}],
    ["throat_dry", "throat", "아픔", "목이 건조해요 · 바짝 말라요", "Throat dryness", ["목|목구멍|목안+건조|마르|말라|바짝|마른|타는|갈라"], {}],
    ["throat_burn", "throat", "아픔", "목이 화끈거려요 · 신물이 올라와요 · 속이 쓰려요", "Throat burning / acid regurgitation / heartburn (r/o LPR, GERD)", ["신물|쓴물|위산|역류|속쓰|속이쓰|가슴쓰|명치|트림|생목", "목+화끈|타는|뜨거|매운|시큼"], {}],

    ["globus", "throat", "걸린 느낌 · 가래", "목에 뭐가 걸린 느낌이에요", "Globus sensation", ["이물감|매핵기", "목|목구멍|목안|목젖+걸린|걸려|걸리|붙어|붙은|낀|끼인|끼어|덩어리|뭐가있|뭔가있|달라붙|막힌|막혀|혹이있는|알약|머리카락|솜|응어리"], {}],
    ["throat_fb", "throat", "걸린 느낌 · 가래", "생선 가시 · 음식이 목에 걸렸어요", "Pharyngeal foreign body suspected (e.g., fish bone)", ["가시|생선|뼈|뼛조각|닭뼈|알약+걸렸|걸린|걸려|박혔|박힌|삼켰|삼킨|넘어갔", "가시"], { lat: 1 }],
    ["throat_phlegm", "throat,cough", "걸린 느낌 · 가래", "목에 가래가 낀 느낌이에요 (잘 안 뱉어져요)", "Sensation of mucus in the throat / throat phlegm", ["가래+낀|끼|걸|붙|안뱉|안나|못뱉|달라붙|그렁|끈적|있는느낌|차|찬", "목+끈적|그렁"], {}],
    ["throat_clearing", "throat,child", "걸린 느낌 · 가래", "자꾸 헛기침을 해요 · 목을 가다듬어요 (큼큼 · 켁켁)", "Frequent throat clearing", ["헛기침|큼큼|흠흠|음음|켁켁|캑캑|컥컥|크흠|가다듬|목청"], {}],
    ["throat_tight", "throat,cough", "걸린 느낌 · 가래", "목이 조이는 느낌이에요 · 답답해요", "Throat tightness", ["목|목구멍|목안+조이|조여|졸리|답답|눌리|눌러|압박|막히는|메이|메어|멘"], {}],

    ["dysphagia", "throat", "삼키기", "음식 · 물이 잘 안 넘어가요", "Dysphagia", ["삼키|삼킬|넘기|넘길|넘어가+힘들|어렵|어려|못|안넘|안돼|걸려|걸리|막히", "연하곤란|삼킴곤란|삼킴장애|안넘어가|못삼키"], { q: ["swallow"] }],
    ["choking", "throat,cough", "삼키기", "사레가 자주 들려요", "Frequent choking on food/liquids (aspiration sx)", ["사레|사래|사례들|기도로넘어|잘못넘어|캑캑거리"], {}],
    ["nasal_regurg", "throat", "삼키기", "음식 · 물이 코로 넘어와요", "Nasal regurgitation", ["음식|물|밥|국물+코로"], {}],
    ["cant_swallow_saliva", "throat", "삼키기", "침도 못 삼킬 정도예요 · 침을 흘려요", "Inability to swallow saliva / drooling", ["침도|침을|침조차+못삼|못넘|흘려|흘리|뱉어"], { flag: "Cannot swallow saliva — r/o epiglottitis, peritonsillar/deep neck abscess" }],
    ["gagging", "throat", "삼키기", "헛구역질이 나요 · 양치할 때 구역질해요", "Gagging / retching", ["헛구역|구역질|욱하|웩|우웩|토할것같"], {}],

    ["tonsil_swell", "throat", "편도 · 목젖", "편도가 부었어요", "Tonsillar swelling (patient-reported)", ["편도|편도선+$부음|커|크|$아픔", "편도염|편도선염"], { lat: 1 }],
    ["tonsil_white", "throat", "편도 · 목젖", "편도 · 목 안에 하얀 게 끼었어요", "White patches/exudate on tonsils or pharynx", ["편도|목안|목구멍|목젖+하얀|하얗|흰|허연|고름|곱|농|백태|염증"], { lat: 1 }],
    ["tonsillolith", "throat,mouth", "편도 · 목젖", "목에서 냄새나는 노란 알갱이가 나와요", "Tonsilloliths", ["편도결석|편도석|목똥", "알갱이|쌀알|밥알|노란덩어리|하얀덩어리|좁쌀+나와|나오|튀어|뱉|$냄새|목"], {}],
    ["uvula", "throat", "편도 · 목젖", "목젖이 부었어요 · 길어진 느낌이에요", "Uvular swelling/elongation", ["목젖+$부음|길어|늘어|닿|내려|빨개|$아픔"], {}],
    ["trismus", "throat,face", "편도 · 목젖", "입이 잘 안 벌어져요", "Trismus", ["입+안벌|못벌|벌리기|벌어지지|벌려지지|안열|다물", "개구장애|개구"], { flag: "Trismus — with sore throat r/o peritonsillar abscess; otherwise TMJ/masticator space" }],
    ["muffled_voice", "throat,voice", "편도 · 목젖", "입에 뭘 문 것처럼 답답한 소리가 나요", "Muffled (\"hot potato\") voice", ["입에+문것|물고|머금", "뜨거운감자|목소리+답답|먹먹|막힌"], { flag: "Muffled voice — r/o peritonsillar abscess, supraglottitis" }],
    ["hemoptysis", "throat,cough,mouth", "편도 · 목젖", "가래 · 침에 피가 섞여 나와요", "Blood-tinged sputum/saliva", ["가래|침|기침|뱉+$피|빨간|붉은", "객혈|각혈|피가래|피를토|피토"], { flag: "Blood in sputum/saliva — examine upper aerodigestive tract; consider chest evaluation" }],
    ["throat_odor", "throat,mouth", "편도 · 목젖", "목 안에서 냄새가 올라와요", "Foul odor from the throat", ["목|목구멍|목안+$냄새"], {}],

    /* ───────── 목소리 ───────── */
    ["hoarseness", "voice", "목소리 변화", "목소리가 쉬었어요", "Hoarseness", ["쉰목|쉬었|쉬어|쉰소리|허스키|걸걸|탁한|탁해|거친|거칠|쇳소리|쇠소리|애성|목이쉬|목쉰|목쉼|목이잠|목잠|잠겨|잠긴|잠기"], { q: ["timing"] }],
    ["aphonia", "voice", "목소리 변화", "목소리가 안 나와요", "Aphonia", ["목소리|소리|말+안나|못내|안나와|안나오|나오지않", "실성증"], {}],
    ["voice_break", "voice", "목소리 변화", "목소리가 갈라져요 · 끊겨요 · 삑사리 (음이탈)가 나요", "Voice breaks / pitch breaks", ["갈라져|갈라지|갈라짐|끊겨|끊기|끊어지|삑사리|삑|음이탈|뒤집어|뒤집히"], {}],
    ["high_pitch_loss", "voice", "목소리 변화", "높은 음이 안 올라가요 · 노래가 안 돼요", "Loss of upper pitch range / singing difficulty", ["고음|높은음|높은소리|노래+안올|못올|안돼|안나|힘들|불안", "음역"], {}],
    ["vocal_fatigue", "voice", "목소리 변화", "조금만 말해도 목이 피곤하고 잠겨요", "Vocal fatigue", ["말|말하|이야기|통화|수업|강의|노래+조금만|오래|많이|하면|후에+피곤|피로|지쳐|잠겨|쉬어|힘들|아프|아파", "음성피로"], {}],
    ["vocal_tremor", "voice", "목소리 변화", "목소리가 떨려요", "Vocal tremor", ["목소리|소리|말+떨려|떨리|떨림|흔들"], {}],
    ["breathy_voice", "voice", "목소리 변화", "목소리에 힘이 없고 바람 새는 소리가 나요", "Breathy / weak voice (r/o glottic insufficiency)", ["바람+새는|새|빠지는", "목소리|소리+힘이없|약해|작아|가늘|기어들"], { flag: "Breathy voice — r/o vocal fold paralysis/glottic insufficiency" }],
    ["pitch_change", "voice", "목소리 변화", "목소리가 낮아졌어요 · 굵어졌어요 · 달라졌어요", "Voice pitch/quality change", ["목소리|음성+낮아|굵어|두꺼|가늘어|높아|변했|변해|달라|바뀌|이상"], {}],
    ["odynophonia", "voice", "목소리 변화", "말할 때 목이 아파요", "Odynophonia (pain on phonation)", ["말할때|말하면|소리낼때|소리내면|노래하면|노래할때+$아픔"], {}],
    ["morning_hoarse", "voice", "목소리 변화", "아침에 일어나면 목이 잠겨 있어요", "Morning hoarseness", ["아침|자고일어나|기상+잠겨|잠기|잠긴|쉬어|쉰|안나"], {}],
    ["dysarthria", "voice,face,dizzy", "발음", "발음이 어눌해졌어요 · 혀가 꼬여요", "Dysarthria", ["발음+어눌|이상|새|꼬여|안돼|부정확|뭉개", "말이+어눌|꼬여|새", "혀가+꼬여|꼬이|굳|말려|둔해"], { flag: "New dysarthria — r/o central (neurologic) cause" }],
    ["hypernasal", "voice", "발음", "말할 때 바람이 코로 새요 · 콧소리가 심해요", "Hypernasal speech (r/o velopharyngeal insufficiency)", ["코로+새|빠져|바람", "과비음"], {}],

    /* ───────── 기침 · 가래 · 숨 ───────── */
    ["cough", "cough,general", "기침 · 가래", "기침이 나요", "Cough", ["기침|콜록|쿨럭|쿨룩|해소|기침감기|밭은"], { q: ["cough"] }],
    ["cough_parox", "cough,child", "기침 · 가래", "기침이 한번 시작하면 멈추지 않아요 · 컹컹 소리가 나요", "Paroxysmal cough / barking cough", ["컹컹|개짖는|개기침|발작|멈추지|안멈|숨넘어|연달아|토할때까지|크룹"], { flag: "Barking/paroxysmal cough — r/o croup (child), pertussis" }],
    ["cough_tickle", "cough,throat", "기침 · 가래", "목이 간질간질하면서 기침이 나와요", "Cough triggered by throat tickle", ["$가려움+기침", "간질간질|간질거"], {}],
    ["sputum", "cough", "기침 · 가래", "가래가 나와요", "Sputum production", ["가래|객담|담이"], { q: ["sputum"] }],
    ["dyspnea", "cough", "숨", "숨이 차요 · 숨쉬기 힘들어요", "Dyspnea", ["숨+차|찬|참|가빠|가쁘|막혀|막히|힘들|어렵|안쉬|못쉬|답답|헐떡|모자라", "호흡곤란|숨참|숨가쁨"], { flag: "Dyspnea — assess airway/vitals first" }],
    ["stridor", "cough,child", "숨", "숨 들이쉴 때 꺽꺽 · 쇳소리가 나요", "Stridor (noisy inspiration)", ["들이쉴|들이마실|숨쉴때+꺽꺽|끅끅|쇳소리|쉭쉭|그르렁|소리", "천명|협착음"], { flag: "Stridor — airway assessment" }],
    ["wheeze", "cough", "숨", "숨 쉴 때 쌕쌕 · 그렁그렁 소리가 나요", "Wheezing / noisy breathing", ["쌕쌕|색색|쌔액|그렁그렁|가르랑|가랑가랑|그르렁|휘파람"], {}],
    ["chest_tight", "cough", "숨", "가슴이 답답해요 · 아파요", "Chest tightness / chest pain", ["가슴|흉부+답답|$아픔|조이|눌리|결려|뻐근"], {}],
    ["laryngospasm", "cough,throat", "숨", "갑자기 목이 조여 숨이 턱 막힐 때가 있어요", "Episodic choking / laryngospasm-like episodes", ["숨이+턱|갑자기막|컥|멎", "자다가+숨막|컥컥|캑캑"], {}],

    /* ───────── 입 · 혀 · 입술 ───────── */
    ["oral_ulcer", "mouth", "헐음 · 아픔", "입안이 헐었어요 (구내염)", "Oral ulcer / stomatitis", ["구내염|입병|혓바늘|아프타", "입안|입속|잇몸|볼안|혀|입천장|입술안+헐었|헐어|헌|패였|파였|구멍|하얗게|궤양"], {}],
    ["glossodynia", "mouth", "헐음 · 아픔", "혀가 아파요 · 따가워요 · 화끈거려요", "Glossodynia / burning tongue", ["혀|혓바닥|혀끝|혀옆+$아픔|따가|따갑|화끈|타는|매운|쓰라|데인|덴", "구강작열|입안이+화끈|타는"], {}],
    ["tongue_numb", "mouth", "헐음 · 아픔", "혀가 저려요 · 얼얼해요 · 감각이 둔해요", "Tongue paresthesia / numbness", ["혀|혀끝|혓바닥|입술+저려|저리|얼얼|감각|둔해|마비|찌릿"], {}],
    ["palate_pain", "mouth", "헐음 · 아픔", "입천장이 아파요 · 데었어요 · 부었어요", "Palatal pain / swelling / burn", ["입천장|입천정+$아픔|데었|데어|덴|$부음|까졌|벗겨|$혹"], {}],
    ["gum_pain", "mouth", "헐음 · 아픔", "잇몸이 붓고 아파요 · 이가 아파요", "Gingival swelling/pain, toothache (dental evaluation)", ["잇몸|치아|이빨|사랑니|충치|치통+$아픔|$부음|$피|시려|흔들", "치통"], {}],
    ["lip_lesion", "mouth", "헐음 · 아픔", "입술이 트고 갈라져요 · 물집이 생겼어요", "Cheilitis / lip vesicles", ["입술|입꼬리|입가+트|터|갈라|물집|수포|찢어|헐었|헐어|부르트|벗겨|$부음"], {}],
    ["oral_vesicle", "mouth,child", "헐음 · 아픔", "입안에 물집 · 수포가 생겼어요", "Oral vesicles/blisters", ["입안|입속|혀|목안|입천장+물집|수포|물혹", "수족구"], {}],
    ["oral_bleed", "mouth", "헐음 · 아픔", "입안에서 피가 나요", "Oral bleeding", ["입|입안|입속|잇몸|혀+$피"], {}],

    ["oral_mass", "mouth", "혹 · 하얀 것", "혀 · 입안에 혹이나 뭔가 돋았어요", "Oral cavity/tongue mass or lesion", ["혀|혓바닥|입안|입속|볼안|잇몸|입술+$혹|돋|돌기|사마귀|만져|났어|생겼"], { lat: 1, flag: "Oral lesion/mass — r/o malignancy if persistent >3 weeks" }],
    ["oral_patch", "mouth", "혹 · 하얀 것", "입안에 하얀 · 빨간 반점이 있어요", "Oral white/red patch (r/o leukoplakia, erythroplakia, candidiasis)", ["입안|입속|볼안|혀|잇몸+하얀|하얗|흰|빨간|붉은+반점|점|막|얼룩|자국", "백반|아구창|칸디다"], {}],
    ["coated_tongue", "mouth", "혹 · 하얀 것", "혀에 하얀 게 (백태) 끼었어요", "Coated tongue", ["백태|설태", "혀|혓바닥+하얗|하얀|허옇|끼|누렇|검|까맣|털"], {}],
    ["sublingual_swell", "mouth", "혹 · 하얀 것", "혀 밑이 부었어요 · 물혹이 있어요", "Sublingual swelling (r/o ranula, sialolithiasis)", ["혀밑|혀아래|혓바닥밑|입바닥+$부음|$혹|$아픔|돌", "하마종"], {}],

    ["xerostomia", "mouth", "침 · 맛 · 냄새", "입이 말라요", "Xerostomia", ["입|입안|입속|혀+마르|말라|마른|바짝|건조|타|텁텁", "구강건조|입마름|침이없|침이안|침이말"], {}],
    ["sialorrhea", "mouth,child", "침 · 맛 · 냄새", "침이 많이 고여요 · 흘러요", "Sialorrhea / drooling", ["침+많|고여|고이|흘러|흘리|질질|줄줄|넘쳐"], {}],
    ["halitosis", "mouth", "침 · 맛 · 냄새", "입냄새가 나요", "Halitosis", ["입냄새|구취|입내", "입|입안+$냄새"], {}],
    ["hypogeusia", "mouth,nose", "침 · 맛 · 냄새", "맛을 잘 못 느껴요", "Hypogeusia / ageusia", ["맛+못느|안느|모르|없|안나|둔해|떨어|못봐", "미각+없|상실|저하|떨어|둔", "입맛이없|무슨맛"], {}],
    ["dysgeusia", "mouth", "침 · 맛 · 냄새", "입에서 쓴맛 · 쇠맛 · 짠맛이 나요", "Dysgeusia", ["쓴맛|쇠맛|쇳맛|금속맛|짠맛|신맛|단맛|떫|입이써|입이쓰|입안이써|입이달", "맛+이상|변했|달라|다르게"], {}],
    ["tongue_tie", "mouth,child", "침 · 맛 · 냄새", "혀가 짧아요 (혀 밑 끈)", "Ankyloglossia (tongue-tie)", ["혀가짧|혀짧|설소대|혀밑끈|혀가안나"], {}],
    ["cheek_bite", "mouth", "침 · 맛 · 냄새", "볼 안쪽 · 혀를 자꾸 깨물어요", "Recurrent cheek/tongue biting", ["볼|볼살|혀|입술+깨물|씹혀|씹어|씹히"], {}],

    /* ───────── 어지럼 ───────── */
    ["vertigo", "dizzy", "어지럼", "빙빙 돌아요 (주변이나 내가 도는 느낌)", "Vertigo (rotatory)", ["빙빙|빙글|뱅뱅|뱅글|핑핑|돌아|도는|돈다|돌고|회전|현훈|천장이|천정이|세상이돌|방이돌", "어지럼|어지러|어지럽|어질|현기증|어찔|아찔"], { q: ["vertigoDur", "vertigoTrig"] }],
    ["positional_vertigo", "dizzy", "어지럼", "눕거나 일어날 때, 고개 돌릴 때 어지러워요", "Positional vertigo (r/o BPPV)", ["누울때|누우면|눕|돌아누|일어날때|일어나면|고개+돌리|숙이|젖히|들면+어지|빙|핑|돌", "이석|이석증|머리감|머리를감"], { q: ["vertigoDur"] }],
    ["presyncope", "dizzy", "어지럼", "일어설 때 핑 돌아요 · 눈앞이 캄캄해져요", "Orthostatic dizziness / presyncope", ["핑|핑도|핑돌|캄캄|깜깜|새까맣|하얘|아득|아찔|쓰러질것|기절할것|정신이아득|눈앞|기립"], {}],
    ["lightheaded", "dizzy", "어지럼", "붕 뜬 느낌이에요 · 멍하고 어질어질해요", "Lightheadedness / floating sensation", ["붕뜬|붕떠|떠있|둥둥|구름|멍하|멍해|멍한|어질어질|몽롱|띵|머리가맑지|안개"], {}],
    ["disequilibrium", "dizzy", "어지럼", "걸을 때 휘청거려요 · 중심을 못 잡겠어요", "Disequilibrium / gait unsteadiness", ["휘청|비틀|중심|균형|술취한|쓰러질|넘어질|넘어지|갈지자|흔들흔들|후들|똑바로못"], {}],
    ["lateropulsion", "dizzy", "어지럼", "몸이 한쪽으로 쏠려요 · 기울어요", "Lateropulsion (veering to one side)", ["한쪽으로|옆으로+쏠|기울|넘어|끌려|치우"], { lat: 1 }],
    ["rocking", "dizzy", "어지럼", "배를 탄 것처럼 흔들려요 · 바닥이 꺼지는 느낌이에요", "Rocking/swaying sensation", ["배를탄|배탄|배타는|출렁|울렁울렁|흔들리는느낌|바닥이|땅이+꺼|푹신|흔들|솟"], {}],
    ["oscillopsia", "dizzy", "어지럼", "보는 것이 흔들려 보여요", "Oscillopsia", ["사물|글자|눈앞|화면|물체+흔들|떨려|움직여|튀어", "눈이+돌아|떨려|흔들"], {}],
    ["nausea", "dizzy,general", "같이 있는 증상", "속이 울렁거려요 · 토했어요", "Nausea / vomiting", ["울렁|메스꺼|매스꺼|미식|메슥|구토|토했|토해|토하|토할|구역|오심|체한|체했"], {}],
    ["motion_sickness", "dizzy", "같이 있는 증상", "멀미가 심해요", "Motion sickness", ["멀미"], {}],
    ["syncope", "dizzy", "같이 있는 증상", "쓰러졌어요 · 정신을 잃었어요", "Syncope / loss of consciousness", ["쓰러졌|쓰러져|기절|실신|정신을잃|의식을잃|의식이없|필름"], { flag: "Syncope — non-otologic cause likely; consider cardiac/neurologic evaluation" }],
    ["neuro_sx", "dizzy,face", "같이 있는 증상", "팔다리 힘이 빠져요 · 감각이 이상해요 · 심한 두통이 있어요", "Focal neurologic symptoms (limb weakness/numbness, severe headache)", ["팔|다리|손|발|한쪽+힘이|힘빠|마비|저려|저리|감각|둔해|안움직", "심한두통|극심한|벼락|중풍|뇌졸중|뇌경색"], { flag: "Dizziness with neurologic symptoms — r/o stroke/central cause (urgent)" }],

    /* ───────── 얼굴 · 턱 ───────── */
    ["facial_palsy", "face", "마비 · 떨림", "얼굴 한쪽이 마비됐어요 (입이 돌아감 · 눈이 안 감김)", "Facial palsy", ["안면마비|구안와사|와사풍|벨마비|얼굴마비", "입+돌아|삐뚤|비뚤|틀어|돌아갔", "눈+안감|못감|감기지", "얼굴|표정|한쪽+마비|굳|안움직|처져|쳐져|삐뚤|비뚤|일그러", "양치|가글|물마시|물마실|물먹|국물+새|흘러|흘리|줄줄"], { lat: 1, flag: "Facial palsy — check onset (steroid window), ear vesicles; r/o central cause" }],
    ["facial_twitch", "face", "마비 · 떨림", "눈 밑 · 얼굴이 떨려요 (파르르)", "Facial twitching (r/o hemifacial spasm, myokymia)", ["눈밑|눈꺼풀|눈가|얼굴|볼|입가|입꼬리+떨려|떨리|떨림|파르르|씰룩|경련|실룩|움찔"], { lat: 1 }],
    ["facial_numb", "face", "마비 · 떨림", "얼굴 감각이 둔해요 · 저려요", "Facial numbness / paresthesia", ["얼굴|볼|뺨|턱|이마|입주변+감각|저려|저리|둔해|남의살|먹먹|얼얼|마취"], { lat: 1 }],
    ["facial_neuralgia", "face", "마비 · 떨림", "얼굴이 전기 오듯 찌릿찌릿 아파요", "Paroxysmal facial pain (r/o trigeminal neuralgia)", ["얼굴|볼|뺨|턱|잇몸+전기|찌릿|번개|칼로|송곳|찌르", "삼차신경"], { lat: 1 }],
    ["facial_swell", "face", "붓기 · 턱", "얼굴 · 볼이 부었어요", "Facial/cheek swelling", ["얼굴|볼|뺨|광대|턱+$부음|$혹"], { lat: 1 }],
    ["tmj", "face", "붓기 · 턱", "턱에서 소리가 나요 (딱딱) · 턱이 아파요", "TMJ clicking / jaw pain", ["턱|턱관절|악관절+소리|딱딱|딱소리|덜컹|덜그럭|$아픔|빠진|빠졌|걸려|걸리|어긋", "턱관절|악관절"], { lat: 1 }],
    ["facial_trauma", "face", "붓기 · 턱", "얼굴을 다쳤어요", "Facial trauma", ["얼굴|턱|광대|이마|입술+다쳤|다쳐|다친|부딪|맞았|찢어|넘어져|깨졌|골절|꿰매"], {}],
    ["skin_lesion", "face,neck", "붓기 · 턱", "얼굴 · 목 피부에 혹 · 점이 생겼어요 · 상처가 안 나아요", "Skin lesion of face/neck (non-healing lesion, nodule, nevus)", ["피부|점이|사마귀|피지|낭종|표피|쥐젖|상처+생겼|커져|커지|안나아|안낫|곪|났어|$혹", "피지낭종|지방종"], {}],
    ["angioedema", "face,general", "붓기 · 턱", "입술 · 눈 · 얼굴이 갑자기 부었어요", "Acute lip/eyelid/facial swelling (r/o angioedema)", ["입술|눈|얼굴|혀|목+갑자기+$부음", "혈관부종|두드러기+$부음"], { flag: "Acute facial/oral swelling — r/o angioedema; check airway and triggers (drug/food)" }],

    /* ───────── 목 겉 ───────── */
    ["neck_mass", "neck", "혹 · 붓기", "목에 멍울 · 혹이 만져져요", "Neck mass", ["목|목옆|목앞|목뒤|턱밑|턱아래|쇄골|귀밑|귀아래+$혹|만져|잡혀|잡히|콩알|구슬", "멍울|몽우리"], { lat: 1, q: ["massLoc", "massChar"], flag: "Neck mass — if adult and >2 weeks, r/o malignancy (US ± FNA)" }],
    ["lymph_node", "neck", "혹 · 붓기", "임파선이 부었어요", "Cervical lymphadenopathy (patient-reported)", ["임파선|임파|림프|림프절|임파절|가래톳"], { lat: 1, q: ["massLoc", "massChar"] }],
    ["parotid_swell", "neck,face", "혹 · 붓기", "귀 밑 · 턱 밑이 부었어요 (볼거리처럼)", "Parotid / submandibular swelling", ["귀밑|귀아래|턱밑|턱아래|턱선|침샘|이하선|악하선+$부음|$아픔|커", "볼거리|침샘염|이하선염"], { lat: 1 }],
    ["meal_swell", "neck,mouth", "혹 · 붓기", "식사할 때 턱 밑 · 귀 밑이 붓고 아파요", "Meal-related salivary gland swelling/pain (r/o sialolithiasis)", ["먹을때|식사|밥먹|음식|신거+턱밑|귀밑|침샘+$부음|$아픔", "타석|침샘돌|침돌"], { lat: 1 }],
    ["thyroid", "neck", "혹 · 붓기", "목 앞 (갑상선 부위)이 부었어요 · 혹이 있대요", "Anterior neck swelling / thyroid nodule", ["갑상선|갑상샘|갑상", "목앞|목가운데|목젖아래|울대+$부음|$혹|튀어|커"], {}],
    ["neck_diffuse_swell", "neck", "혹 · 붓기", "목이 전체적으로 붓고 빨개요 · 열감이 있어요", "Diffuse neck swelling / erythema / warmth", ["목+전체|전부|통째|많이|심하게+$부음", "목+빨개|빨갛|열감|뜨끈|화끈+$부음"], { flag: "Diffuse neck swelling — r/o deep neck infection (airway, CT)" }],
    ["neck_fistula", "neck", "혹 · 붓기", "목에 작은 구멍이 있고 진물이 나와요", "Neck sinus/fistula with discharge (r/o branchial cleft anomaly, thyroglossal duct remnant)", ["목+구멍|진물|고름|누공|새열|갑상설관"], { lat: 1 }],
    ["neck_tender", "neck", "아픔 · 뻣뻣함", "목 겉 (앞 · 옆)을 누르면 아파요", "Neck tenderness", ["목옆|목앞|목겉|목바깥|목줄기|울대+$아픔|누르면", "목+누르면|만지면+$아픔"], { lat: 1 }],
    ["neck_stiff", "neck", "아픔 · 뻣뻣함", "목이 뻣뻣해요 · 잘 안 돌아가요", "Neck stiffness / limited range of motion", ["목+뻣뻣|뻐근|안돌아|못돌|돌리기|굳|담|결려|젖히기"], { flag: "Neck stiffness with fever/sore throat — r/o deep neck infection" }],
    ["post_neck_pain", "neck", "아픔 · 뻣뻣함", "뒷목 · 어깨가 뻐근하고 아파요", "Posterior neck / shoulder pain", ["뒷목|뒷덜미|목덜미|어깨|승모+$아픔|뭉|결려|땡겨|당겨"], {}],

    /* ───────── 코골이 · 잠 ───────── */
    ["snoring", "sleep,child", "잘 때", "코를 골아요", "Snoring", ["코골|코를골|코고는|코곤|드르렁|코를심하게"], { q: ["snore"] }],
    ["apnea", "sleep,child", "잘 때", "자다가 숨을 멈춘대요 · 숨이 막혀 깨요", "Witnessed apnea / choking arousals (r/o OSA)", ["무호흡|숨+멈|멎|안쉬|끊|막혀서깨|컥|꺽", "자다가+숨|컥|켁|헉"], { flag: "Witnessed apnea — consider sleep study" }],
    ["mouth_breathing", "sleep,nose,child", "잘 때", "입을 벌리고 자요 · 입으로 숨 쉬어요", "Mouth breathing", ["입+벌리고|벌리고자|벌려|으로숨|으로쉬|숨쉬", "구강호흡|입호흡|입숨"], {}],
    ["sleep_fragment", "sleep", "잘 때", "자다가 자주 깨요 · 깊이 못 자요", "Fragmented / unrefreshing sleep", ["자다가|자다|밤에|새벽에+깨|깸|깬", "깊이못|깊게못|푹못|잠을설|개운|뒤척|선잠|얕은잠"], {}],
    ["insomnia", "sleep", "잘 때", "잠들기가 어려워요", "Insomnia (difficulty initiating sleep)", ["불면|잠이안|잠을못|잠들기|못자|잠못"], {}],
    ["bruxism", "sleep", "잘 때", "이를 갈아요", "Bruxism", ["이를갈|이갈|이를악|이악물"], {}],
    ["nocturia", "sleep", "잘 때", "밤에 소변 보러 자주 깨요", "Nocturia", ["밤|자다|새벽+소변|오줌|화장실", "야뇨|야간뇨"], {}],
    ["daytime_sleepy", "sleep", "낮 동안", "낮에 너무 졸려요 · 늘 피곤해요", "Excessive daytime sleepiness / fatigue", ["낮|운전|회의|수업|오후+졸려|졸리|졸음|졸아|졸게", "자도자도|자도피곤|늘피곤|만성피로|주간졸림|꾸벅"], {}],
    ["morning_headache", "sleep", "낮 동안", "아침에 머리가 아프고 입이 말라요", "Morning headache / dry mouth on waking", ["아침|일어나면|기상+머리|두통|입이마|입마|목이마|목마|칼칼"], {}],
    ["concentration", "sleep,child", "낮 동안", "집중이 안 돼요 · 기억력이 떨어졌어요", "Impaired concentration / memory", ["집중|기억력|산만|멍때|깜빡|건망"], {}],
    ["cpap", "sleep,visit", "낮 동안", "수면검사 · 양압기 상담을 받고 싶어요", "Requests sleep study / CPAP consultation", ["수면검사|수면다원|양압기|씨팹|cpap|코골이수술|코골이검사"], {}],

    /* ───────── 전신 ───────── */
    ["fever", "general,child", "열 · 몸살", "열이 나요", "Fever", ["열이|열나|열남|고열|미열|발열|열감|열도|체온|해열제|뜨끈|불덩이"], { q: ["fever"] }],
    ["chills", "general", "열 · 몸살", "으슬으슬 추워요 (오한)", "Chills", ["오한|으슬|오슬|한기|춥고|추워|덜덜|떨려"], {}],
    ["myalgia", "general", "열 · 몸살", "온몸이 쑤셔요 (몸살)", "Myalgia / body aches", ["몸살|근육통|삭신|온몸|전신|마디마디|뼈마디+$아픔|두들겨", "몸살|근육통|삭신"], {}],
    ["fatigue", "general", "열 · 몸살", "기운이 없어요 · 피곤해요", "Fatigue / malaise", ["기운|기력|힘이없|피곤|피로|나른|축처|무기력|처져|늘어져|권태"], {}],
    ["uri", "general", "열 · 몸살", "감기에 걸린 것 같아요", "URI symptoms (patient-reported \"cold\")", ["감기|코감기|목감기|감기기운|감기몸살"], {}],
    ["flu_covid", "general,visit", "열 · 몸살", "독감 · 코로나 같아요 · 주변에 환자가 있어요", "Suspected influenza/COVID-19 or sick contact", ["독감|코로나|인플루엔자|확진|양성|키트|옮은|옮았|접촉|신속항원"], {}],
    ["anorexia", "general,child", "그 밖에", "입맛이 없어요 · 잘 못 먹어요", "Poor appetite / reduced oral intake", ["입맛|식욕|밥맛|못먹|안먹|먹기싫"], {}],
    ["weight_loss", "general", "그 밖에", "이유 없이 살이 빠졌어요", "Unintentional weight loss", ["살이빠|살빠|체중+빠|줄|감소|감량", "몸무게+빠|줄|감소"], { flag: "Unintentional weight loss — with dysphagia/hoarseness/neck mass r/o malignancy" }],
    ["night_sweat", "general", "그 밖에", "자면서 식은땀을 흘려요", "Night sweats", ["식은땀|밤에땀|자면서땀|땀이+많|흠뻑|범벅"], {}],
    ["rash", "general,child", "그 밖에", "피부에 발진 · 두드러기가 났어요", "Skin rash / urticaria", ["발진|두드러기|반점|울긋불긋|좁쌀|열꽃|피부가+$가려움|빨개|올라"], {}],
    ["gi_sx", "general", "그 밖에", "배가 아파요 · 설사해요", "Abdominal pain / diarrhea", ["배가|배탈|복통|설사|묽은변|장염|배아"], {}],
    ["eye_sx", "general", "그 밖에", "눈이 충혈되거나 아파요 · 눈곱이 껴요", "Eye symptoms (conjunctival injection / discharge / ocular pain)", ["눈곱|눈꼽|충혈|눈이빨개|눈이빨갛|결막", "눈+$아픔|침침|뻑뻑|건조|시려"], {}],

    /* ───────── 아이 ───────── */
    ["ear_tugging", "child", "귀 · 듣기 · 말", "귀를 자꾸 만져요 · 잡아당겨요", "Ear tugging/pulling", ["$귀+만져|만지|잡아당|당겨|후벼|후비|긁|비벼|쥐어"], { lat: 1 }],
    ["irritable", "child", "귀 · 듣기 · 말", "밤에 자다 깨서 울어요 · 심하게 보채요", "Irritability / night waking with crying", ["보채|보챔|칭얼|울어|울고|자지러|찡얼|떼|짜증"], {}],
    ["poor_response", "child", "귀 · 듣기 · 말", "불러도 반응이 없어요 · TV를 크게, 가까이서 봐요", "Suspected hearing loss (poor response to sound, raises TV volume)", ["불러도|이름+반응|대답|안돌아|못들", "TV|티비|텔레비전|소리+크게|가까이|키워|볼륨", "신생아청력|청력선별|재검"], { lat: 1 }],
    ["speech_delay", "child", "귀 · 듣기 · 말", "말이 늦어요 · 발음이 부정확해요", "Speech delay / articulation problem", ["말이늦|말늦|말을못|말이느|언어발달|언어지연|옹알|발음+부정확|이상|새|안좋"], {}],
    ["restless_sleep", "child", "잠 · 숨", "잘 때 심하게 뒤척여요 · 땀을 많이 흘려요 · 목을 젖히고 자요", "Restless sleep / night sweats / neck hyperextension during sleep (r/o adenotonsillar hypertrophy)", ["뒤척|굴러다|돌아다니며자|엎드려자|목을젖|고개를젖|땀을+많|흘려|범벅", "아데노이드|편도비대|편도가크|편도커"], {}],
    ["enuresis", "child", "잠 · 숨", "밤에 오줌을 싸요", "Nocturnal enuresis", ["야뇨증|오줌+싸|쌌|지려|지렸|못가려", "이불에"], {}],
    ["nose_rub", "child", "잠 · 숨", "코를 자꾸 후비고 비벼요", "Nose picking / rubbing (allergic salute)", ["$코+후비|후벼|비벼|비비|문질|찡긋|코파|를파|꾸파"], {}],
    ["habit_tic", "child", "잠 · 숨", "습관처럼 킁킁 · 음음 소리를 내요 · 눈을 깜빡여요", "Habitual sniffing/throat clearing/blinking (r/o tic)", ["틱장애|틱이|틱증상|틱같|습관처럼|버릇처럼|깜빡|깜박|찡그"], {}],
    ["feeding", "child", "먹기 · 그 밖에", "잘 안 먹어요 · 삼키기 힘들어해요 · 침을 흘려요", "Poor oral intake / feeding difficulty / drooling", ["안먹|못먹|먹기싫|분유|수유|젖+안|못|거부|뱉", "삼키기+힘들|싫"], {}],
    ["daytime_hyper", "child", "먹기 · 그 밖에", "낮에 산만하고 집중을 못 해요 · 짜증이 늘었어요", "Daytime inattention / hyperactivity / irritability", ["산만|집중을못|집중못|과잉|adhd|짜증이늘|예민해"], {}],
    ["poor_growth", "child", "먹기 · 그 밖에", "또래보다 작아요 · 잘 안 커요", "Poor growth", ["또래|키가|성장|안커|작아|안자라|몸무게가안"], {}],
    ["auricle_deformity", "child,ear", "먹기 · 그 밖에", "귀 모양이 이상해요", "Auricular deformity", ["$귀+모양|접혀|접힌|기형|돌출|짝짝", "귓바퀴|귀모양+작아|찌그러|튀어나"], { lat: 1 }],
    ["child_fb", "child", "먹기 · 그 밖에", "코 · 귀 · 목에 뭘 넣거나 삼킨 것 같아요", "Suspected foreign body (nose/ear/aerodigestive)", ["넣은것|넣었|삼킨것|삼켰|먹은것같|건전지|동전|자석|장난감|레고|비즈|스티커"], { flag: "Suspected foreign body in a child — button battery/magnet ingestion is an emergency" }],

    /* ───────── 검사 · 상담 ───────── */
    ["v_result", "visit", "방문 목적", "검사 결과를 들으러 왔어요", "Visit: review of test results", ["검사결과|결과들|결과보러|결과확인|조직검사|ct결과|결과상담"], {}],
    ["v_checkup", "visit", "방문 목적", "건강검진에서 이상이 있다고 했어요", "Visit: abnormal finding on health checkup", ["건강검진|검진|이상소견|재검|소견|정밀검사|의뢰서|진료의뢰"], {}],
    ["v_hearing_test", "visit", "방문 목적", "청력검사를 받고 싶어요", "Visit: requests hearing test", ["청력검사|청력테스트|귀검사|청각검사|청력측정"], {}],
    ["v_hearing_aid", "visit", "방문 목적", "보청기 상담을 받고 싶어요", "Visit: hearing aid consultation", ["보청기|청각장애|장애진단|장애등급|인공와우"], {}],
    ["v_refill", "visit", "방문 목적", "먹던 약을 다시 받으러 왔어요", "Visit: medication refill", ["약받|약타|약처방|처방받|약이떨어|약다먹|같은약|먹던약|리필|약만"], {}],
    ["v_followup", "visit", "방문 목적", "치료 · 수술 뒤 경과를 보러 왔어요", "Visit: follow-up after treatment/surgery", ["경과|재진|수술후|수술하고|수술받고|치료후|실밥|소독|드레싱|튜브확인"], {}],
    ["v_surgery", "visit", "방문 목적", "수술 상담을 받고 싶어요", "Visit: surgical consultation", ["수술상담|수술하고싶|수술받고싶|수술문의|수술가능|수술해야"], {}],
    ["v_allergy_test", "visit", "방문 목적", "알레르기 검사를 받고 싶어요", "Visit: requests allergy testing", ["알레르기검사|알러지검사|마스트|mast|피부반응|면역치료|면역요법"], {}],
    ["v_cerumen", "visit", "방문 목적", "귀지를 빼러 왔어요", "Visit: cerumen removal", ["귀지제거|귀지빼|귀지파|귀청소|귀파러|귀파주"], {}],
    ["v_vaccine", "visit", "방문 목적", "예방접종 · 독감 검사 · 코로나 검사를 받으러 왔어요", "Visit: vaccination / influenza or COVID-19 test", ["예방접종|예방주사|독감주사|백신|독감검사|코로나검사|pcr"], {}],
    ["v_document", "visit", "방문 목적", "서류 (진단서 · 소견서 · 확인서)가 필요해요", "Visit: medical certificate/documentation", ["진단서|소견서|확인서|진료확인|서류|의무기록|보험|실비|출석|결석|병결"], {}],
    ["v_second_opinion", "visit", "방문 목적", "다른 병원에서 치료했는데 낫지 않아요", "Visit: persistent symptoms despite treatment elsewhere / second opinion", ["다른병원|다른의원|다른데서|타병원|옮겨|안나아|안낫|차도가|효과가없|약을먹어도|계속먹어도"], {}]
  ];

  /* 과거력 · 생활 문항: [id, 한글, 영어] */
  var HX = {
    pmh: { ko: "앓고 있거나 앓았던 병", en: "PMH", opts: [["htn", "고혈압", "Hypertension"], ["dm", "당뇨", "Diabetes mellitus"], ["asthma", "천식", "Asthma"], ["ar", "알레르기 비염", "Allergic rhinitis"], ["atopy", "아토피", "Atopic dermatitis"], ["heart", "심장병", "Heart disease"], ["cva", "뇌졸중 (중풍)", "Stroke/CVA"], ["thyroid", "갑상선 질환", "Thyroid disease"], ["gerd", "역류성 식도염 · 위염", "GERD/gastritis"], ["liver", "간 질환 · 간염", "Liver disease/hepatitis"], ["kidney", "신장 (콩팥) 질환", "Kidney disease"], ["tb", "결핵", "Tuberculosis"], ["cancer", "암", "Cancer"], ["glaucoma", "녹내장", "Glaucoma"], ["bph", "전립선 비대", "BPH"], ["bleeding", "피가 잘 안 멎는 병", "Bleeding disorder"]] },
    meds: { ko: "지금 먹는 약", en: "Medications", opts: [["anticoag", "피를 묽게 하는 약 (와파린 · 항응고제)", "Anticoagulant"], ["antiplatelet", "아스피린 · 혈전 예방약", "Aspirin/antiplatelet"], ["antihtn", "혈압약", "Antihypertensive"], ["dmmed", "당뇨약 · 인슐린", "Antidiabetic/insulin"], ["steroid", "스테로이드", "Steroid"], ["immuno", "면역억제제 · 항암제", "Immunosuppressant/chemotherapy"], ["psych", "수면제 · 신경안정제 · 우울증 약", "Hypnotic/anxiolytic/antidepressant"], ["hormone", "피임약 · 호르몬제", "Oral contraceptive/hormone"], ["nasalspray", "코 스프레이", "Nasal spray"], ["herbal", "한약 · 건강기능식품", "Herbal medicine/supplements"]] },
    allergy: { ko: "약 · 음식 알레르기", en: "Allergies", opts: [["pcn", "페니실린 계열 항생제", "Penicillin"], ["ceph", "세파 계열 항생제", "Cephalosporin"], ["sulfa", "설파제", "Sulfa drugs"], ["nsaid", "아스피린 · 소염진통제", "Aspirin/NSAIDs"], ["contrast", "조영제", "Contrast media"], ["anesth", "마취제", "Anesthetics"], ["food", "음식", "Food"], ["unknownAllergy", "약 먹고 두드러기가 난 적 있음 (약 이름 모름)", "Drug rash, agent unknown"]] },
    surg: { ko: "귀 · 코 · 목 수술을 받은 적", en: "ENT surgical Hx", opts: [["tonsil", "편도 · 아데노이드 수술", "Tonsillectomy/adenoidectomy"], ["septo", "코 수술 (비중격 · 비염)", "Septoplasty/turbinate surgery"], ["fess", "축농증 수술", "Sinus surgery"], ["earsurg", "귀 수술 (중이염 · 고막)", "Ear surgery (tympanoplasty/mastoidectomy)"], ["tube", "고막 튜브", "Ventilation tube"], ["thyroidsurg", "갑상선 수술", "Thyroidectomy"], ["vocal", "성대 수술", "Laryngeal microsurgery"], ["rhinoplasty", "코 성형", "Rhinoplasty"]] },
    recent: { ko: "최근에 있었던 일", en: "Recent events", opts: [["cold", "감기를 앓았어요", "recent URI"], ["flight", "비행기를 탔어요", "air travel"], ["swim", "수영 · 물놀이 · 다이빙", "swimming/diving"], ["noise", "큰 소리에 노출 (공연 · 공사 · 사격)", "loud noise exposure"], ["stress", "과로 · 스트레스 · 잠을 못 잠", "overwork/stress/sleep deprivation"], ["trauma", "머리 · 얼굴을 다침", "head/facial trauma"], ["dental", "치과 치료", "dental procedure"], ["otherclinic", "이 증상으로 다른 병원에 다녀옴", "seen at another clinic for this problem"], ["selfmed", "약국 약을 먹어 봄", "self-medicated (OTC)"]] }
  };

  root.ENT_DATA = { MACROS: MACROS, AREAS: AREAS, Q: Q, S: S, HX: HX };
  if (typeof module !== "undefined" && module.exports) module.exports = root.ENT_DATA;
})(typeof window !== "undefined" ? window : globalThis);
