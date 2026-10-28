/*
 * QUIZ LIVE PPAPP
 * Frontend untuk GitHub Pages + Google Apps Script.
 * Disatukan dengan logik Fasa: Jawapan -> Leaderboard -> Soalan Seterusnya.
 */

(() => {
  "use strict";

  const DEFAULT_API_URL =
    "https://script.google.com/macros/s/AKfycbxlHmVrFF84wSGQF3z0F_qEvVWZpirbgo0D06FclCDkhZTWXv_YgFTAHIAx381FERKT/exec";
  const POLL_INTERVAL_MS = 2000;
  const $ = (id) => document.getElementById(id);

  const ANSWER_COLORS = [
    { option: "A", color: "#e53232", shape: "▲", label: "Merah", textColor: "#ffffff" },
    { option: "B", color: "#2878e8", shape: "◆", label: "Biru", textColor: "#ffffff" },
    { option: "C", color: "#20a464", shape: "●", label: "Hijau", textColor: "#ffffff" },
    { option: "D", color: "#f4c430", shape: "■", label: "Kuning", textColor: "#172033" }
  ];

  // ---------- Helpers ----------

  function getApiUrl() {
    try {
      return (localStorage.getItem("qlp_api_url") || DEFAULT_API_URL).trim();
    } catch (error) {
      console.error("Tidak dapat membaca URL API daripada localStorage:", error);
      return DEFAULT_API_URL;
    }
  }

  function storageGet(key, fallback = "") {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch (error) {
      console.error(`Tidak dapat membaca localStorage (${key}):`, error);
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, String(value ?? ""));
    } catch (error) {
      throw new Error("Pelayar tidak dapat menyimpan data setempat. Semak tetapan privasi pelayar.");
    }
  }

  function readStoredArray(key) {
    const raw = storageGet(key, "[]");
    try {
      const value = JSON.parse(raw || "[]");
      return Array.isArray(value) ? value : [];
    } catch (error) {
      console.warn(`Data ${key} tidak sah; senarai kosong digunakan.`, error);
      return [];
    }
  }

  function setMessage(elementOrId, message, kind = "") {
    const element = typeof elementOrId === "string" ? $(elementOrId) : elementOrId;
    if (!element) return;
    element.textContent = String(message ?? "");
    element.className = "message" + (kind ? ` ${kind}` : "");
    element.setAttribute("role", kind === "error" ? "alert" : "status");
    element.setAttribute("aria-live", kind === "error" ? "assertive" : "polite");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function getErrorMessage(error, fallback = "Berlaku ralat yang tidak dijangka.") {
    return error && error.message ? error.message : fallback;
  }

  async function apiPost(payload) {
    const url = getApiUrl();
    if (!url) throw new Error("URL Web App Apps Script belum ditetapkan.");
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/.test(url)) {
      throw new Error("URL API tidak sah. Pastikan URL Apps Script berakhir dengan /exec.");
    }

    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        redirect: "follow"
      });
    } catch (error) {
      throw new Error("Tidak dapat menyambung ke Apps Script. Semak internet, URL dan tetapan deployment.");
    }

    if (!response.ok) {
      throw new Error(`Pelayan memberi ralat HTTP ${response.status}. Semak deployment Apps Script.`);
    }

    let result;
    try {
      result = await response.json();
    } catch (error) {
      throw new Error("Respons Apps Script bukan JSON yang sah. Semak URL /exec dan kod backend.");
    }

    if (!result || typeof result !== "object") {
      throw new Error("Respons API kosong atau tidak dikenali.");
    }
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

  // ---------- Participant join ----------

  function initJoinForm() {
    const pinInput = $("pin");
    const joinButton = $("joinBtn");
    if (!pinInput || !joinButton) return;

    pinInput.addEventListener("input", () => {
      pinInput.value = pinInput.value.replace(/\D/g, "").slice(0, 6);
    });

    joinButton.addEventListener("click", async () => {
      const pin = pinInput.value.trim();
      const nameInput = $("playerName");
      const name = nameInput ? nameInput.value.trim() : "";

      if (!/^\d{6}$/.test(pin)) {
        setMessage("joinMsg", "PIN perlu mengandungi 6 digit.", "error");
        return;
      }
      if (!name) {
        setMessage("joinMsg", "Masukkan nama paparan dahulu.", "error");
        return;
      }

      setButtonBusy(joinButton, true, "Menyemak…");
      setMessage("joinMsg", "Sedang menyemak PIN…");

      try {
        const result = await apiPost({ action: "join", pin, displayName: name });
        if (!result.success) throw new Error(result.message || "PIN tidak sah.");

        storageSet("qlp_player_session_id", result.sessionId);
        storageSet("qlp_player_id", result.playerId);
        storageSet("qlp_player_name", result.displayName || name);
        storageSet("qlp_player_pin", pin);

        const waitingRoom = $("waitingRoom");
        const heroWrap = document.querySelector(".hero-wrap");
        if (waitingRoom && heroWrap) heroWrap.insertAdjacentElement("afterend", waitingRoom);
        if (heroWrap) heroWrap.style.display = "none";

        document.body.classList.add("waiting-page");
        document.body.style.minHeight = "100vh";

        if (waitingRoom) {
          waitingRoom.hidden = false;
          waitingRoom.style.display = "block";
        }

        if ($("waitingPin")) $("waitingPin").textContent = pin;
        if ($("waitingName")) $("waitingName").textContent = `Peserta: ${result.displayName || name}`;
        if ($("waitingStatus")) $("waitingStatus").textContent = "Menunggu hos memulakan kuiz…";

      } catch (error) {
        setMessage("joinMsg", getErrorMessage(error, "Tidak berjaya menyertai sesi."), "error");
      } finally {
        setButtonBusy(joinButton, false);
      }
    });
  }

  // ---------- API settings and quiz creation ----------

  function initApiAndQuizForm() {
    const apiUrlInput = $("apiUrl");
    if (apiUrlInput) apiUrlInput.value = getApiUrl();
    const saveButton = $("saveApi");
    const testButton = $("testApi");

    if (saveButton) {
      saveButton.addEventListener("click", () => {
        const url = apiUrlInput.value.trim();
        storageSet("qlp_api_url", url);
        setMessage("apiMsg", "URL disimpan pada pelayar ini.", "success");
      });
    }

    if (testButton) {
      testButton.addEventListener("click", async () => {
        setButtonBusy(testButton, true, "Menguji…");
        try {
          const url = getApiUrl();
          const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}action=test`);
          const result = await response.json();
          setMessage("apiMsg", result.message || "API OK.", "success");
        } catch (error) {
          setMessage("apiMsg", `Ralat: ${getErrorMessage(error)}`, "error");
        } finally {
          setButtonBusy(testButton, false);
        }
      });
    }

    renderQuizList();
    refreshQuizzesFromServer();
    
    const quizForm = $("quizForm");
    if (quizForm) {
      quizForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const title = $("quizTitle").value.trim();
        const description = $("quizDescription").value.trim();

        const submitButton = quizForm.querySelector('[type="submit"]');
        setButtonBusy(submitButton, true, "Mencipta…");
        try {
          const result = await apiPost({ action: "createQuiz", title, description });
          if (!result.success) throw new Error(result.message);
          
          const items = readStoredArray("qlp_quizzes");
          items.unshift({ title, description, quizId: result.quizId });
          storageSet("qlp_quizzes", JSON.stringify(items));
          
          $("quizTitle").value = "";
          $("quizDescription").value = "";
          renderQuizList();
          loadQuestionQuizOptions();
          loadSessionQuizOptions();
          setMessage("quizMsg", `Kuiz berjaya dicipta!`, "success");
        } catch (error) {
          setMessage("quizMsg", `Gagal: ${getErrorMessage(error)}`, "error");
        } finally {
          setButtonBusy(submitButton, false);
        }
      });
    }
  }

  function renderQuizList() {
    const target = $("quizList");
    if (!target) return;
    const items = readStoredArray("qlp_quizzes");
    if (!items.length) {
      target.innerHTML = '<div class="empty-state">Belum ada kuiz.</div>';
      return;
    }
    target.innerHTML = items.map((quiz) => `
      <div class="quiz-row">
        <div><b>${escapeHtml(quiz.title)}</b><small>ID: ${escapeHtml(String(quiz.quizId).slice(0, 8))}</small></div>
        <span class="pill">KUIZ</span>
      </div>
    `).join("");
  }

  async function refreshQuizzesFromServer() {
    try {
      const result = await apiPost({ action: "getQuizzes" });
      if (result.success && Array.isArray(result.quizzes)) {
        storageSet("qlp_quizzes", JSON.stringify(result.quizzes));
        renderQuizList();
        loadQuestionQuizOptions();
        loadSessionQuizOptions();
      }
    } catch (error) {
      console.error("Gagal memuatkan kuiz:", error);
    }
  }

  // ---------- Question creation ----------

  function loadQuestionQuizOptions() {
    const select = $("questionQuiz");
    if (!select) return;
    const items = readStoredArray("qlp_quizzes");
    select.innerHTML = '<option value="">Pilih kuiz dahulu</option>';
    items.forEach((quiz) => {
      const option = document.createElement("option");
      option.value = quiz.quizId;
      option.textContent = quiz.title;
      select.appendChild(option);
    });
  }

  function initQuestionForm() {
    const form = $("questionForm");
    if (!form) return;
    loadQuestionQuizOptions();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
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
        points: 1000
      };

      const submitButton = form.querySelector('[type="submit"]');
      setButtonBusy(submitButton, true, "Menyimpan…");
      try {
        const result = await apiPost(payload);
        if (!result.success) throw new Error(result.message);
        setMessage("questionMsg", "Soalan berjaya disimpan.", "success");
        ["questionText", "optionA", "optionB", "optionC", "optionD", "correctOption"].forEach(id => { $(id).value = ""; });
      } catch (error) {
        setMessage("questionMsg", `Gagal: ${getErrorMessage(error)}`, "error");
      } finally {
        setButtonBusy(submitButton, false);
      }
    });
  }

  // ---------- Session creation and start ----------

  function loadSessionQuizOptions() {
    const select = $("sessionQuiz");
    if (!select) return;
    const items = readStoredArray("qlp_quizzes");
    select.innerHTML = '<option value="">Pilih kuiz dahulu</option>';
    items.forEach((quiz) => {
      const option = document.createElement("option");
      option.value = quiz.quizId;
      option.textContent = quiz.title;
      select.appendChild(option);
    });
  }

  function initSessionControls() {
    const createButton = $("createSessionBtn");
    if (createButton) {
      loadSessionQuizOptions();
      createButton.addEventListener("click", async () => {
        const quizId = $("sessionQuiz").value;
        if (!quizId) return setMessage("sessionMsg", "Pilih kuiz dahulu.", "error");
        setButtonBusy(createButton, true, "Menjana PIN…");
        try {
          const result = await apiPost({ action: "createSession", quizId });
          if (!result.success) throw new Error(result.message);
          storageSet("qlp_session_id", result.sessionId);
          storageSet("qlp_host_token", result.hostToken);
          storageSet("qlp_host_started_session_id", "");
          
          if ($("sessionPin")) $("sessionPin").textContent = result.pin;
          if ($("sessionResult")) $("sessionResult").hidden = false;
          setMessage("sessionMsg", "Sesi berjaya dicipta!", "success");
        } catch (error) {
          setMessage("sessionMsg", `Gagal: ${getErrorMessage(error)}`, "error");
        } finally {
          setButtonBusy(createButton, false);
        }
      });
    }

    const startButton = $("startQuizBtn");
    if (startButton) {
      startButton.addEventListener("click", async () => {
        const sessionId = storageGet("qlp_session_id");
        const hostToken = storageGet("qlp_host_token");
        setButtonBusy(startButton, true, "Memulakan…");
        try {
          const result = await apiPost({ action: "startSession", sessionId, hostToken });
          if (!result.success) throw new Error(result.message);
          storageSet("qlp_host_started_session_id", sessionId);
          window.location.href = "host.html";
        } catch (error) {
          setMessage("startQuizMsg", `Gagal: ${getErrorMessage(error)}`, "error");
        } finally {
          setButtonBusy(startButton, false);
        }
      });
    }
  }

  // ---------- Live host display (FASA) ----------

  function ensureHostPanel() {
    return $("hostLiveQuestionPanel");
  }

  function initLiveHost() {
    if (!$("hostLiveQuestionPanel") && !$("nextQuestionBtn")) return;
    let polling = false;

    async function pollHost() {
      if (polling) return;
      const sessionId = storageGet("qlp_session_id");
      if (!sessionId) return;
      polling = true;
      try {
        const result = await apiPost({ action: "getSessionState", sessionId });
        const panel = ensureHostPanel();
        if (!result.success || result.status === "waiting") { if(panel) panel.hidden = true; return; }

        window.hostPhase = result.status; 
        if(panel) {
          panel.hidden = false;
          panel.style.display = "block";
        }

        if (result.status === "completed") {
          panel.innerHTML = '<h2 style="text-align:center">Kuiz telah tamat!</h2>';
          return;
        }

        if (result.status === "leaderboard") {
          const tops = (result.leaderboard || []).map((p, i) =>
            `<div style="font-size:24px; margin:10px auto; max-width:500px; background:#1e293b; color:white; padding:15px 25px; border-radius:10px; display:flex; justify-content:space-between;"><span>#${i+1} ${escapeHtml(p.name)}</span><span style="font-weight:900;">${p.score} pt</span></div>`
          ).join("");
          panel.innerHTML = `<div style="text-align:center"><h2>🏆 TOP 5 LEADERBOARD 🏆</h2>${tops}</div>`;
          return;
        }

        const question = result.question;
        if (!question) return;
        const options = [question.optionA, question.optionB, question.optionC, question.optionD];
        const correct = question.correctOption; 
        
        panel.innerHTML = `
          <div style="text-align:center;margin-bottom:26px">
            <div style="font-size:13px;font-weight:900;letter-spacing:3px;color:#a5b4fc">SOALAN ${question.order}</div>
            <h1 style="font-size:clamp(26px,4vw,44px);margin:16px 0 0">${escapeHtml(question.questionText)}</h1>
          </div>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px">
            ${ANSWER_COLORS.map((item, index) => {
              const isDim = (result.status === "revealing_answer" && item.option !== correct);
              return `<div style="opacity:${isDim ? '0.3' : '1'};min-height:110px;display:flex;align-items:center;gap:16px;padding:20px;border-radius:18px;background:${item.color};color:${item.textColor};font-size:20px;font-weight:800;">
                <span style="font-size:30px;">${item.shape}</span><span>${escapeHtml(options[index])}</span>
                ${result.status === "revealing_answer" && !isDim ? '<span style="margin-left:auto;font-size:30px">✅</span>' : ''}
              </div>`
            }).join("")}
          </div>`;
      } catch (e) {
      } finally { polling = false; }
    }

    pollHost();
    window.setInterval(pollHost, POLL_INTERVAL_MS);
  }

  // ---------- Live participant display (FASA) ----------

  function ensurePlayerPanel() {
    let panel = $("liveQuestionPanel");
    if (panel) return panel;
    panel = document.createElement("section");
    panel.id = "liveQuestionPanel";
    panel.hidden = true;
    panel.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;box-sizing:border-box;padding:20px;display:none;flex-direction:column;justify-content:center;background:#f8fafc;color:#111827;overflow-y:auto;";
    document.body.appendChild(panel);
    return panel;
  }
  
  function renderPlayerQuestion(panel, question, sessionId, playerId, onAnswered) {
    try {
      panel.innerHTML = `
        <div style="text-align:center;margin-bottom:22px">
          <div style="font-size:13px;letter-spacing:2px;font-weight:900;color:#64748b">QUIZ LIVE PPAPP</div>
          <h2 style="font-size:clamp(19px,5vw,26px);line-height:1.35;margin:12px 0">Lihat soalan pada skrin hos</h2>
          <p style="color:#64748b;margin:0">Pilih petak warna yang sepadan dengan jawapan.</p>
        </div>
        <div id="playerColorGrid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;width:100%;flex:1;align-content:center">
          ${ANSWER_COLORS.map((item) => `
            <button type="button" data-option="${item.option}" aria-label="Jawapan warna ${item.label}" style="min-height:clamp(135px,28vh,230px);border:0;border-radius:22px;background:${item.color};color:${item.textColor};font-size:clamp(46px,12vw,76px);font-weight:900;box-shadow:0 7px 0 rgba(0,0,0,.12);cursor:pointer;touch-action:manipulation">${item.shape}</button>`).join("")}
        </div>
        <p id="playerAnswerStatus" aria-live="polite" style="text-align:center;font-weight:800;font-size:16px;margin:20px 0 0;color:#334155">Pilih satu warna untuk menjawab.</p>`;

      const buttons = [...panel.querySelectorAll("[data-option]")];
      buttons.forEach((button) => {
        button.addEventListener("click", async () => {
          if (button.dataset.submitting === "true" || button.dataset.answered === "true") return;
          buttons.forEach((item) => { item.disabled = true; item.style.opacity = "0.58"; });
          button.style.opacity = "1";
          button.style.transform = "scale(.97)";
          button.dataset.submitting = "true";
          const status = $("playerAnswerStatus");
          if (status) status.textContent = "Menghantar jawapan…";

          try {
            const response = await apiPost({
              action: "submitAnswer",
              sessionId,
              playerId,
              questionId: question.questionId,
              selectedOption: button.dataset.option,
              responseMs: 1000
            });
            if (!response.success) throw new Error(response.message || "Gagal dihantar.");
            
            // SIMPAN MARKAH SEMASA DAN STATUS BETUL/SALAH DI SINI
            localStorage.setItem("qlp_last_isCorrect", response.isCorrect);
            localStorage.setItem("qlp_last_score", response.totalScore);
            
            button.dataset.answered = "true";
            if (status) {
              status.textContent = "Jawapan diterima!";
              status.style.color = "#15803d";
            }
            onAnswered(question.questionId);
          } catch (error) {
            button.dataset.submitting = "false";
            buttons.forEach((item) => { item.disabled = false; item.style.opacity = "1"; item.style.transform = "none"; });
            if (status) {
              status.textContent = `Ralat: ${getErrorMessage(error)}`;
              status.style.color = "#b91c1c";
            }
          }
        });
      });
    } catch (err) {
      panel.innerHTML = `<div style="padding:20px;text-align:center;color:#b91c1c;font-weight:bold;"><h3>Ralat Sistem</h3><p>${err.message}</p></div>`;
    }
  }

  function initLiveParticipant() {
    if (!$("waitingRoom") && !$("joinBtn")) return;
    let polling = false;
    let lastQuestionId = "";

    async function pollParticipant() {
      if (polling) return;
      const sessionId = storageGet("qlp_player_session_id");
      if (!sessionId) return;
      polling = true;
      try {
        const result = await apiPost({ action: "getSessionState", sessionId });
        const waitingRoom = $("waitingRoom");
        const panel = ensurePlayerPanel();

        if (result.status === "waiting") {
          panel.hidden = true; panel.style.display = "none";
          if (waitingRoom) { waitingRoom.hidden = false; waitingRoom.style.display = "block"; }
          return;
        }

        if (waitingRoom) { waitingRoom.hidden = true; waitingRoom.style.display = "none"; }
        panel.hidden = false; panel.style.display = "flex";

        if (result.status === "completed") {
          panel.innerHTML = '<div style="text-align:center;padding:40px 10px"><h2>Kuiz telah tamat</h2></div>';
          return;
        }

        if (result.status === "revealing_answer") {
          const isCorrect = localStorage.getItem("qlp_last_isCorrect") === "true";
          const bgColor = isCorrect ? "#15803d" : "#b91c1c";
          const icon = isCorrect ? "✅" : "❌";
          panel.innerHTML = `<div style="text-align:center;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${bgColor};color:white;border-radius:20px;min-height:50vh;">
            <div style="font-size:120px;line-height:1;">${icon}</div>
          </div>`;
          return;
        }

        if (result.status === "leaderboard") {
          const score = localStorage.getItem("qlp_last_score") || "0";
          panel.innerHTML = `<div style="text-align:center;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#2563eb;color:white;border-radius:20px;min-height:50vh;">
            <div style="font-size:24px;font-weight:700;margin-bottom:10px;">Markah Semasa</div>
            <div style="font-size:70px;font-weight:900;">${score} pt</div>
          </div>`;
          return;
        }

        const question = result.question;
        if (!question) return;
        if (lastQuestionId === question.questionId) return;
        lastQuestionId = question.questionId;
        renderPlayerQuestion(panel, question, sessionId, storageGet("qlp_player_id"), () => {});
      } catch (e) {
      } finally { polling = false; }
    }

    pollParticipant();
    window.setInterval(pollParticipant, POLL_INTERVAL_MS);
  }

  // ---------- Start the app ----------

  document.addEventListener("DOMContentLoaded", () => {
    try {
      // PADAM MEMORI LAMA
      const pinInput = document.getElementById("pin");
      if (pinInput) {
        localStorage.removeItem("qlp_player_session_id");
        localStorage.removeItem("qlp_player_id");
      }

      initJoinForm();
      initApiAndQuizForm();
      initQuestionForm();
      initSessionControls();
      initLiveHost();
      initLiveParticipant();

      // KOD BUTANG NEXT HOS BERDASARKAN FASA
      const nextBtn = document.getElementById("nextQuestionBtn");
      if (nextBtn) {
        nextBtn.addEventListener("click", async () => {
          const sessionId = localStorage.getItem("qlp_session_id");
          const hostToken = localStorage.getItem("qlp_host_token");
          
          if (!sessionId || !hostToken) {
            alert("Sesi tidak sah.");
            return;
          }

          nextBtn.disabled = true;
          nextBtn.textContent = "Loading...";

          // KIRA FASA SETERUSNYA
          let action = "revealAnswer";
          if (window.hostPhase === "revealing_answer") action = "showLeaderboard";
          else if (window.hostPhase === "leaderboard") action = "nextQuestion";

          try {
            const response = await apiPost({
              action: action,
              sessionId: sessionId,
              hostToken: hostToken
            });

            if (!response.success) throw new Error(response.message);
            if (response.completed) alert("Kuiz telah tamat!");
            
          } catch (error) {
            alert(`Ralat: ${error.message}`);
          } finally {
            nextBtn.disabled = false;
            nextBtn.textContent = "Seterusnya";
          }
        });
      }

    } catch (error) {
      console.error("Ralat memulakan aplikasi:", error);
    }
  });
})();
