TOPIK II 읽기 유형별 문제지 출력 도구

1. 목적
이 폴더는 기존 reading-test, reading-diagnosis와 분리된 출력 전용 도구입니다.
기존 시험 실행 기능과 진단 기능을 수정하지 않습니다.

2. 설치 위치
C:\topik2-reading-ibt\practice-print\index.html
C:\topik2-reading-ibt\practice-print\practice-print.js
C:\topik2-reading-ibt\practice-print\README.txt

3. 실행 방법
PowerShell:
cd C:\topik2-reading-ibt
python -m http.server 5500

브라우저:
http://localhost:5500/practice-print/index.html?v=practice_print_1

4. 사용 방법
- 원본 시작 번호와 원본 끝 번호를 입력합니다.
  예: 1~4번 유형만 모으려면 시작 1, 끝 4
- 출력 문항 수를 입력합니다.
  0이면 가능한 전체 문항을 출력합니다.
- 현재 94·96·97·99·100·102·103회 7개 회차 기준으로 1~4번은 총 28문항입니다.
- 30문항이 필요하면 '부족하면 중복 허용'을 체크하세요.
- [문제지 미리보기 생성]을 누른 뒤 [PDF로 인쇄 / 저장]을 누릅니다.

5. 안전 원칙
- 이 도구는 question-bank.json을 읽기만 합니다.
- reading-test.js, reading-diagnosis.js를 수정하지 않습니다.
- 학생 시험 화면에는 영향을 주지 않습니다.
- 앞으로 새 회차를 question-bank.json에 추가하면 자동으로 후보 문항 수가 늘어납니다.

6. GitHub 업로드 위치
practice-print/index.html
practice-print/practice-print.js
practice-print/README.txt
