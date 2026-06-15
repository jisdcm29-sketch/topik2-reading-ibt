"use strict";

console.log("TOPIK II Reading loaded: level-test-mode-v1");

const TEST_CONFIG = {
  testName: "TOPIK II 읽기",
  testDisplayName: "TOPIK II 읽기 PBT형 IBT 시뮬레이션",
  testLevel: "TOPIK II",
  section: "reading",
  testScope: "TOPIK II PBT 읽기 1~50번",
  timeLimitMinutes: 70,
  timeLimitSeconds: 70 * 60,
  scoreFullMark: 100,
  questionNumberStart: 1,
  questionNumberEnd: 50,
  expectedTotalQuestions: 50,
  accessPassword: "topik2"
};

const FULL_EXAM_RUNTIME_CONFIG = {
  testName: "TOPIK II 읽기",
  testDisplayName: "TOPIK II 읽기 PBT형 IBT 시뮬레이션",
  testScope: "TOPIK II PBT 읽기 1~50번",
  sectionTitle: "읽기",
  examSubtitle: "TOPIK II 읽기 · 1~50번 · 70분",
  questionNumberStart: 1,
  questionNumberEnd: 50,
  expectedTotalQuestions: 50,
  timeLimitMinutes: 70,
  timeLimitSeconds: 70 * 60,
  isFull50QuestionSet: true
};

const LEVEL_TEST_RUNTIME_CONFIG = {
  testName: "TOPIK II 읽기 레벨테스트",
  testDisplayName: "TOPIK II 읽기 레벨테스트",
  testScope: "TOPIK II 읽기 레벨테스트 20문항",
  sectionTitle: "읽기 레벨테스트",
  examSubtitle: "TOPIK II 읽기 레벨테스트 · 20문항 · 30분",
  questionNumberStart: 1,
  questionNumberEnd: 20,
  expectedTotalQuestions: 20,
  timeLimitMinutes: 30,
  timeLimitSeconds: 30 * 60,
  isFull50QuestionSet: false
};

const AUTO_DIAGNOSIS_STORAGE_KEY = "topik2_latest_reading_result";
const AUTO_DIAGNOSIS_URL = "../reading-diagnosis/index.html?auto=1";

const WRONG_REVIEW_STORAGE_KEY = "topik2_wrong_review_question_numbers";
const WRONG_REVIEW_SOURCE_RESULT_STORAGE_KEY = "topik2_wrong_review_source_result";
const RANDOM_EXAM_QUESTIONS_STORAGE_KEY = "topik2_latest_random_exam_questions";

/*
  랜덤 출제 검수용 Console 로그 설정
  true  = 102회/103회 혼합 수, 공통 지문 세트 검증 로그 표시
  false = 학생용 배포 상태, 검증 로그 숨김
*/
const ENABLE_RANDOM_VERIFICATION_LOG = false;

let questions = [];let currentIndex = 0;
let answers = {};
let sentenceOrderAnswers = {};
let sharedInsertState = {};

let studentName = "";
let studentPhone = "";
let startedAt = "";
let submittedAt = "";
let remainingSeconds = TEST_CONFIG.timeLimitSeconds;
let timerId = null;

let latestResult = null;
let latestResultText = "";
let isAccessVerified = false;

let latestExamGenerationOptions = {
  mode: "round",
  round: "103",
  label: "103회 고정 출제"
};

let examManifest = null;
let selectedExamDefinition = null;
let selectedExamCategory = "full";
let selectedExamSelectionType = "round";

const elements = {};
const INSERTED_HIGHLIGHT_CLASS = "inserted-answer-highlight";

document.addEventListener("DOMContentLoaded", initReadingTest);

async function initReadingTest() {
  cacheElements();
  await loadExamManifest();
  bindEvents();

  /*
    일반 시험은 시험 시작 버튼을 누를 때 선택된 시험지를 불러온다.
    시작 화면 진입 시에는 불필요하게 기본 103회 시험지를 먼저 로드하지 않는다.
    단, 오답풀이 모드는 자동 시작을 위해 문항을 먼저 불러와야 한다.
  */
  if (isWrongReviewMode()) {
    await loadQuestions({
      forceReload: true,
      showMessage: false
    });

    autoStartWrongReviewIfPossible();
  }
}
function cacheElements() {
  elements.startScreen = document.getElementById("startScreen");
  elements.testScreen = document.getElementById("testScreen");
  elements.resultScreen = document.getElementById("resultScreen");

  elements.accessPasswordInput = document.getElementById("accessPasswordInput");
  elements.accessConfirmButton = document.getElementById("accessConfirmButton");
  elements.studentNameInput = document.getElementById("studentNameInput");
  elements.studentPhoneInput = document.getElementById("studentPhoneInput");
  elements.examModeSelect = document.getElementById("examModeSelect");
  elements.examTypeButtons = document.querySelectorAll("[data-exam-mode-button]");
  elements.examCategoryButtons = document.querySelectorAll("[data-exam-category-button]");
  elements.examSelectionTypeButtons = document.querySelectorAll("[data-exam-selection-type-button]");
  elements.examDetailOptions = document.getElementById("examDetailOptions");
  elements.examSubtitle = document.getElementById("examSubtitle");

  elements.startButton = document.getElementById("startButton");
  elements.startMessage = document.getElementById("startMessage");
  elements.newExamButton = document.getElementById("newExamButton");
  elements.newExamMessage = document.getElementById("newExamMessage");

  elements.studentNameDisplay = document.getElementById("studentNameDisplay");
  elements.studentPhoneDisplay = document.getElementById("studentPhoneDisplay");
  elements.timerCard = document.getElementById("timerCard");
  elements.timerDisplay = document.getElementById("timerDisplay");

  elements.sectionTitle = document.getElementById("sectionTitle");
  elements.examMetaText = document.getElementById("examMetaText");
  elements.answerStatusText = document.getElementById("answerStatusText");
  elements.sidebarStatusText = document.getElementById("sidebarStatusText");

  elements.questionInstruction = document.getElementById("questionInstruction");
  elements.questionStage = document.getElementById("questionStage");

  elements.prevButton = document.getElementById("prevButton");
  elements.nextButton = document.getElementById("nextButton");
  elements.questionListButton = document.getElementById("questionListButton");
  elements.submitButton = document.getElementById("submitButton");

  elements.questionListBackdrop = document.getElementById("questionListBackdrop");
  elements.closeQuestionListButton = document.getElementById("closeQuestionListButton");
  elements.submitFromListButton = document.getElementById("submitFromListButton");
  elements.progressArea = document.getElementById("progressArea");

  elements.resultSummary = document.getElementById("resultSummary");
  elements.resultTable = document.getElementById("resultTable");
  elements.categoryAnalysis = document.getElementById("categoryAnalysis");

  elements.diagnosisButton = document.getElementById("diagnosisButton");
  elements.downloadJsonButton = document.getElementById("downloadJsonButton");
  elements.downloadTxtButton = document.getElementById("downloadTxtButton");
}

function bindEvents() {
    elements.startButton.addEventListener("click", startTest);

    if (elements.newExamButton) {
    elements.newExamButton.addEventListener("click", handleNewExamButton);
  }
     
     if (elements.examModeSelect) {
    elements.examModeSelect.addEventListener("change", function () {
      syncExamSelectionStateFromSelect();
      renderManifestExamDetailOptions();
      updateExamModeButtonState();
      setNewExamMessage(getExamModeStatusMessage(elements.examModeSelect.value), "#188038");
    });
  }

  bindExamModeButtons();
  updateExamModeButtonState();

  if (elements.accessConfirmButton) {
    elements.accessConfirmButton.addEventListener("click", verifyAccessPassword);
  }

  elements.accessPasswordInput.addEventListener("input", resetAccessVerification);

  elements.accessPasswordInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      verifyAccessPassword();
    }
  });

  elements.studentPhoneInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      startTest();
    }
  });

  elements.prevButton.addEventListener("click", goToPreviousQuestion);
  elements.nextButton.addEventListener("click", goToNextQuestion);
  elements.questionListButton.addEventListener("click", openQuestionList);
  elements.closeQuestionListButton.addEventListener("click", closeQuestionList);
  elements.submitButton.addEventListener("click", requestSubmit);
  elements.submitFromListButton.addEventListener("click", requestSubmit);

  elements.questionListBackdrop.addEventListener("click", function (event) {
    if (event.target === elements.questionListBackdrop) {
      closeQuestionList();
    }
  });

  elements.diagnosisButton.addEventListener("click", openDiagnosisReport);

  elements.downloadJsonButton.addEventListener("click", function () {
    if (!latestResult) {
      alert("다운로드할 결과가 없습니다.");
      return;
    }
    downloadJson(latestResult, "topik2-reading-result.json");
  });

  elements.downloadTxtButton.addEventListener("click", function () {
    if (!latestResultText) {
      alert("다운로드할 결과가 없습니다.");
      return;
    }
    downloadText(latestResultText, "topik2-reading-result.txt");
  });
}
async function loadExamManifest() {
  try {
    const response = await fetch("./data/exam-manifest.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`exam-manifest.json을 불러오지 못했습니다. 상태 코드: ${response.status}`);
    }

    const data = await response.json();

    if (!data || !Array.isArray(data.exams)) {
      throw new Error("exam-manifest.json에 exams 배열이 없습니다.");
    }

    examManifest = data;
    console.info(`exam-manifest.json loaded: ${data.exams.length} exams`);
    return data;
  } catch (error) {
    console.warn("exam-manifest.json을 사용할 수 없어 기존 방식으로 실행합니다.", error);
    examManifest = null;
    return null;
  }
}

function getManifestExamList() {
  if (!examManifest || !Array.isArray(examManifest.exams)) {
    return [];
  }

  return examManifest.exams;
}
function isStudentVisibleExam(exam) {
  return !(exam && exam.student_visible === false);
}

function getStudentVisibleManifestExamList() {
  return getManifestExamList().filter(isStudentVisibleExam);
}
function getManifestExamById(examId) {
  const id = String(examId || "").trim();

  if (!id) {
    return null;
  }

  return getManifestExamList().find(function (exam) {
    return String(exam.id || "") === id;
  }) || null;
}

function getManifestExamForModeValue(value) {
  const text = String(value || "").trim();

  if (!text) {
    return getManifestExamById(examManifest && examManifest.default_exam_id);
  }

  const direct = getManifestExamById(text);

  if (direct) {
    return direct;
  }

  const legacyMap = {
    "round-103": "reading-103",
    "level-test-103": "level-test-103",
    "random": "reading-random",
    "level-test-random": "level-test-random"
  };

  if (legacyMap[text]) {
    return getManifestExamById(legacyMap[text]);
  }

  if (text.startsWith("round-")) {
    return getManifestExamById(`reading-${text.replace("round-", "")}`);
  }

  if (text.startsWith("level-test-")) {
    return getManifestExamById(text);
  }

  return null;
}

function getCurrentExamDefinition(preferredMode) {
  const value = preferredMode !== undefined
    ? preferredMode
    : (elements.examModeSelect ? elements.examModeSelect.value : "");

  return getManifestExamForModeValue(value);
}

function manifestExamToGenerationOptions(exam) {
  if (!exam) {
    return null;
  }

  const isLevelTest = exam.exam_type === "level-test";
  const isRandom = exam.selection_type === "random";

  let mode = "round";

  if (isLevelTest && isRandom) {
    mode = "level-test-random";
  } else if (isLevelTest) {
    mode = "level-test-round";
  } else if (isRandom) {
    mode = "random";
  }

  return {
    mode,
    round: exam.round || "",
    label: exam.label || exam.id || ""
  };
}

function manifestExamToRuntimeConfig(exam) {
  const isLevelTest = exam && exam.exam_type === "level-test";
  const totalQuestions = Number(exam && exam.total_questions ? exam.total_questions : (isLevelTest ? 20 : 50));
  const timeLimitMinutes = Number(exam && exam.time_limit_minutes ? exam.time_limit_minutes : (isLevelTest ? 30 : 70));
  const questionStart = Number(exam && exam.question_number_start ? exam.question_number_start : 1);
  const questionEnd = Number(exam && exam.question_number_end ? exam.question_number_end : totalQuestions);

  return {
    testName: isLevelTest ? "TOPIK II 읽기 레벨테스트" : "TOPIK II 읽기",
    testDisplayName: isLevelTest ? "TOPIK II 읽기 레벨테스트" : "TOPIK II 읽기 PBT형 IBT 시뮬레이션",
    testScope: isLevelTest
      ? `TOPIK II 읽기 레벨테스트 ${totalQuestions}문항`
      : `TOPIK II PBT 읽기 ${questionStart}~${questionEnd}번`,
    sectionTitle: isLevelTest ? "읽기 레벨테스트" : "읽기",
    examSubtitle: isLevelTest
      ? `TOPIK II 읽기 레벨테스트 · ${totalQuestions}문항 · ${timeLimitMinutes}분`
      : `TOPIK II 읽기 · ${questionStart}~${questionEnd}번 · ${timeLimitMinutes}분`,
    questionNumberStart: questionStart,
    questionNumberEnd: questionEnd,
    expectedTotalQuestions: totalQuestions,
    timeLimitMinutes,
    timeLimitSeconds: timeLimitMinutes * 60,
    isFull50QuestionSet: Boolean(exam && exam.is_full_50_question_set)
  };
}

function getManifestQuestionFileCandidates(preferredMode, cacheSuffix) {
  const exam = getCurrentExamDefinition(preferredMode);

  if (!exam) {
    return null;
  }

  selectedExamDefinition = exam;

  if (exam.enabled === false) {
    const reason = exam.disabled_reason ? ` ${exam.disabled_reason}` : "";
    const message = `${exam.label || "선택한 시험지"}은 아직 준비 중입니다.${reason}`;

    setNewExamMessage(message, "#d93025");
    return [];
  }

  if (!exam.file) {
    return [];
  }

  return [
    {
      url: `${exam.file}${cacheSuffix}`,
      label: `${exam.label || exam.id} (${exam.file})`
    }
  ];
}
async function loadQuestions(options = {}) {
  const forceReload = Boolean(options.forceReload);
  const preferredMode = options.preferredMode || (elements.examModeSelect ? elements.examModeSelect.value : "round-103");
  const showMessage = Boolean(options.showMessage);

  const randomExam = getCurrentExamDefinition(preferredMode);

  if (!isWrongReviewMode() && isRandomManifestExam(randomExam)) {
    try {
      if (showMessage) {
        setNewExamMessage("여러 회차에서 랜덤 시험지를 만드는 중입니다.", "#5f6368");
      }

      const generatedData = isLevelTestRandomManifestExam(randomExam)
        ? await generateRandomLevelTestFromRoundExams(randomExam, forceReload)
        : await generateRandomExamFromRoundExams(randomExam, forceReload);
      const normalized = normalizeQuestions(generatedData);

      if (!normalized.length) {
        throw new Error("랜덤으로 생성된 문항이 없습니다.");
      }

      questions = normalized;
      sortQuestionsByNumber();
      logRandomExamVerification(questions);
     saveLatestRandomExamQuestions(questions);

     latestExamGenerationOptions = getLoadedExamGenerationOptions(
        questions,
        getSelectedExamGenerationOptions()
      );

      if (ENABLE_RANDOM_VERIFICATION_LOG) {
  console.info(`TOPIK II Reading random exam generated: ${questions.length}`);
}

      setStartMessage("", "#188038");

      if (showMessage) {
        setNewExamMessage("랜덤 시험지가 준비되었습니다.", "#188038");
      }

      return true;
    } catch (error) {
      console.error("랜덤 시험지 생성 실패:", error);

      const message = error && error.message
        ? error.message
        : "랜덤 시험지를 만들지 못했습니다.";

      setStartMessage(message, "#d93025");

      if (showMessage) {
        setNewExamMessage(message, "#d93025");
      }

      return false;
    }
  }
    if (isWrongReviewMode()) {
    const sourceResult = getWrongReviewSourceResult();

    if (isRandomWrongReviewSource(sourceResult)) {
      return loadWrongReviewQuestionsFromStoredRandomExam(showMessage);
    }
  }
  const questionFiles = getQuestionFileCandidates(preferredMode, forceReload);

if (!questionFiles.length) {
    const manifestExam = getCurrentExamDefinition(preferredMode);
    const label = manifestExam ? manifestExam.label : "선택한 시험지";
    const reason = manifestExam && manifestExam.disabled_reason
      ? ` ${manifestExam.disabled_reason}`
      : "";
    const message = `${label}은 아직 준비 중입니다.${reason}`;

    setStartMessage(message, "#d93025");

    if (showMessage) {
      setNewExamMessage(message, "#d93025");
    }

    return false;
  }

  let lastError = null;

  for (const file of questionFiles) {
    try {
            const data = await fetchQuestionFile(file.url);
      const normalized = normalizeQuestions(data);

      if (!normalized.length) {
        throw new Error(`${file.label}에 문항이 없습니다.`);
      }

      let loadedQuestions = normalized;

      if (isWrongReviewMode()) {
        loadedQuestions = filterWrongReviewQuestions(normalized);

        if (!loadedQuestions.length) {
          throw new Error(`${file.label}에서 오답 다시 풀기 문항을 찾지 못했습니다.`);
        }
      }

      questions = loadedQuestions;
      sortQuestionsByNumber();

      if (isWrongReviewMode()) {
        latestExamGenerationOptions = getWrongReviewExamGenerationOptions(questions);
      } else {
          latestExamGenerationOptions = isWrongReviewMode()
    ? getWrongReviewExamGenerationOptions(questions)
    : getLoadedExamGenerationOptions(
        questions,
        getSelectedExamGenerationOptions()
      );
      }

      if (ENABLE_RANDOM_VERIFICATION_LOG) {
  console.info(`TOPIK II Reading questions loaded from ${file.label}: ${questions.length}`);
}

      setStartMessage("", "#188038");

      if (showMessage) {
        setNewExamMessage("선택한 시험지를 불러왔습니다.", "#188038");
      }

      return true;
    } catch (error) {
      lastError = error;
      console.warn(`${file.label}을 불러오지 못했습니다. 다음 파일을 확인합니다.`, error);
    }
  }

  console.error("문항 JSON 로드 실패:", lastError);
  setStartMessage("문항 파일을 불러오지 못했습니다. generated-reading-questions.json, level-test-questions.json, reading-questions.json 위치를 확인하세요.", "#d93025");

  if (showMessage) {
    setNewExamMessage("선택한 시험지를 불러오지 못했습니다. generated-reading-questions.json 또는 level-test-questions.json 파일을 확인하세요.", "#d93025");
  }

  return false;
}
function getWrongReviewQuestionFileCandidates(cacheSuffix) {
  const sourceResult = getWrongReviewSourceResult();

  const sourceExamFile = String(
    sourceResult.source_exam_file ||
    sourceResult.generated_exam_file ||
    ""
  ).trim();

  const sourceExamId = String(
    sourceResult.source_exam_id ||
    sourceResult.generated_exam_id ||
    ""
  ).trim();

  const sourceRound = String(
    sourceResult.generated_exam_round ||
    sourceResult.source_round ||
    ""
  ).trim();

  const sourceLabel = String(
    sourceResult.generated_exam_label ||
    sourceResult.source_exam_label ||
    sourceResult.test_scope ||
    ""
  ).trim();

  const sourceTotalQuestions = Number(
    sourceResult.source_total_questions ||
    sourceResult.total_questions ||
    sourceResult.expected_total_questions ||
    0
  );

  if (sourceExamFile) {
    return [
      {
        url: `${sourceExamFile}${cacheSuffix}`,
        label: sourceExamFile
      }
    ];
  }

  if (sourceExamId) {
    const examById = getManifestExamById(sourceExamId);

    if (examById && examById.file) {
      return [
        {
          url: `${examById.file}${cacheSuffix}`,
          label: examById.label || examById.id
        }
      ];
    }
  }

  const manifestExams = getManifestExamList();

  const exactLabelExam = manifestExams.find(function (exam) {
    return (
      exam.enabled !== false &&
      sourceLabel &&
      (
        String(exam.label || "") === sourceLabel ||
        String(exam.short_label || "") === sourceLabel
      )
    );
  });

  if (exactLabelExam && exactLabelExam.file) {
    return [
      {
        url: `${exactLabelExam.file}${cacheSuffix}`,
        label: exactLabelExam.label || exactLabelExam.id
      }
    ];
  }

  const matchedByRoundAndCount = manifestExams.find(function (exam) {
    return (
      exam.enabled !== false &&
      sourceRound &&
      String(exam.round || "") === sourceRound &&
      Number(exam.total_questions || 0) === sourceTotalQuestions &&
      String(exam.exam_type || "") !== "level-test"
    );
  });

  if (matchedByRoundAndCount && matchedByRoundAndCount.file) {
    return [
      {
        url: `${matchedByRoundAndCount.file}${cacheSuffix}`,
        label: matchedByRoundAndCount.label || matchedByRoundAndCount.id
      }
    ];
  }

  if (sourceRound === "102") {
    return [
      {
        url: `./data/exams/reading-102.json${cacheSuffix}`,
        label: "data/exams/reading-102.json"
      }
    ];
  }

  if (sourceRound === "103") {
    return [
      {
        url: `./data/exams/reading-103.json${cacheSuffix}`,
        label: "data/exams/reading-103.json"
      }
    ];
  }

  return [
    {
      url: `./data/exams/reading-103.json${cacheSuffix}`,
      label: "data/exams/reading-103.json"
    },
    {
      url: `./generated-reading-questions.json${cacheSuffix}`,
      label: "generated-reading-questions.json"
    },
    {
      url: `./reading-questions.json${cacheSuffix}`,
      label: "reading-questions.json"
    }
  ];
}
function isRandomManifestExam(exam) {
  return Boolean(exam && String(exam.selection_type || "") === "random");
}

