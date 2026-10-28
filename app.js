/*
 * QUIZ LIVE PPAPP
 * Frontend lengkap dengan Fasa Kahoot, Formula Markah Laju (Milisec) & Double Points.
 */

(() => {
  "use strict";

  const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbxlHmVrFF84wSGQF3z0F_qEvVWZpirbgo0D06FclCDkhZTWXv_YgFTAHIAx381FERKT/exec";
  const POLL_INTERVAL_MS = 2000;
  const $ = (id) => document.getElementById(id);

  const ANSWER_COLORS = [
    { option: "A", color: "#e53232", shape: "▲", label: "Merah", textColor: "#ffffff" },
    { option: "B", color: "#2878e8", shape: "◆", label: "Biru", textColor: "#ffffff" },
    { option: "C", color: "#20a464", shape: "●", label: "Hijau", textColor: "#ffffff" },
    { option: "D", color: "#f4c430", shape: "■", label: "Kuning", textColor: "#172033" }
  ];

  function getApiUrl() {
    try { return (localStorage.getItem("qlp_api_url") || DEFAULT_API_URL).trim(); } 
    catch (e) { return DEFAULT_API_URL; }
  }

  function storageGet(key, fallback = "") {
    try { return localStorage.getItem(key) ?? fallback; } 
    catch (e) { return fallback; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, String(value ?? "")); } 
    catch (e) { console.warn("Local storage error"); }
  }

  function readStoredArray(key) {
    const raw = storageGet(key, "[]");
    try { const val = JSON.parse(raw || "[]"); return Array.isArray(val) ? val : []; } 
    catch (e) { return []; }
  }

  function setMessage(elementOrId, message, kind = "") {
    const element = typeof elementOrId === "string" ? $(elementOrId) : elementOrId;
    if (!element) return;
    element.textContent = String(message ?? "");
    element.className = "message" + (kind ? ` ${kind}` : "");
    element.style.display = "block";
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({"&": "&amp;","<": "&lt;",">": "&gt;",'"': "&quot;","'": "&#39;"})[c]);
  }

  function getErrorMessage(error, fallback = "Ralat.") {
    return error && error.message ? error.message : fallback;
  }

  async function apiPost(payload) {
    const url = getApiUrl();
    if (!url) throw new Error("URL API kosong.");
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
    } catch (error) { throw new Error("Gagal menyambung ke server."); }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    let result;
    try { result = await response.json(); } 
    catch (error) { throw new Error("Respons bukan JSON."); }
    if (!result || typeof result !== "object") throw new Error("Respons API ralat.");
    return result;
  }

  function setButtonBusy(button, busy, busyLabel) {
    if (!button) return;
    if (busy) {
      if (!button.dataset.originalLabel) button.dataset.originalLabel = button.textContent;
      button.disabled = true;
      if (busyLabel) button.textContent = busyLabel;
    } else {
      button.disabled = false;
      if (button.dataset.originalLabel) {
        button.textContent = button.dataset.originalLabel;
        delete button.dataset.originalLabel;
      }
    }
  }

  // ---------- Join Form ----------
  function initJoinForm() {
    const pinInput = $("pin"), joinButton = $("joinBtn");
    if (!pinInput || !joinButton) return;
    pinInput.addEventListener("input", () => { pinInput.value = pinInput.value.replace(/\D/g, "").slice(0, 6); });
    joinButton.addEventListener("click", async () => {
      const pin = pinInput.value.trim(), name = ($("playerName") ? $("playerName").value.trim() : "");
      if (!/^\d{6}$/.test(pin)) return setMessage("joinMsg", "PIN perlukan 6 digit.", "error");
      if (!name) return setMessage("joinMsg", "Masukkan nama.", "error");
      setButtonBusy(joinButton, true, "Menyemak…");
      try {
        const result = await apiPost({ action: "join", pin, displayName: name });
        if (!result.success) throw new Error(result.message);
        storageSet("qlp_player_session_id", result.sessionId);
        storageSet("qlp_player_id", result.playerId);
        storageSet("qlp_player_name", result.displayName || name);
        storageSet("qlp_player_pin", pin);
        if ($("waitingRoom")) { $("waitingRoom").hidden = false; $("waitingRoom").style.display = "block"; }
        if (document.querySelector(".hero-wrap")) document.querySelector(".hero-wrap").style.display = "none";
        document.body.classList.add("waiting-page");
        if ($("waitingPin")) $("waitingPin").textContent = pin;
        if ($("waitingName")) $("waitingName").textContent = `Peserta: ${result.displayName || name}`;
      } catch (error) { setMessage("joinMsg", getErrorMessage(error), "error"); } 
      finally { setButtonBusy(joinButton, false); }
    });
  }

  // ---------- API & Quiz Forms ----------
  function initApiAndQuizForm() {
    if ($("apiUrl")) $("apiUrl").value = getApiUrl();
    if ($("saveApi")) $("saveApi").addEventListener("click", () => {
      storageSet("qlp_api_url", $("apiUrl").value.trim());
      setMessage("apiMsg", "URL disimpan.", "success");
    });
    if ($("testApi")) $("testApi").addEventListener("click", async () => {
      setButtonBusy($("testApi"), true, "Menguji…");
      try {
        const url = getApiUrl();
        const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}action=test`);
        const json = await res.json();
        setMessage("apiMsg", json.message || "API OK.", "success");
      } catch (error) { setMessage("apiMsg", "Gagal ujian.", "error"); }
      finally { setButtonBusy($("testApi"), false); }
    });

    renderQuizList();
    refreshQuizzesFromServer();

    if ($("quizForm")) {
      $("quizForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const title = $("quizTitle").value.trim(), desc = $("quizDescription").value.trim();
        const btn = $("quizForm").querySelector('[type="submit"]');
        setButtonBusy(btn, true, "Mencipta…");
        try {
          const res = await apiPost({ action: "createQuiz", title, description: desc });
          if (!res.success) throw new Error(res.message);
          const items = readStoredArray("qlp_quizzes");
          items.unshift({ title, description: desc, quizId: res.quizId });
          storageSet("qlp_quizzes", JSON.stringify(items));
          $("quizTitle").value = ""; $("quizDescription").value = "";
          renderQuizList(); loadQuestionQuizOptions(); loadSessionQuizOptions();
          setMessage("quizMsg", "Kuiz berjaya dicipta!", "success");
        } catch (error) { setMessage("quizMsg", getErrorMessage(error), "error"); }
        finally { setButtonBusy(btn, false); }
      });
    }
  }

  function renderQuizList() {
    if (!$("quizList")) return;
    const items = readStoredArray("qlp_quizzes");
    if (!items.length) { $("quizList").innerHTML = '<div style="color:#94a3b8;text-align:center;">Belum ada kuiz.</div>'; return; }
    $("quizList").innerHTML = items.map(q => `<div class="quiz-row"><div><b>${escapeHtml(q.title)}</b><small>ID: ${escapeHtml(String(q.quizId).slice(0, 8))}</small></div><span class="pill">KUIZ</span></div>`).join("");
  }

  async function refreshQuizzesFromServer() {
    try {
      const res = await apiPost({ action: "getQuizzes" });
      if (res.success && Array.isArray(res.quizzes)) {
        storageSet("qlp_quizzes", JSON.stringify(res.quizzes));
        renderQuizList(); loadQuestionQuizOptions(); loadSessionQuizOptions();
      }
    } catch (e) {}
  }

  // ---------- Question Form ----------
  function loadQuestionQuizOptions() {
    if (!$("questionQuiz")) return;
    const items = readStoredArray("qlp_quizzes");
    $("questionQuiz").innerHTML = '<option value="">Pilih kuiz dahulu</option>' + items.map(q => `<option value="${q.quizId}">${escapeHtml(q.title)}</option>`).join("");
  }

  function initQuestionForm() {
    if (!$("questionForm")) return;
    loadQuestionQuizOptions();
    $("questionForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const isDouble = $("doublePoints") && $("doublePoints").checked;
      const payload = {
        action: "addQuestion",
        quizId: $("questionQuiz").value.trim(),
        questionText: $("questionText").value.trim(),
        optionA: $("optionA").value.trim(),
        optionB: $("optionB").value.trim(),
        optionC: $("optionC").value.trim(),
        optionD: $("optionD").value.trim(),
        correctOption: $("correctOption").value.trim(),
        timeLimitSeconds: Number($("questionTime").value || 20),
        points: isDouble ? 2000 : 1000 // DOUBLE POINTS LOGIC
      };
      const btn = $("questionForm").querySelector('[type="submit"]');
      setButtonBusy(btn, true, "Menyimpan…");
      try {
        const res = await apiPost(payload);
        if (!res.success) throw new Error(res.message);
        setMessage("questionMsg", "Soalan berjaya disimpan.", "success");
        ["questionText","optionA","optionB","optionC","optionD","correctOption"].forEach(id => {$(id).value="";});
      } catch (err) { setMessage("questionMsg", getErrorMessage(err), "error"); }
      finally { setButtonBusy(btn, false); }
    });
  }

  // ---------- Session Controls ----------
  function loadSessionQuizOptions() {
    if (!$("sessionQuiz")) return;
    const items = readStoredArray("qlp_quizzes");
    $("sessionQuiz").innerHTML = '<option value="">Pilih kuiz dahulu</option>' + items.map(q => `<option value="${q.quizId}">${escapeHtml(q.title)}</option>`).join("");
  }

  function initSessionControls() {
    if ($("createSessionBtn")) {
      loadSessionQuizOptions();
      $("createSessionBtn").addEventListener("click", async () => {
        const quizId = $("sessionQuiz").value;
        if (!quizId) return setMessage("sessionMsg", "Pilih kuiz.", "error");
        setButtonBusy($("createSessionBtn"), true, "Menjana PIN…");
        try {
          const res = await apiPost({ action: "createSession", quizId });
          if (!res.success) throw new Error(res.message);
          storageSet("qlp_session_id", res.sessionId);
          storageSet("qlp_host_token", res.hostToken);
          storageSet("qlp_host_started_session_id", "");
          if ($("sessionPin")) $("sessionPin").textContent = res.pin;
          if ($("sessionResult")) $("sessionResult").hidden = false;
          setMessage("sessionMsg", "Sesi tercipta!", "success");
        } catch (err) { setMessage("sessionMsg", getErrorMessage(err), "error"); }
        finally { setButtonBusy($("createSessionBtn"), false); }
      });
    }
    if ($("startQuizBtn")) {
      $("startQuizBtn").addEventListener("click", async () => {
        const sessionId = storageGet("qlp_session_id"), hostToken = storageGet("qlp_host_token");
        setButtonBusy($("startQuizBtn"), true, "Memulakan…");
        try {
          const res = await apiPost({ action: "startSession", sessionId, hostToken });
          if (!res.success) throw new Error(res.message);
          storageSet("qlp_host_started_session_id", sessionId);
          window.location.href = "host.html";
        } catch (err) { setMessage("startQuizMsg", getErrorMessage(err), "error"); }
        finally { setButtonBusy($("startQuizBtn"), false); }
      });
    }
  }

  // ---------- Live Host ----------
  function ensureHostPanel() { return $("hostLiveQuestionPanel"); }
  function initLiveHost() {
    if (!$("hostLiveQuestionPanel") && !$("nextQuestionBtn")) return;
    let polling = false;
    async function pollHost() {
      if (polling) return;
      const sessionId = storageGet("qlp_session_id");
      if (!sessionId) return;
      polling = true;
      try {
        const res = await apiPost({ action: "getSessionState", sessionId });
        const panel = ensureHostPanel();
        if (!res.success || res.status === "waiting") { if(panel) panel.hidden = true; return; }
        window.hostPhase = res.status; 
        if(panel) { panel.hidden = false; panel.style.display = "block"; }

        if (res.status === "completed") { panel.innerHTML = '<h2 style="text-align:center">Kuiz telah tamat!</h2>'; return; }
        if (res.status === "leaderboard") {
          const tops = (res.leaderboard || []).map((p, i) => `<div style="font-size:24px; margin:10px auto; max-width:500px; background:#1e293b; color:white; padding:15px 25px; border-radius:10px; display:flex; justify-content:space-between;"><span>#${i+1} ${escapeHtml(p.name)}</span><span style="font-weight:900;color:#f59e0b;">${p.score} pt</span></div>`).join("");
          panel.innerHTML = `<div style="text-align:center"><h2>🏆 TOP 5 LEADERBOARD 🏆</h2>${tops}</div>`;
          return;
        }

        const q = res.question;
        if (!q) return;
        const opts = [q.optionA, q.optionB, q.optionC, q.optionD];
        panel.innerHTML = `
          <div style="text-align:center;margin-bottom:26px">
            <div style="font-size:13px;font-weight:900;letter-spacing:3px;color:#a5b4fc">SOALAN ${q.order} ${q.points > 1000 ? '⭐ (MARKAH BERGANDA)' : ''}</div>
            <h1 style="font-size:clamp(26px,4vw,44px);margin:16px 0 0">${escapeHtml(q.questionText)}</h1>
          </div>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px">
            ${ANSWER_COLORS.map((item, i) => {
              const isDim = (res.status === "revealing_answer" && item.option !== q.correctOption);
              return `<div style="opacity:${isDim ? '0.3' : '1'};min-height:110px;display:flex;align-items:center;gap:16px;padding:20px;border-radius:18px;background:${item.color};color:${item.textColor};font-size:20px;font-weight:800;">
                <span style="font-size:30px;">${item.shape}</span><span>${escapeHtml(opts[i])}</span>
                ${res.status === "revealing_answer" && !isDim ? '<span style="margin-left:auto;font-size:30px">✅</span>' : ''}
              </div>`
            }).join("")}
          </div>`;
      } catch (e) {} finally { polling = false; }
    }
    pollHost(); window.setInterval(pollHost, POLL_INTERVAL_MS);
  }

  // ---------- Live Participant ----------
  function ensurePlayerPanel() {
    let panel = $("liveQuestionPanel");
    if (panel) return panel;
    panel = document.createElement("section");
    panel.id = "liveQuestionPanel";
    panel.hidden = true;
    panel.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;box-sizing:border-box;padding:20px;display:none;flex-direction:column;justify-content:center;background:#0f172a;color:#fff;overflow-y:auto;";
    document.body.appendChild(panel);
    return panel;
  }
  
  function renderPlayerQuestion(panel, question, sessionId, playerId, onAnswered) {
    const startTime = Date.now(); // MULAKAN MASA REKOD KELAJUAN
    panel.innerHTML = `
      <div style="text-align:center;margin-bottom:22px">
        <h2 style="font-size:clamp(19px,5vw,26px);margin:12px 0">${question.points > 1000 ? '🌟 MARKAH BERGANDA' : 'Pilih Jawapan'}</h2>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;width:100%;flex:1;align-content:center">
        ${ANSWER_COLORS.map(item => `<button type="button" data-option="${item.option}" style="min-height:clamp(135px,28vh,230px);border:0;border-radius:22px;background:${item.color};color:${item.textColor};font-size:clamp(46px,12vw,76px);font-weight:900;cursor:pointer;">${item.shape}</button>`).join("")}
      </div>
      <p id="playerAnswerStatus" style="text-align:center;font-weight:800;font-size:16px;margin:20px 0 0;color:#94a3b8">Pilih satu warna pantas!</p>`;

    const btns = [...panel.querySelectorAll("[data-option]")];
    btns.forEach(btn => {
      btn.addEventListener("click", async () => {
        if (btn.dataset.submitting === "true" || btn.dataset.answered === "true") return;
        btns.forEach(b => { b.disabled = true; b.style.opacity = "0.4"; });
        btn.style.opacity = "1"; btn.dataset.submitting = "true";
        if ($("playerAnswerStatus")) $("playerAnswerStatus").textContent = "Menghantar…";
        try {
          const res = await apiPost({
            action: "submitAnswer", sessionId, playerId,
            questionId: question.questionId, selectedOption: btn.dataset.option,
            responseMs: Date.now() - startTime // HANTAR MASA DIAMBIL (Milisec)
          });
          if (!res.success) throw new Error(res.message);
          localStorage.setItem("qlp_last_isCorrect", res.isCorrect);
          localStorage.setItem("qlp_last_score", res.totalScore);
          btn.dataset.answered = "true";
          if ($("playerAnswerStatus")) { $("playerAnswerStatus").textContent = "Diterima!"; $("playerAnswerStatus").style.color = "#34d399"; }
          onAnswered(question.questionId);
        } catch (err) {
          btn.dataset.submitting = "false";
          btns.forEach(b => { b.disabled = false; b.style.opacity = "1"; });
          if ($("playerAnswerStatus")) { $("playerAnswerStatus").textContent = "Ralat hantar"; $("playerAnswerStatus").style.color = "#f87171"; }
        }
      });
    });
  }

  function initLiveParticipant() {
    if (!$("waitingRoom") && !$("joinBtn")) return;
    let polling = false, lastQuestionId = "";
    async function pollParticipant() {
      if (polling) return;
      const sessionId = storageGet("qlp_player_session_id");
      if (!sessionId) return;
      polling = true;
      try {
        const res = await apiPost({ action: "getSessionState", sessionId });
        const panel = ensurePlayerPanel(), room = $("waitingRoom");
        if (res.status === "waiting") {
          panel.hidden = true; panel.style.display = "none";
          if (room) { room.hidden = false; room.style.display = "block"; } return;
        }
        if (room) { room.hidden = true; room.style.display = "none"; }
        panel.hidden = false; panel.style.display = "flex";

        if (res.status === "completed") { panel.innerHTML = '<div style="text-align:center;"><h2>Kuiz Tamat</h2></div>'; return; }
        if (res.status === "revealing_answer") {
          const isCorrect = localStorage.getItem("qlp_last_isCorrect") === "true";
          panel.innerHTML = `<div style="text-align:center;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${isCorrect ? "#15803d" : "#b91c1c"};color:white;border-radius:20px;">
            <div style="font-size:120px;line-height:1;">${isCorrect ? "✅" : "❌"}</div>
          </div>`; return;
        }
        if (res.status === "leaderboard") {
          const score = localStorage.getItem("qlp_last_score") || "0";
          panel.innerHTML = `<div style="text-align:center;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#2563eb;color:white;border-radius:20px;">
            <div style="font-size:24px;font-weight:700;">Markah Semasa</div>
            <div style="font-size:70px;font-weight:900;color:#fcd34d;">${score}</div>
          </div>`; return;
        }
        const q = res.question;
        if (!q || lastQuestionId === q.questionId) return;
        lastQuestionId = q.questionId;
        renderPlayerQuestion(panel, q, sessionId, storageGet("qlp_player_id"), () => {});
      } catch (e) {} finally { polling = false; }
    }
    pollParticipant(); window.setInterval(pollParticipant, POLL_INTERVAL_MS);
  }

  // ---------- Init ----------
  document.addEventListener("DOMContentLoaded", () => {
    if ($("pin")) { localStorage.removeItem("qlp_player_session_id"); localStorage.removeItem("qlp_player_id"); }
    initJoinForm(); initApiAndQuizForm(); initQuestionForm(); initSessionControls(); initLiveHost(); initLiveParticipant();

    const nextBtn = $("nextQuestionBtn");
    if (nextBtn) {
      nextBtn.addEventListener("click", async () => {
        const sessionId = storageGet("qlp_session_id"), hostToken = storageGet("qlp_host_token");
        if (!sessionId || !hostToken) return alert("Sesi tidak sah.");
        nextBtn.disabled = true; nextBtn.textContent = "Loading...";
        let action = "revealAnswer";
        if (window.hostPhase === "revealing_answer") action = "showLeaderboard";
        else if (window.hostPhase === "leaderboard") action = "nextQuestion";
        try {
          const res = await apiPost({ action, sessionId, hostToken });
          if (!res.success) throw new Error(res.message);
          if (res.completed) alert("Kuiz tamat!");
        } catch (e) { alert(`Ralat: ${e.message}`); } 
        finally { nextBtn.disabled = false; nextBtn.textContent = "Seterusnya"; }
      });
    }
  });
})();
