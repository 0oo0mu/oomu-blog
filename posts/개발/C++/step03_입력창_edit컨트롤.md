---
title: Step03_입력창_Edit컨트롤
date: 2026-07-13
category: 개발/C++
tags: []
---

# Step 03 — 텍스트 입력창(Edit 컨트롤) + 내용 읽기

파일: `Mevolve/Main.cpp` · 계층: Platform / UI

---

## 1. 이번 단계 목표
창에 여러 줄 입력이 가능한 **텍스트 입력창(Edit 컨트롤)**을 붙이고, "내용 확인" 버튼을 누르면 입력한 글을 읽어서 메시지 상자로 보여준다. 메모장의 시작점.

## 2. 왜 필요한가
지금까지는 프로그램이 사용자에게 정보를 "보여주기"만 했다. 이제 반대로 **사용자가 입력한 데이터를 프로그램이 읽어오는** 흐름이 필요하다. 이건 메모 저장, 일정 제목 입력, 뽀모도로 시간 설정 등 앞으로 모든 입력 기능의 토대다.

## 3. 먼저 알아야 할 개념
- **Edit 컨트롤**: Windows 표준 텍스트 입력 상자(`L"EDIT"` 클래스). 버튼처럼 자식 창이다.
- 컨트롤에 나중에 접근하려면 **그 핸들(HWND)을 저장**해 둬야 한다 → 전역 `g_hEdit`.
- **`GetWindowTextW`**: 어떤 창/컨트롤의 현재 텍스트를 읽어오는 함수. Edit의 입력 내용을 우리 버퍼로 복사한다.
- **STATIC 컨트롤**: 상호작용 없는 글자 라벨(안내 문구용).

## 4. 폴더/파일 구조
```
D:\AI\스팀SW\Mevolve\
└── Main.cpp   ← 이 파일만 수정
```
(Step 02의 클릭 카운터 데모는 역할을 다해 입력창 기능으로 교체. g_clickCount와 WM_PAINT 카운터 그리기는 제거.)

## 5. 전체 코드
```cpp
#include <windows.h>

#define ID_BUTTON_SHOW 1001
#define ID_EDIT_MEMO   1002

HWND g_hEdit = nullptr;

LRESULT CALLBACK WindowProc(HWND hWnd, UINT message, WPARAM wParam, LPARAM lParam);

int WINAPI wWinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, PWSTR pCmdLine, int nCmdShow)
{
    const wchar_t CLASS_NAME[] = L"MevolveWindowClass";

    WNDCLASSEXW wc = { };
    wc.cbSize = sizeof(WNDCLASSEXW);
    wc.style = CS_HREDRAW | CS_VREDRAW;
    wc.lpfnWndProc = WindowProc;
    wc.hInstance = hInstance;
    wc.hCursor = LoadCursor(nullptr, IDC_ARROW);
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
    case WM_CREATE:
    {
        HINSTANCE hInst = (HINSTANCE)GetWindowLongPtr(hWnd, GWLP_HINSTANCE);

        CreateWindowExW(
            0, L"STATIC", L"메모를 입력하고 [내용 확인]을 누르세요",
            WS_CHILD | WS_VISIBLE,
            20, 20, 460, 24,
            hWnd, nullptr, hInst, nullptr);

        g_hEdit = CreateWindowExW(
            WS_EX_CLIENTEDGE,
            L"EDIT", L"",
            WS_CHILD | WS_VISIBLE | WS_VSCROLL |
            ES_MULTILINE | ES_AUTOVSCROLL | ES_WANTRETURN,
            20, 54, 500, 300,
            hWnd, (HMENU)ID_EDIT_MEMO, hInst, nullptr);

        CreateWindowExW(
            0, L"BUTTON", L"내용 확인",
            WS_TABSTOP | WS_VISIBLE | WS_CHILD | BS_DEFPUSHBUTTON,
            20, 370, 150, 40,
            hWnd, (HMENU)ID_BUTTON_SHOW, hInst, nullptr);
        return 0;
    }

    case WM_COMMAND:
    {
        if (LOWORD(wParam) == ID_BUTTON_SHOW)
        {
            wchar_t buffer[1024];
            GetWindowTextW(g_hEdit, buffer, 1024);
            MessageBoxW(hWnd, buffer, L"입력한 내용", MB_OK | MB_ICONINFORMATION);
        }
        return 0;
    }

    case WM_DESTROY:
        PostQuitMessage(0);
        return 0;
    }

    return DefWindowProcW(hWnd, message, wParam, lParam);
}
```

## 6. 코드 상세 설명 (새로 추가/변경된 부분 위주)

**`#define ID_EDIT_MEMO 1002`** — Edit 컨트롤용 고유 ID. 버튼(1001)과 다른 번호.

**`HWND g_hEdit = nullptr;`**
Edit 컨트롤의 핸들을 담는 전역 변수. `HWND`는 창(컨트롤 포함) 핸들 타입. 버튼과 달리 Edit은 나중에(버튼 눌렀을 때) 내용을 읽어야 하므로, 생성할 때 받은 핸들을 저장해 둔다. 처음엔 아직 안 만들었으니 `nullptr`.

