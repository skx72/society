// ===== 문제 txt 파싱 =====
// 형식: "숫자.문제내용" 다음 줄(들) 뒤에 "(정답)" 이 오는 형태
function parseQuestions(rawText) {
  const lines = rawText.replace(/\r\n/g, "\n").split("\n");
  const questions = [];
  let current = null;

  const qStart = /^\s*(\d+)[.\)]\s*(.*)$/;   // "1. 문제" 또는 "1) 문제"
  const answerLine = /^\s*\((.+)\)\s*$/;      // "(답)"

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "") continue;

    const qMatch = line.match(qStart);
    const aMatch = line.match(answerLine);

    if (aMatch && current && !current.answer) {
      current.answer = aMatch[1].trim();
      continue;
    }

    if (qMatch) {
      if (current) questions.push(current);
      current = { no: questions.length + 1, question: qMatch[2].trim(), answer: "" };
      continue;
    }

    // 문제가 여러 줄에 걸쳐 있는 경우 이어붙이기
    if (current && !current.answer) {
      current.question += (current.question ? " " : "") + line;
    }
  }
  if (current) questions.push(current);

  // 번호 재정렬 + 답 없는 문항 제거
  return questions
    .filter(q => q.question && q.answer)
    .map((q, i) => ({ no: i + 1, question: q.question, answer: q.answer }));
}

// ===== 템플릿 다운로드 =====
document.getElementById("downloadTemplateBtn").addEventListener("click", () => {
  const template = "1.문제 입력\n(답 입력)\n\n2.문제 입력\n(답 입력)\n\n3.문제 입력\n(답 입력)\n";
  const blob = new Blob([template], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "문제양식.txt";
  a.click();
  URL.revokeObjectURL(url);
});

// ===== 파일 선택 / 붙여넣기 =====
const fileInput = document.getElementById("fileInput");
const fileNameShown = document.getElementById("fileNameShown");
const pasteArea = document.getElementById("pasteArea");

fileNameShown.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  fileNameShown.value = file.name;
  const reader = new FileReader();
  reader.onload = (e) => {
    pasteArea.value = e.target.result;
  };
  reader.readAsText(file, "UTF-8");
});

// ===== 문제 불러오기(파싱) =====
let parsedQuestions = [];
const parseStatus = document.getElementById("parseStatus");
const previewArea = document.getElementById("previewArea");
const createRoomCard = document.getElementById("createRoomCard");

