"use strict";

/**
 * TOPIK II Reading Question Generator
 * 파일 위치:
 * C:\topik2-separated-system\reading-test\question-generator.js
 *
 * 역할:
 * 1. exam-template.json 읽기
 * 2. question-bank.json 읽기
 * 3. 회차 고정 출제 또는 랜덤 출제 생성
 * 4. generated-reading-questions.json 생성
 *
 * 실행 예:
 * node question-generator.js --mode round --round 103
 * node question-generator.js --mode random
 */

const fs = require("fs");
const path = require("path");

const CONFIG = {
  baseDir: __dirname,
  templateFile: "exam-template.json",
  bankFile: "question-bank.json",
  outputFile: "generated-reading-questions.json",
  defaultMode: "round",
  defaultRound: "103"
};

function main() {
  const args = parseArgs(process.argv.slice(2));

  const mode = args.mode || CONFIG.defaultMode;
  const round = args.round || CONFIG.defaultRound;
  const outputFile = args.out || CONFIG.outputFile;

  const templatePath = path.join(CONFIG.baseDir, CONFIG.templateFile);
  const bankPath = path.join(CONFIG.baseDir, CONFIG.bankFile);
  const outputPath = path.join(CONFIG.baseDir, outputFile);

  console.log("TOPIK II Reading Question Generator");
  console.log("----------------------------------");
  console.log(`출제 방식: ${mode}`);
  console.log(`출제 회차: ${round || "-"}`);
  console.log(`출력 파일: ${outputFile}`);

  const template = readJson(templatePath);
  const bank = readJson(bankPath);

  validateTemplate(template);
  validateBank(bank);

  const generationResult = generateExam({
    template,
    bank,
    mode,
    round
  });

  writeJson(outputPath, generationResult.questions);

  console.log("----------------------------------");
  console.log(`생성 문항 수: ${generationResult.questions.length}`);
  console.log(`출력 완료: ${outputPath}`);

  if (generationResult.warnings.length > 0) {
    console.log("----------------------------------");
    console.log("주의 / 확인 필요");
    generationResult.warnings.forEach((warning) => {
      console.log(`- ${warning}`);
    });
  }
}

function parseArgs(argv) {
  const args = {};

  argv.forEach((arg) => {
    if (!arg.startsWith("--")) {
      return;
    }

    const raw = arg.slice(2);
    const [key, ...rest] = raw.split("=");
    const value = rest.length ? rest.join("=") : true;

    args[key] = value;
  });

  return args;
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf-8");

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`JSON 형식 오류: ${filePath}\n${error.message}`);
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function validateTemplate(template) {
  if (!template || typeof template !== "object") {
    throw new Error("exam-template.json 구조가 올바르지 않습니다.");
  }

  if (!Array.isArray(template.single_slots)) {
    throw new Error("exam-template.json에 single_slots 배열이 없습니다.");
  }

  if (!Array.isArray(template.slot_groups)) {
    throw new Error("exam-template.json에 slot_groups 배열이 없습니다.");
  }
}

function validateBank(bank) {
  if (!bank || typeof bank !== "object") {
    throw new Error("question-bank.json 구조가 올바르지 않습니다.");
  }

  if (!Array.isArray(bank.single_items)) {
    throw new Error("question-bank.json에 single_items 배열이 없습니다.");
  }

  if (!Array.isArray(bank.passage_sets)) {
    throw new Error("question-bank.json에 passage_sets 배열이 없습니다.");
  }
}

function generateExam({ template, bank, mode, round }) {
  const warnings = [];
  const selectedQuestions = [];
  const usedKeys = new Set();

  const generationInfo = makeGenerationInfo(mode, round);

  template.single_slots.forEach((slotInfo) => {
    const selected = selectSingleItem({
      slotInfo,
      bank,
      mode,
      round,
      usedKeys,
      warnings
    });

    if (!selected) {
      warnings.push(
        `${slotInfo.slot}번 슬롯에 들어갈 단일 문항을 찾지 못했습니다. required_type=${slotInfo.required_type}`
      );
      return;
    }

    usedKeys.add(makeUseKey(selected));

    const normalized = normalizeSingleItem({
      item: selected,
      slotInfo,
      generationInfo
    });

    selectedQuestions.push(normalized);
  });

  template.slot_groups.forEach((groupInfo) => {
    const selectedSet = selectPassageSet({
      groupInfo,
      bank,
      mode,
      round,
      usedKeys,
      warnings
    });

    if (!selectedSet) {
      warnings.push(
        `[${groupInfo.slot_group.join(", ")}] 세트에 들어갈 공통 지문 세트를 찾지 못했습니다. required_set_type=${groupInfo.required_set_type}`
      );
      return;
    }

    usedKeys.add(makeSetUseKey(selectedSet));

    const normalizedSetItems = normalizePassageSet({
      passageSet: selectedSet,
      groupInfo,
      generationInfo
    });

    selectedQuestions.push(...normalizedSetItems);
  });

  selectedQuestions.sort((a, b) => Number(a.question_number) - Number(b.question_number));

  return {
    questions: selectedQuestions,
    warnings
  };
}