function makeRandomGeneratedExamId() {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();

  return `TOPIK2-READING-RANDOM-${timestamp}-${randomPart}`;
}

function pickRandomItem(items) {
  if (!Array.isArray(items) || !items.length) {
    return null;
  }

  return items[Math.floor(Math.random() * items.length)];
}

function getRandomSourceRoundExams(randomExam) {
  const targetExamType = String(
    randomExam.random_source_exam_type ||
    randomExam.exam_type ||
    "full"
  );

  const targetSelectionType = String(
    randomExam.random_source_selection_type ||
    "round"
  );

  return getManifestExamList().filter(function (exam) {
    if (!exam || exam.enabled === false) {
      return false;
    }

    if (exam.student_visible === false) {
      return false;
    }

    if (String(exam.exam_type || "") !== targetExamType) {
      return false;
    }

    if (String(exam.selection_type || "") !== targetSelectionType) {
      return false;
    }

    if (!exam.file) {
      return false;
    }

    if (targetExamType === "full") {
      return Boolean(exam.is_full_50_question_set) && Number(exam.total_questions || 0) === 50;
    }

    return Number(exam.total_questions || 0) > 0;
  });
}

function normalizeRandomGroupNumbers(numbers) {
  if (!Array.isArray(numbers)) {
    return [];
  }

  return numbers
    .map(function (number) {
      return Number(number);
    })
    .filter(function (number) {
      return Number.isFinite(number) && number > 0;
    })
    .filter(function (number, index, array) {
      return array.indexOf(number) === index;
    })
    .sort(function (a, b) {
      return a - b;
    });
}

function getRandomPassageGroupNumbers(question, allQuestions) {
  if (!question) {
    return [];
  }

  const directNumbers = normalizeRandomGroupNumbers(question.passage_group_numbers);

  if (directNumbers.length > 1) {
    return directNumbers;
  }

  const passageGroupId = String(question.passage_group_id || "").trim();

  if (passageGroupId) {
    const groupNumbers = allQuestions
      .filter(function (item) {
        return String(item.passage_group_id || "").trim() === passageGroupId;
      })
      .map(function (item) {
        return Number(item.question_number);
      });

    const normalized = normalizeRandomGroupNumbers(groupNumbers);

    if (normalized.length > 1) {
      return normalized;
    }
  }

  return [Number(question.question_number)];
}

function cloneRandomQuestionForExam(question, sourceExam, randomExam, generatedExamId) {
  const cloned = JSON.parse(JSON.stringify(question));
  const questionNumber = Number(cloned.question_number || cloned.original_question_number || 0);
  const sourceRound = String(cloned.source_round || sourceExam.round || "").trim();

  cloned.id = `RAND-${generatedExamId}-R${sourceRound || "MIX"}-Q${String(questionNumber).padStart(3, "0")}`;
  cloned.question_number = questionNumber;
  cloned.original_question_number = Number(cloned.original_question_number || questionNumber);
  cloned.source_round = sourceRound;
  cloned.source_exam_id = sourceExam.id || "";
  cloned.source_exam_file = sourceExam.file || "";
  cloned.source_exam_label = sourceExam.label || "";
  cloned.generated_exam_id = generatedExamId;
  cloned.generated_exam_mode = "random";
  cloned.generated_exam_round = "mixed";
  cloned.generated_exam_label = randomExam.label || "랜덤 50문항 실전시험";
  cloned.template_slot = questionNumber;

  return cloned;
}

async function generateRandomExamFromRoundExams(randomExam, forceReload) {
  const sourceExams = getRandomSourceRoundExams(randomExam);
  const minCount = Number(randomExam.random_source_min_count || 2);

  if (sourceExams.length < minCount) {
    throw new Error(`랜덤 출제에는 최소 ${minCount}개 이상의 회차별 전체 시험지가 필요합니다.`);
  }

  const cacheSuffix = forceReload ? `?v=${Date.now()}` : "";
  const generatedExamId = makeRandomGeneratedExamId();

  const sourceBundles = [];

  for (const sourceExam of sourceExams) {
    const data = await fetchQuestionFile(`${sourceExam.file}${cacheSuffix}`);
    const normalized = normalizeQuestions(data);

    if (!normalized.length) {
      throw new Error(`${sourceExam.label || sourceExam.id} 문항을 불러오지 못했습니다.`);
    }

    sourceBundles.push({
      exam: sourceExam,
      questions: normalized
    });
  }

  const questionStart = Number(randomExam.question_number_start || 1);
  const questionEnd = Number(randomExam.question_number_end || 50);
  const selectedByNumber = new Map();

  for (let slot = questionStart; slot <= questionEnd; slot += 1) {
    if (selectedByNumber.has(slot)) {
      continue;
    }

    const candidates = [];

    sourceBundles.forEach(function (bundle) {
      const slotQuestion = bundle.questions.find(function (question) {
        return Number(question.question_number) === slot;
      });

      if (!slotQuestion) {
        return;
      }

      const groupNumbers = getRandomPassageGroupNumbers(slotQuestion, bundle.questions);

      const conflicts = groupNumbers.some(function (number) {
        return selectedByNumber.has(number);
      });

      if (conflicts) {
        return;
      }

      const groupQuestions = groupNumbers
        .map(function (number) {
          return bundle.questions.find(function (question) {
            return Number(question.question_number) === number;
          });
        })
        .filter(Boolean);

      if (!groupQuestions.length) {
        return;
      }

      candidates.push({
        sourceExam: bundle.exam,
        questions: groupQuestions
      });
    });

    const selected = pickRandomItem(candidates);

    if (!selected) {
      throw new Error(`${slot}번 위치에 넣을 랜덤 후보 문항을 찾지 못했습니다.`);
    }

    selected.questions.forEach(function (question) {
      const number = Number(question.question_number);

      selectedByNumber.set(
        number,
        cloneRandomQuestionForExam(
          question,
          selected.sourceExam,
          randomExam,
          generatedExamId
        )
      );
    });
  }

  const generatedQuestions = [];

  for (let number = questionStart; number <= questionEnd; number += 1) {
    const question = selectedByNumber.get(number);

    if (!question) {
      throw new Error(`랜덤 시험지에서 ${number}번 문항이 누락되었습니다.`);
    }

    generatedQuestions.push(question);
  }

  return generatedQuestions;
}
function isLevelTestRandomManifestExam(exam) {
  return Boolean(
    exam &&
    String(exam.exam_type || "") === "level-test" &&
    String(exam.selection_type || "") === "random"
  );
}

function getLevelTestBlueprintSourceNumber(blueprintQuestion) {
  const candidates = [
    blueprintQuestion.source_question_number,
    blueprintQuestion.original_full_question_number,
    blueprintQuestion.original_question_number,
    blueprintQuestion.template_slot,
    blueprintQuestion.question_number
  ];

  for (const value of candidates) {
    const number = Number(value);

    if (Number.isFinite(number) && number > 0) {
      return number;
    }
  }

  return 0;
}

function getLevelTestBlueprintGroupKey(blueprintQuestion) {
  const groupId = String(
    blueprintQuestion.level_test_group_id ||
    blueprintQuestion.passage_group_id ||
    ""
  ).trim();

  if (groupId) {
    return `group:${groupId}`;
  }

  return `single:${Number(blueprintQuestion.question_number || 0)}`;
}

function groupLevelTestBlueprintQuestions(blueprintQuestions) {
  const groupMap = new Map();

  blueprintQuestions.forEach(function (question) {
    const key = getLevelTestBlueprintGroupKey(question);

    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }

    groupMap.get(key).push(question);
  });

  return Array.from(groupMap.values());
}

function cloneRandomQuestionForLevelTestExam(sourceQuestion, blueprintQuestion, sourceExam, randomExam, generatedExamId) {
  const cloned = JSON.parse(JSON.stringify(sourceQuestion));

  const levelTestSlot = Number(
    blueprintQuestion.question_number ||
    blueprintQuestion.level_test_slot ||
    0
  );

  const sourceNumber = getLevelTestBlueprintSourceNumber(blueprintQuestion) ||
    Number(sourceQuestion.question_number || sourceQuestion.original_question_number || 0);

  const sourceRound = String(sourceQuestion.source_round || sourceExam.round || "").trim();

  cloned.id = `RAND-LT-${generatedExamId}-R${sourceRound || "MIX"}-S${String(levelTestSlot).padStart(2, "0")}-Q${String(sourceNumber).padStart(3, "0")}`;
  cloned.question_number = levelTestSlot;
  cloned.level_test_slot = levelTestSlot;
  cloned.source_question_number = sourceNumber;
  cloned.original_question_number = Number(sourceQuestion.original_question_number || sourceNumber);
  cloned.source_round = sourceRound;
  cloned.source_exam_id = sourceExam.id || "";
  cloned.source_exam_file = sourceExam.file || "";
  cloned.source_exam_label = sourceExam.label || "";
  cloned.generated_exam_id = generatedExamId;
  cloned.generated_exam_mode = "level-test-random";
  cloned.generated_exam_round = "mixed";
  cloned.generated_exam_label = randomExam.label || "랜덤 레벨테스트 20문항";
  cloned.template_slot = levelTestSlot;
  cloned.time_limit_minutes = Number(randomExam.time_limit_minutes || 30);

  /*
    레벨테스트 기준표에 별도 배점이 있으면 그 배점을 우선 사용한다.
    없으면 원본 문항 배점을 그대로 사용한다.
  */
  cloned.points = Number(blueprintQuestion.points || cloned.points || 2);

  return cloned;
}

async function generateRandomLevelTestFromRoundExams(randomExam, forceReload) {
  const sourceExams = getRandomSourceRoundExams(randomExam);
  const minCount = Number(randomExam.random_source_min_count || 2);

  if (sourceExams.length < minCount) {
    throw new Error(`랜덤 레벨테스트에는 최소 ${minCount}개 이상의 회차별 전체 시험지가 필요합니다.`);
  }

  const blueprintExamId = String(randomExam.blueprint_exam_id || "level-test-103").trim();
  const blueprintExam = getManifestExamById(blueprintExamId);

  if (!blueprintExam || !blueprintExam.file) {
    throw new Error("레벨테스트 랜덤 기준 시험지를 찾지 못했습니다.");
  }

  const cacheSuffix = forceReload ? `?v=${Date.now()}` : "";
  const generatedExamId = makeRandomGeneratedExamId();

  const blueprintData = await fetchQuestionFile(`${blueprintExam.file}${cacheSuffix}`);
  const blueprintQuestions = normalizeQuestions(blueprintData)
    .sort(function (a, b) {
      return Number(a.question_number) - Number(b.question_number);
    });

  const expectedTotal = Number(randomExam.total_questions || 20);

  if (blueprintQuestions.length < expectedTotal) {
    throw new Error(`레벨테스트 기준 시험지 문항 수가 부족합니다. 현재 ${blueprintQuestions.length}문항입니다.`);
  }

  const sourceBundles = [];

  for (const sourceExam of sourceExams) {
    const data = await fetchQuestionFile(`${sourceExam.file}${cacheSuffix}`);
    const normalized = normalizeQuestions(data);

    if (!normalized.length) {
      throw new Error(`${sourceExam.label || sourceExam.id} 문항을 불러오지 못했습니다.`);
    }

    sourceBundles.push({
      exam: sourceExam,
      questions: normalized
    });
  }

  const blueprintGroups = groupLevelTestBlueprintQuestions(
    blueprintQuestions.slice(0, expectedTotal)
  );

  const selectedQuestions = [];

  blueprintGroups.forEach(function (blueprintGroup) {
    const candidates = [];

    sourceBundles.forEach(function (bundle) {
      const matchedPairs = [];

      for (const blueprintQuestion of blueprintGroup) {
        const sourceNumber = getLevelTestBlueprintSourceNumber(blueprintQuestion);

        if (!sourceNumber) {
          return;
        }

        const sourceQuestion = bundle.questions.find(function (question) {
          return Number(question.question_number) === sourceNumber;
        });

        if (!sourceQuestion) {
          return;
        }

        matchedPairs.push({
          blueprintQuestion,
          sourceQuestion
        });
      }

      if (matchedPairs.length === blueprintGroup.length) {
        candidates.push({
          sourceExam: bundle.exam,
          pairs: matchedPairs
        });
      }
    });

    const selected = pickRandomItem(candidates);

    if (!selected) {
      const sourceNumbers = blueprintGroup
        .map(getLevelTestBlueprintSourceNumber)
        .filter(Boolean)
        .join(", ");

      throw new Error(`레벨테스트 랜덤 후보를 찾지 못했습니다. 기준 문항: ${sourceNumbers}`);
    }

    selected.pairs.forEach(function (pair) {
      selectedQuestions.push(
        cloneRandomQuestionForLevelTestExam(
          pair.sourceQuestion,
          pair.blueprintQuestion,
          selected.sourceExam,
          randomExam,
          generatedExamId
        )
      );
    });
  });

  selectedQuestions.sort(function (a, b) {
    return Number(a.question_number) - Number(b.question_number);
  });

  if (selectedQuestions.length !== expectedTotal) {
    throw new Error(`랜덤 레벨테스트 문항 수가 맞지 않습니다. 현재 ${selectedQuestions.length}문항입니다.`);
  }

  return selectedQuestions;
}
function getRandomExamSourceRoundCounts(generatedQuestions) {
  return generatedQuestions.reduce(function (acc, question) {
    const round = String(question.source_round || "source_round 없음").trim();
    acc[round] = (acc[round] || 0) + 1;
    return acc;
  }, {});
}

