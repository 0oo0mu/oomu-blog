---
title: Step01_기본창
date: 2026-07-13
category: C++
tags: [C++, 공부]
---

# Step 01 — 기본 Win32 창 띄우기

파일: `Mevolve/Main.cpp` · 계층: Platform / UI (Windows 전용, Core 아님)

---

## 1. 이번 단계 목표
아무 기능 없이 회색 배경에 텍스트가 가운데 찍힌 800×600 창을 하나 띄운다. X 버튼으로 정상 종료.

## 2. 왜 필요한가
앞으로 만들 모든 기능(메모장, 뽀모도로, 펫, 오버레이)이 "창(Window)" 위에서 동작한다. 창 띄우는 절차(클래스 등록 → 창 생성 → 메시지 루프 → 프로시저)는 모든 Windows 데스크톱 프로그램의 뼈대다.

## 3. 먼저 알아야 할 개념
Windows 프로그램은 우리가 흐름을 통제하는 게 아니라 **"메시지"를 받아 반응**한다(이벤트 기반). 마우스 클릭, 키 입력, 크기 변경, 다시 그리기 요청이 전부 메시지로 큐에 쌓이고, 우리는 메시지 루프로 하나씩 꺼내 WindowProc으로 보낸다.
핵심 4단계: ①창 클래스 등록 → ②창 생성 → ③메시지 루프 → ④메시지 처리(WindowProc).

## 4. 폴더/파일 구조
```
D:\AI\스팀SW\Mevolve\
└── Main.cpp
```

## 5. 전체 코드
```cpp
#include <windows.h>

LRESULT CALLBACK WindowProc(HWND hWnd, UINT message, WPARAM wParam, LPARAM lParam);

int WINAPI wWinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, PWSTR pCmdLine, int nCmdShow)
{
    const wchar_t CLASS_NAME[] = L"MevolveWindowClass";

    WNDCLASSEXW wc = { };
    wc.cbSize        = sizeof(WNDCLASSEXW);
    wc.style         = CS_HREDRAW | CS_VREDRAW;
    wc.lpfnWndProc   = WindowProc;
    wc.hInstance     = hInstance;
    wc.hCursor       = LoadCursor(nullptr, IDC_ARROW);
    wc.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
    wc.lpszClassName = CLASS_NAME;

    if (!RegisterClassExW(&wc))
    {
        MessageBoxW(nullptr, L"윈도우 클래스 등록 실패", L"Error", MB_ICONERROR);
        return 0;
    }

    HWND hWnd = CreateWindowExW(
        0, CLASS_NAME, L"Mevolve", WS_OVERLAPPEDWINDOW,
        CW_USEDEFAULT, CW_USEDEFAULT, 800, 600,
        nullptr, nullptr, hInstance, nullptr);

    if (hWnd == nullptr)
    {
        MessageBoxW(nullptr, L"창 생성 실패", L"Error", MB_ICONERROR);
        return 0;
    }

    ShowWindow(hWnd, nCmdShow);
    UpdateWindow(hWnd);

    MSG msg = { };
    while (GetMessageW(&msg, nullptr, 0, 0))
    {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }

    return (int)msg.wParam;
}

LRESULT CALLBACK WindowProc(HWND hWnd, UINT message, WPARAM wParam, LPARAM lParam)
{
    switch (message)
    {
    case WM_PAINT:
    {
        PAINTSTRUCT ps;
        HDC hdc = BeginPaint(hWnd, &ps);

        const wchar_t text[] = L"Mevolve - Hello, Win32!";
        RECT rect;
        GetClientRect(hWnd, &rect);
        DrawTextW(hdc, text, -1, &rect, DT_CENTER | DT_VCENTER | DT_SINGLELINE);

        EndPaint(hWnd, &ps);
        return 0;
    }

    case WM_DESTROY:
        PostQuitMessage(0);
        return 0;
    }

    return DefWindowProcW(hWnd, message, wParam, lParam);
}
```

## 6. 코드 상세 설명 (한 줄씩)

**`#include <windows.h>`** — 전처리기 지시. Win32 API의 함수·타입·상수 선언이 든 헤더를 붙여넣음. 이게 있어야 HWND, CreateWindowExW 등을 씀.

**`LRESULT CALLBACK WindowProc(...);`** (전방 선언)
- `LRESULT`: 함수가 돌려주는 값 타입(메시지 처리 결과 정수).
- `CALLBACK`: 호출 규약(`__stdcall`). "Windows가 되부르는 함수"라는 표시.
- 괄호 안: 받을 인자 타입. 세미콜론으로 끝나면 "선언만"(몸통은 아래).

**`int WINAPI wWinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, PWSTR pCmdLine, int nCmdShow)`** — 진입점.
- `int`: 종료 코드로 돌려줄 정수.
- `WINAPI`: `__stdcall` 호출 규약.
- `wWinMain`: GUI 프로그램의 진입점(콘솔의 main 대신). 앞 `w`=wide(유니코드).
- `hInstance`: 실행 중인 내 프로그램을 가리키는 핸들(번호표). 창 만들 때 필요.
- `hPrevInstance`: 옛 16비트 잔재, 항상 nullptr, 안 씀.
- `pCmdLine`: 명령줄 인자(유니코드). 안 씀.
- `nCmdShow`: 창을 처음에 어떻게 보일지 힌트. ShowWindow에 넘김.