function makeGenerationInfo(mode, round) {
  if (mode === "random") {
    return {
      generated_exam_mode: "random",
      generated_exam_round: "",
      generated_exam_label: "랜덤 출제"
    };
  }

  if (mode === "sample") {
    return {
      generated_exam_mode: "sample",
      generated_exam_round: round || "103-sample",
      generated_exam_label: "103회 구조 샘플 7문항"
    };
  }

  return {
    generated_exam_mode: "round",
    generated_exam_round: round || "",
    generated_exam_label: `${round || ""}회 고정 출제`
  };
}

function selectSingleItem({ slotInfo, bank, mode, round, usedKeys }) {
  const candidates = bank.single_items.filter((item) => {
    if (usedKeys.has(makeUseKey(item))) {
      return false;
    }

    if (!isTargetSlotMatched(item, slotInfo.slot)) {
      return false;
    }

    if (item.type !== slotInfo.required_type) {
      return false;
    }

    if (mode === "round" && String(item.source_round) !== String(round)) {
      return false;
    }

    if (mode === "sample" && !String(item.source_round).includes("103")) {
      return false;
    }

    return true;
  });

  if (candidates.length === 0) {
    return null;
  }

  if (mode === "random") {
    return pickRandom(candidates);
  }

  return candidates[0];
}

function selectPassageSet({ groupInfo, bank, mode, round, usedKeys }) {
  const candidates = bank.passage_sets.filter((set) => {
    if (usedKeys.has(makeSetUseKey(set))) {
      return false;
    }

    if (set.set_type !== groupInfo.required_set_type) {
      return false;
    }

    if (!isSameSlotGroup(set.target_slots, groupInfo.slot_group)) {
      return false;
    }

    if (mode === "round" && String(set.source_round) !== String(round)) {
      return false;
    }

    if (mode === "sample" && !String(set.source_round).includes("103")) {
      return false;
    }

    return true;
  });

  if (candidates.length === 0) {
    return null;
  }

  if (mode === "random") {
    return pickRandom(candidates);
  }

  return candidates[0];
}

function normalizeSingleItem({ item, slotInfo, generationInfo }) {
  const questionNumber = Number(slotInfo.slot);

  return {
    id: item.id,
    source_round: item.source_round || "",
    source_pdf: item.source_pdf || "",
    question_number: questionNumber,
    original_question_number: Number(item.original_question_number || questionNumber),

    test_level: item.level || "TOPIK II",
    level: item.level || "TOPIK II",
    section: item.section || "reading",

    type: item.type || slotInfo.required_type,
    category: item.category || slotInfo.category || "미분류",
    diagnostic_area: item.diagnostic_area || slotInfo.diagnostic_area || "미분류",
    difficulty_band: item.difficulty_band || slotInfo.difficulty_band || "",
    question_zone: item.question_zone || slotInfo.question_zone || "",

    instruction: item.instruction || slotInfo.instruction || "",
    question: item.question || item.instruction || "",

    passage: item.passage || "",
    passage_template: item.passage_template || item.passage || "",
    blank_key: item.blank_key || "",

    sentence_blocks: item.sentence_blocks || [],
    insert_sentence: item.insert_sentence || "",
    insert_positions: item.insert_positions || [],

    options: normalizeOptions(item.options),
    answer: item.correct_answer,
    correct_answer: item.correct_answer,
    correct_answer_order: item.correct_answer_order || null,
    correct_position: item.correct_position || "",

    points: Number(item.points || slotInfo.points || 2),
    description: item.description || "",

    image_url: item.image_url || "",
    uses_image: Boolean(item.uses_image || item.image_url),
    image_status: item.image_status || "",

    interaction_mode: item.interaction_mode || slotInfo.interaction_mode || "single_choice",
    negative_focus_text: item.negative_focus_text || "",

    passage_group_id: null,
    passage_group_title: null,
    passage_group_numbers: [],
    shared_passage_index: null,
    shared_passage_total: null,
    shared_insert_enabled: false,
    shared_insert_keys: [],

    generated_exam_mode: generationInfo.generated_exam_mode,
    generated_exam_round: generationInfo.generated_exam_round,
    generated_exam_label: generationInfo.generated_exam_label
  };
}

