---
title: Step04_메모_파일저장_불러오기
date: 2026-07-13
category: 개발/C++
tags: []
---

# Step 04 — 메모 파일 저장/불러오기 (파일 I/O · Data 계층 첫 등장)

파일: `Mevolve/Main.cpp` · 계층: Data(저장/인코딩) + UI(버튼 처리)

---

## 1. 이번 단계 목표
입력창의 메모를 **파일(memo.txt)로 저장**하고, 프로그램을 다시 켜서 **[불러오기]**를 누르면 저장했던 내용이 입력창에 다시 나타나게 만든다.

## 2. 왜 필요한가
지금까지 입력한 메모는 프로그램을 끄면 사라졌다(메모리에만 존재). 실제 앱이 되려면 데이터를 **디스크에 영구 저장(persistence)**해야 한다. 이건 나중에 SQLite 저장, 사용자 진행도(레벨/점수) 저장으로 이어지는 "데이터 저장" 개념의 첫걸음이다.

## 3. 먼저 알아야 할 개념
- **파일 I/O(입출력)**: 프로그램이 디스크의 파일을 읽고 쓰는 것. 여기선 표준 C++ `std::ofstream`(쓰기)·`std::ifstream`(읽기) 사용.
- **인코딩 변환**: 윈도우는 메모리에서 문자를 **UTF-16**(wchar_t)로 다루지만, 디스크엔 **UTF-8**로 저장하는 게 표준적이고 호환성이 좋다(앞서 겪은 C4819 문제도 같은 맥락). 그래서 저장 시 UTF-16→UTF-8, 불러올 때 UTF-8→UTF-16 변환이 필요하다.
- **계층 분리**: "파일에 저장/불러오기" 로직(Data)을 "버튼 눌렀을 때"(UI)와 **별도 함수로** 분리했다. UI는 데이터 함수를 호출만 한다.

## 4. 폴더/파일 구조
```
D:\AI\스팀SW\Mevolve\
├── Main.cpp        ← 수정
└── memo.txt        ← 실행 시 여기(작업 폴더)에 생성됨
```
※ 상대 경로 `L"memo.txt"`는 프로그램의 **현재 작업 폴더**에 저장된다(VS에서 실행 시 보통 프로젝트 폴더). 나중 단계에서 사용자별 정식 경로(AppData)로 바꾼다.

## 5. 전체 코드
전체는 `Mevolve/Main.cpp` 참조. 핵심 구조:
- 상단: `#include <string>`, `#include <fstream>` 추가.
- Data 함수: `WideToUtf8`, `Utf8ToWide`, `SaveMemoToFile`, `LoadMemoFromFile`, `GetEditText`.
- WM_CREATE: 라벨 + Edit + [저장] + [불러오기] 버튼.
- WM_COMMAND: 저장/불러오기 분기.

## 6. 코드 상세 설명

**`#include <string>` / `#include <fstream>`**
표준 C++ 문자열(`std::string`, `std::wstring`)과 파일 스트림(`std::ofstream`, `std::ifstream`)을 쓰기 위한 헤더.

**`const wchar_t* MEMO_FILE = L"memo.txt";`**
저장 파일 이름. `const wchar_t*` = "바뀌지 않는 wide 문자열의 주소". 상대 경로라 작업 폴더에 저장.

### Data 계층 함수

**`std::string WideToUtf8(const std::wstring& w)`** — UTF-16 → UTF-8 변환.
- `const std::wstring& w` : 입력 문자열을 **참조(&)**로 받음 → 복사 안 해서 효율적, `const`라 안 바꿈.
- `WideCharToMultiByte(CP_UTF8, 0, ..., nullptr, 0, ...)` : 첫 호출은 출력 버퍼를 `nullptr`로 줘서 **필요한 바이트 길이만** 계산. `CP_UTF8`=UTF-8 코드페이지.
- `std::string out(len, '\0')` : 그 길이만큼 문자열 준비.
- 두 번째 호출에서 실제로 `&out[0]`에 변환 결과를 채움.
- Windows API지만 여기선 "저장용 데이터 변환" 역할.

**`std::wstring Utf8ToWide(const std::string& s)`** — UTF-8 → UTF-16. 위와 대칭. `MultiByteToWideChar` 사용, 길이 계산 → 버퍼 준비 → 채우기.

