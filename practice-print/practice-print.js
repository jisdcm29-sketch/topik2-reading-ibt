"use strict";

const BANK_PATH = "../reading-test/data/bank/question-bank.json";

let bankData = null;
let flatItems = [];
let lastSelectedItems = [];
let paperTitleMode = "auto";
const AUTO_TITLE_PATTERN = /^TOPIK II 읽기 원본 \d+(?:~\d+)?번 유형별 문제지$/;
const OLD_DEFAULT_TITLE = "TOPIK II 읽기 1~4번 유형 집중 연습";

const $ = (id) => document.getElementById(id);

const elements = {
  startNumber: $("startNumber"),
  endNumber: $("endNumber"),
  questionCount: $("questionCount"),
  allowRepeat: $("allowRepeat"),
  sortMode: $("sortMode"),
  roundBox: $("roundBox"),
  showSource: $("showSource"),
  showAnswers: $("showAnswers"),
  teacherMode: $("teacherMode"),
  paperTitle: $("paperTitle"),
  generateBtn: $("generateBtn"),
  printBtn: $("printBtn"),
  resetBtn: $("resetBtn"),
  answerOnlyPrintBtn: null,
  combinedPrintBtn: null,
  statusBox: $("statusBox"),
  printArea: $("printArea")
};


function injectAnswerOnlyPrintStyle() {
  if (document.getElementById("answerOnlyPrintStyle")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "answerOnlyPrintStyle";
  style.textContent = `
    #printBtn {
      margin-top: 8px;
    }

    #combinedPrintBtn,
    #answerOnlyPrintBtn {
      margin-top: 8px;
    }

    #combinedPrintBtn {
      border-color: #0877f2;
      color: #0058c8;
      font-weight: 900;
    }

    #answerOnlyPrintBtn {
      background: #eef6ff;
      border-color: #b9d8ff;
      color: #003f8f;
      font-weight: 900;
    }

    .answer-only-section {
      page-break-before: auto !important;
      margin-top: 18px !important;
    }

    @media print {
      .answer-only-section {
        page-break-before: auto !important;
        break-before: auto !important;
      }
    }
  `;

  document.head.appendChild(style);
}

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  injectAnswerOnlyPrintStyle();
  bindEvents();
  await loadBank();
}

function bindEvents() {
  createPrintModeButtons();

  elements.generateBtn.addEventListener("click", generatePreview);
  elements.printBtn.addEventListener("click", printStudentOnlySheet);

  if (elements.combinedPrintBtn) {
    elements.combinedPrintBtn.addEventListener("click", printQuestionAndAnswerSheet);
  }

  if (elements.answerOnlyPrintBtn) {
    elements.answerOnlyPrintBtn.addEventListener("click", printAnswerOnlySheet);
  }

  elements.resetBtn.addEventListener("click", resetControls);

  elements.startNumber.addEventListener("input", updateAutoTitleIfNeeded);
  elements.endNumber.addEventListener("input", updateAutoTitleIfNeeded);
  elements.paperTitle.addEventListener("input", function () {
    const value = elements.paperTitle.value.trim();

    if (!value || AUTO_TITLE_PATTERN.test(value) || value === OLD_DEFAULT_TITLE) {
      paperTitleMode = "auto";
      updateAutoTitleIfNeeded();
      return;
    }

    paperTitleMode = "manual";
  });
}

function createPrintModeButtons() {
  if (elements.generateBtn) {
    elements.generateBtn.textContent = "문제지 미리보기 생성";
  }

  if (elements.printBtn) {
    elements.printBtn.textContent = "학생용 문제지 PDF로 인쇄 / 저장";
    elements.printBtn.title = "정답을 포함하지 않는 학생용 문제지만 인쇄합니다.";
  }

  if (!document.getElementById("combinedPrintBtn")) {
    const combinedButton = document.createElement("button");
    combinedButton.id = "combinedPrintBtn";
    combinedButton.type = "button";
    combinedButton.className = "plain-btn";
    combinedButton.textContent = "문제지+정답표 PDF로 인쇄 / 저장";
    combinedButton.title = "학생용 문제지 뒤에 정답표를 붙여 함께 인쇄합니다.";

    if (elements.printBtn && elements.printBtn.parentElement) {
      elements.printBtn.insertAdjacentElement("afterend", combinedButton);
    }
  }

  if (!document.getElementById("answerOnlyPrintBtn")) {
    const answerButton = document.createElement("button");
    answerButton.id = "answerOnlyPrintBtn";
    answerButton.type = "button";
    answerButton.className = "plain-btn";
    answerButton.textContent = "교사용 정답표 PDF로 인쇄 / 저장";
    answerButton.title = "문제 없이 정답표만 별도로 인쇄합니다.";

    const combinedButton = document.getElementById("combinedPrintBtn");
    if (combinedButton && combinedButton.parentElement) {
      combinedButton.insertAdjacentElement("afterend", answerButton);
    } else if (elements.printBtn && elements.printBtn.parentElement) {
      elements.printBtn.insertAdjacentElement("afterend", answerButton);
    }
  }

  elements.combinedPrintBtn = document.getElementById("combinedPrintBtn");
  elements.answerOnlyPrintBtn = document.getElementById("answerOnlyPrintBtn");
}