function getRandomExamPassageGroupCheck(generatedQuestions) {
  const groupMap = new Map();

  generatedQuestions.forEach(function (question) {
    const groupId = String(question.passage_group_id || "").trim();

    if (!groupId) {
      return;
    }

    if (!groupMap.has(groupId)) {
      groupMap.set(groupId, []);
    }

    groupMap.get(groupId).push(question);
  });

  const groups = [];

  groupMap.forEach(function (items, groupId) {
    if (items.length <= 1) {
      return;
    }

    const questionNumbers = items
      .map(function (item) {
        return Number(item.question_number);
      })
      .filter(Number.isFinite)
      .sort(function (a, b) {
        return a - b;
      });

    const sourceRounds = items
      .map(function (item) {
        return String(item.source_round || "source_round 없음").trim();
      })
      .filter(function (value, index, array) {
        return array.indexOf(value) === index;
      });

    groups.push({
      passage_group_id: groupId,
      question_numbers: questionNumbers,
      source_rounds: sourceRounds,
      is_mixed_group: sourceRounds.length > 1
    });
  });

  return groups;
}
function logRandomExamVerification(generatedQuestions) {
  if (!ENABLE_RANDOM_VERIFICATION_LOG) {
    return;
  }

  if (!Array.isArray(generatedQuestions) || !generatedQuestions.length) {
    console.warn("TOPIK II Random 검증: 생성된 문항이 없습니다.");
    return;
  }

  const roundCounts = getRandomExamSourceRoundCounts(generatedQuestions);
  const passageGroups = getRandomExamPassageGroupCheck(generatedQuestions);
  const mixedGroups = passageGroups.filter(function (group) {
    return group.is_mixed_group;
  });

  console.info("TOPIK II Random 회차별 문항 수:", roundCounts);
  console.info("TOPIK II Random 공통 지문 세트 검증:", passageGroups);

  if (mixedGroups.length) {
    console.warn("TOPIK II Random 공통 지문 세트가 여러 회차로 섞인 항목:", mixedGroups);
  } else {
    console.info("TOPIK II Random 공통 지문 세트 회차 섞임 없음");
  }
}
function saveLatestRandomExamQuestions(generatedQuestions) {
  if (!Array.isArray(generatedQuestions) || !generatedQuestions.length) {
    return;
  }

  try {
    localStorage.setItem(
      RANDOM_EXAM_QUESTIONS_STORAGE_KEY,
      JSON.stringify(generatedQuestions)
    );
  } catch (error) {
    console.warn("랜덤 시험지 저장 실패:", error);
  }
}

function getStoredLatestRandomExamQuestions() {
  try {
    const raw = localStorage.getItem(RANDOM_EXAM_QUESTIONS_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("저장된 랜덤 시험지를 읽지 못했습니다:", error);
    return [];
  }
}

function isRandomWrongReviewSource(sourceResult) {
  if (!sourceResult || typeof sourceResult !== "object") {
    return false;
  }

  const mode = String(sourceResult.generated_exam_mode || "").trim();
  const examId = String(sourceResult.source_exam_id || "").trim();
  const examFile = String(sourceResult.source_exam_file || "").trim();

  return (
    mode === "random" ||
    mode === "level-test-random" ||
    examId === "reading-random" ||
    examId === "level-test-random" ||
    examFile.includes("generated-random-reading.json") ||
    examFile.includes("generated-level-test-reading.json")
  );
}
function loadWrongReviewQuestionsFromStoredRandomExam(showMessage) {
  const storedQuestions = getStoredLatestRandomExamQuestions();

  if (!storedQuestions.length) {
    const message = "랜덤 오답풀이 원본 저장본이 없습니다. 새 랜덤 시험을 한 번 제출한 뒤 다시 오답풀이를 실행하세요.";

    setStartMessage(message, "#d93025");

    if (showMessage) {
      setNewExamMessage(message, "#d93025");
    }

    return false;
  }

  const normalized = normalizeQuestions(storedQuestions);
  const loadedQuestions = filterWrongReviewQuestions(normalized);

  if (!loadedQuestions.length) {
    const message = "저장된 랜덤 시험지에서 오답 문항을 찾지 못했습니다.";

    setStartMessage(message, "#d93025");

    if (showMessage) {
      setNewExamMessage(message, "#d93025");
    }

    return false;
  }

  questions = loadedQuestions;
  sortQuestionsByNumber();

  latestExamGenerationOptions = getWrongReviewExamGenerationOptions(questions);

  if (ENABLE_RANDOM_VERIFICATION_LOG) {
  console.info(`TOPIK II Random wrong-review questions loaded from localStorage: ${questions.length}`);
}

  setStartMessage("", "#188038");

  if (showMessage) {
    setNewExamMessage("랜덤 시험 오답 문항을 불러왔습니다.", "#188038");
  }

  return true;
}

function isRandomResult(result) {
  const mode = String(result && result.generated_exam_mode || "").trim();

  return mode === "random" || mode === "level-test-random";
}
function getSourceExamFileForWrongReviewStorage(result) {
  if (isRandomResult(result)) {
    return "";
  }

  return selectedExamDefinition ? selectedExamDefinition.file || "" : "";
}

function getSourceExamStorageKeyForWrongReview(result) {
  if (isRandomResult(result)) {
    return RANDOM_EXAM_QUESTIONS_STORAGE_KEY;
  }

  return "";
}
function getQuestionFileCandidates(preferredMode, forceReload) {
  const cacheSuffix = forceReload ? `?v=${Date.now()}` : "";

   if (isWrongReviewMode()) {
    return getWrongReviewQuestionFileCandidates(cacheSuffix);
  }

  const manifestCandidates = getManifestQuestionFileCandidates(preferredMode, cacheSuffix);

  if (manifestCandidates !== null) {
    return manifestCandidates;
  }

  if (isLevelTestModeValue(preferredMode)) {
    return [
      {
        url: `./level-test-questions.json${cacheSuffix}`,
        label: "level-test-questions.json"
      },
      {
        url: `./generated-reading-questions.json${cacheSuffix}`,
        label: "generated-reading-questions.json"
      },
      {
        url: `./reading-questions.json${cacheSuffix}`,
        label: "reading-questions.json"
      }
    ];
  }

  if (preferredMode === "sample") {
    return [
      {
        url: `./reading-questions.json${cacheSuffix}`,
        label: "reading-questions.json"
      },
      {
        url: `./generated-reading-questions.json${cacheSuffix}`,
        label: "generated-reading-questions.json"
      }
    ];
  }

  return [
    {
      url: `./generated-reading-questions.json${cacheSuffix}`,
      label: "generated-reading-questions.json"
    },
    {
      url: `./reading-questions.json${cacheSuffix}`,
      label: "reading-questions.json"
    }
  ];
}

function isWrongReviewMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get("mode") === "wrong-review";
}



function getWrongReviewQuestionNumbers() {
  const storedNumbers = readWrongReviewNumbersFromStorage();

  if (storedNumbers.length > 0) {
    return storedNumbers;
  }

  const fallbackNumbers = readWrongReviewNumbersFromLatestResult();

  if (fallbackNumbers.length > 0) {
    try {
      localStorage.setItem(
        WRONG_REVIEW_STORAGE_KEY,
        JSON.stringify(fallbackNumbers)
      );
    } catch (error) {
      console.warn("오답 문항 번호 자동 저장 실패:", error);
    }

    return fallbackNumbers;
  }

  return [];
}

function readWrongReviewNumbersFromStorage() {
  try {
    const raw = localStorage.getItem(WRONG_REVIEW_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return normalizeWrongReviewQuestionNumbers(parsed);
  } catch (error) {
    console.warn("오답 문항 번호를 읽지 못했습니다:", error);
    return [];
  }
}

function readWrongReviewNumbersFromLatestResult() {
  try {
    const raw = localStorage.getItem(AUTO_DIAGNOSIS_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const result = JSON.parse(raw);
    const items = Array.isArray(result.items) ? result.items : [];

    const wrongNumbers = items
  .filter(function (item) {
    /*
      오답 다시 풀기에서는 미응답도 다시 풀어야 한다.
      따라서 student_answer가 비어 있어도 is_correct가 false이면 포함한다.
    */
    return !item.is_correct;
  })
  .map(function (item) {
    return item.question_number;
  });

    return normalizeWrongReviewQuestionNumbers(wrongNumbers);
  } catch (error) {
    console.warn("최근 시험 결과에서 오답 문항 번호를 만들지 못했습니다:", error);
    return [];
  }
}

function normalizeWrongReviewQuestionNumbers(numbers) {
  return numbers
    .map(function (number) {
      return Number(number);
    })
    .filter(function (number) {
      return Number.isFinite(number) && number >= 1 && number <= 50;
    })
    .filter(function (number, index, array) {
      return array.indexOf(number) === index;
    });
}

function isWrongReviewAnswerEmpty(answer) {
  if (answer === null || answer === undefined || answer === "") {
    return true;
  }

  if (Array.isArray(answer)) {
    return answer.length === 0;
  }

  return false;
}
function filterWrongReviewQuestions(allQuestions) {
  const wrongNumbers = getWrongReviewQuestionNumbers();
  const wrongNumberSet = new Set(wrongNumbers);

  return allQuestions.filter(function (question) {
    return wrongNumberSet.has(Number(question.question_number));
  });
}

function getWrongReviewExamGenerationOptions(loadedQuestions) {
  return {
    mode: "wrong-review",
    round: latestExamGenerationOptions.round || "103",
    label: `오답 다시 풀기 ${loadedQuestions.length}문항`
  };
}

function getLoadedExamGenerationOptions(loadedQuestions, fallback) {
  const base = fallback || {
    mode: "sample",
    round: "103-sample",
    label: "103회 구조 샘플 7문항"
  };

  if (!Array.isArray(loadedQuestions) || loadedQuestions.length === 0) {
    return base;
  }

  const source = loadedQuestions.find(function (question) {
    return question.generated_exam_mode || question.generated_exam_label || question.generated_exam_round;
  });

  if (!source) {
    return base;
  }

  return {
    mode: source.generated_exam_mode || base.mode,
    round: source.generated_exam_round || base.round,
    label: source.generated_exam_label || base.label
  };
}

function setNewExamMessage(text, color) {
  if (!elements.newExamMessage) {
    return;
  }

  elements.newExamMessage.textContent = text || "";
  elements.newExamMessage.style.color = color || "#188038";
}

function bindExamModeButtons() {
  syncExamSelectionStateFromSelect();

  if (elements.examCategoryButtons && elements.examCategoryButtons.length) {
    elements.examCategoryButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        const value = button.getAttribute("data-exam-category-value");

        if (!value) {
          return;
        }

        selectedExamCategory = value;
        selectFirstAvailableExamForCurrentFilters();
      });
    });
  }

  if (elements.examSelectionTypeButtons && elements.examSelectionTypeButtons.length) {
    elements.examSelectionTypeButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        const value = button.getAttribute("data-exam-selection-type-value");

        if (!value) {
          return;
        }

        selectedExamSelectionType = value;
        selectFirstAvailableExamForCurrentFilters();
      });
    });
  }

  /*
    이전 버전의 data-exam-mode-button 구조도 남겨 둔다.
    새 화면에서는 사용하지 않지만, 혹시 HTML이 예전 구조일 때 깨지지 않게 한다.
  */
  if (
    (!elements.examCategoryButtons || !elements.examCategoryButtons.length) &&
    elements.examTypeButtons &&
    elements.examTypeButtons.length
  ) {
    elements.examTypeButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        const value = button.getAttribute("data-exam-mode-value");

        if (!value) {
          return;
        }

        if (elements.examModeSelect) {
          elements.examModeSelect.value = value;
        }

        syncExamSelectionStateFromSelect();
        renderManifestExamDetailOptions();
        updateExamModeButtonState();
        setNewExamMessage(getExamModeStatusMessage(value), "#188038");
      });
    });
  }

  renderManifestExamDetailOptions();
  updateExamModeButtonState();

  if (elements.examModeSelect) {
    setNewExamMessage(getExamModeStatusMessage(elements.examModeSelect.value), "#188038");
  }
}

function syncExamSelectionStateFromSelect() {
  const value = elements.examModeSelect ? elements.examModeSelect.value : "";
  const manifestExam = getCurrentExamDefinition(value);

  if (manifestExam) {
    selectedExamCategory = manifestExam.exam_type || "full";
    selectedExamSelectionType = manifestExam.selection_type || "round";
    selectedExamDefinition = manifestExam;
    return;
  }

  if (isLevelTestModeValue(value)) {
    selectedExamCategory = "level-test";
  } else {
    selectedExamCategory = "full";
  }

  selectedExamSelectionType = String(value || "").includes("random")
    ? "random"
    : "round";
}

function selectFirstAvailableExamForCurrentFilters() {
  const exams = getStudentVisibleManifestExamList().filter(function (exam) {
    return (
      String(exam.exam_type || "") === selectedExamCategory &&
      String(exam.selection_type || "") === selectedExamSelectionType
    );
  });

  if (exams.length) {
    const enabledExam = exams.find(function (exam) {
      return exam.enabled !== false;
    });

    const targetExam = enabledExam || exams[0];

    setExamModeSelectValue(targetExam);
    renderManifestExamDetailOptions();
    updateExamModeButtonState();
    setNewExamMessage(
      getExamModeStatusMessage(targetExam.id),
      targetExam.enabled === false ? "#d93025" : "#188038"
    );

    return;
  }

  const fallbackMap = {
    "full::round": "reading-103",
    "full::random": "reading-random",
    "level-test::round": "level-test-103",
    "level-test::random": "level-test-random"
  };

  const fallbackValue = fallbackMap[`${selectedExamCategory}::${selectedExamSelectionType}`] || "reading-103";

  if (elements.examModeSelect) {
    elements.examModeSelect.value = fallbackValue;
  }

  renderManifestExamDetailOptions();
  updateExamModeButtonState();
  setNewExamMessage(getExamModeStatusMessage(fallbackValue), "#188038");
}

function setExamModeSelectValue(examOrValue) {
  if (!elements.examModeSelect) {
    return;
  }

  if (typeof examOrValue === "object" && examOrValue !== null) {
    const exam = examOrValue;
    const id = String(exam.id || "");
    const label = exam.label || id;

    ensureExamSelectOption(id, label, exam.enabled === false);
    elements.examModeSelect.value = id;
    selectedExamDefinition = exam;
    selectedExamCategory = exam.exam_type || selectedExamCategory;
    selectedExamSelectionType = exam.selection_type || selectedExamSelectionType;
    return;
  }

  elements.examModeSelect.value = String(examOrValue || "");
}

function ensureExamSelectOption(value, label, disabled) {
  if (!elements.examModeSelect || !value) {
    return;
  }

  let option = Array.from(elements.examModeSelect.options).find(function (entry) {
    return entry.value === value;
  });

  if (!option) {
    option = document.createElement("option");
    option.value = value;
    elements.examModeSelect.appendChild(option);
  }

  option.textContent = label || value;
  option.disabled = Boolean(disabled);
}

function renderManifestExamDetailOptions() {
  if (!elements.examDetailOptions) {
    return;
  }

  const exams = getStudentVisibleManifestExamList().filter(function (exam) {
    return (
      String(exam.exam_type || "") === selectedExamCategory &&
      String(exam.selection_type || "") === selectedExamSelectionType
    );
  });

  if (!exams.length) {
    elements.examDetailOptions.innerHTML = `
      <div class="exam-select-note">
        선택 가능한 시험지가 아직 없습니다.
      </div>
    `;
    return;
  }

  const currentValue = elements.examModeSelect ? elements.examModeSelect.value : "";

  let currentExam = exams.find(function (exam) {
    return String(exam.id || "") === String(currentValue);
  });

  if (!currentExam) {
    currentExam = exams.find(function (exam) {
      return exam.enabled !== false;
    }) || exams[0];
  }

  const currentLabel = currentExam
    ? currentExam.label || currentExam.id || "선택된 시험지"
    : "선택된 시험지 없음";

  const listHtml = exams.map(function (exam) {
    const isActive = String(exam.id || "") === String(currentValue);
    const isDisabled = exam.enabled === false;

    const reason = isDisabled && exam.disabled_reason
      ? `<span class="exam-detail-reason">${escapeHtml(exam.disabled_reason)}</span>`
      : "";

    return `
      <button
        type="button"
        class="exam-detail-button ${isActive ? "active" : ""}"
        data-exam-detail-id="${escapeAttribute(exam.id || "")}"
        ${isDisabled ? "disabled" : ""}
      >
        ${escapeHtml(exam.short_label || exam.label || exam.id || "시험지")}
        ${reason}
      </button>
    `;
  }).join("");

  elements.examDetailOptions.innerHTML = `
    <div
      class="exam-detail-current"
      style="
        padding: 10px 12px;
        border: 2px solid #0877f2;
        border-radius: 10px;
        background: #eef6ff;
        text-align: center;
      "
    >
      <div
        style="
          color: #5f6368;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 3px;
        "
      >
        현재 선택 시험지
      </div>

      <div
        style="
          color: #003f8f;
          font-size: 15px;
          font-weight: 900;
          line-height: 1.4;
        "
      >
        ${escapeHtml(currentLabel)}
      </div>
    </div>

    <details
      class="exam-detail-dropdown"
      style="
        margin-top: 8px;
      "
    >
      <summary
        style="
          min-height: 38px;
          padding: 9px 11px;
          border: 1px solid #cfe0f5;
          border-radius: 9px;
          background: #ffffff;
          color: #003f8f;
          font-size: 14px;
          font-weight: 900;
          text-align: center;
          cursor: pointer;
          list-style-position: inside;
        "
      >
        세부 시험지 선택 펼치기
      </summary>

      <div
        style="
          display: grid;
          gap: 6px;
          margin-top: 8px;
        "
      >
        ${listHtml}
      </div>
    </details>
  `;

  elements.examDetailOptions.querySelectorAll("[data-exam-detail-id]").forEach(function (button) {
    button.addEventListener("click", function () {
      const examId = button.getAttribute("data-exam-detail-id");
      const exam = getManifestExamById(examId);

      if (!exam || exam.enabled === false) {
        return;
      }

      setExamModeSelectValue(exam);
      renderManifestExamDetailOptions();
      updateExamModeButtonState();
      setNewExamMessage(getExamModeStatusMessage(exam.id), "#188038");
    });
  });
}

