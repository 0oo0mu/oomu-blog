---
title: JavaScript 기초: 변수와 함수 이해하기
date: 2026-05-28
category: 개발
tags: [JavaScript, 프로그래밍, 입문]
---

## 변수 선언: var, let, const

JavaScript에서 변수를 선언하는 방법은 세 가지입니다. 각각 언제 쓰는지 알아볼게요.

### var (옛날 방식, 웬만하면 쓰지 마세요)

```javascript
var name = "홍길동";
var name = "이순신"; // 같은 이름으로 또 선언해도 에러가 안 남 → 버그의 원인!
```

`var`은 같은 이름으로 재선언해도 에러가 안 납니다. 실수를 잡기 어려워서 최신 코드에선 거의 안 써요.

### let (값을 바꿔야 할 때)

```javascript
let count = 0;
count = 1;      // 값 변경 가능 ✅
let count = 2;  // 재선언은 에러 ❌ → 실수 방지
```

### const (값을 바꾸지 않을 때)

```javascript
const MAX_SIZE = 100;
MAX_SIZE = 200; // 에러! 재할당 불가 ❌
```

> **원칙**: 기본적으로 `const`를 쓰고, 값이 바뀌어야 할 때만 `let`을 씁니다. `var`은 가능하면 쓰지 마세요.

---

## 함수 선언 방법

함수를 만드는 방법도 여러 가지가 있어요.

### 함수 선언식

```javascript
// 함수를 선언하는 가장 기본적인 방법
// 이름: greet, 파라미터: name (함수에 넘겨주는 값)
function greet(name) {
  return `안녕하세요, ${name}님!`;
}

console.log(greet("철수")); // "안녕하세요, 철수님!"
```

### 함수 표현식

```javascript
// 함수를 변수에 담는 방법
// const로 선언했으니 나중에 다른 함수로 교체 불가
const greet = function(name) {
  return `안녕하세요, ${name}님!`;
};
```

### 화살표 함수 (Arrow Function)

```javascript
// ES6에서 추가된 더 짧은 문법
// 파라미터가 하나면 괄호 생략 가능
const greet = name => `안녕하세요, ${name}님!`;

// 여러 줄이면 중괄호와 return 필요
const add = (a, b) => {
  const result = a + b;
  return result;
};
```

---

## 정리

| 구분 | 재선언 | 재할당 | 언제 쓰나 |
|------|--------|--------|-----------|
| `var` | ✅ | ✅ | 안 쓰는 게 좋음 |
| `let` | ❌ | ✅ | 값이 변하는 변수 |
| `const` | ❌ | ❌ | 기본값 (값 안 바뀔 때) |

다음 글에서는 **조건문과 반복문**에 대해 다뤄볼게요!