function printStudentOnlySheet() {
  generatePaperForPrintMode({
    showAnswers: false,
    teacherMode: false,
    label: "학생용 문제지 전용 화면 생성 완료",
    emptyMessage: "학생용 문제지를 만들 문항이 없습니다. 출력 조건을 확인하세요."
  });
}

function printQuestionAndAnswerSheet() {
  generatePaperForPrintMode({
    showAnswers: true,
    teacherMode: false,
    label: "문제지+정답표 화면 생성 완료",
    emptyMessage: "문제지와 정답표를 만들 문항이 없습니다. 출력 조건을 확인하세요."
  });
}

function generatePaperForPrintMode(config) {
  const originalShowAnswers = elements.showAnswers.checked;
  const originalTeacherMode = elements.teacherMode.checked;

  lastSelectedItems = [];
  elements.showAnswers.checked = Boolean(config.showAnswers);
  elements.teacherMode.checked = Boolean(config.teacherMode);

  generatePreview();

  elements.showAnswers.checked = originalShowAnswers;
  elements.teacherMode.checked = originalTeacherMode;

  if (!lastSelectedItems.length) {
    setStatus(config.emptyMessage, true);
    return;
  }

  setStatus(
    `${config.label}\n출력 문항: ${lastSelectedItems.length}문항\n브라우저 인쇄 창에서 PDF로 저장하세요.`
  );

  window.print();
}

function printAnswerOnlySheet() {
  const originalShowAnswers = elements.showAnswers.checked;
  const originalTeacherMode = elements.teacherMode.checked;

  lastSelectedItems = [];
  elements.showAnswers.checked = false;
  elements.teacherMode.checked = false;

  generatePreview();

  elements.showAnswers.checked = originalShowAnswers;
  elements.teacherMode.checked = originalTeacherMode;

  if (!lastSelectedItems.length) {
    setStatus("정답표를 만들 문항이 없습니다. 출력 조건을 확인하세요.", true);
    return;
  }

  const config = getCurrentSelectionConfig();
  renderAnswerOnlyPaper(lastSelectedItems, config);

  setStatus(
    `교사용 정답표 전용 화면 생성 완료\n출력 문항: ${lastSelectedItems.length}문항\n브라우저 인쇄 창에서 PDF로 저장하세요.`
  );

  window.print();
}

function getCurrentSelectionConfig() {
  const start = clampNumber(Number(elements.startNumber.value), 1, 50);
  const end = clampNumber(Number(elements.endNumber.value), 1, 50);
  const rangeStart = Math.min(start, end);
  const rangeEnd = Math.max(start, end);

  return {
    rangeStart,
    rangeEnd,
    selectedRounds: getSelectedRounds(),
    title: buildAutoAnswerTitle(rangeStart, rangeEnd)
  };
}

function buildAutoAnswerTitle(rangeStart, rangeEnd) {
  if (rangeStart === rangeEnd) {
    return `TOPIK II 읽기 원본 ${rangeStart}번 유형별 정답표`;
  }

  return `TOPIK II 읽기 원본 ${rangeStart}~${rangeEnd}번 유형별 정답표`;
}

