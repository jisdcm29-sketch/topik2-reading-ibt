TOPIK II 읽기 PBT형 IBT 문제은행 52회 병합 패키지
작성일: 2026-07-13
병합 시각: 2026-07-13T15:50:46

============================================================
1. 작업 목적
============================================================

이 패키지는 기존 950문항 question-bank.json에 52회 TOPIK II 읽기 50문항을 병합한 결과물입니다.

이 프로그램은 공식 TOPIK II IBT 복제 프로그램이 아니라,
TOPIK II PBT 읽기 문제를 컴퓨터 화면에서 풀 수 있도록 구현한
PBT형 IBT 시뮬레이션용 문제은행입니다.

============================================================
2. 적용 위치
============================================================

아래 파일을 실제 프로젝트 폴더에 적용합니다.

적용 파일:
C:\topik2-reading-ibt\reading-test\data\bank\question-bank.json

병합 전 백업 권장 파일명:
C:\topik2-reading-ibt\reading-test\data\bank\question-bank_BACKUP_before_52_merge_950.json

이 패키지 안에는 백업용 원본도 함께 포함되어 있습니다.
패키지 내부 경로:
reading-test/data/bank/question-bank_BACKUP_before_52_merge_950.json

============================================================
3. 병합 결과
============================================================

병합 전 문제은행:
- 총 문항: 950문항
- 단일 문항: 665문항
- 공통 지문 세트: 133세트
- 공통 지문 문항: 285문항

추가한 회차:
- 52회 50문항
- 단일 문항: 35문항
- 공통 지문 세트: 7세트
- 공통 지문 문항: 15문항

병합 후 문제은행:
- 총 문항: 1000문항
- 단일 문항: 700문항
- 공통 지문 세트: 140세트
- 공통 지문 문항: 300문항
- 최상위 passage_set_items: 300문항

포함 회차:
52, 55, 57, 60, 63, 64, 78, 81, 83, 87, 89, 91, 93, 94, 96, 97, 99, 100, 102, 103

회차별 문항 수:
{
  "52": 50,
  "55": 50,
  "57": 50,
  "60": 50,
  "63": 50,
  "64": 50,
  "78": 50,
  "81": 50,
  "83": 50,
  "87": 50,
  "89": 50,
  "91": 50,
  "93": 50,
  "94": 50,
  "96": 50,
  "97": 50,
  "99": 50,
  "100": 50,
  "102": 50,
  "103": 50
}

============================================================
4. 중요 보정 사항
============================================================

기존 950문항 question-bank.json은 실제 passage_sets[].items 기준으로는
공통 지문 문항이 285문항이었지만, 최상위 passage_set_items 배열에는
225문항만 들어 있었습니다.

이번 병합에서는 시험 실행과 랜덤 출제 안정성을 위해
최상위 passage_set_items 배열을 전체 passage_sets[].items 기준으로
다시 재생성했습니다.

보정 후:
- passage_sets[].items 합계: 300
- 최상위 passage_set_items: 300
- 두 목록의 문항 ID 순서 일치: True

============================================================
5. 특수 문항 보존 확인
============================================================

52회 14번 문장 순서 분기 데이터:
- sentence_order_branch_map: 보존됨
- sentence_order_input_mode: branch_map
- correct_answer: 2
- correct_answer_order: ['나', '다', '라', '가']

52회 원본 번호:
- 1~50번 누락: []
- 중복: []
- 총점: 100점

============================================================
6. 검증 결과
============================================================

검증 상태:
OK

주요 검증:
- 병합 후 총 문항 1000: OK
- 단일 문항 700: OK
- 공통 지문 세트 140: OK
- 공통 지문 문항 300: OK
- 최상위 passage_set_items 300: OK
- 52회 50문항 추가: OK
- 전체 회차별 50문항 유지: OK
- 문항 ID 중복 0: OK
- passage set ID 중복 0: OK

상세 검증 파일:
reading-test/data/bank/VALIDATION_52_question_bank_merge_1000.json

============================================================
7. 적용 후 확인 방법
============================================================

1) 파일 교체
C:\topik2-reading-ibt\reading-test\data\bank\question-bank.json

2) 로컬 서버 실행
cd C:\topik2-reading-ibt
python -m http.server 5500

3) 브라우저 실행
http://localhost:5500/reading-test/index.html?v=bank52merge1000

4) 확인 항목
- 랜덤 실전시험 50문항 생성
- 랜덤 레벨테스트 생성
- 52회 문항이 랜덤 후보로 포함되는지 확인
- 공통 지문 세트가 분리되지 않고 함께 출제되는지 확인
- 52회 14번 문장 순서 분기 UI가 유지되는지 확인
- 제출 후 진단 보고서 연결 확인

브라우저 캐시가 남아 있으면 Ctrl+F5로 강력 새로고침하거나
URL의 ?v=bank52merge1000 값을 바꿔 다시 확인하십시오.

============================================================
8. GitHub 업로드
============================================================

필수 업로드:
reading-test/data/bank/question-bank.json

권장 보관:
reading-test/data/bank/question-bank_BACKUP_before_52_merge_950.json
reading-test/data/bank/question-bank-52-addon-normalized.json
reading-test/data/bank/VALIDATION_52_question_bank_merge_1000.json
reading-test/data/bank/README_52_question_bank_merge_1000.txt

주의:
GitHub Pages 적용 후에는 아래 URL로 JSON 404 여부를 직접 확인하십시오.

https://사용자명.github.io/저장소명/reading-test/data/bank/question-bank.json

============================================================
9. 파일 목록
============================================================

reading-test/data/bank/question-bank.json
reading-test/data/bank/question-bank_BACKUP_before_52_merge_950.json
reading-test/data/bank/question-bank-52-addon-normalized.json
reading-test/data/bank/VALIDATION_52_question_bank_merge_1000.json
reading-test/data/bank/README_52_question_bank_merge_1000.txt
