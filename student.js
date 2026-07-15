function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function normalize(str) {
  return (str || "").toString().trim().toLowerCase().replace(/\s+/g, "");
}

let roomData = null;
let roomCode = null;
let studentName = "";

const roomCodeInput = document.getElementById("roomCodeInput");
const joinStatus = document.getElementById("joinStatus");

roomCodeInput.addEventListener("input", () => {
  roomCodeInput.value = roomCodeInput.value.toUpperCase();
});

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} 응답이 ${ms / 1000}초 넘게 없어요. 인터넷 연결을 확인해주세요.`)), ms)
    )
  ]);
}

document.getElementById("joinBtn").addEventListener("click", async () => {
  const code = roomCodeInput.value.trim().toUpperCase();
  const name = document.getElementById("studentNameInput").value.trim();

  if (!code) { showJoinError("방 코드를 입력해주세요."); return; }
  if (!name) { showJoinError("이름을 입력해주세요."); return; }

  if (typeof FIREBASE_CONFIGURED !== "undefined" && !FIREBASE_CONFIGURED) {
    showJoinError("이 사이트가 아직 설정 중이에요. 선생님께 문의해주세요. (firebase-config.js 미설정)");
    return;
  }

  const btn = document.getElementById("joinBtn");
  btn.disabled = true;
  joinStatus.textContent = "확인 중...";
  joinStatus.className = "status-msg";

  try {
    const doc = await withTimeout(db.collection("rooms").doc(code).get(), 15000, "방 입장");
    if (!doc.exists) {
      showJoinError("해당 방 코드를 찾을 수 없어요. 코드를 다시 확인해주세요.");
      btn.disabled = false;
      return;
    }
    roomData = doc.data();
    roomCode = code;
    studentName = name;
    renderQuiz();
  } catch (err) {
    console.error(err);
    showJoinError("연결에 실패했어요. (" + err.message + ")");
    btn.disabled = false;
  }
});

function showJoinError(msg) {
  joinStatus.textContent = msg;
  joinStatus.className = "status-msg error";
}

function renderQuiz() {
  document.getElementById("joinView").style.display = "none";
  document.getElementById("quizView").style.display = "block";
  document.getElementById("pageTitle").textContent = roomData.title || "문제 풀기";
  document.getElementById("quizRoomTitle").textContent = `${studentName}님, 문제를 모두 풀고 제출해주세요.`;

  const list = document.getElementById("questionList");
  list.innerHTML = roomData.questions.map(q => `
    <div class="q-item">
      <div class="qnum">${q.no}번</div>
      <div class="qtext">${escapeHtml(q.question)}</div>
      <input type="text" class="answer-input" data-no="${q.no}" placeholder="답을 입력하세요">
    </div>
  `).join("");
}

document.getElementById("submitBtn").addEventListener("click", async () => {
  const inputs = document.querySelectorAll(".answer-input");
  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  btn.textContent = "제출 중...";

  const answers = roomData.questions.map(q => {
    const input = document.querySelector(`.answer-input[data-no="${q.no}"]`);
    const given = input ? input.value.trim() : "";
    const isCorrect = normalize(given) === normalize(q.answer);
    return { no: q.no, question: q.question, given, correct: q.answer, isCorrect };
  });

  const correctCount = answers.filter(a => a.isCorrect).length;
  const total = answers.length;

  try {
    await db.collection("rooms").doc(roomCode).collection("submissions").add({
      studentName,
      answers,
      correctCount,
      total,
      submittedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showResult(answers, correctCount, total);
  } catch (err) {
    console.error(err);
    alert("제출에 실패했어요. 다시 시도해주세요. (" + err.message + ")");
    btn.disabled = false;
    btn.textContent = "제출하기";
  }
});

function showResult(answers, correctCount, total) {
  document.getElementById("quizView").style.display = "none";
  document.getElementById("resultView").style.display = "block";
  document.getElementById("pageTitle").textContent = "채점 결과";

  document.getElementById("bigScore").textContent = `${correctCount}/${total}`;
  const pct = total ? Math.round((correctCount / total) * 100) : 0;
  document.getElementById("bigPct").textContent = `${pct}점`;

  document.getElementById("resultDetail").innerHTML = answers.map(a => `
    <div class="answer-chip ${a.isCorrect ? "correct" : "wrong"}" style="display:block; margin-bottom:8px;">
      ${a.no}번 ${a.isCorrect ? "✅ 정답" : "❌ 오답"} —
      내 답: "${escapeHtml(a.given || "(무응답)")}"
      ${a.isCorrect ? "" : ` / 정답: "${escapeHtml(a.correct)}"`}
    </div>
  `).join("");
}