async function loadBank() {
  try {
    setStatus("문제은행을 불러오는 중입니다.");
    const response = await fetch(`${BANK_PATH}?v=${Date.now()}`);
    if (!response.ok) {
      throw new Error(`question-bank.json을 불러오지 못했습니다. HTTP ${response.status}`);
    }

    bankData = await response.json();
    flatItems = flattenBank(bankData);
    renderRoundCheckboxes();
    setStatus(
      `문제은행 로드 완료\n총 문항: ${flatItems.length}문항\n회차: ${getAllRounds().join(", ")}`
    );
  } catch (error) {
    console.error(error);
    setStatus(
      "문제은행 로드 실패\n" +
      "로컬 서버에서 실행 중인지 확인하세요.\n" +
      "예: cd C:\\topik2-reading-ibt → python -m http.server 5500\n\n" +
      error.message,
      true
    );
  }
}

function flattenBank(bank) {
  const result = [];

  (bank.single_items || []).forEach(function (item) {
    result.push(normalizeFlatItem(item, null));
  });

  (bank.passage_sets || []).forEach(function (set) {
    (set.items || []).forEach(function (item) {
      const merged = {
        ...item,
        passage: item.passage || set.passage || "",
        passage_template: item.passage_template || set.passage_template || set.passage || "",
        image_url: item.image_url || set.image_url || "",
        passage_group_id: item.passage_group_id || set.set_id,
        passage_group_title: item.passage_group_title || set.group_title || "",
        passage_group_numbers: item.passage_group_numbers || set.target_slots || [],
        _set_passage: set.passage || "",
        _set_image_url: set.image_url || "",
        _set_id: set.set_id || item.passage_group_id || ""
      };
      result.push(normalizeFlatItem(merged, set));
    });
  });

  return result.sort(compareByRoundAndQuestion);
}

function normalizeFlatItem(item, set) {
  const sourceRound = String(item.source_round || (set && set.source_round) || "").replace("회", "");
  const originalNumber = Number(item.original_question_number || item.question_number || item.target_slot || 0);
  const answer = Number(item.answer || item.correct_answer || 0);
  const options = normalizeOptions(item.options || item.option_objects || item.options_text || []);

  return {
    ...item,
    _round: sourceRound,
    _roundNumber: Number(sourceRound) || 0,
    _originalNumber: originalNumber,
    _answer: answer,
    _options: options,
    _setId: item._set_id || item.passage_group_id || "",
    _setTitle: item.passage_group_title || (set && set.group_title) || "",
    _passage: item.passage || item.passage_template || (set && set.passage) || "",
    _imageUrl: item.image_url || (set && set.image_url) || "",
    _uniqueKey: `${sourceRound}-${originalNumber}-${item.id || ""}`
  };
}

function normalizeOptions(options) {
  if (!Array.isArray(options)) {
    return [];
  }

  return options.map(function (option, index) {
    if (option && typeof option === "object") {
      return {
        number: Number(option.number || index + 1),
        text: String(option.text ?? option.label ?? "")
      };
    }

    return {
      number: index + 1,
      text: String(option ?? "")
    };
  });
}

function compareByRoundAndQuestion(a, b) {
  if (a._roundNumber !== b._roundNumber) return a._roundNumber - b._roundNumber;
  if (a._originalNumber !== b._originalNumber) return a._originalNumber - b._originalNumber;
  return String(a.id || "").localeCompare(String(b.id || ""));
}

function getAllRounds() {
  return [...new Set(flatItems.map((item) => item._round))]
    .filter(Boolean)
    .sort((a, b) => Number(a) - Number(b));
}

function renderRoundCheckboxes() {
  const rounds = getAllRounds();

  elements.roundBox.innerHTML = rounds.map(function (round) {
    return `
      <label class="check-line">
        <input type="checkbox" class="round-check" value="${escapeAttribute(round)}" checked />
        ${escapeHtml(round)}회
      </label>
    `;
  }).join("");
}

function resetControls() {
  elements.startNumber.value = 1;
  elements.endNumber.value = 4;
  elements.questionCount.value = 0;
  elements.allowRepeat.checked = false;
  elements.sortMode.value = "round";
  elements.showSource.checked = true;
  elements.showAnswers.checked = false;
  elements.teacherMode.checked = false;
  paperTitleMode = "auto";
  elements.paperTitle.value = buildAutoPaperTitle();

  document.querySelectorAll(".round-check").forEach((checkbox) => {
    checkbox.checked = true;
  });

  elements.printArea.innerHTML = `<div class="print-empty">왼쪽에서 조건을 정한 뒤 [문제지 미리보기 생성]을 누르세요.</div>`;
  lastSelectedItems = [];
  setStatus("초기화되었습니다.");
}