document.getElementById("parseBtn").addEventListener("click", () => {
  const text = pasteArea.value;
  parsedQuestions = parseQuestions(text);

  if (parsedQuestions.length === 0) {
    parseStatus.textContent = "문제를 찾지 못했어요. 양식(번호. 문제 / (답)) 을 확인해주세요.";
    parseStatus.className = "status-msg error";
    previewArea.innerHTML = "";
    createRoomCard.style.display = "none";
    return;
  }

  parseStatus.textContent = `${parsedQuestions.length}개의 문제를 찾았어요.`;
  parseStatus.className = "status-msg ok";

  previewArea.innerHTML = parsedQuestions.map(q => `
    <div class="q-preview">
      <div class="qnum">${q.no}번</div>
      <div class="qtext">${escapeHtml(q.question)}</div>
      <div class="qans">정답: ${escapeHtml(q.answer)}</div>
    </div>
  `).join("");

  createRoomCard.style.display = "block";
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ===== 방 코드 생성 =====
function generateRoomCode() {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 헷갈리는 0,O,1,I 제외
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ===== 방 만들기 =====
const createStatus = document.getElementById("createStatus");

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} 응답이 ${ms / 1000}초 넘게 없어요. 인터넷 연결 또는 Firebase 설정을 확인해주세요.`)), ms)
    )
  ]);
}

document.getElementById("createRoomBtn").addEventListener("click", async () => {
  if (parsedQuestions.length === 0) return;

  if (typeof FIREBASE_CONFIGURED !== "undefined" && !FIREBASE_CONFIGURED) {
    createStatus.textContent = "js/firebase-config.js 파일이 아직 예시 값 그대로예요. Firebase 콘솔에서 발급받은 값으로 교체해주세요.";
    createStatus.className = "status-msg error";
    return;
  }

  const title = document.getElementById("roomTitle").value.trim() || "이름 없는 시험";
  const btn = document.getElementById("createRoomBtn");
  btn.disabled = true;
  createStatus.textContent = "방을 만드는 중...";
  createStatus.className = "status-msg";

  try {
    const code = generateRoomCode();
    await withTimeout(
      db.collection("rooms").doc(code).set({
        title,
        questions: parsedQuestions,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }),
      15000,
      "방 만들기"
    );

    saveRoomToLocal(code, title);
    openDashboard(code, title);
  } catch (err) {
    console.error(err);
    createStatus.textContent = "방 만들기에 실패했어요: " + err.message + " (브라우저 개발자 도구 콘솔(F12)에서 자세한 오류를 확인할 수 있어요)";
    createStatus.className = "status-msg error";
  } finally {
    btn.disabled = false;
  }
});

// ===== 로컬에 만든 방 기록 =====
function saveRoomToLocal(code, title) {
  const list = JSON.parse(localStorage.getItem("myRooms") || "[]");
  list.unshift({ code, title, createdAt: Date.now() });
  localStorage.setItem("myRooms", JSON.stringify(list.slice(0, 30)));
}

function renderPastRooms() {
  const list = JSON.parse(localStorage.getItem("myRooms") || "[]");
  const card = document.getElementById("pastRoomsCard");
  const wrap = document.getElementById("pastRoomsList");
  if (list.length === 0) { card.style.display = "none"; return; }
  card.style.display = "block";
  wrap.innerHTML = list.map(r => `
    <div class="row" style="justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--line);">
      <div>
        <strong>${escapeHtml(r.title)}</strong>
        <span class="hint" style="margin-left:8px;">코드 ${r.code}</span>
      </div>
      <button class="btn btn-outline btn-sm" data-code="${r.code}" data-title="${escapeHtml(r.title)}">결과 보기</button>
    </div>
  `).join("");

  wrap.querySelectorAll("button[data-code]").forEach(btn => {
    btn.addEventListener("click", () => openDashboard(btn.dataset.code, btn.dataset.title));
  });
}
renderPastRooms();

// ===== 대시보드 =====
let unsubscribe = null;

function openDashboard(code, title) {
  document.getElementById("createView").style.display = "none";
  document.getElementById("dashboardView").style.display = "block";
  document.getElementById("pastRoomsCard").style.display = "none";
  document.getElementById("pageTitle").textContent = "채점 결과";
  document.getElementById("dashRoomTitle").textContent = title;
  document.getElementById("dashCode").textContent = code;

  if (unsubscribe) unsubscribe();
  unsubscribe = db.collection("rooms").doc(code).collection("submissions")
    .orderBy("submittedAt", "desc")
    .onSnapshot(renderSubmissions, err => console.error(err));
}

function renderSubmissions(snapshot) {
  const wrap = document.getElementById("resultsTableWrap");
  document.getElementById("submitCount").textContent = `(${snapshot.size}명 제출)`;

  if (snapshot.empty) {
    wrap.innerHTML = `<div class="empty-state">아직 제출한 학생이 없어요. 학생이 제출하면 여기 자동으로 뜹니다.</div>`;
    return;
  }

  const rows = [];
  snapshot.forEach(doc => {
    const d = doc.data();
    const pct = d.total ? Math.round((d.correctCount / d.total) * 100) : 0;
    const scoreClass = pct >= 80 ? "score-high" : pct >= 50 ? "score-mid" : "score-low";
    const rowId = "row-" + doc.id;

    rows.push(`
      <tr class="summary-row" data-target="${rowId}" style="cursor:pointer;">
        <td>${escapeHtml(d.studentName || "이름 없음")}</td>
        <td><span class="score-pill ${scoreClass}">${d.correctCount}/${d.total} (${pct}점)</span></td>
        <td class="hint">${d.submittedAt && d.submittedAt.toDate ? d.submittedAt.toDate().toLocaleString() : "-"}</td>
        <td class="hint">▾ 문항별 보기</td>
      </tr>
      <tr class="detail-row" id="${rowId}">
        <td colspan="4">
          ${(d.answers || []).map(a => `
            <span class="answer-chip ${a.isCorrect ? "correct" : "wrong"}">
              ${a.no}번 ${a.isCorrect ? "✅" : "❌"} — 학생: "${escapeHtml(a.given || "(무응답)")}" ${a.isCorrect ? "" : `/ 정답: "${escapeHtml(a.correct)}"`}
            </span>
          `).join("")}
        </td>
      </tr>
    `);
  });

  wrap.innerHTML = `
    <table>
      <thead><tr><th>학생</th><th>점수</th><th>제출 시각</th><th></th></tr></thead>
      <tbody>${rows.join("")}</tbody>
    </table>
  `;

  wrap.querySelectorAll(".summary-row").forEach(tr => {
    tr.addEventListener("click", () => {
      document.getElementById(tr.dataset.target).classList.toggle("open");
    });
  });
}

document.getElementById("newRoomBtn").addEventListener("click", () => {
  if (unsubscribe) unsubscribe();
  document.getElementById("dashboardView").style.display = "none";
  document.getElementById("createView").style.display = "block";
  document.getElementById("pageTitle").textContent = "문제 방 만들기";
  parsedQuestions = [];
  previewArea.innerHTML = "";
  pasteArea.value = "";
  fileNameShown.value = "";
  createRoomCard.style.display = "none";
  parseStatus.textContent = "";
  renderPastRooms();
});
