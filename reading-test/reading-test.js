"use strict";

console.log("TOPIK II Reading loaded: starter-sample-v1");

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

const AUTO_DIAGNOSIS_STORAGE_KEY = "topik2_latest_reading_result";
const AUTO_DIAGNOSIS_URL = "../reading-diagnosis/index.html?auto=1";

const WRONG_REVIEW_STORAGE_KEY = "topik2_wrong_review_question_numbers";
const WRONG_REVIEW_SOURCE_RESULT_STORAGE_KEY = "topik2_wrong_review_source_result";
let questions = [];
let currentIndex = 0;
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

const elements = {};
const INSERTED_HIGHLIGHT_CLASS = "inserted-answer-highlight";

document.addEventListener("DOMContentLoaded", initReadingTest);

async function initReadingTest() {
  cacheElements();
  bindEvents();
  await loadQuestions();

  autoStartWrongReviewIfPossible();
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
      setNewExamMessage("", "#188038");
    });
  }

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

async function loadQuestions(options = {}) {
  const forceReload = Boolean(options.forceReload);
  const preferredMode = options.preferredMode || (elements.examModeSelect ? elements.examModeSelect.value : "round-103");
  const showMessage = Boolean(options.showMessage);

  const questionFiles = getQuestionFileCandidates(preferredMode, forceReload);
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

      console.info(`TOPIK II Reading questions loaded from ${file.label}: ${questions.length}`);

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
  setStartMessage("문항 파일을 불러오지 못했습니다. reading-questions.json 또는 generated-reading-questions.json 위치를 확인하세요.", "#d93025");

  if (showMessage) {
    setNewExamMessage("선택한 시험지를 불러오지 못했습니다. generated-reading-questions.json 파일을 확인하세요.", "#d93025");
  }

  return false;
}