function getSelectedRounds() {
  return Array.from(document.querySelectorAll(".round-check"))
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value);
}

function buildAutoPaperTitle() {
  const start = clampNumber(Number(elements.startNumber.value), 1, 50);
  const end = clampNumber(Number(elements.endNumber.value), 1, 50);
  const rangeStart = Math.min(start, end);
  const rangeEnd = Math.max(start, end);

  if (rangeStart === rangeEnd) {
    return `TOPIK II 읽기 원본 ${rangeStart}번 유형별 문제지`;
  }

  return `TOPIK II 읽기 원본 ${rangeStart}~${rangeEnd}번 유형별 문제지`;
}

function updateAutoTitleIfNeeded() {
  const currentTitle = elements.paperTitle.value.trim();
  const shouldUpdate =
    paperTitleMode === "auto" ||
    !currentTitle ||
    currentTitle === OLD_DEFAULT_TITLE ||
    AUTO_TITLE_PATTERN.test(currentTitle);

  if (shouldUpdate) {
    paperTitleMode = "auto";
    elements.paperTitle.value = buildAutoPaperTitle();
  }
}

function generatePreview() {
  if (!bankData || !flatItems.length) {
    setStatus("문제은행이 아직 로드되지 않았습니다.", true);
    return;
  }

  const start = clampNumber(Number(elements.startNumber.value), 1, 50);
  const end = clampNumber(Number(elements.endNumber.value), 1, 50);
  const rangeStart = Math.min(start, end);
  const rangeEnd = Math.max(start, end);
  const requestedCount = Math.max(0, Number(elements.questionCount.value || 0));
  const allowRepeat = elements.allowRepeat.checked;
  const selectedRounds = getSelectedRounds();

  if (!selectedRounds.length) {
    setStatus("출제 회차를 하나 이상 선택하세요.", true);
    return;
  }

  const pool = flatItems.filter(function (item) {
    return selectedRounds.includes(item._round) &&
      item._originalNumber >= rangeStart &&
      item._originalNumber <= rangeEnd;
  });

  if (!pool.length) {
    setStatus("선택한 조건에 맞는 문항이 없습니다.", true);
    return;
  }

  let selected = pool.slice();

  if (elements.sortMode.value === "random") {
    selected = shuffleArray(selected);
  } else {
    selected.sort(compareByRoundAndQuestion);
  }

  let warning = "";
  if (requestedCount > 0) {
    if (requestedCount <= selected.length) {
      selected = selected.slice(0, requestedCount);
    } else if (allowRepeat) {
      const base = elements.sortMode.value === "random" ? shuffleArray(pool) : pool.slice().sort(compareByRoundAndQuestion);
      const extended = selected.slice();
      let duplicateIndex = 1;
      while (extended.length < requestedCount) {
        const source = base[(extended.length - selected.length) % base.length];
        extended.push({
          ...source,
          _duplicateIndex: duplicateIndex++,
          _uniqueKey: `${source._uniqueKey}-dup-${duplicateIndex}`
        });
      }
      selected = extended;
      warning = `선택 가능한 문항 ${pool.length}문항보다 요청 문항 수가 많아서 중복을 허용해 ${requestedCount}문항으로 구성했습니다.`;
    } else {
      warning = `요청 문항 수는 ${requestedCount}문항이지만, 선택 가능한 문항은 ${selected.length}문항입니다. 중복 없이 가능한 전체 문항만 출력합니다.`;
    }
  }

  updateAutoTitleIfNeeded();

  lastSelectedItems = selected;
  renderPaper(selected, {
    rangeStart,
    rangeEnd,
    selectedRounds,
    requestedCount,
    warning
  });

  const statusLines = [
    `미리보기 생성 완료`,
    `원본 번호 범위: ${rangeStart}~${rangeEnd}번`,
    `선택 회차: ${selectedRounds.join(", ")}회`,
    `후보 문항: ${pool.length}문항`,
    `출력 문항: ${selected.length}문항`
  ];

  if (warning) {
    statusLines.push("", warning);
  }

  setStatus(statusLines.join("\n"), Boolean(warning));
}

