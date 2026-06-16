"use strict";

/*
  TOPIK II 읽기 인증 화면 → 교사용 문제지 출력 화면 연결 버튼

  안전 원칙
  - reading-test.js를 수정하지 않습니다.
  - 시험 시작, 채점, 진단 보고서 기능과 연결하지 않습니다.
  - 인증/시작 화면에 버튼 1개만 추가합니다.
  - 버튼은 새 탭으로 practice-print 화면을 엽니다.
*/

(function () {
  const BUTTON_ID = "practicePrintLinkButton";
  const BOX_ID = "practicePrintLinkBox";
  const PRACTICE_PRINT_URL = "../practice-print/index.html?v=from_reading_auth";

  function openPracticePrint() {
    window.open(PRACTICE_PRINT_URL, "_blank", "noopener,noreferrer");
  }

  function createPracticePrintLinkBox() {
    if (document.getElementById(BOX_ID)) {
      return;
    }

    const startBody = document.querySelector("#startScreen .start-body");
    const examSelectBox = document.querySelector("#startScreen .exam-select-box");
    const startScreen = document.getElementById("startScreen");

    if (!startBody && !startScreen) {
      console.warn("[practice-print-link] startScreen을 찾지 못했습니다.");
      return;
    }

    const box = document.createElement("div");
    box.id = BOX_ID;
    box.setAttribute("data-practice-print-link", "true");
    box.style.margin = "10px 0 12px";
    box.style.padding = "12px 14px";
    box.style.border = "1px solid #cfe0f5";
    box.style.borderRadius = "11px";
    box.style.background = "#f7fbff";

    const title = document.createElement("div");
    title.textContent = "교사용 문제지 출력";
    title.style.fontWeight = "900";
    title.style.color = "#003f8f";
    title.style.marginBottom = "5px";
    title.style.fontSize = "15px";
    title.style.textAlign = "center";

    const desc = document.createElement("div");
    desc.textContent = "원본 문항 번호 범위로 유형별 문제지와 정답표를 PDF로 저장합니다.";
    desc.style.color = "#5f6368";
    desc.style.fontSize = "12px";
    desc.style.lineHeight = "1.45";
    desc.style.marginBottom = "8px";
    desc.style.textAlign = "center";

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "유형별 문제지 출력 열기";
    button.style.width = "100%";
    button.style.minHeight = "42px";
    button.style.padding = "9px 12px";
    button.style.border = "2px solid #0877f2";
    button.style.borderRadius = "10px";
    button.style.background = "#ffffff";
    button.style.color = "#0877f2";
    button.style.fontWeight = "900";
    button.style.cursor = "pointer";
    button.style.fontSize = "15px";
    button.style.fontFamily = "inherit";

    button.addEventListener("click", openPracticePrint);

    box.appendChild(title);
    box.appendChild(desc);
    box.appendChild(button);

    if (examSelectBox) {
      examSelectBox.insertAdjacentElement("afterend", box);
      return;
    }

    if (startBody) {
      startBody.insertBefore(box, startBody.firstChild);
      return;
    }

    startScreen.appendChild(box);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createPracticePrintLinkBox);
  } else {
    createPracticePrintLinkBox();
  }
})();
