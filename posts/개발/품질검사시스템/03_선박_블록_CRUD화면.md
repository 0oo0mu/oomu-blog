---
title: [처음부터 따라하기] 03. 선박/블록 CRUD 화면 만들기
date: 2026-06-22
category: 개발/품질검사시스템
tags: [Next.js, CRUD, 데이터관리]
excerpt: CRUD(생성·조회·수정·삭제)라는 개념을 배우고, 선박 관리 화면을 통해 실제로 구현해봅니다.
---

이번 글에서는 **CRUD**라는 개념을 배우고, 선박 관리 화면을 통해 실제로 구현해봅니다.

---

## 1. CRUD란?

CRUD는 거의 모든 데이터 중심 애플리케이션에서 반복되는 4가지 기본 동작의 줄임말입니다.

| 글자 | 영어 | 뜻 | Supabase 함수 |
|------|------|-----|---------------|
| C | Create | 새로 만들기 | `.insert()` |
| R | Read | 조회하기 | `.select()` |
| U | Update | 수정하기 | `.update()` |
| D | Delete | 삭제하기 | `.delete()` |

선박 관리 화면은 이 4가지를 모두 갖춘 전형적인 CRUD 화면입니다. 이 패턴을 한 번 제대로 이해하면, 블록 관리·다른 어떤 데이터 관리 화면도 거의 똑같은 틀로 만들 수 있습니다.

---

## 2. 페이지(Server Component)와 화면(Client Component) 나누기

이 프로젝트의 모든 목록 화면은 같은 구조를 따릅니다.

```
app/ships/page.tsx          ← Server Component: DB에서 선박 목록을 미리 가져옴
components/ships/ShipList.tsx ← Client Component: 화면에 그리고, 버튼 클릭 처리
```

```tsx
// app/ships/page.tsx
import { createServerSupabaseClient } from "@/lib/supabase-server";
import ShipList from "@/components/ships/ShipList";

export default async function ShipsPage() {
  const supabase = createServerSupabaseClient();
  const { data: ships } = await supabase
    .from("ships")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">선박 관리</h1>
        <p className="text-slate-500 text-sm mt-1">건조 중인 선박 목록을 관리합니다.</p>
      </div>
      <ShipList initialShips={ships ?? []} />
    </div>
  );
}
```

**왜 이렇게 나누는가?** 서버에서 데이터를 미리 가져와서 화면에 "초기값"으로 넘겨주면, 사용자가 페이지에 처음 접속했을 때 빈 화면이 잠깐 보이다가 데이터가 뿅 나타나는 게 아니라 **이미 데이터가 채워진 화면이 바로 보입니다** (이게 서버 사이드 렌더링의 장점 중 하나입니다). 이후 버튼을 눌러서 추가/수정/삭제하는 상호작용은 Client Component(`ShipList`)가 처리합니다.

- `.select("*")`: 모든 칼럼을 가져옴 (`*`은 "전부"라는 뜻)
- `.order("created_at", { ascending: false })`: `created_at` 기준 내림차순(최신 것이 먼저) 정렬
- `ships ?? []`: `ships`가 `null`이면 빈 배열 `[]`을 대신 사용 (`??`는 "널 병합 연산자"로, 왼쪽이 `null`/`undefined`일 때만 오른쪽 값을 씁니다)

---

## 3. ShipList 전체 코드

