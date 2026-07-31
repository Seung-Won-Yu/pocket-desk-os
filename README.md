<h1 align="center">PocketDesk OS</h1>

<p align="center">
  <strong>브라우저 안에서 직접 조작하는 Windows 11 스타일 데스크톱</strong>
</p>

<p align="center">
  부팅부터 바탕 화면, 창 관리, 파일 탐색기와 기본 앱까지 하나의 웹 애플리케이션으로 구현했습니다.
</p>

<p align="center">
  <a href="https://seung-won-yu.github.io/pocket-desk-os/"><strong>웹에서 바로 실행</strong></a>
  ·
  <a href="./DEPLOYMENT.md">배포 안내</a>
</p>

<p align="center">
  <a href="https://github.com/Seung-Won-Yu/pocket-desk-os/actions/workflows/ci.yml">
    <img alt="CI" src="https://github.com/Seung-Won-Yu/pocket-desk-os/actions/workflows/ci.yml/badge.svg">
  </a>
  <a href="https://github.com/Seung-Won-Yu/pocket-desk-os/actions/workflows/pages.yml">
    <img alt="GitHub Pages" src="https://github.com/Seung-Won-Yu/pocket-desk-os/actions/workflows/pages.yml/badge.svg">
  </a>
</p>

![PocketDesk OS 데스크톱](./public/brand/pocketdesk-social.png)

## PocketDesk OS

PocketDesk OS는 Windows 11의 데스크톱 사용 흐름을 웹에서 재현한 React 기반 시뮬레이터입니다. 단순한 화면 모형이 아니라 창 이동과 크기 조절, 파일 생성과 삭제, 앱 실행, 상태 저장까지 실제로 동작합니다.

새로고침해도 창 위치, 바탕 화면 아이콘, 테마와 가상 파일이 유지되며 데스크톱과 모바일 브라우저에서 설치 가능한 PWA로 사용할 수 있습니다.

## 구현된 Windows 경험 (Current Features)

| 영역 | 동작 |
| --- | --- |
| 시작 흐름 | 부팅, 잠금 화면, 로그인, 잠금, 재시작, 종료 |
| 데스크톱 | 아이콘 선택·이동·정렬, 그리드 맞춤, 이름 변경, 우클릭 메뉴 |
| 시작 메뉴 | 앱 목록, 검색, 고정 앱, 전원 메뉴 |
| 작업 표시줄 | 실행 앱 표시, 최소화·복원, 미리보기, 바탕 화면 보기 |
| 창 관리자 | 이동, 크기 조절, 최소화, 최대화, 스냅, 포커스, 다중 창 |
| 시스템 UI | 시스템 트레이, 달력, 알림 센터, 실행 창, 전환 효과 |
| 파일 시스템 | IndexedDB 기반 파일·폴더, 연결 앱, 휴지통, ZIP 가져오기·내보내기 |
| 상태 저장 | 창, 아이콘, 테마, 설정과 파일을 브라우저에 자동 보존 |

## 기본 앱

| 앱 | 지원 기능 |
| --- | --- |
| 내 PC | 기본 폴더, 로컬 디스크와 저장 상태 확인 |
| 파일 탐색기 | 탐색, 검색, 보기·정렬, 새 문서, 복사·붙여넣기, 이름 변경, 속성 |
| 휴지통 | 삭제 항목 복원, 영구 삭제, 휴지통 비우기 |
| Microsoft Edge | 주소 이동, 검색, 방문 기록, 창 안 웹 보기, 읽기 보기 |
| 메모장 | 여러 문서, 자동 저장, Markdown 미리보기 |
| 그림판 | 브러시, 지우개, 도형, 색상 선택, PNG 저장 |
| 계산기 | 일반·공학 계산과 키보드 입력 |
| 지뢰찾기 | 난이도 선택, 첫 클릭 보호, 타이머, 깃발, 승패와 최고 기록 |
| 설정 | 테마, 자체 제작 배경 화면 8종, 시스템 소리, 창 배치 초기화 |

## Edge와 사과게임

Microsoft Edge 앱은 주소를 새 탭으로 넘기지 않고 PocketDesk OS 창 안에서 먼저 엽니다.

- 주소 입력과 웹 검색
- 뒤로, 앞으로, 새로 고침, 홈
- 즐겨찾기와 방문 기록
- iframe을 허용하는 실제 웹사이트 표시
- iframe이 차단된 페이지의 읽기 보기
- 시작 화면의 **사과게임** 바로가기