function updateExamModeButtonState() {
  syncExamSelectionStateFromSelect();

  if (elements.examCategoryButtons && elements.examCategoryButtons.length) {
    elements.examCategoryButtons.forEach(function (button) {
      const value = button.getAttribute("data-exam-category-value");
      button.classList.toggle("active", value === selectedExamCategory);
    });
  }

  if (elements.examSelectionTypeButtons && elements.examSelectionTypeButtons.length) {
    elements.examSelectionTypeButtons.forEach(function (button) {
      const value = button.getAttribute("data-exam-selection-type-value");
      button.classList.toggle("active", value === selectedExamSelectionType);
    });
  }

  if (elements.examTypeButtons && elements.examTypeButtons.length) {
    const selectedValue = elements.examModeSelect ? elements.examModeSelect.value : "round-103";

    elements.examTypeButtons.forEach(function (button) {
      const value = button.getAttribute("data-exam-mode-value");
      button.classList.toggle("active", value === selectedValue);
    });
  }

  if (elements.examDetailOptions) {
    const selectedValue = elements.examModeSelect ? elements.examModeSelect.value : "";

    elements.examDetailOptions.querySelectorAll("[data-exam-detail-id]").forEach(function (button) {
      const value = button.getAttribute("data-exam-detail-id");
      button.classList.toggle("active", value === selectedValue);
    });
  }
}

function getExamModeStatusMessage(value) {
  const manifestExam = getManifestExamForModeValue(value);

  if (manifestExam) {
    if (manifestExam.enabled === false) {
      const reason = manifestExam.disabled_reason ? ` ${manifestExam.disabled_reason}` : "";
      return `${manifestExam.label}은 아직 준비 중입니다.${reason}`;
    }

    return `${manifestExam.label}이 선택되었습니다. ${manifestExam.total_questions}문항, ${manifestExam.time_limit_minutes}분으로 진행합니다.`;
  }

  if (isLevelTestModeValue(value)) {
    return "레벨테스트가 선택되었습니다. 대표 유형 20문항, 30분으로 진행합니다.";
  }

  return "50문항 실전 시험이 선택되었습니다. 1~50번, 70분으로 진행합니다.";
}

function isLevelTestModeValue(value) {
  const text = String(value || "");
  return text === "level-test-103" || text === "level-test-random" || text.startsWith("level-test");
}

function isLevelTestResult(result) {
  if (!result || typeof result !== "object") {
    return false;
  }

  const mode = String(result.generated_exam_mode || "");
  const scope = String(result.test_scope || "");
  const label = String(result.generated_exam_label || "");

  return (
    mode.startsWith("level-test") ||
    mode === "level-test" ||
    scope.includes("레벨테스트") ||
    label.includes("레벨테스트")
  );
}

function hasLoadedLevelTestQuestions() {
  return Array.isArray(questions) && questions.some(function (question) {
    const mode = String(question.generated_exam_mode || "");
    const scope = String(question.test_scope || "");
    const label = String(question.generated_exam_label || "");

    return (
      mode.startsWith("level-test") ||
      mode === "level-test" ||
      scope.includes("레벨테스트") ||
      label.includes("레벨테스트") ||
      Number(question.time_limit_minutes) === 30
    );
  });
}

function isCurrentLevelTestMode() {
  const selectedValue = elements.examModeSelect ? elements.examModeSelect.value : "";
  const mode = String(latestExamGenerationOptions.mode || "");
  const label = String(latestExamGenerationOptions.label || "");

  return (
    isLevelTestModeValue(selectedValue) ||
    mode.startsWith("level-test") ||
    mode === "level-test" ||
    label.includes("레벨테스트") ||
    hasLoadedLevelTestQuestions()
  );
}

function getActiveRuntimeConfig() {
  if (isWrongReviewMode()) {
    const sourceResult = getWrongReviewSourceResult();

    if (isLevelTestResult(sourceResult)) {
      return LEVEL_TEST_RUNTIME_CONFIG;
    }

    return FULL_EXAM_RUNTIME_CONFIG;
  }

  const manifestExam = getCurrentExamDefinition();

  if (manifestExam) {
    return manifestExamToRuntimeConfig(manifestExam);
  }

  return isCurrentLevelTestMode()
    ? LEVEL_TEST_RUNTIME_CONFIG
    : FULL_EXAM_RUNTIME_CONFIG;
}

async function fetchQuestionFile(url) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`${url} 파일을 불러오지 못했습니다. 상태 코드: ${response.status}`);
  }

  return response.json();
}

function normalizeQuestions(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(function (question, index) {
    const cloned = { ...question };

    cloned.id = cloned.id || `T2-R${String(index + 1).padStart(3, "0")}`;
    cloned.question_number = Number(cloned.question_number || index + 1);
    cloned.original_question_number = Number(cloned.original_question_number || cloned.question_number);
    cloned.test_level = cloned.test_level || cloned.level || TEST_CONFIG.testLevel;
    cloned.level = cloned.level || cloned.test_level || TEST_CONFIG.testLevel;
    cloned.section = cloned.section || "reading";
    cloned.type = cloned.type || "single_choice";
    cloned.category = cloned.category || "미분류";
    cloned.diagnostic_area = cloned.diagnostic_area || "미분류";
    cloned.question_zone = cloned.question_zone || "";
    cloned.difficulty_band = cloned.difficulty_band || "";
    cloned.instruction = cloned.instruction || cloned.question || "";
    cloned.question = cloned.question || cloned.instruction || "";
    cloned.passage = cloned.passage || "";
    cloned.passage_template = cloned.passage_template || cloned.passage || "";
    cloned.options = normalizeOptions(cloned.options);
    cloned.answer = cloned.answer !== undefined ? cloned.answer : cloned.correct_answer;
    cloned.correct_answer = cloned.correct_answer !== undefined ? cloned.correct_answer : cloned.answer;
    cloned.points = getQuestionPoints(cloned);
    cloned.description = cloned.description || "";
    cloned.image_url = cloned.image_url || "";

    return cloned;
  });
}

function normalizeOptions(options) {
  if (!Array.isArray(options)) {
    return [];
  }

  return options.map(function (option, index) {
    if (typeof option === "string") {
      return {
        label: String(index + 1),
        text: option
      };
    }

    return {
      label: String(option.label || index + 1),
      text: String(option.text || "")
    };
  });
}

function getQuestionPoints(question) {
  const parsed = Number(question.points);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return 2;
}

function sortQuestionsByNumber() {
  questions.sort(function (a, b) {
    return Number(a.question_number) - Number(b.question_number);
  });
}
function getWrongReviewSourceResult() {
  try {
    const raw = localStorage.getItem(WRONG_REVIEW_SOURCE_RESULT_STORAGE_KEY);

    if (raw) {
      return JSON.parse(raw);
    }

    const latestRaw = localStorage.getItem(AUTO_DIAGNOSIS_STORAGE_KEY);

    if (latestRaw) {
      return JSON.parse(latestRaw);
    }
  } catch (error) {
    console.warn("오답 복습 원본 결과를 읽지 못했습니다:", error);
  }

  return {};
}

function autoStartWrongReviewIfPossible() {
  if (!isWrongReviewMode()) {
    return;
  }

  if (!Array.isArray(questions) || !questions.length) {
  if (!elements.startMessage || !elements.startMessage.textContent) {
    setStartMessage("오답 문항을 아직 불러오지 못했습니다. 잠시 후 다시 시도하세요.", "#d93025");
  }
  return;
}

  const sourceResult = getWrongReviewSourceResult();

  const savedName = String(sourceResult.student_name || "").trim();
  const savedPhone = String(sourceResult.student_phone || "").trim();

  if (elements.accessPasswordInput) {
    elements.accessPasswordInput.value = TEST_CONFIG.accessPassword;
  }

  if (elements.studentNameInput) {
    elements.studentNameInput.value = savedName || "오답 복습";
  }

  if (elements.studentPhoneInput) {
    elements.studentPhoneInput.value = savedPhone || "review";
  }

  isAccessVerified = true;

  if (elements.startButton) {
    elements.startButton.disabled = false;
  }

  if (elements.accessConfirmButton) {
    elements.accessConfirmButton.classList.add("verified");
    elements.accessConfirmButton.textContent = "인증 생략";
  }

  startTest();
}
function verifyAccessPassword() {
  const password = String(elements.accessPasswordInput.value || "").trim();

  if (password !== TEST_CONFIG.accessPassword) {
    isAccessVerified = false;
    elements.startButton.disabled = true;

    if (elements.accessConfirmButton) {
      elements.accessConfirmButton.classList.remove("verified");
      elements.accessConfirmButton.textContent = "인증 확인";
    }

    setStartMessage("인증 비밀번호가 올바르지 않습니다.", "#d93025");
    elements.accessPasswordInput.focus();
    return false;
  }

  isAccessVerified = true;
  elements.startButton.disabled = false;

    if (elements.newExamButton) {
    elements.newExamButton.disabled = false;
  }

  if (elements.accessConfirmButton) {
    elements.accessConfirmButton.classList.add("verified");
    elements.accessConfirmButton.textContent = "인증 완료";
  }

  setStartMessage("인증되었습니다. 이름과 전화번호를 입력한 뒤 시험을 시작하세요.", "#188038");
  elements.studentNameInput.focus();
  return true;
}

function resetAccessVerification() {
  isAccessVerified = false;
  elements.startButton.disabled = true;

  if (elements.newExamButton) {
    elements.newExamButton.disabled = true;
  }

  if (elements.newExamMessage) {
    elements.newExamMessage.textContent = "";
  }

  if (elements.accessConfirmButton) {
    elements.accessConfirmButton.classList.remove("verified");
    elements.accessConfirmButton.textContent = "인증 확인";
  }

  setStartMessage("", "#d93025");
}

async function handleNewExamButton() {
  if (!isAccessVerified) {
    setStartMessage("먼저 인증 비밀번호를 확인하세요.", "#d93025");
    return;
  }

  const selectedExam = getSelectedExamGenerationOptions();
  latestExamGenerationOptions = selectedExam;

  setNewExamMessage("선택한 시험지를 불러오는 중입니다.", "#5f6368");

  const success = await loadQuestions({
    forceReload: true,
    preferredMode: elements.examModeSelect ? elements.examModeSelect.value : "sample",
    showMessage: true
  });

  if (!success) {
    return;
  }

  latestExamGenerationOptions = getLoadedExamGenerationOptions(
    questions,
    selectedExam
  );
}

async function startTest() {
  const password = String(elements.accessPasswordInput.value || "").trim();
  const name = String(elements.studentNameInput.value || "").trim();
  const phone = String(elements.studentPhoneInput.value || "").trim();

  if (!isAccessVerified) {
    const verified = verifyAccessPassword();
    if (!verified) {
      return;
    }
  }

  if (!name) {
    setStartMessage("응시자 이름을 입력하세요.", "#d93025");
    elements.studentNameInput.focus();
    return;
  }

  if (!phone) {
    setStartMessage("전화번호를 입력하세요.", "#d93025");
    elements.studentPhoneInput.focus();
    return;
  }

  /*
    일반 시험에서는 시험 시작 직전에
    현재 선택된 시험지를 다시 불러온다.
    이렇게 해야 화면에서 선택한 시험지와 실제 출제 문항이 어긋나지 않는다.
  */
  if (!isWrongReviewMode()) {
    setStartMessage("선택한 시험지를 불러오는 중입니다.", "#5f6368");

    const loaded = await loadQuestions({
      forceReload: true,
      preferredMode: elements.examModeSelect ? elements.examModeSelect.value : "round-103",
      showMessage: false
    });

    if (!loaded) {
      setStartMessage("선택한 시험지를 불러오지 못했습니다. JSON 파일을 확인하세요.", "#d93025");
      return;
    }
  }

  if (!questions.length) {
    setStartMessage("문항을 아직 불러오지 못했습니다. JSON 파일을 확인하세요.", "#d93025");
    return;
  }

  studentName = name;
  studentPhone = phone;
  startedAt = new Date().toISOString();

  latestExamGenerationOptions = isWrongReviewMode()
    ? getWrongReviewExamGenerationOptions(questions)
    : getLoadedExamGenerationOptions(
        questions,
        getSelectedExamGenerationOptions()
      );

  const runtimeConfig = getActiveRuntimeConfig();
  remainingSeconds = runtimeConfig.timeLimitSeconds;

  elements.studentNameDisplay.textContent = studentName;
  elements.studentPhoneDisplay.textContent = studentPhone;

  if (elements.sectionTitle) {
    elements.sectionTitle.textContent = runtimeConfig.sectionTitle;
  }

  if (elements.examSubtitle) {
    elements.examSubtitle.textContent = runtimeConfig.examSubtitle;
  }

  elements.examMetaText.textContent = isWrongReviewMode()
    ? `오답 다시 풀기 · ${latestExamGenerationOptions.label}`
    : `${runtimeConfig.testScope} · ${latestExamGenerationOptions.label}`;

  elements.startScreen.classList.add("hidden");
  elements.resultScreen.classList.add("hidden");
  elements.testScreen.classList.remove("hidden");

  if (isWrongReviewMode()) {
    if (elements.submitButton) {
      elements.submitButton.classList.remove("hidden");
      elements.submitButton.textContent = "오답풀이 종료";
    }

    if (elements.submitFromListButton) {
      elements.submitFromListButton.classList.remove("hidden");
      elements.submitFromListButton.textContent = "오답풀이 종료";
    }
  } else {
    if (elements.submitButton) {
      elements.submitButton.textContent = "제출";
    }

    if (elements.submitFromListButton) {
      elements.submitFromListButton.textContent = "제출";
    }
  }

  currentIndex = 0;
  renderCurrentQuestion();
  startTimer();
}

function getSelectedExamGenerationOptions() {
  const value = elements.examModeSelect ? elements.examModeSelect.value : "round-103";
  const manifestExam = getCurrentExamDefinition(value);
  const manifestOptions = manifestExamToGenerationOptions(manifestExam);

  if (manifestOptions) {
    return manifestOptions;
  }

  if (value === "level-test-103") {
    return {
      mode: "level-test-round",
      round: "103",
      label: "103회 고정 레벨테스트 20문항"
    };
  }

  if (value === "level-test-random") {
    return {
      mode: "level-test-random",
      round: "mixed",
      label: "랜덤 레벨테스트"
    };
  }

  if (value === "round-103") {
    return {
      mode: "round",
      round: "103",
      label: "103회 고정 출제"
    };
  }

  if (value === "sample") {
    return {
      mode: "sample",
      round: "103-sample",
      label: "103회 구조 샘플 7문항"
    };
  }

  if (value === "random") {
    return {
      mode: "random",
      round: "",
      label: "랜덤 출제"
    };
  }

  return {
    mode: "round",
    round: "103",
    label: "103회 고정 출제"
  };
}