function renderPaper(items, config) {
  const showSource = elements.showSource.checked;
  const showAnswers = elements.showAnswers.checked;
  const teacherMode = elements.teacherMode.checked;
  const title = elements.paperTitle.value.trim() || buildAutoPaperTitle();

  const grouped = groupSelectedItemsForDisplay(items);
  let displayNumber = 1;

  const bodyHtml = grouped.map(function (group) {
    if (group.items.length > 1 && group.setId) {
      const startNo = displayNumber;
      const html = renderQuestionSet(group, displayNumber, showSource, teacherMode);
      displayNumber += group.items.length;
      return html.replace("__SET_NUMBER_RANGE__", `${startNo}~${displayNumber - 1}`);
    }

    const html = renderQuestionCard(group.items[0], displayNumber, showSource, teacherMode);
    displayNumber += 1;
    return html;
  }).join("");

  const answerHtml = showAnswers ? renderAnswerTable(items) : "";

  elements.printArea.innerHTML = `
    <div class="paper">
      <div class="paper-title">
        <h1>${escapeHtml(title)}</h1>
        <div class="meta">
          원본 문항 범위: ${config.rangeStart}~${config.rangeEnd}번 ·
          출력 문항 수: ${items.length}문항 ·
          출제 회차: ${config.selectedRounds.map((round) => `${round}회`).join(", ")}
        </div>
        ${config.warning ? `<div class="status-box warning no-print">${escapeHtml(config.warning)}</div>` : ""}
      </div>
      ${bodyHtml}
      ${answerHtml}
    </div>
  `;
}

function groupSelectedItemsForDisplay(items) {
  const groups = [];
  let current = null;

  items.forEach(function (item) {
    const groupKey = item._setId ? `${item._round}-${item._setId}-${item._duplicateIndex || 0}` : "";

    if (groupKey && current && current.key === groupKey) {
      current.items.push(item);
      return;
    }

    current = {
      key: groupKey || item._uniqueKey,
      setId: item._setId,
      title: item._setTitle,
      items: [item]
    };
    groups.push(current);
  });

  return groups;
}

function renderQuestionSet(group, startNumber, showSource, teacherMode) {
  const first = group.items[0];
  const sourceNote = showSource
    ? `<div class="source-note">${escapeHtml(first._round)}회 원본 ${group.items.map((item) => item._originalNumber).join(", ")}번</div>`
    : "";

  return `
    <section class="question-set">
      ${sourceNote}
      <h3 class="set-heading">[__SET_NUMBER_RANGE__] 공통 지문</h3>
      ${renderImage(first)}
      ${renderPassage(first)}
      ${group.items.map(function (item, index) {
        return renderQuestionBlock(item, startNumber + index, teacherMode);
      }).join("")}
    </section>
  `;
}

function renderQuestionCard(item, displayNumber, showSource, teacherMode) {
  const sourceNote = showSource
    ? `<div class="source-note">${escapeHtml(item._round)}회 원본 ${escapeHtml(item._originalNumber)}번</div>`
    : "";

  return `
    <section class="question-card">
      ${sourceNote}
      <div class="instruction">${escapeHtml(cleanInstructionForPrint(item.instruction || ""))}</div>
      ${renderSpecialMaterial(item)}
      ${renderQuestionBlock(item, displayNumber, teacherMode)}
    </section>
  `;
}

function renderSpecialMaterial(item) {
  if (item.type === "sentence_order" || item.category === "문장 순서") {
    return renderSentenceOrderMaterial(item);
  }

  if (item.type === "sentence_insert" || item.category === "문장 삽입") {
    return `
      <div class="insert-sentence">
        <strong>주어진 문장</strong><br />
        ${formatText(item.insert_sentence || item.sentence_to_insert || "")}
      </div>
      ${renderPassage(item)}
    `;
  }

  if (usesPassageAsQuestionText(item)) {
    return renderImage(item);
  }

  return `${renderImage(item)}${renderPassage(item)}`;
}

function getPrintableQuestionText(item) {
  const question = removeOriginalNumberPrefix(item.question || "");
  const instruction = cleanInstructionForPrint(item.instruction || "");
  const passage = String(item._passage || item.passage || "").trim();
  const isSentenceOrder = item.type === "sentence_order" || item.category === "문장 순서";

  if (isSentenceOrder) {
    return "다음 중 순서에 맞게 배열한 것을 고르십시오.";
  }

  if (isInstructionLikeQuestion(question, instruction) && passage && !hasImage(item)) {
    return passage;
  }

  if (question) {
    return question;
  }

  if (passage) {
    return passage;
  }

  return instruction || "물음에 답하십시오.";
}