**`bool SaveMemoToFile(const std::wstring& text, const wchar_t* path)`**
- `std::ofstream file(path, std::ios::binary);` : 파일을 **쓰기+바이너리 모드**로 연다. (텍스트 모드는 줄바꿈을 변형할 수 있어, UTF-8 바이트를 그대로 쓰려고 바이너리 사용.) ※ MSVC는 `ofstream`에 wide 경로(`wchar_t*`)를 넣는 걸 허용(마이크로소프트 확장).
- `if (!file) return false;` : 열기 실패면 false. `!file`은 스트림 상태가 나쁠 때 참.
- `WideToUtf8(text)`로 변환 후 `file.write(...)`로 바이트를 씀.
- `return true;` : 함수가 끝나면 `file`의 소멸자가 **자동으로 파일을 닫는다**(RAII). 별도 close 불필요.

**`bool LoadMemoFromFile(std::wstring& outText, const wchar_t* path)`**
- `std::ifstream file(path, std::ios::binary);` : 읽기+바이너리로 열기.
- `if (!file) return false;` : 파일이 없거나 못 열면 false(→ "저장된 메모 없음").
- `std::string utf8((istreambuf_iterator<char>(file)), istreambuf_iterator<char>());` : **파일 전체를 한 번에** 문자열로 읽는 관용구. 시작~끝 반복자로 모든 바이트를 담음.
- `outText = Utf8ToWide(utf8);` : UTF-16으로 변환해 **참조 매개변수**(`outText`, `&`로 받아 호출자에게 결과 전달)에 담음.

**`std::wstring GetEditText(HWND hEdit)`**
- `GetWindowTextLengthW(hEdit)` : Edit의 글자 수(널 제외)를 구함.
- `std::wstring text(len, L'\0')` : 그 길이만큼 버퍼 확보(wstring은 내부에 널 자리가 하나 더 있어 안전).
- `GetWindowTextW(hEdit, &text[0], len + 1)` : 널 포함 `len+1`칸으로 실제 텍스트 복사.
- 빈 경우(`len==0`)는 복사 건너뜀.

### UI 계층 (WM_COMMAND)
- **[저장]**: `GetEditText`로 입력 내용을 얻어 `SaveMemoToFile` 호출. 성공/실패에 따라 MessageBox.
- **[불러오기]**: `LoadMemoFromFile` 호출. 성공하면 `SetWindowTextW(g_hEdit, text.c_str())`로 입력창에 채움(`.c_str()`은 wstring을 API가 원하는 `const wchar_t*`로 변환). 파일 없으면 경고 MessageBox.
- 버튼 스타일: 저장은 `BS_DEFPUSHBUTTON`(기본), 불러오기는 `BS_PUSHBUTTON`(일반).

## 7. 실행 방법
`Mevolve.slnx` → `Ctrl+Shift+B` → `Ctrl+F5`.

## 8. 확인해야 할 정상 동작
1. 입력창에 글(한글 포함) 입력 → [저장] → "저장했어요." 뜸.
2. 창을 닫았다 다시 실행 → [불러오기] → 아까 쓴 내용이 입력창에 그대로 나타남.
3. 한 번도 저장 안 한 상태에서 [불러오기] → "저장된 메모가 없어요." 경고.
4. (확인) 작업 폴더에 `memo.txt`가 생기고, 메모장으로 열면 UTF-8로 한글이 정상.

## 9. 자주 발생하는 오류와 해결
- **한글이 깨져 저장/로드됨**: 인코딩 변환(WideToUtf8/Utf8ToWide) 안 쓰고 바로 저장한 경우. UTF-8 변환 확인.
- **불러오기가 항상 "메모 없음"**: 저장 위치(작업 폴더)와 불러오는 경로가 다름 → 같은 상대 경로/작업 폴더인지 확인. VS의 작업 디렉터리 설정 영향.
- **`ofstream`에 wide 경로 오류**: 다른 컴파일러였다면 문제될 수 있으나 MSVC는 허용. (이식성 필요 시 경로를 좁은 문자열로 변환.)
- **C4819/인코딩 빌드 오류**: 소스 파일 UTF-8 BOM 또는 `/utf-8` 옵션 유지.

## 10. 이번 단계에서 배운 내용
표준 C++ 파일 스트림(ofstream/ifstream)과 바이너리 모드, RAII로 파일 자동 닫힘, UTF-16↔UTF-8 인코딩 변환의 필요성과 방법, GetWindowTextLength/GetWindowText로 Edit 내용 읽기, SetWindowText로 채우기, 그리고 **데이터 저장 로직을 UI에서 분리**하는 계층 개념.

## 11. 다음 단계 예고
Step 05 방향 후보: (a) 저장 위치를 사용자별 정식 폴더(AppData)로 바꾸기, 또는 (b) SQLite를 연결해 메모를 DB에 저장(여러 개의 메모 관리 시작). 진행 시 택1.
