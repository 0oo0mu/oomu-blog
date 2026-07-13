---
title: Step05_AppData_경로이전
date: 2026-07-13
category: 개발/C++
tags: []
---

# Step 05 — 저장 위치를 사용자 폴더(AppData)로 이전

파일: `Mevolve/Main.cpp` · 계층: Data(경로) + UI

---

## 1. 이번 단계 목표
메모 저장 파일을 작업 폴더가 아니라 **사용자별 정식 위치** `...\AppData\Roaming\Mevolve\memo.txt`에 저장/불러오게 바꾼다.

## 2. 왜 필요한가
- 작업 폴더(상대 경로)는 실행 방식·위치에 따라 매번 달라져서 저장 파일이 흩어진다.
- Program Files 같은 곳은 일반 사용자 권한으로 쓰기가 막힌다(관리자 권한 요구 = 우리 철학에 어긋남).
- **AppData\Roaming**은 각 사용자 계정마다 따로 있고, 관리자 권한 없이 앱이 자유롭게 읽고 쓸 수 있는 **표준 앱 데이터 위치**다. 나중에 SQLite db, 설정, 사용자 진행도도 전부 여기 둔다.

## 3. 먼저 알아야 할 개념
- **Known Folder(알려진 폴더)**: Windows가 관리하는 표준 폴더(문서, 바탕화면, AppData 등)를 ID로 조회. `SHGetKnownFolderPath` + `FOLDERID_RoamingAppData`.
- 이 API는 문자열 메모리를 **직접 할당**해 주므로, 다 쓰면 `CoTaskMemFree`로 **반드시 해제**해야 한다(메모리 누수 방지).
- **폴더 생성**: `CreateDirectoryW`. 이미 있으면 그냥 무시된다.
- 앞서 Save/Load 함수를 "경로를 인자로 받게" 만들어둔 덕분에, 경로만 바꿔 넘기면 되고 저장 로직은 안 건드린다(계층 분리의 이점).

## 4. 폴더/파일 구조
```
C:\Users\<사용자>\AppData\Roaming\Mevolve\
└── memo.txt        ← 이제 여기 저장됨
```
(탐색기 주소창에 `%AppData%\Mevolve` 입력하면 바로 열림)

## 5. 변경 요약
- 상단에 `#include <shlobj.h>` 추가.
- `#pragma comment(lib, "Shell32.lib")` / `"Ole32.lib"` 추가 — 필요한 라이브러리를 코드에서 자동 링크(프로젝트 속성 안 건드림).
- 전역 `MEMO_FILE` 제거 → 대신 `GetMemoFilePath()` 함수가 매번 경로를 계산.
- Save/Load 함수 시그니처를 `const std::wstring& path`로(문자열 경로) 통일.
- WM_COMMAND의 저장/불러오기에서 먼저 `GetMemoFilePath`로 경로를 구해 사용.

## 6. 코드 상세 설명 (핵심 신규 부분)

**`#include <shlobj.h>`** — 쉘(탐색기) 관련 API. Known Folder 함수와 `FOLDERID_*` 상수가 여기 있음.

**`#pragma comment(lib, "Shell32.lib")` / `"Ole32.lib"`**
- `#pragma comment(lib, ...)`는 "이 라이브러리를 링크하라"고 컴파일러에 지시하는 특수 명령.
- `SHGetKnownFolderPath`는 Shell32.lib, `CoTaskMemFree`는 Ole32.lib에 들어있음. 이 두 줄이 없으면 "unresolved external symbol" 링커 오류가 날 수 있어, 프로젝트 설정 대신 코드로 간단히 해결.