function normalizePassageSet({ passageSet, groupInfo, generationInfo }) {
  const groupNumbers = groupInfo.slot_group.map(Number);
  const total = Array.isArray(passageSet.items) ? passageSet.items.length : 0;

  return passageSet.items.map((item, index) => {
    const slot = Number(item.target_slot || item.original_question_number || groupNumbers[index]);

    return {
      id: item.id,
      source_round: passageSet.source_round || "",
      source_pdf: passageSet.source_pdf || "",
      question_number: slot,
      original_question_number: Number(item.original_question_number || slot),

      test_level: passageSet.level || "TOPIK II",
      level: passageSet.level || "TOPIK II",
      section: passageSet.section || "reading",

      type: item.type || "",
      category: item.category || passageSet.category || "공통 지문",
      diagnostic_area: item.diagnostic_area || passageSet.diagnostic_area || "공통 지문 이해",
      difficulty_band: item.difficulty_band || passageSet.difficulty_band || "",
      question_zone: item.question_zone || passageSet.question_zone || groupInfo.question_zone || "",

      instruction: item.instruction || "",
      question: item.question || "",

      passage: passageSet.passage || "",
      passage_template: passageSet.passage_template || passageSet.passage || "",
      blank_key: item.blank_key || "",

      sentence_blocks: item.sentence_blocks || [],
      insert_sentence: item.insert_sentence || "",
      insert_positions: item.insert_positions || [],

      options: normalizeOptions(item.options),
      answer: item.correct_answer,
      correct_answer: item.correct_answer,
      correct_answer_order: item.correct_answer_order || null,
      correct_position: item.correct_position || "",

      points: Number(item.points || 2),
      description: item.description || "",

      image_url: passageSet.image_url || item.image_url || "",
      uses_image: Boolean(passageSet.uses_image || passageSet.image_url || item.image_url),
      image_status: passageSet.image_status || "",

      interaction_mode: item.interaction_mode || "single_choice",
      negative_focus_text: item.negative_focus_text || "",

      passage_group_id: passageSet.set_id,
      passage_group_title: passageSet.set_title || groupInfo.group_title || "",
      passage_group_numbers: groupNumbers,
      shared_passage_index: index + 1,
      shared_passage_total: total,
      shared_insert_enabled: Boolean(passageSet.shared_insert_enabled || groupInfo.shared_insert_enabled),
      shared_insert_keys: passageSet.shared_insert_keys || [],

      generated_exam_mode: generationInfo.generated_exam_mode,
      generated_exam_round: generationInfo.generated_exam_round,
      generated_exam_label: generationInfo.generated_exam_label
    };
  });
}

function normalizeOptions(options) {
  if (!Array.isArray(options)) {
    return [];
  }

  return options.map((option, index) => {
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

function isTargetSlotMatched(item, slot) {
  if (!Array.isArray(item.target_slots)) {
    return Number(item.original_question_number) === Number(slot);
  }

  return item.target_slots.map(Number).includes(Number(slot));
}

function isSameSlotGroup(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) {
    return false;
  }

  if (left.length !== right.length) {
    return false;
  }

  const a = left.map(Number).sort((x, y) => x - y);
  const b = right.map(Number).sort((x, y) => x - y);

  return a.every((value, index) => value === b[index]);
}

function makeUseKey(item) {
  return `${item.source_round || ""}::${item.original_question_number || ""}::${item.id || ""}`;
}

function makeSetUseKey(set) {
  return `SET::${set.source_round || ""}::${set.set_id || ""}`;
}

function pickRandom(items) {
  const index = Math.floor(Math.random() * items.length);
  return items[index];
}

try {
  main();
} catch (error) {
  console.error("----------------------------------");
  console.error("생성 실패");
  console.error(error.message);
  process.exit(1);
}