function startTimer() {
  clearInterval(timerId);
  updateTimerDisplay();

  timerId = setInterval(function () {
    remainingSeconds -= 1;
    updateTimerDisplay();

    if (remainingSeconds <= 0) {
      clearInterval(timerId);
      alert("시험 시간이 종료되었습니다. 자동 제출합니다.");
      submitTest();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const safeSeconds = Math.max(0, remainingSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  elements.timerDisplay.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  elements.timerCard.classList.remove("warning", "danger");

  if (safeSeconds <= 5 * 60) {
    elements.timerCard.classList.add("danger");
  } else if (safeSeconds <= 10 * 60) {
    elements.timerCard.classList.add("warning");
  }
}
function isSentenceOrderQuestion(question) {
  const type = String(question.type || "").trim();

  return (
    type === "sentence_order_drag" ||
    type === "sentence_order" ||
    type === "sentence_order_choice" ||
    type === "drag_order" ||
    type === "order_sentences" ||
    Array.isArray(question.sentence_blocks) ||
    Array.isArray(question.sentence_items) ||
    Array.isArray(question.order_items)
  );
}

function normalizeSentenceBlockLabel(label, index) {
  const fallbackLabels = ["가", "나", "다", "라"];
  const raw = String(label || fallbackLabels[index] || index + 1).trim();

  return raw
    .replace(/[()\[\]\s]/g, "")
    .replace(/^㉠$/, "가")
    .replace(/^㉡$/, "나")
    .replace(/^㉢$/, "다")
    .replace(/^㉣$/, "라");
}

function getSentenceBlocks(question) {
  let source = [];

  if (Array.isArray(question.sentence_blocks) && question.sentence_blocks.length > 0) {
    source = question.sentence_blocks;
  } else if (Array.isArray(question.sentence_items) && question.sentence_items.length > 0) {
    source = question.sentence_items;
  } else if (Array.isArray(question.order_items) && question.order_items.length > 0) {
    source = question.order_items;
  }

  if ((!source || source.length === 0) && (question.passage_template || question.passage)) {
    source = String(question.passage_template || question.passage || "")
      .split(/\n+/)
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean)
      .slice(0, 4)
      .map(function (line, index) {
        const match = line.match(/^(\([가-라]\)|[가-라]\.|\[[가-라]\]|㉠|㉡|㉢|㉣)\s*(.*)$/);

        return {
          label: match ? normalizeSentenceBlockLabel(match[1], index) : normalizeSentenceBlockLabel("", index),
          text: match ? match[2] : line
        };
      });
  }

  return source.map(function (item, index) {
    if (typeof item === "string") {
      return {
        label: normalizeSentenceBlockLabel("", index),
        text: item
      };
    }

    return {
      label: normalizeSentenceBlockLabel(item.label || item.key || item.id, index),
      text: String(item.text || item.sentence || item.content || "")
    };
  }).filter(function (block) {
    return block.text;
  });
}
function renderCurrentQuestion() {
  const question = questions[currentIndex];

  if (!question) {
    elements.questionInstruction.textContent = "문항을 찾을 수 없습니다.";
    elements.questionStage.innerHTML = "";
    return;
  }

  elements.questionInstruction.innerHTML = emphasizeNegativeFocus(
  escapeHtml(getDisplayInstructionForCurrentMode(question))
);

    if (isSentenceOrderQuestion(question)) {
    renderSentenceOrderQuestion(question);
  } else if (
    question.type === "sentence_insert_interactive" ||
    question.type === "sentence_insert" ||
    question.interaction_mode === "sentence_insert"
  ) {
    renderSentenceInsertQuestion(question);
  } else {
    renderStandardQuestion(question);
  }

  updateNavigationState();
  updateAnswerStatus();
}
function normalizeTextForCompare(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .trim();
}
function removeQuestionGroupPrefix(text) {
  return String(text || "")
    .replace(/^\s*\[\s*\d+\s*(?:~|-|–|—)\s*\d+\s*번?\s*\]\s*/, "")
    .replace(/^\s*\[\s*\d+\s*번?\s*\]\s*/, "")
    .trim();
}

function getCurrentDisplayQuestionNumbers(question) {
  const currentNumber = Number(question && question.question_number || currentIndex + 1);

  const fallbackNumbers = Number.isFinite(currentNumber) && currentNumber > 0
    ? [currentNumber]
    : [currentIndex + 1];

  const groupId = String(question && question.passage_group_id || "").trim();

  /*
    공통 지문 세트는 현재 로드된 시험지 안에서 같은 passage_group_id를 가진
    문항들의 question_number를 기준으로 표시한다.

    이렇게 해야 레벨테스트에서 원본 번호 [19~20번]이 아니라
    현재 화면 번호 [9~10번]처럼 표시된다.
  */
  if (groupId && Array.isArray(questions)) {
    const groupNumbers = questions
      .filter(function (item) {
        return String(item.passage_group_id || "").trim() === groupId;
      })
      .map(function (item) {
        return Number(item.question_number);
      })
      .filter(function (number) {
        return Number.isFinite(number) && number > 0;
      })
      .filter(function (number, index, array) {
        return array.indexOf(number) === index;
      })
      .sort(function (a, b) {
        return a - b;
      });

    if (groupNumbers.length > 1) {
      return groupNumbers;
    }
  }

  /*
    passage_group_numbers가 현재 시험지 번호와 맞을 때만 사용한다.
    레벨테스트에서는 passage_group_numbers에 원본 50문항 번호가 남아 있을 수 있으므로
    현재 문항 번호를 포함하지 않으면 사용하지 않는다.
  */
  if (Array.isArray(question && question.passage_group_numbers)) {
    const directNumbers = question.passage_group_numbers
      .map(function (number) {
        return Number(number);
      })
      .filter(function (number) {
        return Number.isFinite(number) && number > 0;
      })
      .filter(function (number, index, array) {
        return array.indexOf(number) === index;
      })
      .sort(function (a, b) {
        return a - b;
      });

    if (
      directNumbers.length > 1 &&
      directNumbers.includes(currentNumber)
    ) {
      return directNumbers;
    }
  }

  return fallbackNumbers;
}

function getDisplayQuestionNumberLabel(question) {
  const numbers = getCurrentDisplayQuestionNumbers(question);

  if (numbers.length > 1) {
    return `[${numbers[0]}~${numbers[numbers.length - 1]}번]`;
  }

  return `[${numbers[0]}번]`;
}

function getDisplayInstructionForCurrentMode(question) {
  const instruction = String(question && question.instruction || "").trim();
  const displayLabel = getDisplayQuestionNumberLabel(question);

  /*
    기존 지시문에 [13~15], [19~20번], [1번] 같은 번호가 있으면 먼저 제거한다.
    그다음 현재 시험 화면 기준 번호를 다시 붙인다.
  */
  const cleanInstruction = removeQuestionGroupPrefix(instruction || "물음에 답하십시오.");

  if (!cleanInstruction) {
    return `${displayLabel} 물음에 답하십시오.`;
  }

  return `${displayLabel} ${cleanInstruction}`;
}
function getQuestionPromptForPanel(question) {
  const questionText = String(question.question || "").trim();
  const instructionText = String(question.instruction || "").trim();
  const passageText = String(question.passage_template || question.passage || "").trim();
  const typeText = String(question.type || "");
  const categoryText = String(question.category || "");

  const questionLooksSameAsPassage =
    questionText &&
    passageText &&
    normalizeTextForCompare(questionText) === normalizeTextForCompare(passageText);

  if (questionLooksSameAsPassage) {
    if (
      typeText.includes("blank") ||
      categoryText.includes("빈칸") ||
      instructionText.includes("들어갈 말")
    ) {
      return "(     )에 들어갈 말로 가장 알맞은 것을 고르십시오.";
    }

    if (
      categoryText.includes("신문 제목") ||
      instructionText.includes("신문 기사의 제목")
    ) {
      return "다음 신문 기사의 제목을 가장 잘 설명한 것을 고르십시오.";
    }

    if (instructionText) {
      return removeQuestionGroupPrefix(instructionText);
    }

    return "다음을 읽고 물음에 답하십시오.";
  }

   return removeQuestionGroupPrefix(questionText) || removeQuestionGroupPrefix(instructionText) || "다음을 읽고 물음에 답하십시오.";
}
function renderQuestionTextWithNumber(question, promptText) {
  const number = Number(question.question_number || currentIndex + 1);
  const prompt = String(promptText || "").trim();

  return `
    <p class="question-text">
      <strong>[${number}번]</strong>
      ${emphasizeNegativeFocus(escapeHtml(prompt))}
    </p>
  `;
}
function isNewspaperHeadlinePassageQuestion(question) {
  const number = Number(question.question_number || 0);
  const category = String(question.category || "");
  const instruction = String(question.instruction || "");

  return (
    number >= 25 &&
    number <= 27 &&
    (
      category.includes("신문") ||
      category.includes("제목") ||
      instruction.includes("신문 기사의 제목")
    )
  );
}

function getSourceQuestionNumberForDisplayStyle(question) {
  const candidates = [
    question && question.original_question_number,
    question && question.template_slot,
    question && question.question_number
  ];

  for (const value of candidates) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) {
      return number;
    }
  }

  return 0;
}

function hasSourceQuestionNumberInRange(question, start, end) {
  const sourceNumber = getSourceQuestionNumberForDisplayStyle(question);

  if (sourceNumber >= start && sourceNumber <= end) {
    return true;
  }

  const groupNumbers = Array.isArray(question && question.passage_group_numbers)
    ? question.passage_group_numbers.map(Number)
    : [];

  if (groupNumbers.some((number) => number >= start && number <= end)) {
    return true;
  }

  const titleText = [
    question && question.passage_group_title,
    question && question.instruction,
    question && question.generated_exam_label
  ].map((value) => String(value || "")).join(" ");

  return (
    titleText.includes(`${start}~${end}`) ||
    titleText.includes(`${start}-${end}`)
  );
}

function isLongNarrativePassageForDisplay(question) {
  /*
    레벨테스트 랜덤에서는 102회 42~43번이 18번처럼 다시 번호가 매겨질 수 있다.
    따라서 화면 표시 번호(question_number)가 아니라
    original_question_number, template_slot, passage_group_numbers를 함께 확인한다.
  */
  return hasSourceQuestionNumberInRange(question, 42, 43);
}

function applyQuestionSpecificPassageStyle(question) {
  if (isLongNarrativePassageForDisplay(question)) {
    const passageContent = elements.questionStage.querySelector(".passage-panel .passage-content");

    if (passageContent) {
      passageContent.style.setProperty("padding", "14px 22px 20px 22px");
      passageContent.style.setProperty("font-size", "18px");
      passageContent.style.setProperty("line-height", "1.55");
      passageContent.style.setProperty("white-space", "pre-line");
      passageContent.style.setProperty("max-height", "calc(100vh - 275px)");
      passageContent.style.setProperty("overflow-y", "auto");
      passageContent.style.setProperty("word-break", "keep-all");
    }

    return;
  }

  if (!isNewspaperHeadlinePassageQuestion(question)) {
    return;
  }

  const passageContent = elements.questionStage.querySelector(".passage-panel .passage-content");

  if (!passageContent) {
    return;
  }

  passageContent.style.setProperty("font-size", "22px");
  passageContent.style.setProperty("font-weight", "900");
  passageContent.style.setProperty("line-height", "2.05");
  passageContent.style.setProperty("letter-spacing", "-0.2px");

  /*
    25~27번 신문 제목은 지문 영역 가운데가 아니라
    위쪽에서 적당히 내려온 위치에 배치한다.
  */
  passageContent.style.setProperty("padding", "82px 34px 0 34px");
  passageContent.style.setProperty("display", "block");
  passageContent.style.removeProperty("align-items");
  passageContent.style.removeProperty("justify-content");
}
function renderStandardQuestion(question) {
  const passageHtml = renderPassageHtml(question);
  const imageHtml = renderImageHtml(question);
  const visualBoxClass = question.type && question.type.includes("visual") ? " visual-box" : "";
  const hasPassageContent = Boolean(String(passageHtml || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim());
  const shouldShowPassageBox = hasPassageContent;

  elements.questionStage.innerHTML = `
    <div class="reading-layout">
      <section class="passage-panel">
        <div class="panel-label">
          <span>지문 / 자료</span>
          <small>${escapeHtml(question.passage_group_title || "")}</small>
        </div>
        ${imageHtml}
        ${
          shouldShowPassageBox
            ? `<div class="passage-content${visualBoxClass}" data-passage-content="true">
                ${passageHtml}
              </div>`
            : ""
        }
      </section>

      <section class="question-panel">
        <div class="panel-label">
          <span>문제</span>
          <small>${escapeHtml(question.category || "")}</small>
        </div>
        <div class="question-content">
          ${renderQuestionTextWithNumber(question, getQuestionPromptForPanel(question))}
          <div class="options-area">
            ${renderOptionButtons(question)}
          </div>
        </div>
      </section>
    </div>
  `;

  bindOptionButtons(question);
  applyQuestionSpecificPassageStyle(question);
}

function normalizeLongNarrativePassageSpacing(question, source) {
  if (!isLongNarrativePassageForDisplay(question)) {
    return source;
  }

  return String(source || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
function renderPassageHtml(question) {
  let source = question.passage_template || question.passage || "";

  /*
    이미지·안내문 문항에서 지문 텍스트가 비어 있으면
    예전처럼 "자료 이미지 또는 안내문이 표시됩니다."라는 안내 상자를 만들지 않는다.
    실제 자료 이미지만 보이게 해야 5~12번 이미지형 문항 아래의 불필요한 빈 영역이 생기지 않는다.
  */
  if (!String(source || "").trim()) {
    return "";
  }

  source = normalizeLongNarrativePassageSpacing(question, source);
  source = applySharedInsertStateToPassage(question, source);
  source = applyCurrentAnswerInsertToPassage(question, source);

  const htmlWithInsertMarkers = emphasizeInsertMarkers(escapeHtml(source));
  const htmlWithUnderlines = applyUnderlineTargetsToEscapedHtml(question, htmlWithInsertMarkers);

  return emphasizeBlankParenthesesInHtml(htmlWithUnderlines);
}

function emphasizeBlankParenthesesInHtml(html) {
  let result = String(html || "");

  function makeBlankMarkerHtml(rawText) {
    const visibleText = String(rawText || "")
      .replace(/ /g, "&nbsp;")
      .replace(/\t/g, "&nbsp;&nbsp;");

    return `<span class="passage-blank-marker" style="
      display:inline-block;
      color:#d93025;
      -webkit-text-fill-color:#d93025;
      font-weight:900;
      background:#fff3f0;
      border:1px solid #ffb4aa;
      border-radius:7px;
      padding:0 8px;
      margin:0 3px;
      line-height:1.45;
      letter-spacing:2px;
      vertical-align:baseline;
      white-space:nowrap;
    ">${visibleText}</span>`;
  }

  /*
    지문 안의 빈칸 괄호만 강조한다.
    일반 설명 괄호까지 모두 색칠하면 문장 삽입 위치나 일반 괄호까지 과하게 강조될 수 있으므로
    우선 TOPIK 빈칸 표시인 빈 괄호 형태에 적용한다.
  */
  result = result.replace(/\(\s{0,12}\)/g, function (match) {
    return makeBlankMarkerHtml(match);
  });

  result = result.replace(/（\s{0,12}）/g, function (match) {
    return makeBlankMarkerHtml(match);
  });

  return result;
}
function applyUnderlineTargetsToEscapedHtml(question, html) {
  const targets = getUnderlineTargets(question);

  if (!targets.length || !html) {
    return html;
  }

  let result = html;

  targets.forEach(function (target) {
    const cleanTarget = String(target || "").trim();

    if (!cleanTarget) {
      return;
    }

    const escapedTarget = escapeHtml(cleanTarget);
    const pattern = new RegExp(escapeRegExp(escapedTarget), "g");

    result = result.replace(
      pattern,
      `<span style="text-decoration: underline; text-underline-offset: 5px; text-decoration-thickness: 1.5px;">${escapedTarget}</span>`
    );
  });

  return result;
}

function getUnderlineTargets(question) {
  if (!question) {
    return [];
  }

  if (Array.isArray(question.underline_targets)) {
    return question.underline_targets;
  }

  if (Array.isArray(question.underlined_parts)) {
    return question.underlined_parts;
  }

  if (Array.isArray(question.underlineTargets)) {
    return question.underlineTargets;
  }

  return [];
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function applySharedInsertStateToPassage(question, passage) {
  if (!question.passage_group_id) {
    return passage;
  }

  const groupState = sharedInsertState[question.passage_group_id] || {};
  let result = passage;

  Object.keys(groupState).forEach(function (blankKey) {
    const value = groupState[blankKey];

    if (!value) {
      return;
    }

    const marker = `[${blankKey}]`;

    if (result.includes(marker)) {
      result = result.replaceAll(marker, `[[INSERTED:${value}]]`);
      return;
    }

    result = replaceFirstBlankWithSelectedOption(result, value);
  });

  return result;
}

function applyCurrentAnswerInsertToPassage(question, passage) {
  const selectedAnswer = answers[question.id];

  if (!selectedAnswer) {
    return passage;
  }

  if (!isBlankInsertQuestion(question)) {
    return passage;
  }

  const option = getOptionByAnswer(question, selectedAnswer);

  if (!option || !option.text) {
    return passage;
  }

  const blankKey = question.blank_key || "blank_1";

  if (question.passage_group_id) {
    if (!sharedInsertState[question.passage_group_id]) {
      sharedInsertState[question.passage_group_id] = {};
    }

    sharedInsertState[question.passage_group_id][blankKey] = option.text;
  }

  if (passage.includes(`[${blankKey}]`)) {
    return passage.replaceAll(`[${blankKey}]`, `[[INSERTED:${option.text}]]`);
  }

  return replaceFirstBlankWithSelectedOption(passage, option.text);
}

function isBlankInsertQuestion(question) {
  const type = String(question.type || "");
  const category = String(question.category || "");
  const instruction = String(question.instruction || "");

  /*
    passage 안에 ( )가 있다는 이유만으로 빈칸 문항으로 판단하지 않는다.
    20번처럼 19번과 같은 공통 지문을 쓰는 문항도 지문에는 빈칸이 있을 수 있기 때문이다.
  */
  return (
    type.includes("blank") ||
    category.includes("빈칸") ||
    instruction.includes("들어갈 말")
  );
}

function replaceFirstBlankWithSelectedOption(passage, selectedText) {
  const inserted = `[[INSERTED:${selectedText}]]`;

  const blankPatterns = [
    /\(\s{5,}\)/,
    /\(\s{4}\)/,
    /\(\s{3}\)/,
    /\(\s{2}\)/,
    /\(\s{1}\)/,
    /\(\s*\)/,
    /\[blank_1\]/,
    /\[blank\]/i,
    /\[빈칸\]/,
    /_____/,
    /____/,
    /㉠/
  ];

  for (const pattern of blankPatterns) {
    if (pattern.test(passage)) {
      return passage.replace(pattern, inserted);
    }
  }

  return passage;
}

function emphasizeInsertMarkers(html) {
  let result = html;

  result = result.replace(/\[\[INSERTED:([\s\S]*?)\]\]/g, function (_, insertedText) {
    return `<span class="${INSERTED_HIGHLIGHT_CLASS}">${escapeHtml(insertedText)}</span>`;
  });

    result = result.replace(/\[blank_1\]/g, '<span class="blank-placeholder">(　　　　)</span>');
    result = result.replace(/\[blank_2\]/g, '<span class="blank-placeholder">(　　　　)</span>');

  result = result.replace(/\[ㄱ\]/g, '<span class="insert-position" data-position-label="ㄱ">ㄱ</span>');
  result = result.replace(/\[ㄴ\]/g, '<span class="insert-position" data-position-label="ㄴ">ㄴ</span>');
  result = result.replace(/\[ㄷ\]/g, '<span class="insert-position" data-position-label="ㄷ">ㄷ</span>');
  result = result.replace(/\[ㄹ\]/g, '<span class="insert-position" data-position-label="ㄹ">ㄹ</span>');

  return result;
}

function renderImageHtml(question) {
  if (!question.image_url) {
    return "";
  }

  const maxHeight = Number(
    question.image_max_height ||
    question.imageMaxHeight ||
    question.visual_image_max_height ||
    0
  ) || 320;

  const displayWidth = String(
    question.image_display_width ||
    question.imageDisplayWidth ||
    question.visual_image_width ||
    ""
  ).trim();

  const widthStyle = displayWidth
    ? `width:${escapeAttribute(displayWidth)}; max-width:100%;`
    : "max-width:100%; width:auto;";

  return `
    <div class="image-area" style="
      display:flex;
      align-items:center;
      justify-content:center;
      padding:10px 12px;
      margin:0 auto 12px;
      width:100%;
      box-sizing:border-box;
    ">
      <img
        src="${escapeAttribute(question.image_url)}"
        alt="문항 자료 이미지"
        style="
          ${widthStyle}
          max-height:${maxHeight}px;
          height:auto;
          object-fit:contain;
          border:1px solid #e3e6ea;
          border-radius:10px;
          display:block;
        "
      />
    </div>
  `;
}

function renderOptionButtons(question) {
  return question.options.map(function (option) {
    const answerValue = String(option.label);
    const selected = isAnswerSelected(question, answerValue);

    return `
      <button
        type="button"
        class="option-button ${selected ? "selected" : ""}"
        data-answer="${escapeAttribute(answerValue)}"
      >
        <span class="option-label">${escapeHtml(option.label)}</span>
        ${escapeHtml(option.text)}
      </button>
    `;
  }).join("");
}

function bindOptionButtons(question) {
  const buttons = elements.questionStage.querySelectorAll(".option-button");

  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      const selectedAnswer = button.getAttribute("data-answer");
      answers[question.id] = normalizeStudentAnswerValue(selectedAnswer);

     if (
  isBlankInsertQuestion(question) &&
  question.passage_group_id
) {
        const option = getOptionByAnswer(question, selectedAnswer);
        const blankKey = question.blank_key || "blank_1";

        if (!sharedInsertState[question.passage_group_id]) {
          sharedInsertState[question.passage_group_id] = {};
        }

        sharedInsertState[question.passage_group_id][blankKey] = option ? option.text : "";
      }

      renderCurrentQuestion();
    });
  });
}

function normalizeStudentAnswerValue(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  return value;
}

function getOptionByAnswer(question, answerValue) {
  const textValue = String(answerValue);
  return question.options.find(function (option) {
    return String(option.label) === textValue;
  }) || null;
}

function isAnswerSelected(question, answerValue) {
  return String(answers[question.id] || "") === String(answerValue);
}

function normalizeInsertPositionLabelForQuestion(value) {
  const raw = String(value || "")
    .replace(/[()\[\]（）\s]/g, "")
    .trim();

  const markerMap = {
    "ㄱ": "㉠",
    "ㄴ": "㉡",
    "ㄷ": "㉢",
    "ㄹ": "㉣",
    "가": "㉠",
    "나": "㉡",
    "다": "㉢",
    "라": "㉣",
    "1": "㉠",
    "2": "㉡",
    "3": "㉢",
    "4": "㉣"
  };

  return markerMap[raw] || raw;
}

function escapeInsertPositionRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getInsertSentence(question) {
  return String(
    question.insert_sentence ||
    question.sentence_to_insert ||
    question.given_sentence ||
    question.target_sentence ||
    question.sentence ||
    ""
  ).trim();
}

function getSentenceInsertPositionLabels(question) {
  let rawPositions = [];

  if (Array.isArray(question.insert_positions) && question.insert_positions.length > 0) {
    rawPositions = question.insert_positions.map(function (item) {
      if (typeof item === "string") {
        return item;
      }

      return item.label || item.position || item.text || item.value || "";
    });
  } else if (Array.isArray(question.options) && question.options.length > 0) {
    rawPositions = question.options.map(function (option, index) {
      if (typeof option === "string") {
        return option;
      }

      return option.text || option.label || String(index + 1);
    });
  }

  const labels = rawPositions
    .map(normalizeInsertPositionLabelForQuestion)
    .filter(Boolean);

  return labels.length ? labels : ["㉠", "㉡", "㉢", "㉣"];
}

function getInsertPositionLabelByAnswer(question, answerValue) {
  const labels = getSentenceInsertPositionLabels(question);
  const answerNumber = Number(answerValue);

  if (Number.isFinite(answerNumber) && answerNumber >= 1) {
    return labels[answerNumber - 1] || "";
  }

  return normalizeInsertPositionLabelForQuestion(answerValue);
}

function getSentenceInsertMarkerVariants(label) {
  const cleanLabel = normalizeInsertPositionLabelForQuestion(label);

  if (!cleanLabel) {
    return [];
  }

  const reverseMap = {
    "㉠": ["㉠", "ㄱ", "가", "1"],
    "㉡": ["㉡", "ㄴ", "나", "2"],
    "㉢": ["㉢", "ㄷ", "다", "3"],
    "㉣": ["㉣", "ㄹ", "라", "4"]
  };

  const baseLabels = reverseMap[cleanLabel] || [cleanLabel];
  const variants = [];

  baseLabels.forEach(function (base) {
    variants.push(base);
    variants.push(`(${base})`);
    variants.push(`[${base}]`);
    variants.push(`（${base}）`);
  });

  return Array.from(new Set(variants));
}

function makeInlineInsertPositionHtml(label, optionNumber, selectedPosition, insertSentence) {
  const normalizedLabel = normalizeInsertPositionLabelForQuestion(label);
  const normalizedSelected = normalizeInsertPositionLabelForQuestion(selectedPosition);
  const isSelected = normalizedLabel === normalizedSelected;

  const commonStyle = "display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:24px;margin:0 4px;padding:0;border:2px solid #0877f2;border-radius:50%;background:#ffffff;color:#0877f2;font-size:14px;font-weight:900;line-height:1;vertical-align:baseline;";

  if (isSelected && insertSentence) {
    return `<span class="insert-position selected" data-position-label="${escapeAttribute(label)}" style="${commonStyle}background:#eaf4ff;color:#0047b3;">${escapeHtml(label)}</span> <span class="${INSERTED_HIGHLIGHT_CLASS}" style="display:inline;color:#0047b3;font-weight:900;">${escapeHtml(insertSentence)}</span> `;
  }

  return `<button type="button" class="insert-position" data-inline-insert-answer="${optionNumber}" data-position-label="${escapeAttribute(label)}" style="${commonStyle}cursor:pointer;">${escapeHtml(label)}</button>`;
}

function replaceSentenceInsertMarkersInHtml(html, question, selectedPosition, insertSentence) {
  let result = html;
  const positionLabels = getSentenceInsertPositionLabels(question);
  let foundMarker = false;

  positionLabels.forEach(function (label, index) {
    const optionNumber = index + 1;
    const markerVariants = getSentenceInsertMarkerVariants(label);
    const markerHtml = makeInlineInsertPositionHtml(label, optionNumber, selectedPosition, insertSentence);

    for (const marker of markerVariants) {
      const escapedMarker = escapeHtml(marker);
      const pattern = new RegExp(escapeInsertPositionRegExp(escapedMarker), "g");

      if (pattern.test(result)) {
        result = result.replace(pattern, markerHtml);
        foundMarker = true;
        break;
      }
    }
  });

  if (!foundMarker) {
    const fallbackButtons = positionLabels.map(function (label, index) {
      const optionNumber = index + 1;
      return makeInlineInsertPositionHtml(label, optionNumber, selectedPosition, insertSentence);
    }).join(" ");

    result += `
      <div style="margin-top:16px; padding-top:12px; border-top:1px dashed #b9c5d6;">
        ${fallbackButtons}
      </div>
    `;
  }

  return result;
}

function renderSentenceInsertQuestion(question) {
  const selectedAnswer = answers[question.id];
  const selectedPosition = selectedAnswer
    ? getInsertPositionLabelByAnswer(question, selectedAnswer)
    : "";

  const insertSentence = getInsertSentence(question);
  const sourcePassage = String(question.passage_template || question.passage || "")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  let passageHtml = escapeHtml(sourcePassage);
  passageHtml = replaceSentenceInsertMarkersInHtml(
    passageHtml,
    question,
    selectedPosition,
    insertSentence
  );

  const positionLabels = getSentenceInsertPositionLabels(question);

  const positionButtonsHtml = positionLabels.map(function (label, index) {
    const optionNumber = index + 1;
    const selectedClass = Number(selectedAnswer) === optionNumber ? " selected" : "";

    return `
      <button
        type="button"
        class="option-button${selectedClass}"
        data-sentence-insert-answer="${optionNumber}"
      >
        <span class="option-label">${optionNumber}</span>
        ${escapeHtml(label)}
      </button>
    `;
  }).join("");

  elements.questionStage.innerHTML = `
    <div class="reading-layout">
      <section class="passage-panel">
        <div class="panel-label">
          <span>지문</span>
          <small>문장 삽입</small>
        </div>
        <div class="passage-content" data-passage-content="true" style="
          font-size:18px;
          line-height:2.05;
          min-height:360px;
        ">
          ${passageHtml}
        </div>
      </section>

      <section class="question-panel">
        <div class="panel-label">
          <span>문제</span>
          <small>${escapeHtml(question.category || "")}</small>
        </div>

        <div class="question-content">
          <div class="insert-sentence-box" style="
            border:1px solid #b9d8ff;
            border-radius:12px;
            background:#e9f3ff;
            padding:13px 14px;
            margin-bottom:16px;
          ">
            <div style="
              color:#0047b3;
              font-size:18px;
              line-height:1.7;
              font-weight:900;
            ">
              ${escapeHtml(insertSentence || "주어진 문장을 입력하세요.")}
            </div>
          </div>

          ${renderQuestionTextWithNumber(
            question,
            question.question || "주어진 문장이 들어갈 곳으로 가장 알맞은 것을 고르십시오."
          )}

          <div class="options-area">
            ${positionButtonsHtml}
          </div>
        </div>
      </section>
    </div>
  `;

  elements.questionStage.querySelectorAll("[data-sentence-insert-answer]").forEach(function (button) {
    button.addEventListener("click", function () {
      const answerValue = button.getAttribute("data-sentence-insert-answer");
      answers[question.id] = normalizeStudentAnswerValue(answerValue);
      renderCurrentQuestion();
    });
  });

  elements.questionStage.querySelectorAll("[data-inline-insert-answer]").forEach(function (button) {
    button.addEventListener("click", function () {
      const answerValue = button.getAttribute("data-inline-insert-answer");
      answers[question.id] = normalizeStudentAnswerValue(answerValue);
      renderCurrentQuestion();
    });
  });
}

function getSentenceOrderOptionOrders(question) {
  if (!Array.isArray(question.options)) {
    return [];
  }

  return question.options
    .map(function (option) {
      const text = typeof option === "string"
        ? option
        : String(option.text || "");

      const parsed = parseSentenceOrderLabelsFromText(text);

      return parsed
        .slice(0, 4)
        .map(function (label) {
          return normalizeSentenceBlockLabel(label);
        });
    })
    .filter(function (order) {
      if (order.length !== 4) {
        return false;
      }

      const unique = Array.from(new Set(order));

      if (unique.length !== 4) {
        return false;
      }

      return order.every(function (label) {
        return Boolean(findSentenceBlock(question, label));
      });
    });
}

function getFirstOrderCandidates(question) {
  const optionOrders = getSentenceOrderOptionOrders(question);
  const candidates = [];

  optionOrders.forEach(function (order) {
    const label = normalizeSentenceBlockLabel(order[0]);

    if (label && !candidates.includes(label)) {
      candidates.push(label);
    }
  });

  return candidates;
}

function getSecondOrderCandidates(question, firstLabel) {
  const cleanFirst = normalizeSentenceBlockLabel(firstLabel);
  const optionOrders = getSentenceOrderOptionOrders(question);
  const candidates = [];

  optionOrders.forEach(function (order) {
    if (normalizeSentenceBlockLabel(order[0]) !== cleanFirst) {
      return;
    }

    const secondLabel = normalizeSentenceBlockLabel(order[1]);

    if (secondLabel && !candidates.includes(secondLabel)) {
      candidates.push(secondLabel);
    }
  });

  return candidates;
}

function getAutoCompletedOrderFromFirstAndSecond(question, firstLabel, secondLabel) {
  const cleanFirst = normalizeSentenceBlockLabel(firstLabel);
  const cleanSecond = normalizeSentenceBlockLabel(secondLabel);

  const matchedOrder = getSentenceOrderOptionOrders(question).find(function (order) {
    return (
      normalizeSentenceBlockLabel(order[0]) === cleanFirst &&
      normalizeSentenceBlockLabel(order[1]) === cleanSecond
    );
  });

  if (matchedOrder) {
    return matchedOrder;
  }

  const used = new Set([cleanFirst, cleanSecond]);

  const remaining = getSentenceBlocks(question)
    .map(function (block) {
      return normalizeSentenceBlockLabel(block.label);
    })
    .filter(function (label) {
      return label && !used.has(label);
    });

  return [cleanFirst, cleanSecond].concat(remaining).slice(0, 4);
}

function getValidFirstOrderLabel(question, currentOrder) {
  const selectedFirst = normalizeSentenceBlockLabel(
    Array.isArray(currentOrder) ? currentOrder[0] : ""
  );

  if (!selectedFirst) {
    return "";
  }

  return findSentenceBlock(question, selectedFirst) ? selectedFirst : "";
}

function renderFirstOrderCandidateButtons(question, currentOrder) {
  const candidates = getFirstOrderCandidates(question);

  if (candidates.length < 2) {
    return `
      <div class="order-card-list" id="orderSourceList">
        ${getSentenceBlocks(question).map(renderSentenceCard).join("")}
      </div>
    `;
  }

  const columnCount = Math.min(candidates.length, 2);

  return `
    <div style="
      display: grid;
      grid-template-columns: repeat(${columnCount}, minmax(0, 1fr));
      gap: 12px;
    ">
      ${candidates.map(function (label) {
        const cleanLabel = normalizeSentenceBlockLabel(label);
        const block = findSentenceBlock(question, cleanLabel);

        return `
          <button
            type="button"
            class="first-order-candidate-button"
            data-first-order-label="${escapeAttribute(cleanLabel)}"
            style="
              min-height: 108px;
              padding: 16px 17px;
              border-radius: 10px;
              border: 2px solid #b8c7d9;
              background: #ffffff;
              color: #003f8f;
              font-weight: 900;
              cursor: pointer;
              text-align: left;
              line-height: 1.55;
            "
          >
            <span style="
              display:block;
              margin-bottom: 8px;
              color:#003f8f;
              font-size:19px;
              font-weight:900;
            ">
              (${escapeHtml(cleanLabel)})로 시작
            </span>

            <span style="
              display:block;
              color:#111827;
              font-size:19px;
              font-weight:900;
              line-height:1.6;
            ">
              (${escapeHtml(cleanLabel)}) ${block ? escapeHtml(block.text) : ""}
            </span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}
function renderSecondOrderCandidateButtons(question, currentOrder) {
  const firstLabel = getValidFirstOrderLabel(question, currentOrder);
  const firstBlock = findSentenceBlock(question, firstLabel);
  const candidates = getSecondOrderCandidates(question, firstLabel);
  const columnCount = Math.min(Math.max(candidates.length, 1), 2);

  if (!candidates.length) {
    return `
      <div style="
        padding: 16px;
        border: 1px solid #e3e6ea;
        border-radius: 10px;
        background: #ffffff;
        color: #555;
        font-size: 17px;
        font-weight: 800;
        line-height: 1.6;
      ">
        두 번째 문장 후보를 찾지 못했습니다. 문항 데이터를 확인하세요.
      </div>

      <button
        type="button"
        id="changeFirstOrderButton"
        style="
          width: 100%;
          margin-top: 10px;
          padding: 12px 14px;
          border: 2px solid #d93025;
          border-radius: 10px;
          background: #ffffff;
          color: #d93025;
          font-size: 17px;
          font-weight: 900;
          cursor: pointer;
        "
      >
        처음부터 다시 선택
      </button>
    `;
  }

  return `
    <div style="
      margin: 0 0 10px;
      padding: 12px 15px;
      border: 1px solid #b9d8ff;
      border-radius: 10px;
      background: #f8fbff;
      color: #111827;
    ">
      <div style="
        color:#003f8f;
        margin-bottom:4px;
        font-size:16px;
        font-weight:900;
      ">
        선택한 첫 번째 문장
      </div>
      <div style="
        font-size:18px;
        font-weight:900;
        line-height:1.55;
      ">
        (${escapeHtml(firstLabel)}) ${firstBlock ? escapeHtml(firstBlock.text) : ""}
      </div>
    </div>

    <div style="
      display: grid;
      grid-template-columns: repeat(${columnCount}, minmax(0, 1fr));
      gap: 10px;
    ">
      ${candidates.map(function (label) {
        const cleanLabel = normalizeSentenceBlockLabel(label);
        const block = findSentenceBlock(question, cleanLabel);
        const autoOrder = getAutoCompletedOrderFromFirstAndSecond(question, firstLabel, cleanLabel);

        return `
          <button
            type="button"
            class="second-order-candidate-button"
            data-second-order-label="${escapeAttribute(cleanLabel)}"
            style="
              min-height: 104px;
              padding: 14px 16px;
              border-radius: 10px;
              border: 2px solid #b8c7d9;
              background: #ffffff;
              color: #003f8f;
              font-weight: 900;
              cursor: pointer;
              text-align: left;
              line-height: 1.5;
            "
          >
            <span style="
              display:block;
              margin-bottom: 7px;
              color:#003f8f;
              font-size:18px;
              font-weight:900;
            ">
              (${escapeHtml(cleanLabel)})를 두 번째로 선택
            </span>

            <span style="
              display:block;
              color:#111827;
              font-size:18px;
              font-weight:900;
              line-height:1.55;
            ">
              (${escapeHtml(cleanLabel)}) ${block ? escapeHtml(block.text) : ""}
            </span>

            <span style="
              display:block;
              margin-top:8px;
              color:#5f6368;
              font-size:14px;
              font-weight:800;
            ">
              완성 순서: ${autoOrder.map(function (item) {
                return "(" + escapeHtml(item) + ")";
              }).join("-")}
            </span>
          </button>
        `;
      }).join("")}
    </div>

    <button
      type="button"
      id="changeFirstOrderButton"
      style="
        width: 100%;
        margin-top: 10px;
        padding: 12px 14px;
        border: 2px solid #d93025;
        border-radius: 10px;
        background: #ffffff;
        color: #d93025;
        font-size: 17px;
        font-weight: 900;
        cursor: pointer;
      "
    >
      처음부터 다시 선택
    </button>
  `;
}
function updateSentenceOrderAnswerState(question, currentOrder) {
  const normalizedOrder = (currentOrder || [])
    .slice(0, 4)
    .map(function (label) {
      return label ? normalizeSentenceBlockLabel(label) : null;
    });

  sentenceOrderAnswers[question.id] = normalizedOrder;

  const completedOrder = normalizedOrder.filter(Boolean);

  if (completedOrder.length === 4) {
    answers[question.id] = completedOrder;
  } else {
    delete answers[question.id];
  }
}

function setFirstOrderCandidate(question, label) {
  const cleanLabel = normalizeSentenceBlockLabel(label);

  if (!cleanLabel) {
    return;
  }

  const currentOrder = [null, null, null, null];

  currentOrder[0] = cleanLabel;

  updateSentenceOrderAnswerState(question, currentOrder);
  renderCurrentQuestion();
}
function setSecondOrderCandidate(question, label) {
  const currentOrder = sentenceOrderAnswers[question.id] || [];
  const firstLabel = getValidFirstOrderLabel(question, currentOrder);
  const secondLabel = normalizeSentenceBlockLabel(label);

  if (!firstLabel || !secondLabel) {
    return;
  }

  const completedOrder = getAutoCompletedOrderFromFirstAndSecond(
    question,
    firstLabel,
    secondLabel
  );

  updateSentenceOrderAnswerState(question, completedOrder);
  renderCurrentQuestion();
}
function renderSentenceOrderQuestion(question) {
  const sentenceBlocks = getSentenceBlocks(question);
  let currentOrder = sentenceOrderAnswers[question.id] || [];

  const selectedFirst = getValidFirstOrderLabel(question, currentOrder);
  const hasSelectedFirst = Boolean(selectedFirst);
  const hasCompletedOrder = currentOrder.filter(Boolean).length === 4;

  if (!hasSelectedFirst && currentOrder.some(Boolean)) {
    currentOrder = [];
    sentenceOrderAnswers[question.id] = [];
    delete answers[question.id];
  }

  let rightPanelContent = "";

  if (!hasSelectedFirst) {
    rightPanelContent = renderFirstOrderCandidateButtons(question, currentOrder);
  } else if (!hasCompletedOrder) {
    rightPanelContent = renderSecondOrderCandidateButtons(question, currentOrder);
  } else {
    rightPanelContent = `
      <div style="
        margin: 0 0 14px;
        padding: 15px 16px;
        border: 2px solid #0877f2;
        border-radius: 12px;
        background: #eef6ff;
        color: #003f8f;
        font-size: 18px;
        font-weight: 900;
        line-height: 1.65;
      ">
        선택한 두 문장을 기준으로 순서가 자동 완성되었습니다.<br />
        완성 순서:
        ${currentOrder.map(function (label) {
          return "(" + escapeHtml(normalizeSentenceBlockLabel(label)) + ")";
        }).join("-")}
      </div>

      <button
        type="button"
        id="changeFirstOrderButton"
        style="
          width: 100%;
          margin-top: 12px;
          padding: 12px 14px;
          border: 2px solid #d93025;
          border-radius: 10px;
          background: #ffffff;
          color: #d93025;
          font-size: 17px;
          font-weight: 900;
          cursor: pointer;
        "
      >
        다시 선택
      </button>
    `;
  }

  elements.questionStage.innerHTML = `
    <div class="order-layout">
      <section class="order-target">
        <div class="panel-label">
          <span>학생 배열</span>
          <small>문장 순서</small>
        </div>

        <div class="order-slot-list">
          ${[0, 1, 2, 3].map(function (index) {
            return renderOrderSlot(question, index, currentOrder[index]);
          }).join("")}
        </div>
      </section>

      <section class="order-source">
        <div class="panel-label">
          <span>선택지 문장</span>
          <small>문장 순서</small>
        </div>

        <div style="
          margin: 0 0 14px;
          padding: 13px 15px;
          border: 1px solid #d7e1ec;
          border-radius: 10px;
          background: #ffffff;
          font-size: 20px;
          font-weight: 900;
          line-height: 1.6;
          color: #111827;
        ">
          <strong>[${question.question_number}번]</strong>
          다음을 순서에 맞게 배열하십시오.
        </div>

        <div style="
          margin: 0;
          padding: 14px 16px;
          border: 1px solid #b9d8ff;
          border-radius: 12px;
          background: #f8fbff;
        ">
          ${rightPanelContent}
        </div>
      </section>
    </div>
  `;

  bindSentenceOrderEvents(question);
}

function renderSentenceCard(block) {
  const cleanLabel = normalizeSentenceBlockLabel(block.label);

  return `
    <div
      class="sentence-card"
      draggable="true"
      data-sentence-label="${escapeAttribute(cleanLabel)}"
      style="
        padding: 14px 16px;
        border-radius: 10px;
        font-size: 18px;
        line-height: 1.65;
        font-weight: 900;
      "
    >
      <strong>(${escapeHtml(cleanLabel)})</strong> ${escapeHtml(block.text)}
    </div>
  `;
}

function renderOrderSlot(question, index, label) {
  const cleanLabel = label ? normalizeSentenceBlockLabel(label) : "";
  const block = findSentenceBlock(question, cleanLabel);
  const filled = block ? "filled" : "";

  return `
    <div class="order-slot ${filled}" data-slot-index="${index}">
      <span class="order-slot-label">${index + 1}번째 문장</span>
      ${
        block
          ? `<div
              class="sentence-card"
              draggable="true"
              data-sentence-label="${escapeAttribute(cleanLabel)}"
              style="
                padding: 14px 16px;
                border-radius: 10px;
                font-size: 18px;
                line-height: 1.65;
                font-weight: 900;
              "
            >
              <strong>(${escapeHtml(cleanLabel)})</strong> ${escapeHtml(block.text)}
            </div>`
          : "자동 입력 대기"
      }
    </div>
  `;
}

function bindSentenceOrderEvents(question) {
  const allCards = elements.questionStage.querySelectorAll(".sentence-card");
  const sourceCards = elements.questionStage.querySelectorAll("#orderSourceList .sentence-card");
  const slots = elements.questionStage.querySelectorAll(".order-slot");
  const firstOrderButtons = elements.questionStage.querySelectorAll(".first-order-candidate-button");
  const secondOrderButtons = elements.questionStage.querySelectorAll(".second-order-candidate-button");
  const changeFirstOrderButton = document.getElementById("changeFirstOrderButton");

  firstOrderButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      const label = button.getAttribute("data-first-order-label");
      setFirstOrderCandidate(question, label);
    });
  });
    secondOrderButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      const label = button.getAttribute("data-second-order-label");
      setSecondOrderCandidate(question, label);
    });
  });

  allCards.forEach(function (card) {
    card.addEventListener("dragstart", function (event) {
      event.dataTransfer.setData("text/plain", card.getAttribute("data-sentence-label"));
    });
  });

  sourceCards.forEach(function (card) {
    card.addEventListener("click", function () {
      const label = card.getAttribute("data-sentence-label");
      putSentenceIntoFirstEmptySlot(question, label);
    });
  });

  slots.forEach(function (slot) {
    slot.addEventListener("dragover", function (event) {
      event.preventDefault();
    });

    slot.addEventListener("drop", function (event) {
      event.preventDefault();
      const label = event.dataTransfer.getData("text/plain");
      const slotIndex = Number(slot.getAttribute("data-slot-index"));
      putSentenceIntoSlot(question, label, slotIndex);
    });

    slot.addEventListener("dblclick", function () {
      const slotIndex = Number(slot.getAttribute("data-slot-index"));
      clearOrderSlot(question, slotIndex);
    });
  });

  if (changeFirstOrderButton) {
    changeFirstOrderButton.addEventListener("click", function () {
      sentenceOrderAnswers[question.id] = [];
      delete answers[question.id];
      renderCurrentQuestion();
    });
  }
}