사과게임은 [Apple Burst](https://seung-won-yu.github.io/apple-burst/) 데스크톱 버전을 Edge 창 안에서 바로 실행합니다.

## 주요 조작

| 입력 | 동작 |
| --- | --- |
| 더블클릭 | 바탕 화면 아이콘 또는 파일 실행 |
| 우클릭 | 바탕 화면·아이콘·파일 메뉴 열기 |
| `Alt + Tab` | 열린 창 전환 |
| `Alt + F4` | 현재 창 닫기 |
| `Win/⌘ + E` | 파일 탐색기 열기 |
| `Win/⌘ + R` | 실행 창 열기 |
| `Win/⌘ + D` | 바탕 화면 표시·복원 |
| `Ctrl + Alt + ←/→/↑` | 현재 창 스냅 |
| `F2` | 선택한 파일 또는 아이콘 이름 변경 |
| `Delete` | 선택 항목을 휴지통으로 이동 |
| `Ctrl + S` | 메모장 문서 저장 |

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| 애플리케이션 | React 18, TypeScript, Vite |
| 인터페이스 | CSS, lucide-react |
| 저장소 | localStorage, IndexedDB |
| 콘텐츠 | react-markdown |
| 테스트 | Playwright, 릴리즈 검증 스크립트 |
| 배포 | GitHub Actions, GitHub Pages |

## 로컬 실행

Node.js 20 이상을 권장합니다.

```bash
npm install
npm run dev
```

개발 서버는 기본적으로 `http://127.0.0.1:5173/`에서 실행됩니다.

프로덕션 빌드를 확인하려면 다음 명령을 실행합니다.

```bash
npm run build
npm run preview
```

## 품질 확인

```bash
npm run release:check
npm run qa:pages
npm run qa:smoke
```

| 명령 | 확인 범위 |
| --- | --- |
| `release:check` | 배포 필수 파일, PWA 자산, workflow와 문서 |
| `qa:pages` | `/pocket-desk-os/` 하위 경로 기준 GitHub Pages 빌드 |
| `qa:smoke` | 시작 메뉴, 앱, 파일, 휴지통과 창 관리의 실제 브라우저 흐름 |

## 프로젝트 구조

```text
src/App.tsx           데스크톱 셸, 창 관리자, 기본 앱과 상태 로직
src/styles.css        Windows 스타일 UI와 전환 효과
src/ErrorBoundary.tsx 앱 오류 복구 화면
public/brand/         PWA 아이콘과 공유 이미지
public/wallpapers/    프로젝트용 배경 화면
scripts/              릴리즈, Pages와 Playwright 검증
DEPLOYMENT.md         정적 호스팅과 배포 안내
```

## 데이터 저장 (Persistence Keys)

- 창, 아이콘, 테마와 앱 설정: `pocket-desk-*` localStorage
- 파일, 폴더와 바로가기: `pocket-desk-vfs` IndexedDB
- 백업과 복원: 파일 탐색기의 ZIP 내보내기·가져오기

모든 데이터는 사용 중인 브라우저에 저장되며 브라우저 사이트 데이터를 지우면 초기화됩니다.

## 개발 로드맵 (Development Roadmap)

- [x] Windows 11 스타일 데스크톱 셸과 창 관리자
- [x] IndexedDB 가상 파일 시스템과 휴지통
- [x] 기본 앱, 파일 연결과 브라우저 내 웹 실행
- [x] PWA, 자동 테스트와 GitHub Pages 배포
- [ ] 앱 모듈 분리와 장기 유지보수 구조 개선

## 배포

`main` 브랜치에 푸시하면 GitHub Actions가 빌드와 릴리즈 검사를 수행하고, Pages workflow가 결과물을 자동 배포합니다.

- 서비스: [seung-won-yu.github.io/pocket-desk-os](https://seung-won-yu.github.io/pocket-desk-os/)
- 배포 설정: [DEPLOYMENT.md](./DEPLOYMENT.md)

## 웹 실행 범위

PocketDesk OS는 브라우저 기반 시뮬레이터입니다. Windows 실행 파일, 장치 드라이버와 운영체제용 설치 프로그램은 실행하지 않습니다. 외부 웹사이트는 해당 사이트의 iframe 보안 정책에 따라 창 안 표시가 제한될 수 있습니다.

Microsoft Windows의 프로그램 파일, 로고와 공식 배경 화면은 포함하지 않았으며 프로젝트의 시각 자산은 별도로 제작했습니다.
