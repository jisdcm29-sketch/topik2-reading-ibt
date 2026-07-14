TOPIK II 읽기 문제은행 47회 병합 패키지
==================================================

작업 목적
---------
기존 1000문항 question-bank.json에 47회 TOPIK II 읽기 50문항을 병합하여
1050문항 문제은행을 생성했습니다.

중요
----
이 패키지는 reading-test/data/bank/question-bank.json 교체용입니다.
기존 question-bank.json은 반드시 아래 이름으로 백업한 뒤 교체하세요.

백업 권장 파일명:
C:\topik2-reading-ibt\reading-test\data\bank\question-bank_BACKUP_before_47_merge_1000.json

생성 일시
---------
2026-07-14T18:03:58

병합 전 상태
------------
- total_bank_questions: 1000
- single_items: 700
- passage_sets: 140
- passage_set_items: 300
- top-level passage_set_items: 300

47회 addon 상태
---------------
- total_bank_questions: 50
- single_items: 35
- passage_sets: 7
- passage_set_items: 15
- 총점: 100점

병합 후 상태
------------
- total_bank_questions: 1050
- single_items: 735
- passage_sets: 147
- passage_set_items: 315
- top-level passage_set_items: 315
- source_round 47 문항 수: 50

검증 결과
---------
- 기존 source_round 47 없음: True
- 기존/47회 문항 ID 중복: 0
- 기존/47회 passage set ID 중복: 0
- 병합 후 ID 중복: 0
- 병합 후 passage set ID 중복: 0
- 각 회차 50문항 유지: True
- 최종 검증 상태: OK

47회 특수 문항 보존
-------------------
- 14번 분기형 문장 순서: sentence_order_branch_map 보존
- 23~24번 밑줄: 등에서 땀이 흘렀다
- 39번 문장 삽입: ㉢
- 40번 문장 삽입: ㉢
- 41번 문장 삽입: ㉡
- 42~43번 밑줄: 못 오겠냐?
- 46번 문장 삽입: ㉢
- 48~50번 공통 지문 유지
- 49번 공유 빈칸 유지
- 50번 밑줄: 실리콘밸리 모델 적용 움직임이 고무적이라는 문장 전체

포함 파일
---------
reading-test/data/bank/question-bank.json
reading-test/data/bank/question-bank_BACKUP_before_47_merge_1000.json
reading-test/data/bank/question-bank-47-addon.json
reading-test/data/bank/VALIDATION_47_question_bank_merge_1050.json
reading-test/data/bank/README_47_question_bank_merge_1050.txt

적용 방법
---------
1. 아래 폴더를 엽니다.
   C:\topik2-reading-ibt\reading-test\data\bank

2. 기존 question-bank.json을 백업합니다.
   question-bank_BACKUP_before_47_merge_1000.json

3. 이 패키지의 question-bank.json을 같은 위치에 넣어 교체합니다.

4. 로컬 서버를 실행합니다.
   cd C:\topik2-reading-ibt
   python -m http.server 5500

5. 브라우저에서 확인합니다.
   http://localhost:5500/reading-test/index.html?v=bank47merge1050

확인할 기능
-----------
- 랜덤 50문항 실전시험 생성
- 랜덤 레벨테스트 20문항 생성
- 47회 문항이 랜덤 후보에 포함되는지 확인
- 공통 지문 세트가 분리되지 않는지 확인
- 14번 분기형 문장 순서 구조 유지
- 39~41번, 46번 문장 삽입 구조 유지
- 42~43번 밑줄 “못 오겠냐?” 유지
- 50번 밑줄 유지
- 제출 후 진단 보고서 연결 정상 확인

SHA256
------
question-bank.json: ed276dce179836d82dd2a3211bf1ad39f713701dea3ae7804477662611071d1a
question-bank_BACKUP_before_47_merge_1000.json: 0fe4a360d3f39384684dec5f5bbd90fec06f7a6d4aeedeb8b1f5e7f63519605b
question-bank-47-addon.json: 72a6a5ca672927391ddc21a5783efd1ff166587caf904d3c552c6e4d36bcc567
VALIDATION_47_question_bank_merge_1050.json: 70f54875160ce92429bda961e27bf297b5728d6b7454a9d098ebff4fbd97d981