function putSentenceIntoFirstEmptySlot(question, label) {
  const currentOrder = sentenceOrderAnswers[question.id] || [];
  let targetIndex = currentOrder.findIndex(function (value, index) {
    return index > 0 && !value;
  });

  if (targetIndex === -1) {
    targetIndex = currentOrder.length < 4 ? currentOrder.length : 1;
  }

  putSentenceIntoSlot(question, label, targetIndex);
}

function putSentenceIntoSlot(question, label, slotIndex) {
  const cleanLabel = normalizeSentenceBlockLabel(label);

  if (!cleanLabel) {
    return;
  }

  const currentOrder = sentenceOrderAnswers[question.id] || [];

  for (let i = 0; i < currentOrder.length; i += 1) {
    if (normalizeSentenceBlockLabel(currentOrder[i]) === cleanLabel) {
      currentOrder[i] = null;
    }
  }

  currentOrder[slotIndex] = cleanLabel;

  updateSentenceOrderAnswerState(question, currentOrder);
  renderCurrentQuestion();
}

function clearOrderSlot(question, slotIndex) {
  const currentOrder = sentenceOrderAnswers[question.id] || [];

  currentOrder[slotIndex] = null;

  updateSentenceOrderAnswerState(question, currentOrder);
  renderCurrentQuestion();
}

