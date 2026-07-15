# 퀴즈판 — txt로 만드는 우리 반 온라인 시험

바로 붙여서 쓸 수 있는 정적 웹앱입니다. 서버 프로그래밍 없이 **Firebase**(구글의 무료 백엔드 서비스) 하나로 "파일 저장 + 실시간 채점 결과"까지 해결하도록 만들었어요.

## 왜 Firebase인가

- **호스팅 + 데이터 저장(DB)이 한 서비스에** 다 있어서, 이것저것 따로 가입하지 않아도 됩니다.
- 학급 규모(몇십 명이 하루 몇 번 시험)라면 **무료 요금제로 충분**합니다.
- 콘솔이 한국어를 지원하고, 설정도 클릭 몇 번이면 끝나요.
- 학생/선생님 로그인 없이도 "방 코드"만으로 동작하게 설계했습니다.

(참고: Netlify/Vercel + Supabase 조합도 비슷하게 무료로 가능합니다. 다만 이 코드는 Firebase 기준으로 작성되어 있어요.)

## 폴더 구성

```
quiz-app/
  index.html          첫 화면 (선생님/학생 선택)
  teacher.html         선생님 화면
  student.html         학생 화면
  css/style.css        디자인
  js/firebase-config.js  ← 여기에 본인 Firebase 설정을 넣어야 함
  js/teacher.js
  js/student.js
```

## 시작하는 방법 (10분이면 끝나요)

### 1. Firebase 프로젝트 만들기
1. https://console.firebase.google.com 접속 후 구글 계정으로 로그인
2. **프로젝트 추가** → 이름 입력 (예: `우리반-퀴즈`) → 만들기

### 2. Firestore(데이터 저장소) 켜기
1. 왼쪽 메뉴 **빌드 > Firestore Database** 클릭
2. **데이터베이스 만들기** → 위치는 `asia-northeast3(서울)` 선택 추천
3. 보안 규칙은 **테스트 모드**로 시작 (아래 3번에서 규칙을 다시 설정할 거예요)

### 3. 보안 규칙 설정
Firestore > 규칙 탭에서 아래 내용으로 바꿔주세요. 로그인 없이도 방 코드 기반으로 쓸 수 있게 하는 대신, 방을 지우거나 문제를 통째로 바꾸는 것은 막아둔 규칙입니다.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomCode} {
      allow create: if request.resource.data.keys().hasAll(['title','questions']);
      allow read: if true;
      allow update, delete: if false;

      match /submissions/{submissionId} {
        allow create: if request.resource.data.keys().hasAll(['studentName','answers']);
        allow read: if true;
        allow update, delete: if false;
      }
    }
  }
}
```

### 4. 웹 앱 등록 후 설정값 복사
1. 프로젝트 개요 옆 톱니바퀴 > **프로젝트 설정**
2. 아래로 스크롤 후 **앱 추가 > 웹(</>)** 선택, 앱 닉네임 아무거나 입력
3. 화면에 나오는 `firebaseConfig` 값을 복사해서 `js/firebase-config.js` 파일의 값과 **하나하나 교체**하세요.

### 5. Firebase Hosting으로 배포하기 (선택)
컴퓨터에 Node.js가 설치되어 있다면:

```bash
npm install -g firebase-tools
firebase login
cd quiz-app
firebase init hosting   # public 디렉터리를 현재 폴더(.)로 지정, 기존 파일 덮어쓰지 않기
firebase deploy
```

배포가 끝나면 `https://프로젝트이름.web.app` 같은 주소가 생기고, 이 주소를 학생들에게 그대로 공유하면 됩니다.

Node.js 설치가 어렵다면, Firebase Hosting 대신 **Netlify**(https://app.netlify.com)에 이 폴더를 그대로 드래그&드롭해서 올려도 동작합니다. (데이터 저장은 여전히 Firebase가 담당하니 3~4번은 꼭 해주세요.)

## 문제 파일(txt) 작성 규칙

선생님 화면에서 "양식 txt 다운로드" 버튼을 누르면 아래 형식의 파일이 내려받아집니다.

```
1.대한민국의 수도는 어디인가요?
(서울)

2.3 + 4 는 얼마인가요?
(7)
```

- `번호.` 다음 줄에 문제, 그 다음 줄에 `(정답)` 형식이면 인식됩니다.
- 채점은 띄어쓰기·대소문자를 무시하고 비교합니다. (예: "서울" = "서울 " = "Seoul"과 다르게 취급되니 정답은 학생이 쓸 그대로 적어주세요)

## 사용 흐름

1. **선생님**: 양식대로 문제 작성 → txt 업로드(또는 붙여넣기) → 문제 불러오기로 미리보기 확인 → 방 만들기 → 생성된 **방 코드**를 학생에게 공유
2. **학생**: 첫 화면에서 "학생이에요" → 방 코드 + 이름 입력 → 문제 풀고 제출 → 본인 점수 바로 확인
3. **선생님**: 대시보드 화면에서 학생별 점수와 문항별 정답/오답이 실시간으로 쌓이는 것을 확인 (제출 즉시 새로고침 없이 반영됨)

## 알아두면 좋은 점 (한계)

- 로그인 기능이 없는 대신 방 코드로만 접근을 구분합니다. 코드를 아는 사람은 누구나 그 방에 들어갈 수 있어요.
- 정답은 브라우저로 전달되는 데이터 안에 함께 들어있어서, 개발자 도구를 볼 줄 아는 학생이라면 이론적으로 정답을 미리 볼 수 있습니다. 점수 경쟁이 아니라 확인용 쪽지시험에 적합한 구조예요. 더 엄격한 부정행위 방지가 필요하면 Firebase Cloud Functions로 채점 로직을 서버로 옮기는 추가 작업이 필요합니다 (원하시면 이어서 도와드릴 수 있어요).
- 지난 방 목록은 선생님이 사용한 그 브라우저에만 저장됩니다(로컬 저장). 다른 기기에서는 방 코드를 다시 입력해서 대시보드를 열어야 해요.