**`const wchar_t CLASS_NAME[] = L"MevolveWindowClass";`**
- `const`: 값 안 바꿈(상수). `wchar_t`: 유니코드 문자 하나(2바이트). `[]`: 배열(문자열). `L"..."`: wide 문자열 표시. 창 클래스 식별용 이름.

**`WNDCLASSEXW wc = { };`** — 창 "설계도" 구조체. `= { }`로 0 초기화(쓰레기값 방지).
- `.cbSize = sizeof(WNDCLASSEXW)`: 구조체 크기(버전 확인용). `sizeof`=크기 재는 연산자.
- `.style = CS_HREDRAW | CS_VREDRAW`: 가로/세로 크기 변하면 다시 그림. `|`=비트 OR.
- `.lpfnWndProc = WindowProc`: **가장 중요.** 메시지 처리 함수 지정(함수 이름=주소).
- `.hInstance = hInstance`: 소속 프로그램.
- `.hCursor = LoadCursor(nullptr, IDC_ARROW)`: 기본 화살표 커서.
- `.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1)`: 배경 브러시. `(HBRUSH)`=형변환, `+1`은 오래된 관례.
- `.lpszClassName = CLASS_NAME`: 클래스 이름.

**`if (!RegisterClassExW(&wc)) {...}`** — 설계도를 Windows에 등록. `&wc`=wc의 주소. `!`=NOT(실패=0이면 참). 실패 시 팝업 후 종료.

**`HWND hWnd = CreateWindowExW(...)`** — 실제 창 생성, 반환값 HWND(창 핸들).
- `0`: 확장 스타일 없음(나중에 오버레이의 항상위/투명이 여기 들어감).
- `CLASS_NAME`: 등록한 설계도 이름.
- `L"Mevolve"`: 제목 표시줄 글자.
- `WS_OVERLAPPEDWINDOW`: 제목줄+테두리+버튼 있는 표준 창.
- `CW_USEDEFAULT, CW_USEDEFAULT`: 위치 자동.
- `800, 600`: 너비, 높이.
- 이후 nullptr(부모 없음), nullptr(메뉴 없음), hInstance, nullptr(추가 데이터 없음).

**`ShowWindow(hWnd, nCmdShow);`** — 창을 화면에 보이기.
**`UpdateWindow(hWnd);`** — 즉시 한 번 그리기 요청 → WM_PAINT 발생.

**메시지 루프**
- `MSG msg = { };`: 메시지 담을 구조체 0 초기화.
- `while (GetMessageW(&msg, nullptr, 0, 0))`: 큐에서 메시지 꺼냄. WM_QUIT 만나면 0 반환→종료.
- `TranslateMessage(&msg);`: 키보드 입력을 문자 메시지로 번역.
- `DispatchMessageW(&msg);`: 메시지를 해당 창 WindowProc으로 전달.
- `return (int)msg.wParam;`: 종료 코드 반환.

**`WindowProc`**
- `switch (message)`: 메시지 종류로 분기.
- `WM_PAINT`: 그려야 할 때.
  - `BeginPaint`로 도화지(HDC) 얻기, `GetClientRect`로 내부 영역 크기, `DrawTextW`로 가운데 텍스트, `EndPaint`로 종료.
- `WM_DESTROY`: 창 파괴 시 `PostQuitMessage(0)`으로 루프 종료(→ 프로그램 종료).
- `return DefWindowProcW(...)`: 처리 안 한 메시지는 Windows 기본 처리에 맡김(없으면 창 동작 이상).

## 7. 실행 방법
VS Installer에서 "C++를 사용한 데스크톱 개발" 설치 → 빈 프로젝트 → Main.cpp 추가 → 플랫폼 x64 → 문자 집합 유니코드 → 링커>시스템>하위 시스템=창 → `Ctrl+F5`.

## 8. 확인해야 할 정상 동작
제목 "Mevolve"인 800×600 창 + 가운데 "Mevolve - Hello, Win32!". 크기 조절해도 가운데 유지, X로 완전 종료.

## 9. 자주 발생하는 오류
- `unresolved external symbol WinMain`: 하위 시스템이 콘솔이거나 함수명 불일치 → 하위 시스템=창, 함수명 wWinMain.
- 문자열 타입 오류(const char* → LPCWSTR): 문자 집합 유니코드 아님/L 누락 → 유니코드, 모든 리터럴 L"...".
- `windows.h 없음`: 데스크톱 개발 워크로드/SDK 미설치.
- 콘솔 검은 창 같이 뜸: 하위 시스템 콘솔 → 창으로.

## 10. 배운 내용
이벤트(메시지) 기반 구조, 창 4단계, HWND/HINSTANCE/HDC 핸들, wWinMain·유니코드 관계, WM_PAINT/WM_DESTROY.

## 11. 다음 단계 예고
Step 02 = 창에 버튼 추가 + 클릭 이벤트 처리.
