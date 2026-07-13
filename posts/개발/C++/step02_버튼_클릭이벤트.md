---
title: Step02_버튼_클릭이벤트
date: 2026-07-13
category: 개발/C++
tags: []
---

# Step 02 — 버튼 추가 + 클릭 이벤트 처리

파일: `Mevolve/Main.cpp` · 계층: Platform / UI

---

## 1. 이번 단계 목표
Step 01의 창에 "클릭하세요" 버튼을 붙이고, 누를 때마다 화면 가운데 문구가 `버튼을 1번 눌렀어요`, `2번…`으로 바뀌게 만든다.

## 2. 왜 필요한가
앱이 되려면 사용자 입력에 반응해야 한다. **버튼 클릭 → 감지 → 상태(횟수) 변경 → 화면 갱신** 흐름은 앞으로 만들 모든 상호작용(저장 버튼, 타이머 시작 등)의 기본형이다.

## 3. 먼저 알아야 할 개념
- Win32에서 **버튼도 하나의 "창(child window)"** 이다. 메인 창 안의 작은 창.
- 버튼 클릭 시 버튼이 부모 창에게 **`WM_COMMAND` 메시지**를 보낸다.
- 화면 숫자를 바꾸려면 직접 그리지 않고 **`InvalidateRect`로 "다시 그려줘" 요청** → Windows가 `WM_PAINT`를 보냄 → 거기서 새 숫자를 그린다.
- 핵심 패턴: **상태를 바꾸고 → 다시 그리라고 요청**.

## 4. 폴더/파일 구조
```
D:\AI\스팀SW\Mevolve\
└── Main.cpp   ← 이 파일만 수정
```

## 5. 전체 코드
```cpp
#include <windows.h>

#define ID_BUTTON_CLICK 1001

int g_clickCount = 0;

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
        CreateWindowExW(
            0, L"BUTTON", L"클릭하세요",
            WS_TABSTOP | WS_VISIBLE | WS_CHILD | BS_DEFPUSHBUTTON,
            20, 20, 150, 40,
            hWnd, (HMENU)ID_BUTTON_CLICK,
            (HINSTANCE)GetWindowLongPtr(hWnd, GWLP_HINSTANCE), nullptr);
        return 0;
    }

    case WM_COMMAND:
    {
        if (LOWORD(wParam) == ID_BUTTON_CLICK)
        {
            g_clickCount++;
            InvalidateRect(hWnd, nullptr, TRUE);
        }
        return 0;
    }

    case WM_PAINT:
    {
        PAINTSTRUCT ps;
        HDC hdc = BeginPaint(hWnd, &ps);

        wchar_t text[64];
        wsprintfW(text, L"버튼을 %d번 눌렀어요", g_clickCount);

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

## 6. 코드 상세 설명 (새로 추가된 부분 위주)

**`#define ID_BUTTON_CLICK 1001`**
전처리기 매크로. 컴파일 전에 `ID_BUTTON_CLICK` 글자를 전부 `1001`로 바꿔치기. 버튼마다 고유 번호(ID)를 줘서 "어느 컨트롤에서 온 메시지인지" 구분. 1001은 임의 값(0~2는 시스템이 쓰기도 해서 보통 1000번대부터).

**`int g_clickCount = 0;`**
클릭 횟수를 담는 전역 변수. `int`=정수, `g_`=global(전역) 관례 표시. `WindowProc`는 메시지마다 새로 호출됐다 끝나므로 함수 안 지역변수는 값을 유지 못 함 → 값을 계속 기억하려면 전역(또는 static). (나중에 데이터가 많아지면 Core 계층 구조체로 옮길 예정. 지금은 학습용으로 단순하게.)

**`case WM_CREATE:`**
창이 생성되는 순간 딱 한 번 오는 메시지. 자식 컨트롤(버튼) 만들기 좋은 타이밍.

버튼 생성 `CreateWindowExW(...)` — Step 01의 창 만들기와 같은 함수, 인자만 버튼용:
- `L"BUTTON"` — Windows에 미리 있는 표준 버튼 클래스(등록 불필요).
- `L"클릭하세요"` — 버튼에 표시될 글자.
- 스타일 4개(`|`로 합침):
  - `WS_CHILD`: 자식 창(부모 안에 붙음). 버튼 필수.
  - `WS_VISIBLE`: 처음부터 보이게(없으면 안 보임).
  - `WS_TABSTOP`: Tab 키로 포커스 이동(접근성).
  - `BS_DEFPUSHBUTTON`: 기본 눌림 버튼 모양(Enter로도 눌림).