**`bool GetMemoFilePath(std::wstring& outPath)`**
- `std::wstring& outPath` : 결과 경로를 담아 돌려줄 **참조 매개변수**(호출자의 변수에 직접 채움).
- `PWSTR appDataPath = nullptr;` : `PWSTR`은 `wchar_t*`(wide 문자열 포인터). API가 여기에 새 문자열을 할당해 넣어줄 것이라 처음엔 비워둠.
- `HRESULT hr = SHGetKnownFolderPath(FOLDERID_RoamingAppData, 0, nullptr, &appDataPath);`
  - `HRESULT` : COM 계열 함수의 성공/실패 코드 타입.
  - `FOLDERID_RoamingAppData` : "AppData\Roaming" 폴더를 가리키는 ID.
  - `0` : 기본 플래그. `nullptr` : 현재 사용자 토큰(기본).
  - `&appDataPath` : 함수가 경로 문자열을 할당해서 이 포인터에 넣어줌.
- `if (FAILED(hr)) { CoTaskMemFree(appDataPath); return false; }`
  - `FAILED(hr)` : 실패면 참. 실패해도 혹시 할당됐을 수 있어 안전하게 해제 후 false.
- `std::wstring folder = appDataPath;` : C 문자열을 std::wstring으로 복사(다루기 쉽게).
- `CoTaskMemFree(appDataPath);` : **API가 할당한 메모리 해제**. 이걸 안 하면 부를 때마다 메모리가 조금씩 샌다.
- `folder += L"\\Mevolve";` : 경로 뒤에 우리 앱 폴더 붙이기. `\\`는 문자열 안에서 역슬래시 하나(`\`)를 뜻함(이스케이프).
- `CreateDirectoryW(folder.c_str(), nullptr);` : 그 폴더 생성. 이미 있으면 실패를 반환하지만 무시해도 됨(있으면 그만).
- `outPath = folder + L"\\memo.txt";` : 최종 파일 경로 완성.

**Save/Load 시그니처 변경**: 경로를 `const std::wstring&`로 받게 하고 내부에서 `path.c_str()` 사용. 나머지 로직은 Step 04와 동일.

**WM_COMMAND**: 저장/불러오기 각각에서 `GetMemoFilePath(path)`를 먼저 호출해 경로 확보 → 실패 시 에러 MessageBox 후 종료, 성공 시 기존처럼 저장/불러오기.

## 7. 실행 방법
`Mevolve.slnx` → `Ctrl+Shift+B` → `Ctrl+F5`.

## 8. 확인해야 할 정상 동작
1. 글 입력 → [저장] → "저장했어요."
2. 탐색기 주소창에 `%AppData%\Mevolve` 입력 → `memo.txt`가 실제로 생성돼 있음(메모장으로 열면 한글 정상).
3. 창 껐다 다시 실행 → [불러오기] → 내용 복원.
4. 이전 Step에서 작업 폴더에 생겼던 memo.txt는 이제 사용 안 함(지워도 됨).

## 9. 자주 발생하는 오류와 해결
- **`unresolved external symbol SHGetKnownFolderPath / CoTaskMemFree`**: 라이브러리 링크 누락 → `#pragma comment(lib, "Shell32.lib")` / `"Ole32.lib"` 확인.
- **`FOLDERID_RoamingAppData` 정의 안 됨**: `#include <shlobj.h>` 누락.
- **저장은 되는데 위치 못 찾음**: `%AppData%`는 Roaming을 가리킴. `%LocalAppData%`(=Local)와 다름. 우리는 Roaming 사용.
- **한글 경로(사용자명) 문제**: wide(W) API + wstring이라 정상. ANSI 함수 섞지 말 것.

## 10. 이번 단계에서 배운 내용
Known Folder로 표준 앱 데이터 경로 얻기, API가 할당한 메모리를 CoTaskMemFree로 해제하는 규칙, CreateDirectoryW로 폴더 생성, `#pragma comment(lib)`로 라이브러리 링크, 그리고 경로를 인자로 분리해둔 설계 덕에 저장 로직을 안 건드리고 위치만 바꾼 경험.

## 11. 다음 단계 예고
Step 06 = **SQLite 연결**. 외부 라이브러리(SQLite, 퍼블릭 도메인) 추가 → db 파일을 이 AppData\Mevolve 폴더에 두고 메모를 여러 개 관리 시작. 규칙대로 라이브러리 목적·장단점·설치·라이선스부터 설명 예정. 사용자 진행도(레벨/점수) 테이블 설계도 여기서 시작.
