TOPIK II 읽기 유형별 문제지 출력 도구 README

1. 용도
이 폴더는 TOPIK II 읽기 문제은행을 바탕으로 원본 문항 번호 범위별 문제지를 출력하는 별도 도구입니다.

이 도구는 공식 TOPIK II IBT 프로그램이 아닙니다.
TOPIK II PBT 읽기 문제를 화면 기반으로 정리하여 학생용 문제지와 교사용 정답표를 PDF로 저장하기 위한 보조 출력 화면입니다.

2. 실행 주소
로컬 서버 실행 후 아래 주소로 접속합니다.

http://localhost:5500/practice-print/index.html

GitHub Pages 배포 후에는 아래 형식으로 접속합니다.

https://사용자이름.github.io/저장소이름/practice-print/index.html

캐시 확인이 필요할 때는 주소 끝에 버전을 붙입니다.

https://사용자이름.github.io/저장소이름/practice-print/index.html?v=practice_print_final_1

3. 필요한 파일
이 도구가 정상 작동하려면 GitHub 저장소에 아래 파일이 있어야 합니다.

practice-print/index.html
practice-print/practice-print.js
practice-print/README.txt

그리고 문제은행 파일은 아래 위치에 있어야 합니다.

reading-test/data/bank/question-bank.json

4. 연결 구조
practice-print/index.html은 practice-print/practice-print.js를 불러옵니다.
practice-print/practice-print.js는 ../reading-test/data/bank/question-bank.json 파일을 읽어 문제지를 만듭니다.

따라서 practice-print 폴더와 reading-test 폴더는 같은 상위 폴더 안에 있어야 합니다.

올바른 구조 예시:

/
├─ reading-test/
│  └─ data/
│     └─ bank/
│        └─ question-bank.json
│
└─ practice-print/
   ├─ index.html
   ├─ practice-print.js
   └─ README.txt

5. 주요 기능
- 원본 시작 번호와 끝 번호를 선택해 유형별 문제지 생성
- 선택한 회차만 출력
- 출력 문항 수 지정
- 부족할 때 중복 허용 선택
- 회차·원본 번호순 또는 랜덤 출력 선택
- 문제에 원본 회차·원본 번호 표시
- 학생용 문제지 PDF 저장
- 문제지+정답표 PDF 저장
- 교사용 정답표 PDF 저장
- 선택지 번호 ①②③④ 표시
- 문장 순서 문항의 배열 문장 4개와 선택지 4개 표시
- 문제 문장 중복 출력 방지
- 인증 화면으로 돌아가기 버튼 제공

6. 버튼 설명
문제지 미리보기 생성:
현재 선택한 조건으로 화면에 문제지를 먼저 보여 줍니다.

학생용 문제지 PDF로 인쇄 / 저장:
정답표 없이 학생용 문제지만 PDF로 저장합니다.

문제지+정답표 PDF로 인쇄 / 저장:
문제지 뒤에 정답표를 붙여 하나의 PDF로 저장합니다.

교사용 정답표 PDF로 인쇄 / 저장:
문제 없이 정답표만 PDF로 저장합니다.

초기화:
출력 조건을 기본값으로 되돌립니다.

7. 사용 방법
1) 원본 시작 번호와 원본 끝 번호를 입력합니다.
   예: 1번부터 4번 유형만 모으려면 시작 1, 끝 4로 설정합니다.

2) 출력 문항 수를 입력합니다.
   0으로 두면 가능한 전체 문항을 출력합니다.
   현재 7개 회차가 있을 경우 1~4번 범위는 7회차 × 4문항 = 28문항입니다.

3) 출제 회차를 선택합니다.

4) 문제지 제목을 확인합니다.
   제목은 원본 번호 범위에 맞게 자동 변경됩니다.

5) 필요한 출력 버튼을 누릅니다.
   학생용 문제지만 필요하면 학생용 문제지 PDF로 인쇄 / 저장을 누릅니다.
   정답표까지 함께 필요하면 문제지+정답표 PDF로 인쇄 / 저장을 누릅니다.
   정답표만 필요하면 교사용 정답표 PDF로 인쇄 / 저장을 누릅니다.

8. 인쇄 및 PDF 저장
브라우저 인쇄 창이 열리면 프린터 대상을 PDF로 저장으로 선택합니다.
용지 크기는 A4를 권장합니다.
배경 그래픽 옵션이 있으면 켜는 것을 권장합니다.

9. GitHub Pages 주의 사항
- file:/// 방식으로 직접 열지 말고 로컬 서버 또는 GitHub Pages에서 실행합니다.
- GitHub Pages에 올린 뒤 이전 화면이 보이면 주소 끝에 ?v=practice_print_final_1을 붙입니다.
- 그래도 이전 JS가 보이면 Ctrl+F5로 새로고침합니다.
- question-bank.json 경로가 깨지면 문제지가 생성되지 않습니다.

10. 업로드 위치
이 README.txt 파일은 GitHub 저장소의 아래 위치에 올립니다.

practice-print/README.txt

이미 README.txt가 있으면 이 파일로 교체합니다.
ZIP 파일, 백업 파일, 테스트용 PDF 파일은 GitHub에 올리지 않습니다.

11. 수정하지 않아야 할 파일
이 출력 도구만 사용할 때는 아래 파일을 수정하지 않습니다.

reading-test/reading-test.js
reading-diagnosis/reading-diagnosis.js
reading-test/data/exam-manifest.json
reading-test/data/bank/question-bank.json

문제은행을 확장할 때만 question-bank.json을 별도로 관리합니다.