function getQuestionFileCandidates(preferredMode, forceReload) {
  const cacheSuffix = forceReload ? `?v=${Date.now()}` : "";

  if (isWrongReviewMode()) {
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

  if (preferredMode === "sample") {    return [
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
    setStartMessage("오답 문항을 아직 불러오지 못했습니다. 잠시 후 다시 시도하세요.", "#d93025");
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
  remainingSeconds = TEST_CONFIG.timeLimitSeconds;

  latestExamGenerationOptions = isWrongReviewMode()
    ? getWrongReviewExamGenerationOptions(questions)
    : getLoadedExamGenerationOptions(
        questions,
        getSelectedExamGenerationOptions()
      );

  elements.studentNameDisplay.textContent = studentName;
  elements.studentPhoneDisplay.textContent = studentPhone;
  elements.examMetaText.textContent = isWrongReviewMode()
    ? `오답 다시 풀기 · ${latestExamGenerationOptions.label}`
    : `${TEST_CONFIG.testScope} · ${latestExamGenerationOptions.label}`;

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

  /*
    알 수 없는 선택값이 들어와도 학생 시험은
    103회 고정 출제로 시작되게 한다.
  */
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
  escapeHtml(question.instruction || "")
);

  if (isSentenceOrderQuestion(question)) {
    renderSentenceOrderQuestion(question);
  } else if (question.type === "sentence_insert_interactive") {
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
      return instructionText;
    }

    return "다음을 읽고 물음에 답하십시오.";
  }

  return questionText || instructionText || "다음을 읽고 물음에 답하십시오.";
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

function applyQuestionSpecificPassageStyle(question) {
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
  const shouldShowPassageBox = !question.image_only || Boolean(passageHtml.trim());

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

function renderPassageHtml(question) {
  let source = question.passage_template || question.passage || "";

  if (!source && question.type && question.type.includes("visual")) {
    source = question.image_only ? "" : (question.passage || "자료 이미지 또는 안내문이 표시됩니다.");
  }

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

  return `
    <div class="image-area">
      <img src="${escapeAttribute(question.image_url)}" alt="문항 자료 이미지" />
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
  return String(value || "")
    .replace(/[()\[\]（）\s]/g, "")
    .trim();
}

function escapeInsertPositionRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getSentenceInsertPositionLabels(question) {
  const rawPositions = Array.isArray(question.insert_positions) && question.insert_positions.length > 0
    ? question.insert_positions
    : ["ㄱ", "ㄴ", "ㄷ", "ㄹ"];

  return rawPositions
    .map(normalizeInsertPositionLabelForQuestion)
    .filter(Boolean);
}

function replaceSentenceInsertMarkersInHtml(html, question, selectedPosition, insertSentence) {
  let result = html;
  const positionLabels = getSentenceInsertPositionLabels(question);
  const safeInsertSentence = escapeHtml(insertSentence || "");

  positionLabels.forEach(function (label, index) {
    const cleanLabel = normalizeInsertPositionLabelForQuestion(label);
    const optionNumber = index + 1;

    if (!cleanLabel) {
      return;
    }

    const markerPatterns = [
      new RegExp(`\\(\\s*${escapeInsertPositionRegExp(cleanLabel)}\\s*\\)`, "g"),
      new RegExp(`\\[\\s*${escapeInsertPositionRegExp(cleanLabel)}\\s*\\]`, "g"),
      new RegExp(`（\\s*${escapeInsertPositionRegExp(cleanLabel)}\\s*）`, "g")
    ];

    const isSelected = selectedPosition === cleanLabel;

    const markerHtml = isSelected && safeInsertSentence
      ? `<span class="insert-position selected" data-position-label="${escapeAttribute(cleanLabel)}">${escapeHtml(cleanLabel)}</span>
         <span class="${INSERTED_HIGHLIGHT_CLASS}">${safeInsertSentence}</span>`
      : `<span
            class="insert-position"
            data-position-label="${escapeAttribute(cleanLabel)}"
            data-inline-insert-answer="${optionNumber}"
            style="cursor:pointer;"
         >${escapeHtml(cleanLabel)}</span>`;

    markerPatterns.forEach(function (pattern) {
      result = result.replace(pattern, markerHtml);
    });
  });

  return result;
}

function renderSentenceInsertQuestion(question) {
  const selectedAnswer = answers[question.id];
  const selectedOption = selectedAnswer ? getOptionByAnswer(question, selectedAnswer) : null;

  const selectedPosition = selectedOption
    ? normalizeInsertPositionLabelForQuestion(selectedOption.text || selectedOption.label || selectedAnswer)
    : "";

  const insertSentence = String(question.insert_sentence || "");
  const sourcePassage = String(question.passage_template || question.passage || "");

  let passageHtml = escapeHtml(sourcePassage);
  passageHtml = replaceSentenceInsertMarkersInHtml(
    passageHtml,
    question,
    selectedPosition,
    insertSentence
  );

  elements.questionStage.innerHTML = `
    <div class="reading-layout">
      <section class="passage-panel">
        <div class="panel-label">
          <span>지문</span>
          <small>문장 삽입</small>
        </div>
        <div class="passage-content" data-passage-content="true">
          ${passageHtml}
        </div>
      </section>

      <section class="question-panel">
        <div class="panel-label">
          <span>문제</span>
          <small>${escapeHtml(question.category || "")}</small>
        </div>

        <div class="question-content">
          <div class="insert-sentence-box">
            ${escapeHtml(question.insert_sentence || "")}
          </div>

          ${renderQuestionTextWithNumber(
            question,
            question.question || "주어진 문장이 들어갈 곳으로 가장 알맞은 것을 고르십시오."
          )}

          <div class="options-area">
            ${renderOptionButtons(question)}
          </div>
        </div>
      </section>
    </div>
  `;

  bindOptionButtons(question);

  elements.questionStage.querySelectorAll("[data-inline-insert-answer]").forEach(function (button) {
    button.addEventListener("click", function () {
      const answerValue = button.getAttribute("data-inline-insert-answer");
      answers[question.id] = normalizeStudentAnswerValue(answerValue);
      renderCurrentQuestion();
    });
  });
}

function getFirstOrderCandidates(question) {
  const manualCandidates = Array.isArray(question.first_order_candidates)
    ? question.first_order_candidates
    : [];

  const candidates = [];

  function addCandidate(label) {
    const cleanLabel = normalizeSentenceBlockLabel(label);

    if (!cleanLabel) {
      return;
    }

    if (!findSentenceBlock(question, cleanLabel)) {
      return;
    }

    if (!candidates.includes(cleanLabel)) {
      candidates.push(cleanLabel);
    }
  }

  manualCandidates.forEach(addCandidate);

  if (candidates.length > 0) {
    return candidates;
  }

  if (!Array.isArray(question.options)) {
    return [];
  }

  question.options.forEach(function (option) {
    const text = typeof option === "string"
      ? option
      : String(option.text || "");

    const match = text.match(/[（(]\s*([가나다라])\s*[）)]/);

    if (match && match[1]) {
      addCandidate(match[1]);
    }
  });

  return candidates;
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

function renderSentenceOrderQuestion(question) {
  const sentenceBlocks = getSentenceBlocks(question);
  let currentOrder = sentenceOrderAnswers[question.id] || [];

  const selectedFirst = getValidFirstOrderLabel(question, currentOrder);
  const hasSelectedFirst = Boolean(selectedFirst);

  /*
    이전 코드에서 숫자나 잘못된 값이 1번째 문장으로 저장된 경우가 있으면
    오른쪽에 4개 문장이 모두 보이는 문제가 생긴다.
    그런 잘못된 상태는 즉시 초기화한다.
  */
  if (!hasSelectedFirst && currentOrder.some(Boolean)) {
    currentOrder = [];
    sentenceOrderAnswers[question.id] = [];
    delete answers[question.id];
  }

  const usedLabels = new Set(
    currentOrder
      .filter(Boolean)
      .map(function (label) {
        return normalizeSentenceBlockLabel(label);
      })
  );

  const sourceCards = hasSelectedFirst
    ? sentenceBlocks.filter(function (block) {
        return !usedLabels.has(normalizeSentenceBlockLabel(block.label));
      })
    : [];

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
          ${
            hasSelectedFirst
              ? `<div class="order-card-list" id="orderSourceList">
                  ${
                    sourceCards.length
                      ? sourceCards.map(renderSentenceCard).join("")
                      : `<div style="
                          padding:16px;
                          border:1px solid #e3e6ea;
                          border-radius:10px;
                          background:#ffffff;
                          text-align:center;
                          color:#555;
                          font-size:17px;
                          font-weight:800;
                        ">모든 문장을 왼쪽에 배치했습니다.</div>`
                  }
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
                  다시 배치
                </button>`
              : renderFirstOrderCandidateButtons(question, currentOrder)
          }
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
          : "여기에 문장을 놓으세요."
      }
    </div>
  `;
}

function bindSentenceOrderEvents(question) {
  const allCards = elements.questionStage.querySelectorAll(".sentence-card");
  const sourceCards = elements.questionStage.querySelectorAll("#orderSourceList .sentence-card");
  const slots = elements.questionStage.querySelectorAll(".order-slot");
  const firstOrderButtons = elements.questionStage.querySelectorAll(".first-order-candidate-button");
  const changeFirstOrderButton = document.getElementById("changeFirstOrderButton");

  firstOrderButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      const label = button.getAttribute("data-first-order-label");
      setFirstOrderCandidate(question, label);
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
          generated_exam_label: latestResult.generated_exam_label || ""
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

  try {
    localStorage.setItem(
      WRONG_REVIEW_STORAGE_KEY,
      JSON.stringify(remainingWrongNumbers)
    );

    localStorage.setItem(
      WRONG_REVIEW_SOURCE_RESULT_STORAGE_KEY,
      JSON.stringify({
        student_name: result.student_name || "",
        student_phone: result.student_phone || "",
        last_review_total_questions: result.total_questions || 0,
        last_review_correct_count: result.correct_count || 0,
        last_review_wrong_count: remainingWrongNumbers.length,
        last_review_submitted_at: result.submitted_at || ""
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
      interaction_mode: question.interaction_mode || "single_choice"
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

  return {
    test_level: TEST_CONFIG.testLevel,
    section: TEST_CONFIG.section,
    test_name: TEST_CONFIG.testDisplayName,
    test_scope: TEST_CONFIG.testScope,
    question_number_start: TEST_CONFIG.questionNumberStart,
    question_number_end: TEST_CONFIG.questionNumberEnd,
    expected_total_questions: TEST_CONFIG.expectedTotalQuestions,
    is_full_50_question_set: questions.length === TEST_CONFIG.expectedTotalQuestions,
    student_name: studentName,
    student_phone: studentPhone,
    started_at: startedAt,
    submitted_at: submittedAt,
    time_limit_minutes: TEST_CONFIG.timeLimitMinutes,
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
  if (Array.isArray(question.correct_answer_order)) {
    return normalizeSentenceOrderAnswerLabels(question.correct_answer_order);
  }

  if (Array.isArray(question.correct_order)) {
    return normalizeSentenceOrderAnswerLabels(question.correct_order);
  }

  if (Array.isArray(question.correct_answer)) {
    return normalizeSentenceOrderAnswerLabels(question.correct_answer);
  }

  const correctAnswer = question.correct_answer !== undefined
    ? question.correct_answer
    : question.answer;

  const matchedOption = getOptionByAnswer(question, correctAnswer);

  if (matchedOption && matchedOption.text) {
    return parseSentenceOrderLabelsFromText(matchedOption.text);
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
      이 결과는 TOPIK II 읽기 영역 기준 결과입니다.
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