function findSentenceBlock(question, label) {
  if (!label) {
    return null;
  }

  const cleanLabel = normalizeSentenceBlockLabel(label);
  const sentenceBlocks = getSentenceBlocks(question);

  return sentenceBlocks.find(function (block) {
    return normalizeSentenceBlockLabel(block.label) === cleanLabel;
  }) || null;
}

function goToPreviousQuestion() {
  if (currentIndex <= 0) {
    return;
  }

  currentIndex -= 1;
  renderCurrentQuestion();
}

function goToNextQuestion() {
  if (currentIndex >= questions.length - 1) {
    return;
  }

  currentIndex += 1;
  renderCurrentQuestion();
}

function goToQuestion(index) {
  if (index < 0 || index >= questions.length) {
    return;
  }

  currentIndex = index;
  closeQuestionList();
  renderCurrentQuestion();
}

function updateNavigationState() {
  const isFirstQuestion = currentIndex <= 0;
  const isLastQuestion = currentIndex >= questions.length - 1;
  const wrongReviewMode = isWrongReviewMode();

  elements.prevButton.disabled = isFirstQuestion;

  if (wrongReviewMode) {
    /*
      오답풀이 모드에서는 마지막 문항이 아니어도
      학생이 언제든지 복습을 종료할 수 있어야 한다.
    */
    elements.nextButton.classList.toggle("hidden", isLastQuestion);
    elements.nextButton.disabled = isLastQuestion;

    elements.submitButton.classList.remove("hidden");
    elements.submitButton.textContent = "오답풀이 종료";

    if (elements.submitFromListButton) {
      elements.submitFromListButton.classList.remove("hidden");
      elements.submitFromListButton.textContent = "오답풀이 종료";
    }

    return;
  }

  /*
    일반 50문항 시험에서는 기존 방식 유지:
    마지막 문항에서만 제출 버튼을 보이게 한다.
  */
  if (isLastQuestion) {
    elements.nextButton.classList.add("hidden");
    elements.submitButton.classList.remove("hidden");
    elements.submitButton.textContent = "제출";
  } else {
    elements.nextButton.classList.remove("hidden");
    elements.nextButton.disabled = false;
    elements.submitButton.classList.add("hidden");
    elements.submitButton.textContent = "제출";
  }

  if (elements.submitFromListButton) {
    elements.submitFromListButton.classList.toggle("hidden", !isLastQuestion);
    elements.submitFromListButton.textContent = "제출";
  }
}

function updateAnswerStatus() {
  const totalCount = questions.length;
  const currentScreenNumber = totalCount > 0 ? currentIndex + 1 : 0;

  if (elements.answerStatusText) {
    elements.answerStatusText.textContent = `${currentScreenNumber} / ${totalCount}`;
  }

  if (elements.sidebarStatusText) {
    elements.sidebarStatusText.textContent = "";
  }
}

function getAnsweredCount() {
  return questions.filter(function (question) {
    return isQuestionAnswered(question);
  }).length;
}

function isQuestionAnswered(question) {
  const answer = answers[question.id];

  if (Array.isArray(answer)) {
    return answer.filter(Boolean).length > 0;
  }

  return answer !== undefined && answer !== null && answer !== "";
}

function openQuestionList() {
  renderQuestionList();
  elements.questionListBackdrop.classList.remove("hidden");
}

function closeQuestionList() {
  elements.questionListBackdrop.classList.add("hidden");
}

function renderQuestionList() {
  elements.progressArea.innerHTML = questions.map(function (question, index) {
    const answered = isQuestionAnswered(question);
    const current = index === currentIndex;

    return `
      <button
        type="button"
        class="question-dot ${answered ? "answered" : ""} ${current ? "current" : ""}"
        data-question-index="${index}"
      >
        ${question.question_number}
      </button>
    `;
  }).join("");

  elements.progressArea.querySelectorAll(".question-dot").forEach(function (button) {
    button.addEventListener("click", function () {
      goToQuestion(Number(button.getAttribute("data-question-index")));
    });
  });
}

function requestSubmit() {
  const unanswered = questions.filter(function (question) {
    return !isQuestionAnswered(question);
  });

  let message = "시험을 제출하시겠습니까?";

  if (unanswered.length) {
    message = `미응답 문항이 ${unanswered.length}개 있습니다.\n그래도 제출하시겠습니까?`;
  }

  if (confirm(message)) {
    submitTest();
  }
}

function submitTest() {
  clearInterval(timerId);

  submittedAt = new Date().toISOString();
  latestResult = buildResultObject();
  latestResultText = buildResultText(latestResult);

  if (isWrongReviewMode()) {
    saveWrongReviewProgress(latestResult);
  } else {
    /*
      일반 50문항 시험 제출 시:
      - 진단 보고서용 결과는 topik2_latest_reading_result에 저장한다.
      - 오답풀이용 문항 번호도 함께 저장한다.
      - 미응답 문항도 is_correct가 false이므로 오답풀이 대상에 포함한다.
    */
    const initialWrongReviewNumbers = getRemainingWrongQuestionNumbersFromResult(latestResult);

    try {
      localStorage.setItem(AUTO_DIAGNOSIS_STORAGE_KEY, JSON.stringify(latestResult));

      localStorage.setItem(
        WRONG_REVIEW_STORAGE_KEY,
        JSON.stringify(initialWrongReviewNumbers)
      );

      localStorage.setItem(
        WRONG_REVIEW_SOURCE_RESULT_STORAGE_KEY,
        JSON.stringify({
          student_name: latestResult.student_name || "",
          student_phone: latestResult.student_phone || "",
          source_total_questions: latestResult.total_questions || 0,
          source_correct_count: latestResult.correct_count || 0,
          source_wrong_count: initialWrongReviewNumbers.length,
          source_unanswered_count: latestResult.unanswered_count || 0,
          source_submitted_at: latestResult.submitted_at || "",
          generated_exam_mode: latestResult.generated_exam_mode || "",
          generated_exam_round: latestResult.generated_exam_round || "",
          generated_exam_label: latestResult.generated_exam_label || "",
          source_exam_id: selectedExamDefinition ? selectedExamDefinition.id || "" : "",
          source_exam_file: getSourceExamFileForWrongReviewStorage(latestResult),
         source_exam_storage_key: getSourceExamStorageKeyForWrongReview(latestResult),
         source_exam_label: selectedExamDefinition ? selectedExamDefinition.label || "" : ""
        })
      );
    } catch (error) {
      console.warn("localStorage 저장 실패:", error);
    }
  }

  renderResultScreen(latestResult);

  elements.testScreen.classList.add("hidden");
  elements.resultScreen.classList.remove("hidden");
}

