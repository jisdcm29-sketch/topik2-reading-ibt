"use strict";

console.log("TOPIK II Reading Diagnosis loaded: final-type-16-v12-strength-weakness-dedupe");

const AUTO_DIAGNOSIS_STORAGE_KEY = "topik2_latest_reading_result";
const WRONG_REVIEW_STORAGE_KEY = "topik2_wrong_review_question_numbers";
const WRONG_REVIEW_SOURCE_RESULT_STORAGE_KEY = "topik2_wrong_review_source_result";
const WRONG_REVIEW_TEST_URL = "../reading-test/index.html?mode=wrong-review";

const state = {
  sourceResult: null,
  report: null
};

const els = {
  fileInput: document.getElementById("resultFile"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  status: document.getElementById("status"),
  manualLoadBox: document.getElementById("manualLoadBox"),
  reportActions: document.getElementById("reportActions"),
  reportArea: document.getElementById("reportArea"),
  reportPaper: document.getElementById("reportPaper"),
  printBtn: document.getElementById("printBtn")
};

document.addEventListener("DOMContentLoaded", initDiagnosis);

function initDiagnosis() {
  bindEvents();
  tryAutoLoad();
}

function bindEvents() {
  if (els.analyzeBtn) {
    els.analyzeBtn.addEventListener("click", analyzeUploadedFile);
  }

  if (els.printBtn) {
    els.printBtn.addEventListener("click", function () {
      window.print();
    });
  }
}

function tryAutoLoad() {
  const params = new URLSearchParams(window.location.search);
  const shouldAutoLoad = params.get("auto") === "1";

  if (!shouldAutoLoad) {
    setStatus("자동 연결 없이 열렸습니다. 결과 JSON 파일을 직접 선택하세요.", "");
    showManualLoadBox();
    return;
  }

  try {
    const raw = localStorage.getItem(AUTO_DIAGNOSIS_STORAGE_KEY);

    if (!raw) {
      setStatus("자동 연결 결과가 없습니다. topik2-reading-result.json 파일을 직접 선택하세요.", "error");
      showManualLoadBox();
      return;
    }

    const data = JSON.parse(raw);
    validateReadingResult(data);

    state.sourceResult = data;
    state.report = buildDiagnosisReport(data);

    renderReport(state.report);
    setStatus("시험 결과를 자동으로 불러와 진단 보고서를 생성했습니다.", "ok");
  } catch (error) {
    console.error(error);
    setStatus(`자동 분석 실패: ${error.message}`, "error");
    showManualLoadBox();
  }
}

function analyzeUploadedFile() {
  const file = els.fileInput.files && els.fileInput.files[0];

  if (!file) {
    setStatus("분석할 JSON 파일을 선택하세요.", "error");
    return;
  }

  const reader = new FileReader();

  reader.onload = function () {
    try {
      const data = JSON.parse(String(reader.result || ""));
      validateReadingResult(data);

      state.sourceResult = data;
      state.report = buildDiagnosisReport(data);

      renderReport(state.report);
      setStatus("파일을 분석하여 진단 보고서를 생성했습니다.", "ok");
    } catch (error) {
      console.error(error);
      setStatus(`파일 분석 실패: ${error.message}`, "error");
    }
  };

  reader.onerror = function () {
    setStatus("파일을 읽는 중 오류가 발생했습니다.", "error");
  };

  reader.readAsText(file, "utf-8");
}

function showManualLoadBox() {
  if (els.manualLoadBox) {
    els.manualLoadBox.classList.add("show");
  }
}

function validateReadingResult(data) {
  if (!data || typeof data !== "object") {
    throw new Error("JSON 형식이 올바르지 않습니다.");
  }

  if (!Array.isArray(data.items)) {
    throw new Error("items 배열이 없습니다. topik2-reading-result.json 파일인지 확인하세요.");
  }

  if (data.section && data.section !== "reading") {
    throw new Error("읽기 결과 파일이 아닙니다. section 값이 reading이어야 합니다.");
  }

  if (data.test_level && data.test_level !== "TOPIK II") {
    throw new Error("TOPIK II 읽기 결과 파일이 아닙니다.");
  }

  return true;
}

function buildDiagnosisReport(result) {
  const items = Array.isArray(result.items) ? result.items : [];
  const score = numberOrZero(result.section_score_100);
  const level = isLevelTestResult(result)
    ? getTopik2LevelTestReadingLevel(score)
    : getTopik2ReadingLevel(score);

  const readingTypeAnalysis = makeReadingTypeChartAnalysis(items);

  /*
    유형별 분석은 item.category 원문을 그대로 쓰지 않고
    유형별 득점 그래프와 같은 16개 대표 유형 기준으로 통일한다.
    진단 영역별 분석은 세부 처방을 위해 diagnostic_area 원문 기준을 유지한다.
  */
  const categoryAnalysis = readingTypeAnalysis;
  const diagnosticAnalysis = groupDiagnosticStats(items);
  const zoneAnalysis = makeZoneAnalysis(items);

  const problemItems = items.filter((item) => !item.is_correct);
  const unansweredItems = items.filter((item) => isUnanswered(item.student_answer));
  const wrongItems = items.filter((item) => !item.is_correct && !isUnanswered(item.student_answer));

  const strengths = makeStrengthList(categoryAnalysis, diagnosticAnalysis);
  const weaknesses = makeWeaknessList(categoryAnalysis, diagnosticAnalysis, zoneAnalysis);

  const prescriptions = makePrescriptions({
    result,
    level,
    problemItems,
    wrongItems,
    unansweredItems,
    categoryAnalysis,
    diagnosticAnalysis,
    zoneAnalysis,
    readingTypeAnalysis,
    weaknesses
  });

    return {
    source: result,
    generated_at: new Date().toISOString(),
    score,
    level,
    items,
    categoryAnalysis,
    diagnosticAnalysis,
    zoneAnalysis,
    readingTypeAnalysis,
    problemItems,
    wrongItems,
    unansweredItems,
    strengths,
    weaknesses,
    prescriptions
  };
}

function getTopik2ReadingLevel(score) {
  const numericScore = numberOrZero(score);

  if (numericScore < 40) {
    return {
      code: "BELOW_TOPIK2_LEVEL3",
      title: "TOPIK II 3급 미도달 위험",
      range: "0~39점",
      expected_level: "3급 미도달 가능성 높음",
      stable_level: "TOPIK II 진입 전 또는 3급 준비 단계",
      next_target_score: 40,
      next_target_label: "3급 가능권 진입",
      message: "기본 문법·어휘와 짧은 지문 이해부터 다시 안정화해야 합니다.",
      study_focus: "초반 문법·표현, 자료 이해, 짧은 글 내용 일치 문항을 우선 보완하세요."
    };
  }

  if (numericScore < 50) {
    return {
      code: "TOPIK2_LEVEL3_RANGE",
      title: "TOPIK II 3급 가능권",
      range: "40~49점",
      expected_level: "3급 가능권",
      stable_level: "3급 진입권",
      next_target_score: 50,
      next_target_label: "4급 가능권 진입",
      message: "쉬운 문항은 해결할 수 있지만 중후반 지문, 빈칸 추론, 세트형 문항에서 점수 손실이 큽니다.",
      study_focus: "문맥 추론, 공통 지문, 내용 일치 문항을 집중적으로 보완하세요."
    };
  }

  if (numericScore < 63) {
    return {
      code: "TOPIK2_LEVEL4_RANGE",
      title: "TOPIK II 4급 가능권",
      range: "50~62점",
      expected_level: "4급 가능권",
      stable_level: "3급 안정권",
      next_target_score: 63,
      next_target_label: "5급 가능권 진입",
      message: "기본 독해는 가능하지만 문장 삽입, 빈칸 추론, 장문 독해에서 안정성이 더 필요합니다.",
      study_focus: "39~50번 후반부 고난도 지문과 논리 관계 파악 훈련을 강화하세요."
    };
  }

  if (numericScore < 76) {
    return {
      code: "TOPIK2_LEVEL5_RANGE",
      title: "TOPIK II 5급 가능권",
      range: "63~75점",
      expected_level: "5급 가능권",
      stable_level: "4급 안정권",
      next_target_score: 76,
      next_target_label: "6급 가능권 진입",
      message: "중상급 독해 능력이 있으나 고난도 논설문, 필자 태도, 세부 내용 함정에서 실수를 줄여야 합니다.",
      study_focus: "긴 지문에서 핵심 주장, 근거 문장, 선택지 함정을 비교하는 훈련이 필요합니다."
    };
  }

  return {
    code: "TOPIK2_LEVEL6_RANGE",
    title: "TOPIK II 6급 가능권",
    range: "76~100점",
    expected_level: "6급 가능권",
    stable_level: "5급 이상 안정권",
    next_target_score: 90,
    next_target_label: "고득점 안정권",
    message: "고급 독해가 가능하며, 시간 관리와 고난도 선택지 함정 관리가 핵심입니다.",
    study_focus: "실전 속도 유지, 후반부 장문 근거 찾기, 오답 선택지 분석으로 점수를 안정화하세요."
  };
}
function isLevelTestResult(result) {
  if (!result || typeof result !== "object") {
    return false;
  }

  const mode = String(result.generated_exam_mode || "");
  const label = String(result.generated_exam_label || "");
  const scope = String(result.test_scope || "");

  return (
    mode.includes("level-test") ||
    label.includes("레벨테스트") ||
    scope.includes("레벨테스트")
  );
}

function getTopik2LevelTestReadingLevel(score) {
  const numericScore = numberOrZero(score);

  if (numericScore < 40) {
    return {
      code: "LEVEL_TEST_BASIC_REVIEW",
      title: "TOPIK II 읽기 기초 보완 필요",
      range: "0~39점",
      expected_level: "TOPIK II 읽기 기초 보완 단계",
      stable_level: "3급 진입 전 준비 단계",
      next_target_score: 40,
      next_target_label: "3급 진입 가능권",
      message: "대표 유형 20문항 기준으로 기본 문법·표현, 짧은 글 이해, 자료 읽기에서 보완이 필요합니다.",
      study_focus: "초반 문법·표현, 자료 이해, 짧은 글 내용 일치 문항부터 다시 안정화하세요."
    };
  }

  if (numericScore < 55) {
    return {
      code: "LEVEL_TEST_TOPIK2_LEVEL3_RANGE",
      title: "TOPIK II 읽기 3급 진입 가능권",
      range: "40~54점",
      expected_level: "3급 진입 가능권",
      stable_level: "기초 독해 가능, 중급 유형 보완 필요",
      next_target_score: 55,
      next_target_label: "4급 가능권",
      message: "쉬운 유형은 해결할 수 있지만 공통 지문, 빈칸, 중·장문 유형에서 점수 손실이 있을 수 있습니다.",
      study_focus: "문맥 추론, 공통 지문, 내용 일치 문항을 집중적으로 보완하세요."
    };
  }

  if (numericScore < 70) {
    return {
      code: "LEVEL_TEST_TOPIK2_LEVEL4_RANGE",
      title: "TOPIK II 읽기 4급 가능권",
      range: "55~69점",
      expected_level: "4급 가능권",
      stable_level: "3급 안정권",
      next_target_score: 70,
      next_target_label: "5급 가능권",
      message: "기본 독해는 가능하지만 문장 삽입, 필자 의도, 긴 지문 내용 일치에서 안정성이 더 필요합니다.",
      study_focus: "중·장문에서 핵심어, 근거 문장, 선택지 함정을 비교하는 연습을 강화하세요."
    };
  }

  if (numericScore < 85) {
    return {
      code: "LEVEL_TEST_TOPIK2_LEVEL5_RANGE",
      title: "TOPIK II 읽기 5급 가능권",
      range: "70~84점",
      expected_level: "5급 가능권",
      stable_level: "4급 안정권",
      next_target_score: 85,
      next_target_label: "6급 가능권",
      message: "중상급 독해 능력이 있으나 후반부 장문과 추론형 선택지에서 실수를 줄여야 합니다.",
      study_focus: "후반부 장문, 필자 의도·주장, 문장 삽입 유형을 중심으로 근거 찾기 훈련을 하세요."
    };
  }

  return {
    code: "LEVEL_TEST_TOPIK2_LEVEL6_RANGE",
    title: "TOPIK II 읽기 6급 가능권",
    range: "85~100점",
    expected_level: "6급 가능권",
    stable_level: "5급 이상 안정권",
    next_target_score: 90,
    next_target_label: "6급 고득점 안정권",
    message: "대표 유형 20문항 기준으로 고급 독해가 가능하며, 실전에서는 시간 관리와 후반 장문 안정화가 중요합니다.",
    study_focus: "50문항 전체 시험으로 실전 시간 관리와 후반부 고난도 지문 정확도를 확인하세요."
  };
}

function getAnalysisQuestionNumber(item) {
  const original = Number(item && (item.original_question_number || item.source_question_number));
  const current = Number(item && item.question_number);

  if (Number.isFinite(original) && original >= 1 && original <= 50) {
    return original;
  }

  if (Number.isFinite(current)) {
    return current;
  }

  return 0;
}
const READING_TYPE_CHART_DEFINITIONS = [
  {
    id: "T01",
    label: "문법·표현",
    focus: "문맥에 맞는 문법 표현 선택"
  },
  {
    id: "T02",
    label: "유사 표현",
    focus: "밑줄 친 표현의 의미 이해"
  },
  {
    id: "T03",
    label: "이미지·안내문 이해",
    focus: "광고·안내문·이미지 자료의 목적과 대상 파악"
  },
  {
    id: "T04",
    label: "자료·그래프 이해",
    focus: "표·그래프·자료의 세부 정보 파악"
  },
  {
    id: "T05",
    label: "내용 일치",
    focus: "글의 세부 내용과 선택지 일치 판단"
  },
  {
    id: "T06",
    label: "문장 순서",
    focus: "시간 흐름과 인과 관계에 따른 문장 배열"
  },
  {
    id: "T07",
    label: "빈칸 표현",
    focus: "문맥에 맞는 연결·문법 표현 선택"
  },
  {
    id: "T08",
    label: "공통 지문 빈칸",
    focus: "공통 지문 안의 빈칸 추론"
  },
  {
    id: "T09",
    label: "공통 지문 주제",
    focus: "공통 지문의 주제와 중심 내용 파악"
  },
  {
    id: "T10",
    label: "심정 파악",
    focus: "인물의 감정과 태도 이해"
  },
  {
    id: "T11",
    label: "서사 글 이해",
    focus: "사건 전개와 인물 행동의 의미 파악"
  },
  {
    id: "T12",
    label: "신문 제목 이해",
    focus: "신문 제목의 함축 의미 이해"
  },
  {
    id: "T13",
    label: "중심 내용 파악",
    focus: "글의 중심 생각과 주제 파악"
  },
  {
    id: "T14",
    label: "필자 의도·주장",
    focus: "필자의 의도, 주장, 태도 파악"
  },
  {
    id: "T15",
    label: "문장 삽입",
    focus: "주어진 문장과 앞뒤 문맥의 응집성 판단"
  },
  {
    id: "T16",
    label: "긴 지문 내용 일치",
    focus: "긴 지문의 세부 정보와 선택지 비교"
  }
];
function inferReadingTypeChartIdByNumberFirst(item) {
  const analysisNumber = getAnalysisQuestionNumber(item);

  /*
    TOPIK II 읽기 1~20번은 문항 위치별 유형이 고정되어 있다.
    따라서 유형별 득점 그래프에서는 1~20번을 문항 번호 기준으로 먼저 분류한다.
  */

  if (analysisNumber >= 1 && analysisNumber <= 2) {
    return "T01";
  }

  if (analysisNumber >= 3 && analysisNumber <= 4) {
    return "T02";
  }

  if (analysisNumber >= 5 && analysisNumber <= 9) {
    return "T03";
  }

  if (analysisNumber === 10) {
    return "T04";
  }

  if (analysisNumber >= 11 && analysisNumber <= 12) {
    return "T05";
  }

  if (analysisNumber >= 13 && analysisNumber <= 15) {
    return "T06";
  }

  if (analysisNumber >= 16 && analysisNumber <= 18) {
    return "T07";
  }

  if (analysisNumber === 19) {
    return "T08";
  }

  if (analysisNumber === 20) {
    return "T09";
  }

  return inferReadingTypeChartId(item);
}
function getReadingTypeDefinition(typeId) {
  return READING_TYPE_CHART_DEFINITIONS.find(function (definition) {
    return definition.id === typeId;
  }) || null;
}

function getReadingTypeDisplayName(item) {
  const typeId = inferReadingTypeChartIdByNumberFirst(item);
  const definition = getReadingTypeDefinition(typeId);

  return definition ? definition.label : (item && item.category ? item.category : "미분류");
}

function statHasQuestionNumber(stat, questionNumber) {
  const target = Number(questionNumber);

  if (!Number.isFinite(target)) {
    return false;
  }

  return Array.isArray(stat && stat.wrong_questions)
    && stat.wrong_questions.map(Number).includes(target);
}

function makeReadingTypeChartAnalysis(items) {
  const map = new Map();

  READING_TYPE_CHART_DEFINITIONS.forEach(function (definition) {
    map.set(definition.id, {
      type_id: definition.id,
      name: definition.label,
      focus: definition.focus,
      total: 0,
      correct: 0,
      wrong: 0,
      unanswered: 0,
      points_possible: 0,
      points_earned: 0,
      wrong_questions: []
    });
  });

  items.forEach(function (item) {
    const typeId = inferReadingTypeChartIdByNumberFirst(item);
    const definition = READING_TYPE_CHART_DEFINITIONS.find(function (entry) {
      return entry.id === typeId;
    });

    if (!definition) {
      return;
    }

    const stat = map.get(typeId);
    const points = numberOrZero(item.points);
    const earned = numberOrZero(item.earned_points);
    const isCorrect = Boolean(item.is_correct);

    stat.total += 1;
    stat.points_possible += points;
    stat.points_earned += earned;

    if (isCorrect) {
      stat.correct += 1;
    } else {
      stat.wrong += 1;
      stat.wrong_questions.push(item.question_number);
    }

    if (isUnanswered(item.student_answer)) {
      stat.unanswered += 1;
    }
  });

  return READING_TYPE_CHART_DEFINITIONS
    .map(function (definition) {
      const stat = map.get(definition.id);

      return {
        ...stat,
        accuracy: percent(stat.correct, stat.total),
        point_rate: stat.points_possible
          ? Math.round((stat.points_earned / stat.points_possible) * 100)
          : 0
      };
    })
    .filter(function (stat) {
      return stat.total > 0;
    });
}

function inferReadingTypeChartId(item) {
  const analysisNumber = getAnalysisQuestionNumber(item);

  const type = String(item.type || "");
  const category = String(item.category || "");
  const diagnosticArea = String(item.diagnostic_area || "");
  const levelTestLabel = String(item.level_test_type_label || "");

  const mainText = [
    type,
    category,
    diagnosticArea,
    levelTestLabel
  ].join(" ");

  /*
    102회 검수용 1~20번과 TOPIK II 기본 1~20번은
    문항 번호별 유형 위치가 명확하다.
    따라서 description이나 category에 섞인 단어보다
    원래 문항 번호를 먼저 기준으로 유형별 그래프를 분류한다.
  */

  if (analysisNumber >= 1 && analysisNumber <= 2) return "T01";
  if (analysisNumber >= 3 && analysisNumber <= 4) return "T02";

  if (analysisNumber >= 5 && analysisNumber <= 9) {
    return "T03";
  }

  if (analysisNumber === 10) {
    return "T04";
  }

  if (analysisNumber >= 11 && analysisNumber <= 12) {
    return "T05";
  }

  if (analysisNumber >= 13 && analysisNumber <= 15) {
    return "T06";
  }

  if (analysisNumber >= 16 && analysisNumber <= 18) {
    return "T07";
  }

  if (analysisNumber === 19) {
    return "T08";
  }

  if (analysisNumber === 20) {
    return "T09";
  }

  /*
    21번 이후는 유형명과 진단 영역을 함께 보고 보정한다.
  */

  if (/sentence_insert|문장 삽입|삽입 위치|위치 판단/.test(mainText)) {
    return "T15";
  }

  if (/headline|신문 제목|기사 제목|제목의 핵심|제목/.test(mainText)) {
    return "T12";
  }

  if (/공통 지문 빈칸|common_passage_blank|공통.*빈칸/.test(mainText)) {
    return "T08";
  }

  if (/짧은 공통 지문의 주제|공통 지문 주제|공통.*주제/.test(mainText)) {
    return "T09";
  }

  if (/심정|감정|기분/.test(mainText)) {
    return "T10";
  }

  if (/긴 지문 내용 일치|long.*detail|긴 지문.*세부|긴 지문의 세부/.test(mainText)) {
    return "T16";
  }

  if (/sentence_order|문장 순서|문장 배열|배열|시간 흐름과 인과 관계/.test(mainText)) {
    return "T06";
  }

  /*
    60회 레벨테스트 20번(원본 50번)처럼
    diagnostic_area에 '밑줄'이 들어가더라도
    실제 유형이 필자 태도/의도/주장인 문항이 있다.
    따라서 필자 태도/의도/목적 판별을 유사 표현 판별보다 먼저 한다.
  */
  if (/필자 의도|필자의 태도|필자.*태도|밑줄 친 부분에 나타난 필자의 태도|글을 쓴 목적|목적 파악|주장|태도 파악/.test(mainText)) {
    return "T14";
  }

  if (/similar_expression|유사 표현|밑줄 친 표현의 의미|밑줄/.test(mainText)) {
    return "T02";
  }

  if (/blank_choice|long_blank_choice|빈칸|문맥에 맞는 연결 표현|문맥에 맞는 명사구|문맥에 맞는.*표현/.test(mainText)) {
    return "T07";
  }

  if (/visual_topic|이미지|광고|안내문 목적|목적 및 대상|안전 안내|자료 이해|자료.*목적|대상 파악/.test(mainText)) {
    return "T03";
  }

  if (/same_content_visual|안내문 세부|자료.*세부|안내문.*세부/.test(mainText)) {
    return "T03";
  }

  if (/same_content_graph|graph|그래프|표|자료.*비교|자료·그래프|그래프 정보 비교/.test(mainText)) {
    return "T04";
  }

  if (/필자 의도|필자의 태도|주장|태도/.test(mainText)) {
    return "T14";
  }

  if (/목적/.test(mainText) && !/광고|안내문|목적 및 대상|대상 파악/.test(mainText)) {
    return "T14";
  }

  if (/중심 내용|주제 파악|중심 생각|학술 설명문의 중심/.test(mainText)) {
    return "T13";
  }

  if (/서사|사건 전개|인물 행동/.test(mainText)) {
    return "T11";
  }

  if (/same_content|내용 일치|세부 내용/.test(mainText)) {
    return "T05";
  }

  if (analysisNumber >= 21 && analysisNumber <= 24) {
    if (/심정|감정|기분|태도/.test(mainText)) {
      return "T10";
    }

    return "T11";
  }

  if (analysisNumber >= 25 && analysisNumber <= 27) return "T12";

  if (analysisNumber >= 28 && analysisNumber <= 31) {
    if (/의도|주장|태도|목적/.test(mainText)) {
      return "T14";
    }

    return "T13";
  }

  if (analysisNumber >= 32 && analysisNumber <= 34) return "T05";

  if (analysisNumber >= 35 && analysisNumber <= 38) {
    if (/내용 일치|세부|정보/.test(mainText)) {
      return "T05";
    }

    return "T13";
  }

  if (analysisNumber >= 39 && analysisNumber <= 41) return "T15";

  if (analysisNumber >= 42 && analysisNumber <= 43) {
    if (/심정|감정|기분|태도/.test(mainText)) {
      return "T10";
    }

    return "T11";
  }

  if (analysisNumber >= 44 && analysisNumber <= 47) {
    if (/의도|주장|태도|목적/.test(mainText)) {
      return "T14";
    }

    if (/중심|주제/.test(mainText)) {
      return "T13";
    }

    return "T05";
  }

  if (analysisNumber >= 48 && analysisNumber <= 50) return "T16";

  return "T05";
}
function makeZoneAnalysis(items) {
  const zoneInfo = {
    Z01: {
      label: "초반 문법·표현",
      range: "1~4번",
      focus: "기본 문법, 어휘, 표현 의미 파악"
    },
    Z02: {
      label: "자료·정보 이해",
      range: "5~12번",
      focus: "광고, 안내문, 표, 그래프, 짧은 글의 세부 정보 파악"
    },
    Z03: {
      label: "문장 배열·문맥 추론",
      range: "13~18번",
      focus: "문장 순서, 연결어, 문맥상 빈칸 추론"
    },
    Z04: {
      label: "공통 지문 기초 세트",
      range: "19~24번",
      focus: "공통 지문에서 빈칸, 주제, 감정, 내용 일치 파악"
    },
    Z05: {
      label: "신문 제목·함축 의미",
      range: "25~27번",
      focus: "제목의 함축 의미와 기사문 핵심 내용 파악"
    },
    Z06: {
      label: "중·장문 독해",
      range: "28~38번",
      focus: "빈칸, 내용 일치, 주제, 중심 내용 파악"
    },
    Z07: {
      label: "문장 삽입",
      range: "39~41번",
      focus: "주어진 문장과 앞뒤 문맥의 응집성 판단"
    },
    Z08: {
      label: "고난도 장문 세트",
      range: "42~50번",
      focus: "긴 이야기, 설명문, 논설문, 필자 태도, 목적, 추론, 내용 일치"
    }
  };

  const map = new Map();

  items.forEach((item) => {
        const analysisNumber = getAnalysisQuestionNumber(item);

    /*
      진단 보고서의 문항 구간은 JSON 안의 question_zone 값보다
      실제 TOPIK II 읽기 문항 번호를 우선한다.

      이유:
      - 31번이 25~27번 신문 제목 구간에 잘못 들어가는 문제 방지
      - 44~50번이 미분류 구간으로 빠지는 문제 방지
      - 102회, 103회, 이후 회차 모두 1~50번 위치 기준으로 구간 분석
    */
    const zoneId = inferZoneIdByQuestionNumber(analysisNumber);

    const info = zoneInfo[zoneId] || {
      label: "미분류 구간",
      range: "-",
      focus: "미분류"
    };

    if (!map.has(zoneId)) {
      map.set(zoneId, {
        zone_id: zoneId,
        label: info.label,
        range: info.range,
        focus: info.focus,
        total: 0,
        correct: 0,
        wrong: 0,
        unanswered: 0,
        points_possible: 0,
        points_earned: 0,
        wrong_questions: []
      });
    }

    const stat = map.get(zoneId);
    const points = numberOrZero(item.points);
    const earned = numberOrZero(item.earned_points);
    const isCorrect = Boolean(item.is_correct);

    stat.total += 1;
    stat.points_possible += points;
    stat.points_earned += earned;

    if (isCorrect) {
      stat.correct += 1;
    } else {
      stat.wrong += 1;
      stat.wrong_questions.push(item.question_number);
    }

    if (isUnanswered(item.student_answer)) {
      stat.unanswered += 1;
    }
  });

  return [...map.values()]
    .map((stat) => ({
      ...stat,
      accuracy: percent(stat.correct, stat.total),
      point_rate: stat.points_possible
        ? Math.round((stat.points_earned / stat.points_possible) * 100)
        : 0
    }))
    .sort((a, b) => zoneOrder(a.zone_id) - zoneOrder(b.zone_id));
}

function inferZoneIdByQuestionNumber(questionNumber) {
  const n = Number(questionNumber);

  if (n >= 1 && n <= 4) return "Z01";
  if (n >= 5 && n <= 12) return "Z02";
  if (n >= 13 && n <= 18) return "Z03";
  if (n >= 19 && n <= 24) return "Z04";
  if (n >= 25 && n <= 27) return "Z05";
  if (n >= 28 && n <= 38) return "Z06";
  if (n >= 39 && n <= 41) return "Z07";
  if (n >= 42 && n <= 50) return "Z08";

  return "Z00";
}

function zoneOrder(zoneId) {
  const order = {
    Z01: 1,
    Z02: 2,
    Z03: 3,
    Z04: 4,
    Z05: 5,
    Z06: 6,
    Z07: 7,
    Z08: 8,
    Z00: 99
  };

  return order[zoneId] || 99;
}

function groupStats(items, key) {
  const map = new Map();

  items.forEach((item) => {
    const groupName = item[key] || "미분류";

    if (!map.has(groupName)) {
      map.set(groupName, {
        name: groupName,
        total: 0,
        correct: 0,
        wrong: 0,
        unanswered: 0,
        points_possible: 0,
        points_earned: 0,
        wrong_questions: []
      });
    }

    const stat = map.get(groupName);
    const points = numberOrZero(item.points);
    const earned = numberOrZero(item.earned_points);
    const isCorrect = Boolean(item.is_correct);

    stat.total += 1;
    stat.points_possible += points;
    stat.points_earned += earned;

    if (isCorrect) {
      stat.correct += 1;
    } else {
      stat.wrong += 1;
      stat.wrong_questions.push(item.question_number);
    }

    if (isUnanswered(item.student_answer)) {
      stat.unanswered += 1;
    }
  });

  return [...map.values()]
    .map((stat) => ({
      ...stat,
      accuracy: percent(stat.correct, stat.total),
      point_rate: stat.points_possible
        ? Math.round((stat.points_earned / stat.points_possible) * 100)
        : 0
    }))
    .sort((a, b) => b.wrong - a.wrong || a.accuracy - b.accuracy || a.name.localeCompare(b.name, "ko"));
}

function groupDiagnosticStats(items) {
  const map = new Map();

  items.forEach((item) => {
    const groupName = getStandardDiagnosticAreaName(item);

    if (!map.has(groupName)) {
      map.set(groupName, {
        name: groupName,
        total: 0,
        correct: 0,
        wrong: 0,
        unanswered: 0,
        points_possible: 0,
        points_earned: 0,
        wrong_questions: []
      });
    }

    const stat = map.get(groupName);
    const points = numberOrZero(item.points);
    const earned = numberOrZero(item.earned_points);
    const isCorrect = Boolean(item.is_correct);

    stat.total += 1;
    stat.points_possible += points;
    stat.points_earned += earned;

    if (isCorrect) {
      stat.correct += 1;
    } else {
      stat.wrong += 1;
      stat.wrong_questions.push(item.question_number);
    }

    if (isUnanswered(item.student_answer)) {
      stat.unanswered += 1;
    }
  });

  return [...map.values()]
    .map((stat) => ({
      ...stat,
      accuracy: percent(stat.correct, stat.total),
      point_rate: stat.points_possible
        ? Math.round((stat.points_earned / stat.points_possible) * 100)
        : 0
    }))
    .sort((a, b) => b.wrong - a.wrong || a.accuracy - b.accuracy || a.name.localeCompare(b.name, "ko"));
}

function getStandardDiagnosticAreaName(item) {
  const typeId = inferReadingTypeChartIdByNumberFirst(item);

  const names = {
    T01: "문법·표현",
    T02: "유사 표현",
    T03: "이미지·안내문 이해",
    T04: "자료·그래프 정보 비교",
    T05: "내용 일치·세부 내용",
    T06: "문장 순서·배열",
    T07: "빈칸·문맥 표현",
    T08: "공통 지문 빈칸",
    T09: "공통 지문 주제·중심 생각",
    T10: "심정 파악",
    T11: "서사 글 이해",
    T12: "신문 제목·함축 의미",
    T13: "중심 내용·주제 파악",
    T14: "필자 의도·주장",
    T15: "문장 삽입",
    T16: "긴 지문 내용 일치"
  };

  return names[typeId] || (item && item.diagnostic_area ? item.diagnostic_area : "미분류");
}

function makeStrengthList(categoryAnalysis, diagnosticAnalysis) {
  const categoryStrengths = categoryAnalysis
    .filter((stat) => stat.total >= 1 && stat.accuracy >= 70)
    .slice(0, 5);

  const diagnosticStrengths = diagnosticAnalysis
    .filter((stat) => stat.total >= 1 && stat.accuracy >= 70)
    .slice(0, 5);

  return {
    categoryStrengths,
    diagnosticStrengths
  };
}

function makeWeaknessList(categoryAnalysis, diagnosticAnalysis, zoneAnalysis) {
  const categoryWeaknesses = categoryAnalysis
    .filter((stat) => stat.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong || a.accuracy - b.accuracy)
    .slice(0, 5);

  const diagnosticWeaknesses = diagnosticAnalysis
    .filter((stat) => stat.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong || a.accuracy - b.accuracy)
    .slice(0, 8);

  const zoneWeaknesses = zoneAnalysis
    .filter((stat) => stat.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong || a.accuracy - b.accuracy)
    .slice(0, 5);

  return {
    categoryWeaknesses,
    diagnosticWeaknesses,
    zoneWeaknesses
  };
}
function getPriorityWeakZones(zoneAnalysis, limit) {
  return (zoneAnalysis || [])
    .filter(function (stat) {
      return numberOrZero(stat.wrong) > 0;
    })
    .sort(function (a, b) {
      const wrongDiff = numberOrZero(b.wrong) - numberOrZero(a.wrong);

      if (wrongDiff !== 0) {
        return wrongDiff;
      }

      const accuracyDiff = numberOrZero(a.accuracy) - numberOrZero(b.accuracy);

      if (accuracyDiff !== 0) {
        return accuracyDiff;
      }

      const pointLossA = numberOrZero(a.points_possible) - numberOrZero(a.points_earned);
      const pointLossB = numberOrZero(b.points_possible) - numberOrZero(b.points_earned);
      const pointLossDiff = pointLossB - pointLossA;

      if (pointLossDiff !== 0) {
        return pointLossDiff;
      }

      return zoneOrder(a.zone_id) - zoneOrder(b.zone_id);
    })
    .slice(0, limit);
}
function makePrescriptions(context) {
  const result = context.result;
  const level = context.level;
  const problemItems = context.problemItems || [];
  const unansweredItems = context.unansweredItems || [];
  const categoryAnalysis = context.categoryAnalysis || [];
  const diagnosticAnalysis = context.diagnosticAnalysis || [];
  const zoneAnalysis = context.zoneAnalysis || [];

  const totalQuestions = Number(result.total_questions || 0);
  const isFullSet = totalQuestions >= 50;
  const isLevelTest = isLevelTestResult(result);
  const prescriptions = [];

  prescriptions.push({
    title: "현재 읽기 수준에 따른 종합 처방",
    body: [
      `현재 읽기 기준 예상 수준은 '${level.title}'입니다.`,
      level.message,
      `다음 목표는 ${level.next_target_score}점 이상, 즉 '${level.next_target_label}'입니다.`,
      level.study_focus
    ].join(" ")
  });
    if (!isFullSet && isLevelTest) {
    prescriptions.push({
      title: "레벨테스트 결과 해석 안내",
      body: [
        `현재 결과는 TOPIK II 읽기 50문항 전체 시험이 아니라 ${totalQuestions}문항 레벨테스트입니다.`,
        "이 결과는 대표 유형별 약점과 현재 읽기 수준을 빠르게 확인하기 위한 참고 자료입니다.",
        "공식 급수나 최종 실전 점수는 듣기·쓰기·읽기를 포함한 전체 시험 또는 50문항 읽기 시험에서 더 정확하게 판단해야 합니다."
      ].join(" ")
    });

    const weakCategoriesForLevelTest = categoryAnalysis
      .filter((stat) => stat.wrong > 0)
      .slice(0, 3);

    weakCategoriesForLevelTest.forEach((stat) => {
      prescriptions.push(prescriptionForCategory(stat, problemItems));
    });

    const weakZonesForLevelTest = getPriorityWeakZones(zoneAnalysis, 2);

    weakZonesForLevelTest.forEach((stat) => {
      prescriptions.push(prescriptionForZone(stat));
    });

    if (unansweredItems.length > 0) {
      prescriptions.push({
        title: "레벨테스트 미응답 관리 처방",
        body: [
          `미응답 문항은 ${makeQuestionListText(unansweredItems.map((item) => item.question_number))}입니다.`,
          "20문항 레벨테스트에서 미응답이 생겼다면 시간 부족보다 특정 유형을 읽는 순서가 불안정한지 먼저 확인해야 합니다.",
          "다음 응시에서는 어려운 문항에 오래 머물지 말고 표시 후 넘어간 뒤 마지막에 다시 확인하세요."
        ].join(" ")
      });
    }

    prescriptions.push({
      title: "레벨테스트 이후 2주 학습 계획",
      body: [
        "1~3일차: 오답과 미응답 문항을 다시 풀고 정답 근거 문장을 표시합니다.",
        "4~6일차: 점수가 낮은 유형을 같은 유형끼리 묶어 다시 풉니다.",
        "7일차: 레벨테스트 20문항을 시간 제한 없이 다시 풀며 지문 구조를 분석합니다.",
        "8~10일차: 약한 유형과 같은 원래 번호대의 50문항 시험 문제를 추가로 풉니다.",
        "11~13일차: 50문항 실전 시험을 70분 제한으로 풀어 봅니다.",
        `14일차: ${level.next_target_score}점 이상을 목표로 레벨테스트 또는 50문항 시험을 다시 응시합니다.`
      ].join(" ")
    });

    return prescriptions;
  }
  if (!isFullSet) {
    prescriptions.push({
      title: "샘플 문항 결과 해석 주의",
      body: [
        `현재 결과는 전체 50문항이 아니라 ${totalQuestions}문항 기준입니다.`,
        "따라서 이 결과는 화면 기능, 문제 유형, 진단 구조를 확인하는 용도로 해석해야 합니다.",
        "실제 예상 급수와 세부 처방은 1~50번 전체 문항을 입력한 뒤 더 정확하게 판단할 수 있습니다."
      ].join(" ")
    });

        const weakCategoriesForSample = categoryAnalysis
      .filter((stat) => stat.wrong > 0)
      .slice(0, 1);

    weakCategoriesForSample.forEach((stat) => {
      prescriptions.push(prescriptionForCategory(stat, problemItems));
    });

    const weakZonesForSample = getPriorityWeakZones(zoneAnalysis, 1);

    weakZonesForSample.forEach((stat) => {
      prescriptions.push(prescriptionForZone(stat));
    });

    if (unansweredItems.length > 0) {
      prescriptions.push({
        title: "미응답 문항 관리 처방",
        body: [
          `미응답 문항은 ${makeQuestionListText(unansweredItems.map((item) => item.question_number))}입니다.`,
          "샘플 문항에서도 미응답이 생겼다면 시간 부족, 지문 이해 실패, 유형 미숙 중 어느 원인인지 확인해야 합니다.",
          "실전에서는 어려운 문항에 오래 머물지 말고 표시 후 넘어간 뒤 마지막에 다시 확인하는 방식이 필요합니다."
        ].join(" ")
      });
    }

    prescriptions.push(makeTwoWeekPlan(level));
    return prescriptions;
  }

  const weakCategories = categoryAnalysis
    .filter((stat) => stat.wrong > 0)
    .slice(0, 3);

  weakCategories.forEach((stat) => {
    prescriptions.push(prescriptionForCategory(stat, problemItems));
  });

  const weakAreas = diagnosticAnalysis
    .filter((stat) => stat.wrong > 0)
    .slice(0, 3);

  weakAreas.forEach((stat) => {
    prescriptions.push(prescriptionForDiagnosticArea(stat, problemItems));
  });

    const weakZones = getPriorityWeakZones(zoneAnalysis, 3);

  weakZones.forEach((stat) => {
    prescriptions.push(prescriptionForZone(stat));
  });

  if (unansweredItems.length > 0) {
    prescriptions.push({
      title: "미응답 문항 관리 처방",
      body: [
        `미응답 문항은 ${makeQuestionListText(unansweredItems.map((item) => item.question_number))}입니다.`,
        "미응답이 생긴 이유가 시간 부족인지, 지문 이해 실패인지, 문제 유형 미숙인지 구분해야 합니다.",
        "실전에서는 어려운 문항에 오래 머물지 말고 표시 후 넘어간 뒤 마지막 10분에 다시 확인하는 방식이 필요합니다."
      ].join(" ")
    });
  }

  prescriptions.push(makeTwoWeekPlan(level));
  return prescriptions;
}
function prescriptionForCategory(stat, problemItems) {
  const relatedProblemItems = problemItems.filter((item) => {
    if (item.category === stat.name) {
      return true;
    }

    if (getReadingTypeDisplayName(item) === stat.name) {
      return true;
    }

    return statHasQuestionNumber(stat, item.question_number);
  });
  const questionText = makeQuestionListText(relatedProblemItems.map((item) => item.question_number));

  if (/문법|표현|어휘/.test(stat.name)) {
    return {
      title: `${stat.name} 보완 처방`,
      body: [
        `${questionText}을 다시 풀면서 빈칸 앞뒤 문장을 먼저 확인하세요.`,
        "문법 형태만 보고 고르지 말고, 앞 문장과 뒤 문장의 의미 관계가 자연스러운지 확인해야 합니다.",
        "오답 복습 시 정답 표현으로 새 문장 2개를 직접 만들어 보세요."
      ].join(" ")
    };
  }

  if (/자료|그래프|표|안내|광고/.test(stat.name)) {
    return {
      title: `${stat.name} 보완 처방`,
      body: [
        `${questionText}에서는 날짜, 시간, 장소, 대상, 조건을 먼저 표시하세요.`,
        "보기 4개를 한 번에 읽지 말고, 보기 하나마다 자료에서 근거를 확인하세요.",
        "맞지 않는 것을 고르는 문제는 맞는 보기 3개를 먼저 지우고 남은 1개를 선택하는 방식으로 풀어야 합니다."
      ].join(" ")
    };
  }

  if (/문장 순서/.test(stat.name)) {
    return {
      title: "문장 순서 배열 보완 처방",
      body: [
        `${questionText}에서는 시간 표현, 지시어, 접속어, 반복되는 명사를 먼저 찾으세요.`,
        "순서는 '처음 상황 → 전개 → 결과' 흐름으로 잡습니다.",
        "복습할 때는 정답 순서를 외우지 말고, 왜 그 문장이 앞에 와야 하는지 이유를 한 문장으로 적으세요."
      ].join(" ")
    };
  }

  if (/문장 삽입/.test(stat.name)) {
    return {
      title: "문장 삽입 보완 처방",
      body: [
        `${questionText}에서는 주어진 문장의 지시어, 접속 표현, 핵심 명사를 먼저 표시하세요.`,
        "삽입 위치 앞 문장이 그 문장을 준비하고, 뒤 문장이 그 문장을 이어 받는지 확인해야 합니다.",
        "정답 위치 앞뒤 문장과 삽입 문장을 함께 읽어서 자연스러운지 확인하세요."
      ].join(" ")
    };
  }

  if (/긴 지문|장문|논설|설명|내용 일치|글의 목적|중심/.test(stat.name)) {
    return {
      title: `${stat.name} 보완 처방`,
      body: [
        `${questionText}을 다시 풀 때 선택지의 핵심어를 먼저 표시하세요.`,
        "그 핵심어가 지문에 그대로 있는지, 다른 말로 바뀌었는지 찾아야 합니다.",
        "정답이라고 생각한 보기마다 지문 속 근거 문장을 반드시 하나씩 표시하세요."
      ].join(" ")
    };
  }

  return {
    title: `${stat.name} 보완 처방`,
    body: [
      `${questionText}을 다시 풀고, 정답의 근거 문장을 지문에서 찾아 표시하세요.`,
      "오답 선택지를 고른 이유와 정답이 되는 이유를 각각 한 문장으로 적어야 합니다."
    ].join(" ")
  };
}

function prescriptionForDiagnosticArea(stat, problemItems) {
  const relatedProblemItems = problemItems.filter((item) => {
    return item.diagnostic_area === stat.name || getStandardDiagnosticAreaName(item) === stat.name;
  });
  const questionText = makeQuestionListText(relatedProblemItems.map((item) => item.question_number));

  return {
    title: `진단 영역 처방: ${stat.name}`,
    body: [
      `${questionText}에서 문제가 발생했습니다.`,
      "이 영역은 단순 암기보다 문제를 푸는 순서가 중요합니다.",
      "먼저 질문의 요구를 확인하고, 선택지의 핵심어를 표시한 뒤, 지문에서 근거 문장을 찾는 방식으로 복습하세요.",
      "같은 진단 영역의 문제를 3문항 이상 연속으로 풀어 오답 패턴이 반복되는지 확인하세요."
    ].join(" ")
  };
}

function prescriptionForZone(stat) {
  if (stat.zone_id === "Z01") {
    return {
      title: "1~4번 초반 문법·표현 구간 처방",
      body: "초반 문항에서 오답이나 미응답이 있으면 기본 문법·표현 안정성이 부족할 수 있습니다. 빈칸 앞뒤 문장을 소리 내어 읽고, 보기 4개를 하나씩 넣어 자연스러운 표현을 고르는 훈련이 필요합니다."
    };
  }

  if (stat.zone_id === "Z02") {
    return {
      title: "5~12번 자료·정보 이해 구간 처방",
      body: "자료형 문항은 글을 모두 해석하기보다 날짜, 시간, 장소, 대상, 조건을 빠르게 찾는 능력이 중요합니다. 보기 하나마다 자료에서 근거를 확인하는 방식으로 복습하세요."
    };
  }

  if (stat.zone_id === "Z03") {
    return {
      title: "13~18번 문장 배열·문맥 추론 구간 처방",
      body: "이 구간은 글의 흐름을 보는 능력을 평가합니다. 접속어, 지시어, 반복 명사, 원인·결과 관계를 표시하면서 문장 간 연결을 확인하세요."
    };
  }

  if (stat.zone_id === "Z04") {
    return {
      title: "19~24번 공통 지문 세트 구간 처방",
      body: "공통 지문 세트는 한 지문에서 여러 문제를 풀어야 하므로, 첫 문제를 풀 때 지문 구조를 잡아 두는 것이 중요합니다. 주제, 인물, 사건, 핵심 변화 내용을 간단히 표시하세요."
    };
  }

  if (stat.zone_id === "Z05") {
    return {
      title: "25~27번 신문 제목·함축 의미 구간 처방",
      body: "신문 제목은 짧지만 함축적입니다. 제목 속 핵심 명사와 동사를 풀어 쓰고, 기사 내용이 어떤 사건·변화·문제를 말하는지 한 문장으로 바꾸는 연습이 필요합니다."
    };
  }

  if (stat.zone_id === "Z06") {
    return {
      title: "28~38번 중·장문 독해 구간 처방",
      body: "중·장문에서는 첫 문장과 마지막 문장에서 글의 방향을 잡고, 보기의 핵심어를 지문에서 찾는 방식이 필요합니다. 정답 근거가 없는 보기는 선택하지 않는 훈련을 하세요."
    };
  }

  if (stat.zone_id === "Z07") {
    return {
      title: "39~41번 문장 삽입 구간 처방",
      body: "문장 삽입은 앞뒤 문맥의 응집성을 보는 문제입니다. 주어진 문장의 지시어, 연결어, 반복 명사가 앞뒤 문장과 어떻게 연결되는지 확인하세요."
    };
  }

  if (stat.zone_id === "Z08") {
    return {
      title: "42~50번 고난도 장문 세트 구간 처방",
      body: "후반 장문은 TOPIK II 고급 독해의 핵심입니다. 글 전체를 처음부터 세부적으로 해석하기보다 첫 문단의 문제 제기, 중간의 근거, 마지막의 결론을 나누어 읽어야 합니다."
    };
  }

  return {
    title: `${stat.label} 구간 처방`,
    body: "문제가 발생한 문항을 다시 풀고 정답 근거 문장을 표시하세요."
  };
}

function makeTwoWeekPlan(level) {
  return {
    title: "2주 학습 계획",
    body: [
      "1~3일차: 오답과 미응답 문항을 다시 풀고 정답 근거 문장을 표시합니다.",
      "4~6일차: 약한 유형을 같은 유형끼리 묶어 집중 풀이합니다.",
      "7일차: 1회분을 시간 제한 없이 풀며 지문 구조를 분석합니다.",
      "8~10일차: 목표 급수보다 한 단계 높은 난이도의 지문을 매일 2~3개씩 풉니다.",
      "11~13일차: 70분 시간 제한을 두고 실전처럼 풉니다.",
      `14일차: ${level.next_target_score}점 이상을 목표로 다시 시험을 봅니다.`
    ].join(" ")
  };
}
function isWrongReviewReport(report) {
  const result = report && report.source ? report.source : {};
  const mode = String(result.generated_exam_mode || "");
  const label = String(result.generated_exam_label || "");

  return mode === "wrong-review" || label.includes("오답 다시 풀기");
}

function renderWrongReviewInlineActionPlaceholder() {
  return `
    <div
      id="wrongReviewInlineAction"
      style="
        margin: 18px 0 8px;
        padding: 16px;
        border: 1px solid #d7e1ec;
        border-radius: 12px;
        background: #f8fbff;
      "
    ></div>
  `;
}

function renderWrongReviewResultReport(report) {
  const result = report.source;
  const wrongCount = Array.isArray(report.wrongItems) ? report.wrongItems.length : 0;
  const totalQuestions = numberOrZero(result.total_questions);
  const correctCount = numberOrZero(result.correct_count);
  const unansweredCount = numberOrZero(result.unanswered_count);

  els.reportPaper.innerHTML = `
    <div class="report-title">
      <h2>오답 복습 결과</h2>
      <p>${escapeHtml(result.generated_exam_label || "오답 다시 풀기")} · ${totalQuestions}문항</p>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <div class="label">응시자</div>
        <div class="value">${escapeHtml(result.student_name || "-")}</div>
      </div>
      <div class="summary-card">
        <div class="label">복습 문항</div>
        <div class="value">${totalQuestions}문항</div>
      </div>
      <div class="summary-card">
        <div class="label">맞힌 문항</div>
        <div class="value">${correctCount} / ${totalQuestions}</div>
      </div>
      <div class="summary-card">
        <div class="label">남은 오답</div>
        <div class="value">${wrongCount}</div>
      </div>
    </div>

    <div class="level-box">
      <strong>${wrongCount ? "아직 다시 틀린 문제가 남아 있습니다." : "오답 복습 완료"}</strong><br />
      ${
        wrongCount
          ? `이번 복습에서 ${wrongCount}문항이 다시 오답으로 남았습니다. 아래 문항만 다시 풀면 됩니다.`
          : "이번 복습에서 남은 오답이 없습니다. 모든 오답을 해결했습니다."
      }
      <br />
      미응답: ${unansweredCount}문항
    </div>

    <div class="notice">
      <strong>오답 복습 결과 안내</strong><br />
      이 화면은 전체 TOPIK II 읽기 50문항 진단 보고서가 아니라 오답 복습 결과입니다.
      따라서 이 화면에서는 예상 급수나 전체 실력 판정을 하지 않습니다.
    </div>

    <h3 class="section-title">다시 틀린 문항</h3>
    ${renderWrongItems(report.wrongItems)}

    ${renderWrongReviewInlineActionPlaceholder()}

    <h3 class="section-title">미응답 문항</h3>
    ${renderUnansweredItems(report.unansweredItems)}
  `;

  els.reportArea.classList.add("show");
  els.reportActions.classList.add("show");

  renderWrongReviewButton(report);

  const loadPanel = document.getElementById("loadPanel");
  if (loadPanel) {
    loadPanel.classList.add("hidden");
  }
}
function renderReport(report) {
  const result = report.source;
  const level = report.level;
  const isFullSet = Boolean(result.is_full_50_question_set);
  const isLevelTest = isLevelTestResult(result);
  els.reportPaper.innerHTML = `
    <div class="report-title">
      <h2>${isLevelTest ? "TOPIK II 읽기 레벨테스트 진단 보고서" : "TOPIK II 읽기 진단 보고서"}</h2>
      <p>${escapeHtml(result.test_name || "TOPIK II Reading")} · ${escapeHtml(result.test_scope || "TOPIK II PBT Reading 1-50")}</p>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <div class="label">응시자</div>
        <div class="value">${escapeHtml(result.student_name || "-")}</div>
      </div>
      <div class="summary-card">
        <div class="label">읽기 점수</div>
        <div class="value">${numberOrZero(result.section_score_100)}점</div>
      </div>
      <div class="summary-card">
        <div class="label">정답 수</div>
        <div class="value">${numberOrZero(result.correct_count)} / ${numberOrZero(result.total_questions)}</div>
      </div>
      <div class="summary-card">
        <div class="label">미응답</div>
        <div class="value">${numberOrZero(result.unanswered_count)}</div>
      </div>
    </div>

    <div class="level-box">
      <strong>${escapeHtml(level.title)}</strong><br />
      읽기 점수 구간: ${escapeHtml(level.range)}<br />
      예상 수준: ${escapeHtml(level.expected_level)}<br />
      안정권 해석: ${escapeHtml(level.stable_level)}<br />
      다음 목표: ${level.next_target_score}점 이상, ${escapeHtml(level.next_target_label)}<br />
      ${escapeHtml(level.message)}
    </div>

    <div class="notice">
      <strong>공식 급수 안내</strong><br />
      이 보고서는 TOPIK II 읽기 영역만 기준으로 한 예상 수준입니다.
      공식 TOPIK II 급수는 듣기·쓰기·읽기 총점 300점 기준으로 결정되므로,
      이 결과만으로 공식 급수를 확정할 수 없습니다.
    </div>

       ${
      isFullSet
        ? ""
        : isLevelTest
          ? `<div class="notice">
              <strong>레벨테스트 결과 안내</strong><br />
              이 결과는 TOPIK II 읽기 50문항 전체 시험 결과가 아니라
              ${numberOrZero(result.total_questions)}문항 레벨테스트 결과입니다.
              예상 수준과 약점 진단은 참고용이며,
              전체 실전 점수는 50문항 시험에서 더 정확하게 확인할 수 있습니다.
            </div>`
          : `<div class="notice">
              <strong>샘플 결과 주의</strong><br />
              현재 결과는 전체 50문항이 아니라 ${numberOrZero(result.total_questions)}문항 기준입니다.
              화면 기능과 진단 구조 확인용으로 사용하고, 실제 예상 급수는 1~50번 전체 문항 입력 후 판단하세요.
            </div>`
    }

    <h3 class="section-title">시험 정보</h3>
    ${renderExamInfoTable(result)}

    <h3 class="section-title">유형별 득점 그래프</h3>
    ${renderTypeBarChart(report.readingTypeAnalysis)}

    <h3 class="section-title">문항 구간별 분석</h3>
    ${renderZoneTable(report.zoneAnalysis)}

    <h3 class="section-title">유형별 분석</h3>
    ${renderStatsTable(report.readingTypeAnalysis, "유형")}

    <h3 class="section-title">진단 영역별 분석</h3>
    ${renderStatsTable(report.diagnosticAnalysis, "진단 영역")}

    <h3 class="section-title">강점 영역</h3>
    ${renderStrengths(report.strengths, result)}

    <h3 class="section-title">약점 영역</h3>
     ${renderWeaknesses(report.weaknesses, result)}

            <h3 class="section-title">오답 문항</h3>
    ${renderWrongItems(report.wrongItems)}

    <h3 class="section-title">미응답 문항</h3>
    ${renderUnansweredItems(report.unansweredItems)}

    <h3 class="section-title">학습 처방</h3>
    ${renderPrescriptions(report.prescriptions)}
  `;

    els.reportArea.classList.add("show");
  els.reportActions.classList.add("show");

  renderWrongReviewButton(report);

  const loadPanel = document.getElementById("loadPanel");
  if (loadPanel) {
    loadPanel.classList.add("hidden");
  }
}

function getReportWrongQuestionNumbers(report) {
  const wrongItems = Array.isArray(report && report.wrongItems)
    ? report.wrongItems
    : [];

  return wrongItems
    .map(function (item) {
      return Number(item.question_number);
    })
    .filter(function (number) {
      return Number.isFinite(number) && number >= 1 && number <= 50;
    })
    .filter(function (number, index, array) {
      return array.indexOf(number) === index;
    });
}

function getStoredWrongReviewState() {
  try {
    const raw = localStorage.getItem(WRONG_REVIEW_STORAGE_KEY);

    if (raw === null) {
      return {
        exists: false,
        numbers: []
      };
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return {
        exists: false,
        numbers: []
      };
    }

    return {
      exists: true,
      numbers: parsed
        .map(function (number) {
          return Number(number);
        })
        .filter(function (number) {
          return Number.isFinite(number) && number >= 1 && number <= 50;
        })
        .filter(function (number, index, array) {
          return array.indexOf(number) === index;
        })
    };
  } catch (error) {
    console.warn("남은 오답 문항 정보를 읽지 못했습니다:", error);

    return {
      exists: false,
      numbers: []
    };
  }
}

function getActiveWrongReviewNumbers(report) {
  const storedState = getStoredWrongReviewState();

  if (storedState.exists) {
    return storedState.numbers;
  }

  return getReportWrongQuestionNumbers(report);
}

function renderWrongReviewButton(report) {
  const target = els.reportActions;

  if (!target) {
    return;
  }

  const oldButton = document.getElementById("wrongReviewButton");
  if (oldButton) {
    oldButton.remove();
  }

  const oldNotice = document.getElementById("wrongReviewClearNotice");
  if (oldNotice) {
    oldNotice.remove();
  }

  const activeWrongNumbers = getActiveWrongReviewNumbers(report);

  if (!activeWrongNumbers.length) {
    const notice = document.createElement("span");
    notice.id = "wrongReviewClearNotice";
    notice.textContent = "남은 오답이 없습니다.";
    notice.style.cssText = [
      "display:inline-block",
      "margin-left:10px",
      "padding:10px 14px",
      "border-radius:8px",
      "background:#ecfdf5",
      "color:#047857",
      "font-weight:900"
    ].join(";");

    target.appendChild(notice);
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.id = "wrongReviewButton";
  button.textContent = `오답 다시 풀기 (${activeWrongNumbers.length}문항)`;
  button.style.cssText = [
    "margin-left: 10px",
    "padding: 10px 16px",
    "border: 0",
    "border-radius: 8px",
    "background: #dc2626",
    "color: #ffffff",
    "font-weight: 900",
    "cursor: pointer"
  ].join(";");

  button.addEventListener("click", function () {
    startWrongReview(report);
  });

  target.appendChild(button);
}

function startWrongReview(report) {
  const activeWrongNumbers = getActiveWrongReviewNumbers(report);

  if (!activeWrongNumbers.length) {
    alert("다시 풀 오답 문항이 없습니다.");
    return;
  }

  try {
    localStorage.setItem(
      WRONG_REVIEW_STORAGE_KEY,
      JSON.stringify(activeWrongNumbers)
    );

    localStorage.setItem(
      WRONG_REVIEW_SOURCE_RESULT_STORAGE_KEY,
      JSON.stringify(report.source || {})
    );
  } catch (error) {
    console.warn("오답 다시 풀기 정보 저장 실패:", error);
    alert("오답 문항 정보를 저장하지 못했습니다. 브라우저 저장소 설정을 확인하세요.");
    return;
  }

  window.location.href = WRONG_REVIEW_TEST_URL;
}
function renderTypeBarChart(stats) {
  if (!Array.isArray(stats) || !stats.length) {
    return `<p>유형별 그래프 데이터가 없습니다.</p>`;
  }

  const rows = stats.map(function (stat) {
    const rate = numberOrZero(stat.point_rate);
    const fillClass = rate >= 70
      ? "good"
      : rate >= 50
        ? "warn"
        : "bad";

    return `
      <div class="type-chart-row">
        <div class="type-chart-label">
          ${escapeHtml(stat.name)}
          <span class="type-chart-focus">${escapeHtml(stat.focus || "")}</span>
        </div>

        <div class="type-chart-track" aria-label="${escapeHtml(stat.name)} 득점률 ${rate}%">
          <div
            class="type-chart-fill ${fillClass}"
            style="width: ${Math.max(0, Math.min(100, rate))}%;"
          ></div>
        </div>

        <div class="type-chart-rate">${rate}%</div>

        <div class="type-chart-score">
          ${numberOrZero(stat.points_earned)} / ${numberOrZero(stat.points_possible)}점
          <br />
          ${numberOrZero(stat.correct)} / ${numberOrZero(stat.total)}문항
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="type-chart">
      <p class="type-chart-guide">
        아래 그래프는 TOPIK II 읽기 문항을 16개 대표 유형으로 묶어 계산한 득점률입니다.
        막대가 짧은 유형일수록 우선 복습이 필요한 영역입니다.
      </p>

      ${rows}

      ${renderTypeChartWeaknessSummary(stats)}
    </div>
  `;
}

function renderTypeChartWeaknessSummary(stats) {
  const weakStats = stats
    .filter(function (stat) {
      return stat.total > 0 && stat.wrong > 0;
    })
    .sort(function (a, b) {
      return a.point_rate - b.point_rate || b.wrong - a.wrong;
    })
    .slice(0, 3);

  if (!weakStats.length) {
    return `
      <div class="type-chart-summary">
        <strong>유형별 약점 요약</strong><br />
        현재 결과에서는 뚜렷한 약점 유형이 확인되지 않았습니다.
        고득점 유지를 위해 후반 장문과 선택지 함정 분석을 계속 연습하세요.
      </div>
    `;
  }

  const summaryText = weakStats.map(function (stat) {
    const questionText = makeQuestionListText(stat.wrong_questions);

    return `${escapeHtml(stat.name)} ${numberOrZero(stat.point_rate)}%`;
  }).join(", ");

  const questionText = weakStats
    .map(function (stat) {
      return `${escapeHtml(stat.name)}: ${makeQuestionListText(stat.wrong_questions)}`;
    })
    .join(" / ");

  return `
    <div class="type-chart-summary">
      <strong>유형별 약점 요약</strong><br />
      현재 가장 보완이 필요한 유형은 ${summaryText}입니다.<br />
      관련 오답 문항: ${questionText}
    </div>
  `;
}
function renderExamInfoTable(result) {
  return `
    <table>
      <tbody>
        <tr>
          <th>시험명</th>
          <td>${escapeHtml(result.test_name || "-")}</td>
        </tr>
        <tr>
          <th>시험 범위</th>
          <td>${escapeHtml(result.test_scope || "-")}</td>
        </tr>
        <tr>
          <th>출제 방식</th>
          <td>${escapeHtml(result.generated_exam_label || "-")}</td>
        </tr>
        <tr>
          <th>출제 회차</th>
          <td>${escapeHtml(result.generated_exam_round || "-")}</td>
        </tr>
        <tr>
          <th>응시 시간</th>
          <td>${escapeHtml(formatDateTime(result.started_at))} ~ ${escapeHtml(formatDateTime(result.submitted_at))}</td>
        </tr>
        <tr>
          <th>문항 수</th>
          <td>${numberOrZero(result.total_questions)}문항</td>
        </tr>
      </tbody>
    </table>
  `;
}

function renderZoneTable(stats) {
  if (!stats.length) {
    return `<p>구간별 분석 데이터가 없습니다.</p>`;
  }

  const rows = stats.map((stat) => `
    <tr>
      <td>${escapeHtml(stat.range)}</td>
      <td><strong>${escapeHtml(stat.label)}</strong><br />${escapeHtml(stat.focus)}</td>
      <td>${stat.correct} / ${stat.total}</td>
      <td>${stat.points_earned} / ${stat.points_possible}</td>
      <td>${stat.accuracy}%</td>
      <td>${makeQuestionListText(stat.wrong_questions)}</td>
    </tr>
  `).join("");

  return `
    <table>
      <thead>
        <tr>
          <th>구간</th>
          <th>진단 초점</th>
          <th>정답 수</th>
          <th>점수</th>
          <th>정답률</th>
          <th>문제 발생 문항</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderStatsTable(stats, label) {
  if (!stats.length) {
    return `<p>${escapeHtml(label)} 분석 데이터가 없습니다.</p>`;
  }

  const rows = stats.map((stat) => `
    <tr>
      <td>${escapeHtml(stat.name)}</td>
      <td>${stat.correct} / ${stat.total}</td>
      <td>${stat.points_earned} / ${stat.points_possible}</td>
      <td>${stat.accuracy}%</td>
      <td>${makeQuestionListText(stat.wrong_questions)}</td>
    </tr>
  `).join("");

  return `
    <table>
      <thead>
        <tr>
          <th>${escapeHtml(label)}</th>
          <th>정답 수</th>
          <th>점수</th>
          <th>정답률</th>
          <th>문제 발생 문항</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function getReportTagDedupeKey(name) {
  const normalized = String(name || "")
    .replace(/\s+/g, "")
    .replace(/[·ㆍ]/g, "")
    .replace(/[()]/g, "");

  const aliasMap = {
    "자료그래프정보비교": "자료그래프이해",
    "내용일치세부내용": "내용일치",
    "문장순서배열": "문장순서",
    "빈칸문맥표현": "빈칸표현",
    "공통지문주제중심생각": "공통지문주제",
    "신문제목함축의미": "신문제목이해",
    "중심내용주제파악": "중심내용파악",
    "긴지문내용일치": "긴지문내용일치",
    "필자의도주장": "필자의도주장",
    "이미지안내문이해": "이미지안내문이해",
    "유사표현": "유사표현",
    "문법표현": "문법표현",
    "심정파악": "심정파악",
    "문장삽입": "문장삽입",
    "공통지문빈칸": "공통지문빈칸",
    "서사글이해": "서사글이해"
  };

  return aliasMap[normalized] || normalized;
}

function renderStrengths(strengths, result) {
  const tags = [];
  const usedKeys = new Set();
  const totalQuestions = Number(result && result.total_questions ? result.total_questions : 0);
  const isLevelTest = isLevelTestResult(result);

  function addStrengthTag(stat) {
    const name = String(stat && stat.name ? stat.name : "").trim();
    if (!name) return;

    const key = getReportTagDedupeKey(name);
    if (usedKeys.has(key)) return;

    usedKeys.add(key);
    tags.push(`<span class="tag good">${escapeHtml(name)} ${stat.accuracy}%</span>`);
  }

  (strengths.categoryStrengths || []).forEach(addStrengthTag);
  (strengths.diagnosticStrengths || []).forEach(addStrengthTag);

  if (!tags.length) {
    if (isLevelTest) {
      return `<p>현재 레벨테스트 ${totalQuestions}문항 기준으로 뚜렷한 강점 영역은 아직 확인되지 않았습니다. 다음 응시에서는 정답률 70% 이상인 유형이 2개 이상 안정적으로 나타나는지 확인하세요.</p>`;
    }

    return `<p>현재 결과 기준으로 뚜렷한 강점 영역이 아직 확인되지 않았습니다. 전체 50문항 시험에서는 더 넓은 범위로 강점 영역을 확인할 수 있습니다.</p>`;
  }

  return `<p>${tags.join(" ")}</p>`;
}

function renderWeaknesses(weaknesses, result) {
  const tags = [];
  const usedKeys = new Set();
  const totalQuestions = Number(result && result.total_questions ? result.total_questions : 0);
  const isFullSet = totalQuestions >= 50;
  const isLevelTest = isLevelTestResult(result);

  const categoryLimit = isFullSet ? 5 : 3;
  const diagnosticLimit = isFullSet ? 8 : 2;
  const zoneLimit = isFullSet ? 5 : 2;

  const categoryWeaknesses = (weaknesses.categoryWeaknesses || []).slice(0, categoryLimit);
  const diagnosticWeaknesses = (weaknesses.diagnosticWeaknesses || []).slice(0, diagnosticLimit);
  const zoneWeaknesses = (weaknesses.zoneWeaknesses || []).slice(0, zoneLimit);

  function addWeaknessTag(name, wrongCount) {
    const safeName = String(name || "").trim();
    if (!safeName) return;

    const key = getReportTagDedupeKey(safeName);
    if (usedKeys.has(key)) return;

    usedKeys.add(key);
    tags.push(`<span class="tag bad">${escapeHtml(safeName)} 문제 ${wrongCount}개</span>`);
  }

  categoryWeaknesses.forEach((stat) => {
    addWeaknessTag(stat.name, stat.wrong);
  });

  diagnosticWeaknesses.forEach((stat) => {
    addWeaknessTag(stat.name, stat.wrong);
  });

  zoneWeaknesses.forEach((stat) => {
    addWeaknessTag(stat.label, stat.wrong);
  });

  if (!tags.length) {
    return `<p>오답 또는 미응답이 없거나 약점 영역이 확인되지 않았습니다.</p>`;
  }

   if (!isFullSet) {
    return `
      <p>${tags.join(" ")}</p>
      <p class="small-report-note">
        ${
          isLevelTest
            ? `현재 약점 영역은 레벨테스트 ${totalQuestions}문항 기준으로 표시한 것입니다. 대표 유형별 약점 확인에는 유용하지만, 전체 실전 점수는 50문항 시험에서 더 정확하게 판단할 수 있습니다.`
            : `현재 약점 영역은 샘플 ${totalQuestions}문항 기준으로 간략 표시한 것입니다. 전체 50문항 결과에서는 더 많은 약점 영역을 세부적으로 표시합니다.`
        }
      </p>
    `;
  }

  return `<p>${tags.join(" ")}</p>`;
}

function renderWrongItems(items) {
  if (!items.length) {
    return `<p><span class="tag good">오답 없음</span> 현재 결과에서 실제 오답 문항은 없습니다. 미응답 문항은 아래 미응답 문항 영역에서 확인하세요.</p>`;
  }

  const html = items.map((item) => `
    <div class="wrong-item">
      <strong>${item.question_number}번</strong>
      <br />
      ${escapeHtml(getReadingTypeDisplayName(item) || "미분류")}
      <br />
      <span class="tag bad">${escapeHtml(item.diagnostic_area || "미분류")}</span>
      <br />
      내 답: ${escapeHtml(answerToTextWithOptions(item, item.student_answer))}
      <br />
      정답: ${escapeHtml(answerToTextWithOptions(item, item.correct_answer))}
    </div>
  `).join("");

  return `<div class="wrong-list">${html}</div>`;
}

function renderUnansweredItems(items) {
  if (!items.length) {
    return `<p><span class="tag good">미응답 없음</span> 모든 문항에 응답했습니다.</p>`;
  }

  return `<p>${makeQuestionListText(items.map((item) => item.question_number))}</p>`;
}

function renderPrescriptions(prescriptions) {
  return prescriptions.map((item) => `
    <div class="prescription-box">
      <h4>${escapeHtml(item.title)}</h4>
      <p>${escapeHtml(item.body)}</p>
    </div>
  `).join("");
}

function makeQuestionListText(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return "관련 문항 없음";
  }

  return numbers
    .filter((number) => number !== null && number !== undefined && number !== "")
    .map((number) => `${number}번`)
    .join(", ");
}

function answerToText(answer) {
  if (answer === null || answer === undefined || answer === "") {
    return "미응답";
  }

  if (Array.isArray(answer)) {
    return answer.join("-");
  }

  return String(answer);
}

function answerToTextWithOptions(item, answer) {
  if (answer === null || answer === undefined || answer === "") {
    return "미응답";
  }

  if (Array.isArray(answer)) {
    const cleanedParts = answer
      .map((part) => String(part ?? "").trim())
      .filter((part) => part && part !== "NaN" && part !== "undefined" && part !== "null");

    if (!cleanedParts.length) {
      return "응답 형식 확인 필요";
    }

    const joined = cleanedParts.join("-");
    const normalizedJoined = joined
      .replace(/[()\s]/g, "")
      .replace(/[－–—]/g, "-");

    if (Array.isArray(item.options)) {
      const matched = item.options.find((option) => {
        const optionText = String(option.text ?? "");
        const normalizedOptionText = optionText
          .replace(/[()\s]/g, "")
          .replace(/[－–—]/g, "-");

        return (
          String(option.label) === joined ||
          optionText === joined ||
          normalizedOptionText === normalizedJoined
        );
      });

      if (matched) {
        return `${matched.label}. ${matched.text}`;
      }
    }

    return joined;
  }

  const answerText = String(answer);

  if (Array.isArray(item.options)) {
    const matched = item.options.find((option) => String(option.label) === answerText);
    if (matched) {
      return `${matched.label}. ${matched.text}`;
    }
  }

  return answerText;
}

function isUnanswered(answer) {
  if (answer === null || answer === undefined || answer === "") {
    return true;
  }

  if (Array.isArray(answer)) {
    return answer.length === 0;
  }

  return false;
}

function percent(correct, total) {
  if (!total) {
    return 0;
  }

  return Math.round((correct / total) * 100);
}

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("ko-KR");
}

function setStatus(message, type = "") {
  if (!els.status) {
    return;
  }

  els.status.textContent = message;
  els.status.className = `status ${type}`.trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}