**`HINSTANCE hInst = (HINSTANCE)GetWindowLongPtr(hWnd, GWLP_HINSTANCE);`**
WM_CREATE 안에서 프로그램 인스턴스 핸들을 한 번 꺼내 변수에 담아, 아래 컨트롤 3개 생성에 재사용. (Step 02에선 인라인으로 넣었던 걸 깔끔하게 변수화.)

**(1) STATIC 라벨**
```cpp
CreateWindowExW(0, L"STATIC", L"메모를 입력하고 ...", WS_CHILD | WS_VISIBLE, 20,20,460,24, hWnd, nullptr, hInst, nullptr);
```
- `L"STATIC"` — 표준 라벨 클래스. 클릭 등 상호작용이 없어 ID가 필요 없으니 HMENU 자리에 `nullptr`.
- 위치 x=20,y=20, 크기 460×24.

**(2) EDIT 입력창**
```cpp
g_hEdit = CreateWindowExW(WS_EX_CLIENTEDGE, L"EDIT", L"", ...스타일..., 20,54,500,300, hWnd, (HMENU)ID_EDIT_MEMO, hInst, nullptr);
```
- `WS_EX_CLIENTEDGE` — 확장 스타일. 입력창을 안쪽으로 파인 테두리로 보이게(전형적 입력 상자 모양).
- `L"EDIT"` — 표준 텍스트 입력 클래스. `L""` — 처음엔 빈 내용.
- 스타일 조합:
  - `WS_CHILD | WS_VISIBLE` — 자식 창, 보이기(컨트롤 필수).
  - `WS_VSCROLL` — 세로 스크롤바.
  - `ES_MULTILINE` — 여러 줄 입력 허용(ES=Edit Style).
  - `ES_AUTOVSCROLL` — 줄이 넘치면 자동으로 위로 스크롤.
  - `ES_WANTRETURN` — 여러 줄 Edit에서 Enter로 줄바꿈을 넣게 허용(없으면 Enter가 기본 버튼으로 감).
- `(HMENU)ID_EDIT_MEMO` — 이 컨트롤의 ID(1002).
- 반환된 핸들을 `g_hEdit`에 저장 → 나중에 내용 읽을 때 사용.

**(3) 버튼** — Step 02와 동일 패턴. 텍스트만 "내용 확인", ID는 `ID_BUTTON_SHOW`(1001), 위치 아래쪽(y=370).

**`WM_COMMAND` 처리**
- `if (LOWORD(wParam) == ID_BUTTON_SHOW)` — '내용 확인' 버튼이 눌렸는지 확인.
- `wchar_t buffer[1024];` — 입력 내용을 담을 버퍼(최대 1023글자 + 끝표시).
- `GetWindowTextW(g_hEdit, buffer, 1024);` — **핵심.** `g_hEdit`(입력창)의 현재 텍스트를 `buffer`로 복사. 세 번째 인자 1024는 버퍼 최대 크기(넘치면 잘라서 안전).
- `MessageBoxW(hWnd, buffer, L"입력한 내용", MB_OK | MB_ICONINFORMATION);` — 읽어온 내용을 메시지 상자로 표시. `MB_OK`=확인 버튼, `MB_ICONINFORMATION`=정보 아이콘.

**제거된 것**: Step 02의 `g_clickCount`와 WM_PAINT의 카운터 그리기(데모 종료). 이제 화면 그리기는 기본 배경만 있으면 되므로 커스텀 WM_PAINT 없이 DefWindowProcW가 처리.

## 7. 실행 방법
`Mevolve.slnx` → `Ctrl+Shift+B` → `Ctrl+F5`. (인코딩은 UTF-8 BOM 또는 `/utf-8` 옵션 유지.)

## 8. 확인해야 할 정상 동작
상단에 안내 라벨, 그 아래 테두리 있는 입력창, 아래에 "내용 확인" 버튼. 입력창에 여러 줄로 글을 쓸 수 있고(Enter로 줄바꿈), 버튼을 누르면 방금 입력한 내용이 메시지 상자로 그대로 뜬다. 빈 상태로 누르면 빈 메시지 상자.

## 9. 자주 발생하는 오류와 해결
- **입력창이 한 줄만 됨/Enter가 안 먹음**: `ES_MULTILINE` 또는 `ES_WANTRETURN` 누락.
- **버튼 눌러도 내용이 안 뜸/빈 값**: `g_hEdit`에 핸들 저장 안 함, 또는 `GetWindowTextW`에 엉뚱한 핸들 전달.
- **한글 입력이 깨짐**: 유니코드 설정/`GetWindowTextW`(W버전) 확인. ANSI(A) 함수 쓰면 깨짐.
- **C4819 + 파생 오류**: 파일 인코딩 문제 → UTF-8 BOM 또는 `/utf-8` (Step 인코딩 이슈 참고).

## 10. 이번 단계에서 배운 내용
Edit·STATIC 컨트롤 생성, 컨트롤 핸들을 저장해 두는 이유, Edit 스타일 플래그(ES_MULTILINE 등), `GetWindowTextW`로 사용자 입력을 읽어 버퍼에 담는 법, MessageBox로 결과 표시.

## 11. 다음 단계 예고
Step 04 = 입력한 메모를 **파일로 저장하고 다시 불러오기**(로컬 파일 I/O). 이후 SQLite 저장으로 발전. Core/Data 계층 개념이 처음 등장한다.