function usesPassageAsQuestionText(item) {
  const question = removeOriginalNumberPrefix(item.question || "");
  const instruction = cleanInstructionForPrint(item.instruction || "");
  const passage = String(item._passage || item.passage || "").trim();

  if (!passage) {
    return false;
  }

  if (item.type === "sentence_order" || item.category === "문장 순서") {
    return false;
  }

  if (item.type === "sentence_insert" || item.category === "문장 삽입") {
    return false;
  }

  if (hasImage(item)) {
    return false;
  }

  if (isSamePrintableText(question, passage)) {
    return true;
  }

  return isInstructionLikeQuestion(question, instruction);
}


function isSamePrintableText(a, b) {
  return normalizePrintableText(a) === normalizePrintableText(b);
}

function normalizePrintableText(text) {
  return String(text || "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\(각\s*\d+\s*점\)/g, "")
    .replace(/\s+/g, "")
    .replace(/[.。]/g, "")
    .trim();
}

function isInstructionLikeQuestion(question, instruction) {
  const q = normalizeInstructionText(question);
  const i = normalizeInstructionText(instruction);

  if (!q || !i) {
    return false;
  }

  if (q === i) {
    return true;
  }

  return q.includes(i) || i.includes(q);
}

function normalizeInstructionText(text) {
  return normalizePrintableText(text);
}

function hasImage(item) {
  return Boolean(String(item._imageUrl || item.image_url || "").trim());
}

function renderQuestionBlock(item, displayNumber, teacherMode) {
  const isSentenceOrder = item.type === "sentence_order" || item.category === "문장 순서";
  const optionLabelHtml = isSentenceOrder
    ? `<div class="options-label">선택지 4개</div>`
    : "";

  const questionText = getPrintableQuestionText(item);

  return `
    <div class="question-block">
      <p class="question-title">
        [${displayNumber}번] ${formatText(questionText, item)}
        ${teacherMode ? `<span class="source-note">정답 ${escapeHtml(toOptionSymbol(item._answer))}</span>` : ""}
      </p>
      ${optionLabelHtml}
      ${renderOptions(item)}
    </div>
  `;
}

function renderSentenceOrderMaterial(item) {
  const sentenceItems = item.sentence_items || item.sentence_blocks || parseSentenceBlocks(item._passage);
  const listHtml = sentenceItems.length
    ? `
      <div class="sentence-list">
        <div class="options-label">배열할 문장 4개</div>
        ${sentenceItems.map(function (sentence) {
          const label = sentence.label || "";
          const text = sentence.text || "";
          return `<div class="sentence-item"><span class="sentence-label">${escapeHtml(label)}</span>${formatText(text, item)}</div>`;
        }).join("")}
      </div>
    `
    : renderPassage(item);

  return listHtml;
}

function renderImage(item) {
  const imageUrl = normalizeImageUrl(item._imageUrl || item.image_url || "");
  if (!imageUrl) return "";

  return `
    <div class="image-wrap">
      <img src="${escapeAttribute(imageUrl)}" alt="자료 이미지" />
    </div>
  `;
}

function renderPassage(item) {
  const passage = String(item._passage || item.passage || "");
  if (!passage.trim()) return "";

  return `<div class="passage">${formatText(passage, item)}</div>`;
}

function renderOptions(item) {
  const options = item._options || [];
  if (!options.length) {
    return `<div class="hint">선택지가 없는 문항입니다. 원본 문항 데이터를 확인하세요.</div>`;
  }

  const isSentenceOrder = item.type === "sentence_order" || item.category === "문장 순서";
  const optionCountNotice =
    isSentenceOrder && options.length !== 4
      ? `<div class="hint">문장 순서 문항은 원본 선택지 4개가 필요합니다. 현재 ${options.length}개입니다.</div>`
      : "";

  return `
    ${optionCountNotice}
    <ol class="options">
      ${options.map(function (option) {
        return `
          <li>
            <span class="option-number">${escapeHtml(toOptionSymbol(option.number))}</span>
            ${formatText(option.text, item)}
          </li>
        `;
      }).join("")}
    </ol>
  `;
}

function renderAnswerOnlyPaper(items, config) {
  elements.printArea.innerHTML = `
    <div class="paper">
      <div class="paper-title">
        <h1>${escapeHtml(config.title)}</h1>
        <div class="meta">
          원본 문항 범위: ${config.rangeStart}~${config.rangeEnd}번 ·
          출력 문항 수: ${items.length}문항 ·
          출제 회차: ${config.selectedRounds.map((round) => `${round}회`).join(", ")}
        </div>
      </div>

      <section class="answer-section answer-only-section">
        <h2>정답표</h2>
        <table class="answer-table">
          <thead>
            <tr>
              <th>출력 번호</th>
              <th>정답</th>
              <th>원본 회차</th>
              <th>원본 번호</th>
              <th>유형</th>
              <th>진단 영역</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(function (item, index) {
              return `
                <tr>
                  <td>${index + 1}</td>
                  <td>${escapeHtml(toOptionSymbol(item._answer || ""))}</td>
                  <td>${escapeHtml(item._round)}회</td>
                  <td>${escapeHtml(item._originalNumber)}번</td>
                  <td>${escapeHtml(item.category || item.type || "")}</td>
                  <td>${escapeHtml(item.diagnostic_area || "")}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </section>
    </div>
  `;
}

function renderAnswerTable(items) {
  return `
    <section class="answer-section">
      <h2>정답표</h2>
      <table class="answer-table">
        <thead>
          <tr>
            <th>출력 번호</th>
            <th>정답</th>
            <th>원본 회차</th>
            <th>원본 번호</th>
            <th>유형</th>
            <th>진단 영역</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(function (item, index) {
            return `
              <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(toOptionSymbol(item._answer || ""))}</td>
                <td>${escapeHtml(item._round)}회</td>
                <td>${escapeHtml(item._originalNumber)}번</td>
                <td>${escapeHtml(item.category || item.type || "")}</td>
                <td>${escapeHtml(item.diagnostic_area || "")}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </section>
  `;
}

function parseSentenceBlocks(text) {
  const source = String(text || "");
  const pattern = /\((가|나|다|라)\)\s*([\s\S]*?)(?=\((?:가|나|다|라)\)\s*|$)/g;
  const result = [];
  let match;
  while ((match = pattern.exec(source)) !== null) {
    result.push({
      label: `(${match[1]})`,
      text: match[2].trim()
    });
  }
  return result;
}

function cleanInstructionForPrint(text) {
  return String(text || "")
    .replace(/^\s*\[\s*\d+\s*(?:~|-|–|—)\s*\d+\s*번?\s*\]\s*/, "")
    .replace(/^\s*\[\s*\d+\s*번?\s*\]\s*/, "")
    .trim();
}

function removeOriginalNumberPrefix(text) {
  return String(text || "")
    .replace(/^\s*\[\s*\d+\s*(?:~|-|–|—)\s*\d+\s*번?\s*\]\s*/, "")
    .replace(/^\s*\[\s*\d+\s*번?\s*\]\s*/, "")
    .trim();
}

function normalizeImageUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";

  if (/^(https?:|data:|blob:)/i.test(value)) {
    return value;
  }

  let clean = value.replace(/^\.\//, "");
  clean = clean.replace(/^reading-test\//, "");

  if (clean.startsWith("images/")) {
    return `../reading-test/${clean}`;
  }

  if (clean.startsWith("../reading-test/")) {
    return clean;
  }

  return `../reading-test/${clean}`;
}

function formatText(text, item = {}) {
  let html = escapeHtml(String(text || ""));
  const targets = [
    ...(Array.isArray(item.underline_targets) ? item.underline_targets : []),
    ...(Array.isArray(item.underlined_parts) ? item.underlined_parts : [])
  ].filter(Boolean);

  const uniqueTargets = [...new Set(targets)].sort((a, b) => String(b).length - String(a).length);

  uniqueTargets.forEach(function (target) {
    const escapedTarget = escapeHtml(String(target));
    if (!escapedTarget) return;
    html = html.split(escapedTarget).join(`<span class="underlined">${escapedTarget}</span>`);
  });

  return html.replace(/\n/g, "<br />");
}

function setStatus(message, isWarning = false) {
  elements.statusBox.textContent = message;
  elements.statusBox.classList.toggle("warning", Boolean(isWarning));
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function shuffleArray(array) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}


function toOptionSymbol(value) {
  const number = Number(value);
  const symbols = {
    1: "①",
    2: "②",
    3: "③",
    4: "④",
    5: "⑤"
  };

  return symbols[number] || String(value ?? "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