function getRemainingWrongQuestionNumbersFromResult(result) {
  const items = Array.isArray(result && result.items) ? result.items : [];

  return items
    .filter(function (item) {
      return !item.is_correct;
    })
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

function saveWrongReviewProgress(result) {
  const remainingWrongNumbers = getRemainingWrongQuestionNumbersFromResult(result);
  const originalSourceResult = getWrongReviewSourceResult();

  try {
    localStorage.setItem(
      WRONG_REVIEW_STORAGE_KEY,
      JSON.stringify(remainingWrongNumbers)
    );

    localStorage.setItem(
      WRONG_REVIEW_SOURCE_RESULT_STORAGE_KEY,
      JSON.stringify({
        ...originalSourceResult,
        student_name: result.student_name || originalSourceResult.student_name || "",
        student_phone: result.student_phone || originalSourceResult.student_phone || "",
        last_review_total_questions: result.total_questions || 0,
        last_review_correct_count: result.correct_count || 0,
        last_review_wrong_count: remainingWrongNumbers.length,
        last_review_submitted_at: result.submitted_at || "",
        last_review_generated_exam_mode: result.generated_exam_mode || "",
        last_review_generated_exam_round: result.generated_exam_round || "",
        last_review_generated_exam_label: result.generated_exam_label || ""
      })
    );
  } catch (error) {
    console.warn("오답 복습 진행 상태 저장 실패:", error);
  }
}

function startRemainingWrongReview(questionNumbers) {
  const cleanNumbers = normalizeWrongReviewQuestionNumbers(questionNumbers || []);

  if (!cleanNumbers.length) {
    alert("다시 풀 오답 문항이 없습니다.");
    return;
  }

  try {
    localStorage.setItem(
      WRONG_REVIEW_STORAGE_KEY,
      JSON.stringify(cleanNumbers)
    );
  } catch (error) {
    console.warn("다시 틀린 문제 저장 실패:", error);
    alert("다시 틀린 문제 정보를 저장하지 못했습니다.");
    return;
  }

  window.location.href = `./index.html?mode=wrong-review&v=retry-${Date.now()}`;
}

function returnToOriginalDiagnosisReport() {
  window.location.href = AUTO_DIAGNOSIS_URL;
}

function buildResultObject() {
  const items = questions.map(function (question) {
    const studentAnswer = getStudentAnswerForResult(question);
    const isCorrect = checkCorrect(question, studentAnswer);
    const points = getQuestionPoints(question);

    return {
      id: question.id,
      question_number: question.question_number,
      original_question_number: question.original_question_number,
      level_test_slot: question.level_test_slot || null,
      source_question_number: question.source_question_number || question.original_question_number || question.question_number,
      type: question.type,
      category: question.category,
      diagnostic_area: question.diagnostic_area,
      difficulty_band: question.difficulty_band || "",
      question_zone: question.question_zone || "",
      instruction: question.instruction,
      question: question.question,
      passage: getRenderedPassageForResult(question),
      options: question.options,
      points: points,
      earned_points: isCorrect ? points : 0,
      correct_answer: question.correct_answer,
      correct_answer_order: question.correct_answer_order || null,
      correct_position: question.correct_position || "",
      student_answer: studentAnswer,
      is_correct: isCorrect,
      description: question.description || "",
      source_round: question.source_round || "",
      source_pdf: question.source_pdf || "",
      passage_group_id: question.passage_group_id || null,
      passage_group_title: question.passage_group_title || null,
      interaction_mode: question.interaction_mode || "single_choice",
      generated_exam_mode: question.generated_exam_mode || latestExamGenerationOptions.mode || "",
      generated_exam_round: question.generated_exam_round || latestExamGenerationOptions.round || "",
      generated_exam_label: question.generated_exam_label || latestExamGenerationOptions.label || ""
    };
  });

  const answeredCount = items.filter(function (item) {
    return item.student_answer !== null && item.student_answer !== "" && !(Array.isArray(item.student_answer) && item.student_answer.length === 0);
  }).length;

  const correctCount = items.filter(function (item) {
    return item.is_correct;
  }).length;

  const totalPossiblePoints = items.reduce(function (sum, item) {
    return sum + Number(item.points || 0);
  }, 0);

  const earnedPoints = items.reduce(function (sum, item) {
    return sum + Number(item.earned_points || 0);
  }, 0);

  const unansweredQuestions = items
    .filter(function (item) {
      return item.student_answer === null || item.student_answer === "" || (Array.isArray(item.student_answer) && item.student_answer.length === 0);
    })
    .map(function (item) {
      return item.question_number;
    });

  const sectionScore100 = totalPossiblePoints
    ? Math.round((earnedPoints / totalPossiblePoints) * 100)
    : 0;

  const runtimeConfig = getActiveRuntimeConfig();

  return {
    test_level: TEST_CONFIG.testLevel,
    section: TEST_CONFIG.section,
    test_name: runtimeConfig.testDisplayName,
    test_scope: runtimeConfig.testScope,
    question_number_start: runtimeConfig.questionNumberStart,
    question_number_end: runtimeConfig.questionNumberEnd,
    expected_total_questions: runtimeConfig.expectedTotalQuestions,
    is_full_50_question_set: runtimeConfig.isFull50QuestionSet && questions.length === runtimeConfig.expectedTotalQuestions,
    student_name: studentName,
    student_phone: studentPhone,
    started_at: startedAt,
    submitted_at: submittedAt,
    time_limit_minutes: runtimeConfig.timeLimitMinutes,
    total_questions: questions.length,
    answered_count: answeredCount,
    unanswered_count: questions.length - answeredCount,
    correct_count: correctCount,
    wrong_count: questions.length - correctCount,
    total_possible_points: totalPossiblePoints,
    earned_points: earnedPoints,
    section_score_100: sectionScore100,
    generated_exam_mode: latestExamGenerationOptions.mode,
    generated_exam_round: latestExamGenerationOptions.round,
    generated_exam_label: latestExamGenerationOptions.label,
    unanswered_questions: unansweredQuestions,
    items: items
  };
}

function getStudentAnswerForResult(question) {
  if (isSentenceOrderQuestion(question)) {
    return normalizeSentenceOrderAnswerLabels(
      sentenceOrderAnswers[question.id] || []
    );
  }

  return answers[question.id] !== undefined ? answers[question.id] : null;
}

function normalizeSentenceOrderAnswerLabels(answer) {
  if (Array.isArray(answer)) {
    return answer
      .map(function (label) {
        return normalizeSentenceBlockLabel(label);
      })
      .filter(Boolean);
  }

  return parseSentenceOrderLabelsFromText(answer);
}

function getCorrectSentenceOrder(question) {
  /*
    문장 순서형은 최종 정답 번호(correct_answer)를 가장 우선한다.
    이유:
    - 13~15번은 선택지 번호가 공식 정답이다.
    - correct_answer_order가 예전 값으로 남아 있으면 정답 번호를 골라도 오답 처리될 수 있다.
  */
  const correctAnswer = question.correct_answer !== undefined
    ? question.correct_answer
    : question.answer;

  const matchedOption = getOptionByAnswer(question, correctAnswer);

  if (matchedOption && matchedOption.text) {
    const parsedFromOption = parseSentenceOrderLabelsFromText(matchedOption.text);

    if (parsedFromOption.length) {
      return parsedFromOption;
    }
  }

  if (Array.isArray(question.correct_answer_order)) {
    return normalizeSentenceOrderAnswerLabels(question.correct_answer_order);
  }

  if (Array.isArray(question.correct_order)) {
    return normalizeSentenceOrderAnswerLabels(question.correct_order);
  }

  if (Array.isArray(question.correct_answer)) {
    return normalizeSentenceOrderAnswerLabels(question.correct_answer);
  }

  return parseSentenceOrderLabelsFromText(correctAnswer);
}

function parseSentenceOrderLabelsFromText(value) {
  const matches = String(value || "").match(/[가나다라]/g) || [];

  return matches
    .map(function (label) {
      return normalizeSentenceBlockLabel(label);
    })
    .filter(Boolean);
}

function getRenderedPassageForResult(question) {
  let source = question.passage_template || question.passage || "";
  source = applySharedInsertStateToPassage(question, source);
  source = applyCurrentAnswerInsertToPassage(question, source);
  return source;
}

function checkCorrect(question, studentAnswer) {
  if (
    studentAnswer === null ||
    studentAnswer === undefined ||
    studentAnswer === "" ||
    (Array.isArray(studentAnswer) && studentAnswer.length === 0)
  ) {
    return false;
  }

  if (isSentenceOrderQuestion(question)) {
    const studentOrder = normalizeSentenceOrderAnswerLabels(studentAnswer);
    const correctOrder = getCorrectSentenceOrder(question);

    if (!studentOrder.length || !correctOrder.length) {
      return false;
    }

    return sameArray(studentOrder, correctOrder);
  }

  return String(studentAnswer) === String(question.correct_answer);
}
function sameArray(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) {
    return false;
  }

  const cleanLeft = left.filter(Boolean);
  const cleanRight = right.filter(Boolean);

  if (cleanLeft.length !== cleanRight.length) {
    return false;
  }

  return cleanLeft.every(function (value, index) {
    return String(value) === String(cleanRight[index]);
  });
}

function renderResultScreen(result) {
  if (isWrongReviewMode()) {
    renderWrongReviewResultScreen(result);
    return;
  }

  renderNormalResultScreen(result);
}

function renderNormalResultScreen(result) {
  if (elements.diagnosisButton) {
    elements.diagnosisButton.classList.remove("hidden");
    elements.diagnosisButton.style.display = "";
  }

  elements.resultSummary.innerHTML = `
    <div class="summary-card">
      <div class="label">응시자</div>
      <div class="value">${escapeHtml(result.student_name)}</div>
    </div>
    <div class="summary-card">
      <div class="label">읽기 점수</div>
      <div class="value">${result.section_score_100}점</div>
    </div>
    <div class="summary-card">
      <div class="label">정답 수</div>
      <div class="value">${result.correct_count} / ${result.total_questions}</div>
    </div>
    <div class="summary-card">
      <div class="label">미응답</div>
      <div class="value">${result.unanswered_count}</div>
    </div>
  `;

  elements.resultTable.innerHTML = `
    <div class="notice-box">
      <strong>제출이 완료되었습니다.</strong><br />
      이 화면에서는 읽기 점수, 정답 수, 미응답 수를 간단히 확인할 수 있습니다.
      <br />
      자세한 문항별 분석, 예상 수준, 약점 진단, 학습 처방은 아래의
      <strong>진단 보고서 보기</strong>에서 확인하세요.
      <br /><br />

      <strong>출제 방식</strong><br />
      ${escapeHtml(result.generated_exam_label)}
      <br /><br />

      <strong>안내</strong><br />
      ${
        isLevelTestResult(result)
          ? "이 결과는 TOPIK II 읽기 50문항 전체 시험이 아니라 20문항 레벨테스트 결과입니다. 점수는 100점 기준으로 환산되며, 약점 진단은 참고용입니다."
          : "이 결과는 TOPIK II 읽기 영역 기준 결과입니다."
      }
      <br />
      최종 TOPIK 급수는 듣기·쓰기·읽기 총점 기준으로 결정됩니다.
    </div>
  `;

  if (elements.categoryAnalysis) {
    elements.categoryAnalysis.innerHTML = "";
  }
}

function renderWrongReviewResultScreen(result) {
  const remainingWrongNumbers = getRemainingWrongQuestionNumbersFromResult(result);
  const remainingWrongCount = remainingWrongNumbers.length;
  const solvedCount = Number(result.total_questions || 0);
  const correctCount = Number(result.correct_count || 0);
  const unansweredCount = Number(result.unanswered_count || 0);

  if (elements.diagnosisButton) {
    elements.diagnosisButton.classList.add("hidden");
    elements.diagnosisButton.style.display = "none";
  }

  elements.resultSummary.innerHTML = `
    <div class="summary-card">
      <div class="label">응시자</div>
      <div class="value">${escapeHtml(result.student_name)}</div>
    </div>
    <div class="summary-card">
      <div class="label">복습 문항</div>
      <div class="value">${solvedCount}문항</div>
    </div>
    <div class="summary-card">
      <div class="label">맞힌 문항</div>
      <div class="value">${correctCount} / ${solvedCount}</div>
    </div>
    <div class="summary-card">
      <div class="label">남은 오답</div>
      <div class="value">${remainingWrongCount}</div>
    </div>
  `;

  elements.resultTable.innerHTML = `
    <div class="notice-box">
      <strong>${remainingWrongCount ? "오답풀이 결과" : "오답풀이 완료"}</strong><br />
      ${
        remainingWrongCount
          ? `이번 오답풀이에서 ${remainingWrongCount}문항이 아직 해결되지 않았습니다.`
          : "이번 오답풀이에서 모든 오답을 해결했습니다."
      }
      <br /><br />

      <strong>복습 결과</strong><br />
      복습 문항: ${solvedCount}문항<br />
      맞힌 문항: ${correctCount}문항<br />
      남은 오답: ${remainingWrongCount}문항<br />
      미응답: ${unansweredCount}문항
      <br /><br />

      ${
        remainingWrongCount
          ? `<strong>남은 오답 문항</strong><br />${remainingWrongNumbers.map(function (number) {
              return number + "번";
            }).join(", ")}<br /><br />`
          : ""
      }

      <strong>안내</strong><br />
      오답풀이 결과는 진단 보고서로 저장하지 않습니다.
      첫 번째 50문항 진단 보고서는 그대로 유지됩니다.
      <br /><br />

      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        ${
          remainingWrongCount
            ? `<button
                type="button"
                id="retryWrongReviewButton"
                class="primary-button"
                style="
                  padding: 12px 18px;
                  border: 0;
                  border-radius: 10px;
                  background: #dc2626;
                  color: #ffffff;
                  font-weight: 900;
                  cursor: pointer;
                "
              >
                다시 틀린 문제 풀기 (${remainingWrongCount}문항)
              </button>`
            : ""
        }

        <button
          type="button"
          id="backToOriginalDiagnosisButton"
          class="primary-button"
          style="
            padding: 12px 18px;
            border: 0;
            border-radius: 10px;
            background: #0877f2;
            color: #ffffff;
            font-weight: 900;
            cursor: pointer;
          "
        >
          진단 보고서로 돌아가기
        </button>
      </div>
    </div>
  `;

  const retryButton = document.getElementById("retryWrongReviewButton");
  if (retryButton) {
    retryButton.addEventListener("click", function () {
      startRemainingWrongReview(remainingWrongNumbers);
    });
  }

  const backButton = document.getElementById("backToOriginalDiagnosisButton");
  if (backButton) {
    backButton.addEventListener("click", returnToOriginalDiagnosisReport);
  }

  if (elements.categoryAnalysis) {
    elements.categoryAnalysis.innerHTML = "";
  }
}

function renderCategoryAnalysis(items) {
  const map = new Map();

  items.forEach(function (item) {
    const name = item.category || "미분류";

    if (!map.has(name)) {
      map.set(name, {
        total: 0,
        correct: 0,
        points: 0,
        earned: 0
      });
    }

    const stat = map.get(name);
    stat.total += 1;
    stat.correct += item.is_correct ? 1 : 0;
    stat.points += Number(item.points || 0);
    stat.earned += Number(item.earned_points || 0);
  });

  const rows = Array.from(map.entries()).map(function ([name, stat]) {
    const accuracy = stat.total ? Math.round((stat.correct / stat.total) * 100) : 0;

    return `
      <tr>
        <td>${escapeHtml(name)}</td>
        <td>${stat.correct} / ${stat.total}</td>
        <td>${stat.earned} / ${stat.points}</td>
        <td>${accuracy}%</td>
      </tr>
    `;
  }).join("");

  return `
    <h2>유형별 요약</h2>
    <table style="width:100%; border-collapse:collapse; margin-top:12px;">
      <thead>
        <tr>
          <th style="border:1px solid #d7e1ec; padding:8px;">유형</th>
          <th style="border:1px solid #d7e1ec; padding:8px;">정답 수</th>
          <th style="border:1px solid #d7e1ec; padding:8px;">점수</th>
          <th style="border:1px solid #d7e1ec; padding:8px;">정답률</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function openDiagnosisReport() {
  if (isWrongReviewMode()) {
    alert("오답풀이 결과는 진단 보고서로 보내지 않습니다. 첫 번째 50문항 진단 보고서를 확인하세요.");
    return;
  }

  if (!latestResult) {
    alert("진단 보고서로 보낼 결과가 없습니다.");
    return;
  }

  try {
    localStorage.setItem(AUTO_DIAGNOSIS_STORAGE_KEY, JSON.stringify(latestResult));
  } catch (error) {
    console.warn("localStorage 저장 실패:", error);
  }

  window.location.href = AUTO_DIAGNOSIS_URL;
}

function buildResultText(result) {
  return [
    `시험명: ${result.test_name}`,
    `시험 범위: ${result.test_scope}`,
    `응시자: ${result.student_name}`,
    `전화번호: ${result.student_phone}`,
    `제출 시각: ${result.submitted_at}`,
    `총 문항: ${result.total_questions}`,
    `응답: ${result.answered_count}`,
    `미응답: ${result.unanswered_count}`,
    `정답: ${result.correct_count}`,
    `오답: ${result.wrong_count}`,
    `점수: ${result.section_score_100} / 100`,
    `출제 방식: ${result.generated_exam_label}`
  ].join("\n");
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8"
  });

  downloadBlob(blob, filename);
}

function downloadText(text, filename) {
  const blob = new Blob([text], {
    type: "text/plain;charset=utf-8"
  });

  downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();

  anchor.remove();
  URL.revokeObjectURL(url);
}

function emphasizeNegativeFocus(html) {
  return html
    .replaceAll("맞지 않는 것", '<span class="negative-focus">맞지 않는 것</span>')
    .replaceAll("알맞지 않은 것", '<span class="negative-focus">알맞지 않은 것</span>')
    .replaceAll("다른 것", '<span class="negative-focus">다른 것</span>')
    .replaceAll("틀린 것", '<span class="negative-focus">틀린 것</span>');
}

function setStartMessage(text, color) {
  elements.startMessage.textContent = text || "";
  elements.startMessage.style.color = color || "#d93025";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}