- `20, 20, 150, 40` — x=20, y=20, 너비 150, 높이 40 (부모 왼쪽 위 기준).
- `hWnd` — 부모 창.
- `(HMENU)ID_BUTTON_CLICK` — 일반 창에선 "메뉴" 자리인데, **자식 컨트롤에선 컨트롤 ID 자리**로 바뀜. `(HMENU)`로 형변환해 버튼 번호를 넣음.
- `(HINSTANCE)GetWindowLongPtr(hWnd, GWLP_HINSTANCE)` — 프로그램 인스턴스 핸들. WM_CREATE엔 hInstance가 직접 없어서 창에 저장된 값을 이 함수로 꺼냄.
- 반환값(버튼 HWND)은 지금 안 써서 변수에 안 담음.

**`case WM_COMMAND:`**
버튼 클릭 시 부모 창에 오는 메시지.
- `LOWORD(wParam)` — wParam의 아래 16비트를 꺼내는 매크로. 여기에 **컨트롤 ID**가 들어있음.
- `if (LOWORD(wParam) == ID_BUTTON_CLICK)` — 그 번호가 우리 버튼(1001)이면 참.
- `g_clickCount++;` — 횟수 1 증가(`++`는 1 더하기).
- `InvalidateRect(hWnd, nullptr, TRUE);` — 창을 "다시 그려야 함"으로 표시. `nullptr`=창 전체, `TRUE`=그리기 전 배경 지우기(잔상 제거). 호출하면 곧 WM_PAINT가 옴.

**`case WM_PAINT:` 변경점**
- `wchar_t text[64];` — 최대 63글자 담을 버퍼(배열). 유니코드라 `wchar_t`.
- `wsprintfW(text, L"버튼을 %d번 눌렀어요", g_clickCount);` — `%d` 자리에 숫자를 넣어 문자열 완성 후 `text`에 채움. printf류와 같고, `wsprintfW`는 Win32 유니코드용이라 별도 헤더 불필요.
- 나머지 `DrawTextW`는 Step 01과 동일하게 가운데 그림.

## 7. 실행 방법
`Mevolve.slnx` 열기 → `Ctrl+Shift+B`(빌드) → `Ctrl+F5`(실행). 별도 라이브러리 불필요(버튼 클래스·wsprintfW는 user32에 있음).

## 8. 확인해야 할 정상 동작
왼쪽 위에 "클릭하세요" 버튼, 가운데 처음엔 `버튼을 0번 눌렀어요`. 클릭마다 숫자 +1, 즉시 반영. 창 크기 바꿔도 문구는 가운데, 버튼은 왼쪽 위 고정.

## 9. 자주 발생하는 오류와 해결
- **버튼이 안 보임**: 스타일에 `WS_VISIBLE`/`WS_CHILD` 빠짐 → 둘 다 필요.
- **클릭해도 숫자 안 바뀜**: `InvalidateRect` 누락 또는 ID 비교 오류 → ID 값 확인.
- **wsprintfW 경고/오류**: 유니코드 설정 꺼짐 또는 버퍼 작음 → 유니코드 확인, 버퍼 64면 충분.
- **글자 겹침(잔상)**: `InvalidateRect` 마지막 인자를 `FALSE`로 두면 배경이 안 지워짐 → `TRUE`로.

## 10. 이번 단계에서 배운 내용
버튼=자식 창, WM_CREATE에서 컨트롤 만드는 타이밍, 컨트롤 ID로 구분, WM_COMMAND로 클릭 받기, LOWORD로 wParam에서 ID 꺼내기, **상태 변경 → InvalidateRect → WM_PAINT 재그리기** 패턴, 전역 변수로 상태 유지하는 이유.

## 11. 다음 단계 예고
Step 03 = 버튼 옆에 **텍스트 입력창(Edit 컨트롤)** 추가 → 글자 입력·읽어오기 → 메모장의 시작점.