```tsx
"use client";
// components/ships/ShipList.tsx
// 선박 목록 + 등록 모달을 담은 클라이언트 컴포넌트

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Ship as ShipType, ShipStatus } from "@/lib/types";
import { Plus, Anchor, Pencil, Trash2, X, Loader2 } from "lucide-react";

// 상태 배지 색상
const statusConfig: Record<ShipStatus, { label: string; color: string }> = {
  building:  { label: "건조 중",  color: "bg-blue-100 text-blue-700" },
  completed: { label: "건조 완료", color: "bg-green-100 text-green-700" },
  delivered: { label: "인도 완료", color: "bg-slate-100 text-slate-600" },
};

const shipTypes = ["컨테이너선", "탱커", "벌크선", "LNG선", "크루즈선", "군함", "기타"];

interface Props {
  initialShips: ShipType[];
}

export default function ShipList({ initialShips }: Props) {
  const router  = useRouter();
  const supabase = createClient();

  const [ships, setShips]         = useState<ShipType[]>(initialShips);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<ShipType | null>(null);
  const [loading, setLoading]     = useState(false);
  const [deleteId, setDeleteId]   = useState<string | null>(null);

  // 폼 상태
  const [form, setForm] = useState({
    name: "",
    ship_type: "컨테이너선",
    build_number: "",
    status: "building" as ShipStatus,
  });

  function openCreate() {
    setEditTarget(null);
    setForm({ name: "", ship_type: "컨테이너선", build_number: "", status: "building" });
    setShowModal(true);
  }

  function openEdit(ship: ShipType) {
    setEditTarget(ship);
    setForm({
      name: ship.name,
      ship_type: ship.ship_type,
      build_number: ship.build_number,
      status: ship.status,
    });
    setShowModal(true);
  }

  // ── 등록 / 수정 ───────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    if (editTarget) {
      // 수정
      const { data, error } = await supabase
        .from("ships")
        .update(form)
        .eq("id", editTarget.id)
        .select()
        .single();

      if (!error && data) {
        setShips((prev) => prev.map((s) => (s.id === data.id ? data : s)));
      }
    } else {
      // 신규 등록
      const { data, error } = await supabase
        .from("ships")
        .insert(form)
        .select()
        .single();

      if (!error && data) {
        setShips((prev) => [data, ...prev]);
      }
    }

    setLoading(false);
    setShowModal(false);
    router.refresh();
  }

  // ── 삭제 ─────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm("선박을 삭제하면 연결된 블록과 검사 데이터도 모두 삭제됩니다. 계속하시겠습니까?")) return;
    setDeleteId(id);
    const { error } = await supabase.from("ships").delete().eq("id", id);
    if (error) {
      alert("삭제 실패: " + error.message);
    } else {
      setShips((prev) => prev.filter((s) => s.id !== id));
    }
    setDeleteId(null);
  }

  return (
    <>
      {/* 상단 버튼 */}
      <div className="flex justify-end">
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          선박 등록
        </button>
      </div>

      {/* 선박 카드 목록 */}
      {ships.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Anchor className="w-12 h-12 mb-3 opacity-30" />
          <p className="font-medium">등록된 선박이 없습니다</p>
          <p className="text-sm mt-1">위의 "선박 등록" 버튼을 눌러 선박을 추가하세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {ships.map((ship) => {
            const st = statusConfig[ship.status] ?? statusConfig.building;
            return (
              <div key={ship.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Anchor className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{ship.name}</p>
                      <p className="text-xs text-slate-400">{ship.ship_type}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${st.color}`}>
                    {st.label}
                  </span>
                </div>

                <div className="text-sm text-slate-500 mb-4">
                  건조번호: <span className="font-medium text-slate-700">{ship.build_number || "—"}</span>
                </div>

                <div className="flex gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => openEdit(ship)}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    수정
                  </button>
                  <button
                    onClick={() => handleDelete(ship.id)}
                    disabled={deleteId === ship.id}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-500 transition-colors ml-2"
                  >
                    {deleteId === ship.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />}
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 등록/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-slate-800">
                {editTarget ? "선박 정보 수정" : "신규 선박 등록"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  선박명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="예) 현대 드림호"
                  required
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">선박 유형</label>
                <select
                  value={form.ship_type}
                  onChange={(e) => setForm({ ...form, ship_type: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {shipTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">건조 번호</label>
                <input
                  type="text"
                  value={form.build_number}
                  onChange={(e) => setForm({ ...form, build_number: e.target.value })}
                  placeholder="예) HHI-2025-001"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">건조 상태</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as ShipStatus })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="building">건조 중</option>
                  <option value="completed">건조 완료</option>
                  <option value="delivered">인도 완료</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editTarget ? "수정 완료" : "등록하기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
```

---

## 4. 핵심 부분 한 줄씩 뜯어보기

### 상태(state) 설계

```tsx
const [ships, setShips]         = useState<ShipType[]>(initialShips);
const [showModal, setShowModal] = useState(false);
const [editTarget, setEditTarget] = useState<ShipType | null>(null);
```

- `ships`: 화면에 보여줄 선박 목록. 서버에서 받아온 `initialShips`로 시작하지만, 이후 등록/수정/삭제할 때마다 **이 배열 자체를 직접 갱신**합니다 (이게 왜 중요한지는 아래에서 설명).
- `showModal`: 등록/수정용 팝업(모달)이 열려있는지 여부.
- `editTarget`: 지금 "수정 중인" 선박이 무엇인지. `null`이면 신규 등록 모드, 값이 있으면 수정 모드 — **이 하나의 변수로 모달을 등록용/수정용 두 가지로 재사용**합니다.

### "낙관적 업데이트"라는 패턴

```tsx
const { data, error } = await supabase.from("ships").insert(form).select().single();
if (!error && data) {
  setShips((prev) => [data, ...prev]);
}
```

여기서 중요한 점: 등록에 성공하면 **DB에 다시 물어보지 않고**, 방금 insert 결과로 돌려받은 `data`를 그냥 화면의 `ships` 배열 맨 앞에 직접 끼워 넣습니다.

- `.select()`: insert/update 명령 뒤에 붙이면, "방금 추가/수정된 행의 최종 데이터를 돌려달라"는 뜻입니다. 안 붙이면 성공 여부만 알 수 있고 데이터는 안 줍니다.
- `.single()`: "결과가 1건만 있을 거야, 배열이 아니라 객체 하나로 줘"라는 뜻. insert는 보통 1건만 추가하므로 붙입니다.
- `setShips((prev) => [data, ...prev])`: `setShips`에 함수를 넘기는 방식입니다. `prev`는 "현재의 ships 값"을 가리키고, `[data, ...prev]`는 "새 데이터를 맨 앞에 놓고, 그 뒤에 기존 배열을 그대로 펼쳐 넣는다"는 뜻입니다 (`...`은 스프레드 연산자 — 배열/객체를 펼쳐줍니다).

**왜 DB를 다시 조회 안 하고 이렇게 하는가?** 한 번 더 네트워크 요청을 보내서 전체 목록을 다시 받아오는 것보다, 이미 손에 있는 결과를 화면에 바로 반영하는 게 **훨씬 빠르고 매끄럽게** 느껴집니다. 사용자 입장에서는 "등록 버튼 누르자마자 바로 화면에 나타난다"는 체감이 됩니다.

### `router.refresh()`는 왜 같이 호출하는가?

낙관적 업데이트로 화면(클라이언트 상태)은 바로 갱신했지만, `app/ships/page.tsx`(Server Component)가 서버에서 가져온 데이터는 여전히 예전 것입니다. `router.refresh()`는 "이 페이지를 서버에서 다시 그려서, Server Component가 가진 데이터도 최신으로 맞춰라"라고 요청합니다. 당장 화면이 깜빡이진 않지만, 다음에 또 다른 작업을 할 때 서버 쪽 데이터도 일치시켜두기 위한 안전장치입니다.

### 수정(Update)

```tsx
const { data, error } = await supabase
  .from("ships")
  .update(form)
  .eq("id", editTarget.id)
  .select()
  .single();

if (!error && data) {
  setShips((prev) => prev.map((s) => (s.id === data.id ? data : s)));
}
```

- `.update(form)`: `form` 객체에 담긴 값으로 갱신
- `.eq("id", editTarget.id)`: "`id` 칼럼이 `editTarget.id`와 같은 행만" 대상으로 함 (`eq`는 equal). 이게 없으면 테이블의 **모든 행**이 수정되어 버립니다 — 매우 중요한 조건입니다.
- `prev.map((s) => (s.id === data.id ? data : s))`: 배열을 순회하면서, "수정한 그 항목이면 새 데이터로 교체하고, 아니면 그대로 둔다"는 뜻. `.map()`은 배열의 각 원소를 변환해서 새 배열을 만드는 함수입니다.

### 삭제(Delete)

```tsx
async function handleDelete(id: string) {
  if (!confirm("선박을 삭제하면 연결된 블록과 검사 데이터도 모두 삭제됩니다. 계속하시겠습니까?")) return;
  setDeleteId(id);
  const { error } = await supabase.from("ships").delete().eq("id", id);
  if (error) {
    alert("삭제 실패: " + error.message);
  } else {
    setShips((prev) => prev.filter((s) => s.id !== id));
  }
  setDeleteId(null);
}
```

- `confirm(...)`: 브라우저 기본 확인창. "확인"을 누르면 `true`, "취소"를 누르면 `false`를 반환합니다. `!confirm(...)`이 참이면(취소를 눌렀으면) `return`으로 함수를 즉시 끝냅니다.
- `.delete().eq("id", id)`: "이 id에 해당하는 행만 삭제"
- **에러 처리를 꼭 확인하는 이유**: 01번 글에서 설명한 외래키 제약(`ON DELETE CASCADE`)이 걸려있지 않으면, "이 선박을 참조하는 블록이 있어서 삭제할 수 없다"는 에러가 돌아옵니다. `error`를 무시하고 그냥 화면에서 지워버리면, 사용자는 "삭제됐다"고 착각하지만 실제 DB에는 그대로 남아있는 **불일치 상태**가 됩니다. 그래서 `if (error)`로 반드시 사용자에게 알려줘야 합니다.
- `prev.filter((s) => s.id !== id)`: "삭제한 항목만 빼고 나머지를 남긴다". `.filter()`는 조건을 만족하는 원소만 모아서 새 배열을 만듭니다.

### 모달 재사용 패턴

```tsx
function openCreate() {
  setEditTarget(null);
  setForm({ name: "", ship_type: "컨테이너선", build_number: "", status: "building" });
  setShowModal(true);
}

function openEdit(ship: ShipType) {
  setEditTarget(ship);
  setForm({ name: ship.name, ship_type: ship.ship_type, build_number: ship.build_number, status: ship.status });
  setShowModal(true);
}
```

```tsx
{editTarget ? "선박 정보 수정" : "신규 선박 등록"}
...
{editTarget ? "수정 완료" : "등록하기"}
```

등록용 모달과 수정용 모달을 따로 만들지 않고, **`editTarget`이 있는지 없는지로 하나의 모달이 두 가지 역할을 다 하게** 만들었습니다. `handleSubmit`도 마찬가지로 `if (editTarget) { 수정 } else { 등록 }`으로 분기합니다. 이렇게 하면 폼 입력 칸 같은 중복 코드를 한 번만 작성해도 됩니다.

---

## 5. BlockList — 같은 패턴 + 필터 기능 추가

`BlockList.tsx`는 위 패턴과 거의 동일하지만 두 가지가 추가됩니다: **선박 선택 드롭다운**(블록은 어느 선박에 속하는지 정해야 하므로)과 **선박별 필터**입니다.

```tsx
// 선박 필터 적용
const filteredBlocks = useMemo(() =>
  filterShipId === "all"
    ? blocks
    : blocks.filter((b) => b.ship_id === filterShipId),
  [blocks, filterShipId]
);
```

### `useMemo`란?

`useMemo(계산함수, [의존값들])`는 "이 계산 결과를 기억해두고, 의존값이 안 바뀌면 다시 계산하지 않는다"는 React Hook입니다. 여기서는 `blocks`나 `filterShipId`가 바뀔 때만 필터링을 다시 수행하고, 그 외의 이유로 화면이 다시 그려질 때는 이전 계산 결과를 재사용합니다. 데이터가 많지 않은 이 프로젝트에서는 사실 `useMemo` 없이 매번 계산해도 체감 차이가 거의 없지만, **"필터링/가공된 값은 useMemo로 감싼다"는 습관**을 들이면 데이터가 커졌을 때도 성능 문제가 덜 생깁니다.

조인(join)해서 가져온 선박명 표시도 주목할 부분입니다.

```tsx
const { data, error } = await supabase
  .from("blocks")
  .insert(form)
  .select("*, ship:ships(id, name)")
  .single();
```

`select("*, ship:ships(id, name)")`은 Supabase(PostgREST)가 제공하는 **관계 조인 문법**입니다. "blocks의 모든 칼럼과, 그 블록이 참조하는 ships 테이블에서 id와 name만 같이 가져와서 `ship`이라는 이름으로 묶어달라"는 뜻입니다. 이렇게 하면 따로 선박 테이블을 또 조회할 필요 없이, 블록 데이터 안에 `block.ship.name`으로 바로 선박명을 꺼내 쓸 수 있습니다.

```tsx
function getShipName(shipId: string) {
  return ships.find((s) => s.id === shipId)?.name ?? "알 수 없음";
}
```

이 함수는 조인 데이터가 없는 경우(예: 서버에서 처음 가져올 때 조인을 안 했다면)를 대비한 **대체 경로(fallback)**입니다. `?.`(옵셔널 체이닝)은 "앞의 값이 `undefined`/`null`이면 에러 내지 말고 그냥 `undefined`를 반환하라"는 안전장치이고, 뒤의 `?? "알 수 없음"`이 최종 기본값입니다.

---

## 6. 정리

이번 글의 핵심 개념:

- **CRUD**: Create/Read/Update/Delete, 거의 모든 데이터 화면의 기본 패턴
- **Server Component + Client Component 분리**: 초기 데이터는 서버에서, 상호작용은 클라이언트에서
- **낙관적 업데이트**: DB 응답으로 받은 데이터를 화면 상태에 바로 반영해서 빠른 체감 속도를 만듦
- **`.eq()`, `.select()`, `.single()`**: Supabase 쿼리에서 자주 쓰는 필수 메서드들
- **조인 문법**: `select("*, 관계명:테이블명(칼럼들)")`로 연결된 테이블 데이터를 한 번에 가져오기
- **모달 재사용**: 하나의 모달 + 상태값(`editTarget`)으로 등록/수정 두 기능을 처리
- **`useMemo`**: 의존값이 바뀔 때만 다시 계산하는 캐싱 Hook

다음 글(04)에서는 본격적으로 AI 쪽으로 들어가기 전에, **과적합, 정밀도/재현율, IoU, mAP** 같은 AI의 핵심 개념들을 미리 정리합니다. 이걸 알아야 09~10번 글의 YOLOv8 학습 결과를 제대로 해석할 수 있습니다.
