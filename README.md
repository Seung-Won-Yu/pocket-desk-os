# PocketDesk OS

[![CI](https://github.com/Seung-Won-Yu/pocket-desk-os/actions/workflows/ci.yml/badge.svg)](https://github.com/Seung-Won-Yu/pocket-desk-os/actions/workflows/ci.yml)
[![GitHub Pages](https://github.com/Seung-Won-Yu/pocket-desk-os/actions/workflows/pages.yml/badge.svg)](https://github.com/Seung-Won-Yu/pocket-desk-os/actions/workflows/pages.yml)

브라우저 안에서 실제로 조작할 수 있는 개인 웹 데스크톱입니다. 창 관리자, 시작 메뉴, 파일 시스템과 기본 앱을 하나의 React 애플리케이션으로 구현하고 사용자 상태를 브라우저에 보존합니다.

**[Open PocketDesk OS](https://seung-won-yu.github.io/pocket-desk-os/)** · **React 18** · **TypeScript** · **Vite** · **PWA**

![PocketDesk OS 미리보기](./public/brand/pocketdesk-social.png)

## 한눈에 보기

| 영역 | 구현 내용 |
| --- | --- |
| Desktop shell | 시작 메뉴, 작업 표시줄, 시스템 트레이, 알림 센터 |
| Window manager | 이동·크기 조절·최소화·최대화·스냅·Alt+Tab |
| Virtual file system | IndexedDB 파일·폴더, 연결 앱, 휴지통, ZIP 백업 |
| Built-in apps | 내 PC, 탐색기, 브라우저, 메모장, 그림판, 계산기, 지뢰찾기 |
| Persistence | 창·아이콘·설정은 localStorage, 파일은 IndexedDB |
| Distribution | PWA, GitHub Pages와 정적 호스팅 설정 |

## 포함된 앱

| 앱 | 주요 동작 |
| --- | --- |
| 내 PC | 드라이브와 기본 폴더, 시스템 상태 확인 |
| 파일 탐색기 | 보기·정렬·다중 선택·이름 변경·삭제·파일 연결 |
| 휴지통 | 삭제 항목 복원, 영구 삭제와 비우기 |
| 웹 브라우저 | 검색, 즐겨찾기, 방문 기록과 실제 새 탭 열기 |
| 메모장 | 여러 문서, 자동 저장과 Markdown 미리보기 |
| 그림판 | 브러시, 도형, 팔레트와 PNG 저장 |
| 계산기 | 일반·공학 모드와 키보드 입력 |
| 지뢰찾기 | 난이도, 타이머와 최고 기록 |
| 설정 | 테마, 배경화면, 창 배치와 시스템 소리 |

## 주요 기능 (Current Features)

- 드래그·리사이즈 가능한 다중 창과 z-index 관리
- 스냅 레이아웃, 창 시스템 메뉴, 작업 표시줄 미리보기
- 시작 메뉴 검색, 실행 창과 앱 별칭
- 바탕화면 아이콘 이동·크기·정렬·그리드 맞춤
- 부팅·잠금·재시작·종료 흐름
- 키보드 탐색과 `Ctrl+S`, `F2`, `Delete`, `Alt+Tab` 등 주요 단축키
- 자체 제작 배경화면 8종과 통일된 브랜드 아이콘

## 빠른 시작

```bash
npm install
npm run dev
```

기본 개발 주소는 `http://127.0.0.1:5173/`입니다.

프로덕션 빌드:

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
| `qa:pages` | `/pocket-desk-os/` 하위 경로 기준 Pages 빌드 |
| `qa:smoke` | Playwright 기반 시작 메뉴·앱·파일·휴지통·창 스냅 흐름 |

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| Frontend | React 18, TypeScript, Vite |
| UI | CSS, lucide-react |
| Storage | localStorage, IndexedDB |
| QA | Playwright, custom release scripts |
| Deploy | GitHub Actions, GitHub Pages, Vercel, Netlify |

## 프로젝트 구조

```text
src/App.tsx           데스크톱 셸, 기본 앱과 상태 로직
src/styles.css        전체 UI, 창과 앱 스타일
src/ErrorBoundary.tsx 앱 오류 복구 화면
public/brand/         로고, PWA와 공유 이미지
public/wallpapers/    자체 제작 배경화면
scripts/              릴리즈·Pages·브라우저 검증
DEPLOYMENT.md         정적 호스팅 안내
```

## 에셋 생성

```bash
npm run icons
npm run social:preview
```

아이콘과 소셜 미리보기는 프로젝트의 브랜드 소스와 실제 앱 화면을 기준으로 다시 생성할 수 있습니다.

## 개발 로드맵 (Development Roadmap)

현재 `0.1.0`은 데스크톱 셸, 가상 파일 시스템, 기본 앱, PWA와 자동 배포까지 한 번에 체험할 수 있는 공개 프로토타입입니다.

- [x] 창 관리자와 데스크톱 셸
- [x] IndexedDB 가상 파일 시스템과 휴지통
- [x] 기본 앱과 파일 연결
- [x] PWA·GitHub Pages·릴리즈 검증
- [ ] 앱 모듈 분리와 장기 유지보수 구조 개선

## 저장 정책 (Persistence Keys)

창, 테마, 아이콘과 앱 설정은 `pocket-desk-*` 접두사의 localStorage 키로 관리합니다. 파일·폴더·바로가기는 `pocket-desk-vfs` IndexedDB의 `entries` store에 저장됩니다. 브라우저 데이터를 지우면 로컬 데스크톱 상태도 함께 초기화됩니다.

## 배포

`main` 브랜치에 푸시하면 CI가 릴리즈와 Pages 빌드를 확인하고, 별도 Pages workflow가 `dist/`를 배포합니다. 자세한 호스팅 설정은 [DEPLOYMENT.md](./DEPLOYMENT.md)를 참고하세요.

## 참고

PocketDesk OS는 Microsoft Windows 파일, 로고 또는 배경화면을 포함하지 않습니다. 데스크톱 메타포만 참고했으며 브랜드와 시각 자산은 프로젝트용으로 별도 제작했습니다.
