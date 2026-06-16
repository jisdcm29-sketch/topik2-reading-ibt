TOPIK II practice-print 연결 오류 수정 패키지

1. 증상
TOPIK II 인증 화면에서 '유형별 문제지 출력 열기' 버튼을 누르면
TOPIK II가 아니라 TOPIK I 문제지 출력 화면이 열리는 문제가 있었습니다.

2. 원인
reading-test의 연결 버튼은 ../practice-print/index.html을 열고 있습니다.
따라서 practice-print 폴더 안에 TOPIK I용 index.html/practice-print.js가 들어 있으면
TOPIK II 인증 화면에서도 TOPIK I 출력 화면이 열립니다.

3. 수정 내용
아래 파일을 TOPIK II 전용 파일로 교체합니다.

practice-print/index.html
practice-print/practice-print.js
reading-test/practice-print-link.js

4. 적용 전 백업
아래 파일들을 먼저 백업하세요.

C:\topik2-reading-ibt\practice-print\index.html
C:\topik2-reading-ibt\practice-print\practice-print.js
C:\topik2-reading-ibt\reading-test\practice-print-link.js

백업 이름 예시:
index_BACKUP_before_topik2_practice_print_fix.html
practice-print_BACKUP_before_topik2_practice_print_fix.js
practice-print-link_BACKUP_before_topik2_practice_print_fix.js

5. 적용 위치
압축을 푼 뒤 폴더 구조 그대로 아래 위치에 넣으세요.

C:\topik2-reading-ibt\

6. 확인 주소
TOPIK II 인증 화면:
http://localhost:5500/reading-test/index.html?v=topik2_practice_print_link_fix

TOPIK II 유형별 문제지 출력 화면:
http://localhost:5500/practice-print/index.html?v=topik2_practice_print_final_1

7. 확인할 부분
- TOPIK II 인증 화면에서 유형별 문제지 출력 열기 버튼을 누릅니다.
- 새 탭의 제목이 'TOPIK II 읽기 유형별 문제지 출력'인지 확인합니다.
- 설명 문구가 'TOPIK II PBT 읽기 1~50번 기준'인지 확인합니다.
- 원본 문항 번호 범위가 1~50 기준인지 확인합니다.
- 출제 회차 목록에 93회, 94회, 96회, 97회, 99회, 100회, 102회, 103회가 보이는지 확인합니다.
- 원본 1~4번을 출력하면 8회차 기준 32문항이 생성되는지 확인합니다.

8. 주의
이번 패키지는 reading-test.js, reading-diagnosis.js, question-bank.json을 수정하지 않습니다.
문제는 연결 대상인 practice-print 폴더가 TOPIK I 파일이었던 것이므로,
practice-print 폴더의 index.html과 practice-print.js를 TOPIK II 파일로 교체하는 방식이 가장 안전합니다.
