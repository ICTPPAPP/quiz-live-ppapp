/*
 * QUIZ LIVE PPAPP
 * Frontend untuk GitHub Pages + Google Apps Script.
 * Kekalkan nama action dan localStorage sedia ada supaya serasi dengan backend.
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

  function requireElements(ids) {
    return ids.map($).every(Boolean);
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
      if (name.length > 30) {
        setMessage("joinMsg", "Nama paparan tidak boleh melebihi 30 aksara.", "error");
        return;
      }

      setButtonBusy(joinButton, true, "Menyemak…");
      setMessage("joinMsg", "Sedang menyemak PIN…");

      try {
        const result = await apiPost({ action: "join", pin, displayName: name });
        if (!result.success) {
          throw new Error(result.message || "PIN tidak sah atau sesi tidak tersedia.");
        }
        if (!result.sessionId || !result.playerId) {
          throw new Error("Respons join tidak mengandungi ID sesi atau ID peserta.");
        }

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
          Object.assign(waitingRoom.style, {
            display: "block",
            width: "min(600px, 100%)",
            margin: "60px auto",
            padding: "32px",
            boxSizing: "border-box"
          });
          waitingRoom.hidden = false;
        }

        if ($("waitingPin")) $("waitingPin").textContent = pin;
        if ($("waitingName")) $("waitingName").textContent = `Peserta: ${result.displayName || name}`;
        if ($("waitingStatus")) $("waitingStatus").textContent = "Menunggu hos memulakan kuiz…";

        document.title = "Bilik Menunggu | QUIZ LIVE PPAPP";
        setMessage("joinMsg", result.message || "Berjaya menyertai sesi.", "success");
        window.scrollTo({ top: 0, behavior: "smooth" });
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
    if (!apiUrlInput) return;

    apiUrlInput.value = getApiUrl();
    const saveButton = $("saveApi");
    const testButton = $("testApi");

    if (saveButton) {
      saveButton.addEventListener("click", () => {
        const url = apiUrlInput.value.trim();
        if (url && !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/.test(url)) {
          setMessage("apiMsg", "URL perlu bermula dengan https://script.google.com/macros/s/ dan berakhir dengan /exec.", "error");
          return;
        }
        try {
          storageSet("qlp_api_url", url);
          setMessage("apiMsg", url ? "URL disimpan pada pelayar ini." : "URL API dipadam; URL lalai akan digunakan.", "success");
        } catch (error) {
          setMessage("apiMsg", getErrorMessage(error), "error");
        }
      });
    }

    if (testButton) {
      testButton.addEventListener("click", async () => {
        setButtonBusy(testButton, true, "Menguji…");
        setMessage("apiMsg", "Sedang menguji sambungan API…");
        try {
          const url = getApiUrl();
          if (!url) throw new Error("URL API belum ditetapkan.");
          const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}action=test`, { redirect: "follow" });
          if (!response.ok) throw new Error(`Pelayan memberi ralat HTTP ${response.status}.`);
          let result;
          try {
            result = await response.json();
          } catch (error) {
            throw new Error("Respons ujian bukan JSON yang sah. Semak deployment Apps Script.");
          }
          setMessage("apiMsg", result.message || (result.success ? "API OK." : "API memberi respons tetapi ujian tidak berjaya."), result.success ? "success" : "error");
        } catch (error) {
          setMessage("apiMsg", `${getErrorMessage(error)} Jika pelayar melaporkan CORS, semak tetapan akses Web App Apps Script.`, "error");
        } finally {
          setButtonBusy(testButton, false);
        }
      });
    }

    renderQuizList();
    const quizForm = $("quizForm");
    if (quizForm) {
      quizForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const titleInput = $("quizTitle");
        const descriptionInput = $("quizDescription");
        const title = titleInput ? titleInput.value.trim() : "";
        const description = descriptionInput ? descriptionInput.value.trim() : "";
        if (!title) {
          setMessage("quizMsg", "Masukkan tajuk kuiz dahulu.", "error");
          return;
        }

        const submitButton = quizForm.querySelector('[type="submit"]');
        setButtonBusy(submitButton, true, "Mencipta…");
        setMessage("quizMsg", "Sedang mencipta kuiz…");
        try {
          const result = await apiPost({ action: "createQuiz", title, description });
          if (!result.success) throw new Error(result.message || "Kuiz tidak berjaya dicipta.");
          if (!result.quizId) throw new Error("Backend tidak memulangkan quizId; kuiz tidak ditambah ke senarai setempat.");

          const items = readStoredArray("qlp_quizzes");
          items.unshift({ title, description, quizId: result.quizId, createdAt: new Date().toISOString() });
          storageSet("qlp_quizzes", JSON.stringify(items));
          if (titleInput) titleInput.value = "";
          if (descriptionInput) descriptionInput.value = "";
          renderQuizList();
          loadQuestionQuizOptions();
          loadSessionQuizOptions();
          setMessage("quizMsg", `Kuiz berjaya dicipta. ID: ${result.quizId}`, "success");
        } catch (error) {
          setMessage("quizMsg", `Tidak berjaya mencipta kuiz: ${getErrorMessage(error)}`, "error");
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
      target.innerHTML = '<div class="empty-state">Belum ada kuiz dicipta melalui panel ini.</div>';
      return;
    }
    target.innerHTML = items.map((quiz) => `
      <div class="quiz-row">
        <div><b>${escapeHtml(quiz.title)}</b><small>${escapeHtml(quiz.description || "Tiada penerangan")} · ${quiz.quizId ? `ID: ${escapeHtml(String(quiz.quizId).slice(0, 8))}…` : "Demo setempat"}</small></div>
        <span class="pill">KUIZ</span>
      </div>
    `).join("");
  }

  // ---------- Question creation ----------

  function loadQuestionQuizOptions() {
    const select = $("questionQuiz");
    if (!select) return;
    const items = readStoredArray("qlp_quizzes");
    select.innerHTML = '<option value="">Pilih kuiz dahulu</option>';
    items.forEach((quiz) => {
      if (!quiz.quizId) return;
      const option = document.createElement("option");
      option.value = quiz.quizId;
      option.textContent = quiz.title || "Kuiz tanpa tajuk";
      select.appendChild(option);
    });
  }

  function initQuestionForm() {
    const form = $("questionForm");
    if (!form) return;
    loadQuestionQuizOptions();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const valueOf = (id) => $(id) ? $(id).value.trim() : "";
      const payload = {
        action: "addQuestion",
        quizId: valueOf("questionQuiz"),
        questionText: valueOf("questionText"),
        optionA: valueOf("optionA"),
        optionB: valueOf("optionB"),
        optionC: valueOf("optionC"),
        optionD: valueOf("optionD"),
        correctOption: valueOf("correctOption"),
        timeLimitSeconds: Number(valueOf("questionTime") || 20),
        points: 1000
      };

      if (!payload.quizId) return setMessage("questionMsg", "Pilih kuiz dahulu. Jika senarai kosong, cipta kuiz terlebih dahulu.", "error");
      if (!payload.questionText || !payload.optionA || !payload.optionB || !payload.optionC || !payload.optionD || !payload.correctOption) {
        return setMessage("questionMsg", "Lengkapkan soalan, keempat-empat pilihan dan jawapan yang betul.", "error");
      }
      if (!Number.isFinite(payload.timeLimitSeconds) || payload.timeLimitSeconds < 1) {
        return setMessage("questionMsg", "Masa menjawab perlu sekurang-kurangnya 1 saat.", "error");
      }

      const submitButton = form.querySelector('[type="submit"]');
      setButtonBusy(submitButton, true, "Menyimpan…");
      setMessage("questionMsg", "Sedang menyimpan soalan…");
      try {
        const result = await apiPost(payload);
        if (!result.success) throw new Error(result.message || "Soalan gagal disimpan.");
        setMessage("questionMsg", "Soalan berjaya disimpan ke backend.", "success");
        ["questionText", "optionA", "optionB", "optionC", "optionD", "correctOption"].forEach((id) => { if ($(id)) $(id).value = ""; });
        if ($("questionTime")) $("questionTime").value = "20";
      } catch (error) {
        setMessage("questionMsg", `Gagal menyimpan soalan: ${getErrorMessage(error)}`, "error");
      } finally {
        setButtonBusy(submitButton, false);
      }
    });
  }

  // ---------- Session creation and start ----------

  function loadSessionQuizOptions() {
    const select = $("sessionQuiz");
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="">Pilih kuiz dahulu</option>';
    readStoredArray("qlp_quizzes").forEach((quiz) => {
      if (!quiz.quizId) return;
      const option = document.createElement("option");
      option.value = quiz.quizId;
      option.textContent = quiz.title || "Kuiz tanpa tajuk";
      select.appendChild(option);
    });
    if ([...select.options].some((option) => option.value === currentValue)) select.value = currentValue;
  }

  function initSessionControls() {
    const select = $("sessionQuiz");
    const createButton = $("createSessionBtn");
    if (!select || !createButton) return;
    loadSessionQuizOptions();

    createButton.addEventListener("click", async () => {
      const quizId = select.value;
      if (!quizId) return setMessage("sessionMsg", "Sila pilih kuiz dahulu.", "error");
      setButtonBusy(createButton, true, "Menjana PIN…");
      setMessage("sessionMsg", "Sedang menjana PIN sesi…");
      try {
        const result = await apiPost({ action: "createSession", quizId });
        if (!result.success) throw new Error(result.message || "Sesi gagal dicipta.");
        if (!result.sessionId || !result.hostToken || !result.pin) throw new Error("Respons backend tidak lengkap: sessionId, hostToken atau PIN tiada.");
        storageSet("qlp_session_id", result.sessionId);
        storageSet("qlp_host_token", result.hostToken);
        if ($("sessionPin")) $("sessionPin").textContent = result.pin;
        if ($("sessionStatus")) $("sessionStatus").textContent = "Status: Menunggu peserta";
        if ($("sessionResult")) $("sessionResult").hidden = false;
        setMessage("sessionMsg", "Sesi berjaya dicipta!", "success");
      } catch (error) {
        setMessage("sessionMsg", `Gagal menjana PIN: ${getErrorMessage(error)}`, "error");
      } finally {
        setButtonBusy(createButton, false);
      }
    });

    const startButton = $("startQuizBtn");
    if (startButton) {
      startButton.addEventListener("click", async () => {
        const sessionId = storageGet("qlp_session_id");
        const hostToken = storageGet("qlp_host_token");
        if (!sessionId || !hostToken) return setMessage("startQuizMsg", "Sila jana PIN sesi terlebih dahulu.", "error");
        setButtonBusy(startButton, true, "Memulakan…");
        setMessage("startQuizMsg", "Sedang memulakan kuiz…");
        try {
          const result = await apiPost({ action: "startSession", sessionId, hostToken });
          if (!result.success) throw new Error(result.message || "Kuiz gagal dimulakan.");
          if ($("sessionStatus")) $("sessionStatus").textContent = "Status: Kuiz sedang berlangsung";
          setMessage("startQuizMsg", "Kuiz berjaya dimulakan!", "success");
        } catch (error) {
          setMessage("startQuizMsg", `Gagal memulakan kuiz: ${getErrorMessage(error)}`, "error");
        } finally {
          setButtonBusy(startButton, false);
        }
      });
    }
  }

  // ---------- Live host display ----------

  function ensureHostPanel() {
    let panel = $("hostLiveQuestionPanel");
    if (panel) return panel;
    panel = document.createElement("section");
    panel.id = "hostLiveQuestionPanel";
    panel.hidden = true;
    panel.style.cssText = "max-width:1100px;width:calc(100% - 32px);box-sizing:border-box;margin:28px auto;padding:clamp(18px,3vw,36px);border-radius:24px;background:#111827;color:#fff;box-shadow:0 16px 40px rgba(0,0,0,.18);";
    const anchor = $("sessionResult") || $("startQuizMsg") || $("startQuizBtn");
    if (anchor && anchor.insertAdjacentElement) anchor.insertAdjacentElement("afterend", panel);
    else document.body.appendChild(panel);
    return panel;
  }

  function renderHostQuestion(panel, question) {
    const options = [question.optionA, question.optionB, question.optionC, question.optionD];
    panel.innerHTML = `
      <div style="text-align:center;margin-bottom:26px">
        <div style="font-size:13px;font-weight:900;letter-spacing:3px;color:#a5b4fc">QUIZ LIVE PPAPP · SOALAN ${escapeHtml(question.order)}</div>
        <h1 style="font-size:clamp(26px,4vw,44px);line-height:1.25;margin:16px 0 0">${escapeHtml(question.questionText)}</h1>
        <div style="margin-top:12px;color:#cbd5e1;font-weight:700">Masa menjawab: ${escapeHtml(question.timeLimitSeconds)} saat</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px">
        ${ANSWER_COLORS.map((item, index) => `
          <div style="min-height:110px;display:flex;align-items:center;gap:16px;padding:clamp(16px,2.5vw,28px);box-sizing:border-box;border-radius:18px;background:${item.color};color:${item.textColor};font-size:clamp(17px,2.3vw,25px);font-weight:800;overflow-wrap:anywhere">
            <span aria-hidden="true" style="font-size:clamp(28px,4vw,44px);line-height:1">${item.shape}</span>
            <span>${escapeHtml(options[index])}</span>
          </div>`).join("")}
      </div>
      <p style="text-align:center;color:#cbd5e1;margin:22px 0 0;font-weight:700">Peserta jawab menggunakan petak warna pada telefon masing-masing.</p>`;
  }

  function initLiveHost() {
    if (!$("startQuizBtn")) return;
    let polling = false;
    let lastQuestionId = "";
    let lastStatus = "";

    async function pollHost() {
      if (polling) return;
      const sessionId = storageGet("qlp_session_id");
      if (!sessionId) return;
      polling = true;
      try {
        const result = await apiPost({ action: "getSessionState", sessionId });
        if (!result.success) throw new Error(result.message || "Gagal mendapatkan status sesi.");
        const panel = ensureHostPanel();
        if (result.status === "waiting") {
          panel.hidden = true;
          lastStatus = "waiting";
          return;
        }
        if (result.status === "completed") {
          panel.hidden = false;
          panel.innerHTML = '<h2 style="text-align:center">Kuiz telah tamat</h2>';
          lastStatus = "completed";
          return;
        }
        if (result.status !== "active" || !result.question) return;
        const question = result.question;
        panel.hidden = false;
        if (lastQuestionId === question.questionId && lastStatus === result.status) return;
        lastQuestionId = question.questionId;
        lastStatus = result.status;
        renderHostQuestion(panel, question);
      } catch (error) {
        console.error("Semakan soalan hos gagal:", error);
        const panel = $("hostLiveQuestionPanel");
        if (panel && !panel.hidden) {
          let errorNotice = $("hostPollError");
          if (!errorNotice) {
            errorNotice = document.createElement("p");
            errorNotice.id = "hostPollError";
            errorNotice.style.cssText = "text-align:center;color:#fecaca;font-weight:700";
            panel.appendChild(errorNotice);
          }
          errorNotice.textContent = `Sambungan terputus sementara: ${getErrorMessage(error)}`;
        }
      } finally {
        polling = false;
      }
    }

    pollHost();
    window.setInterval(pollHost, POLL_INTERVAL_MS);
  }

  // ---------- Live participant display and answers ----------

  function ensurePlayerPanel() {
    let panel = $("liveQuestionPanel");
    if (panel) return panel;
    panel = document.createElement("section");
    panel.id = "liveQuestionPanel";
    panel.hidden = true;
    panel.style.cssText = "width:100%;max-width:760px;min-height:100vh;box-sizing:border-box;margin:0 auto;padding:18px;display:flex;flex-direction:column;justify-content:center;background:#f8fafc;color:#111827;";
    const waitingRoom = $("waitingRoom");
    if (waitingRoom) waitingRoom.insertAdjacentElement("afterend", panel);
    else document.body.appendChild(panel);
    return panel;
  }

  function renderPlayerQuestion(panel, question, sessionId, playerId, onAnswered) {
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
        buttons.forEach((item) => {
          item.disabled = true;
          item.style.opacity = "0.58";
        });
        button.style.opacity = "1";
        button.style.transform = "scale(.97)";
        button.dataset.submitting = "true";
        const status = $("playerAnswerStatus");
        if (status) status.textContent = "Menghantar jawapan…";

        try {
          if (!playerId) throw new Error("ID peserta tiada. Sila sertai semula sesi.");
          const response = await apiPost({
            action: "submitAnswer",
            sessionId,
            playerId,
            questionId: question.questionId,
            selectedOption: button.dataset.option,
            responseMs: 1000
          });
          if (!response.success) throw new Error(response.message || "Jawapan gagal dihantar.");
          button.dataset.answered = "true";
          if (status) {
            status.textContent = "Jawapan diterima!";
            status.style.color = "#15803d";
          }
          onAnswered(question.questionId);
        } catch (error) {
          button.dataset.submitting = "false";
          buttons.forEach((item) => {
            item.disabled = false;
            item.style.opacity = "1";
            item.style.transform = "none";
          });
          if (status) {
            status.textContent = `Jawapan gagal dihantar: ${getErrorMessage(error)}`;
            status.style.color = "#b91c1c";
          }
        }
      });
    });
  }

  function initLiveParticipant() {
    if (!$("joinBtn") || !$("waitingRoom")) return;
    let polling = false;
    let lastQuestionId = "";
    let answerSubmittedFor = "";

    async function pollParticipant() {
      if (polling) return;
      const sessionId = storageGet("qlp_player_session_id");
      if (!sessionId) return;
      polling = true;
      try {
        const result = await apiPost({ action: "getSessionState", sessionId });
        if (!result.success) throw new Error(result.message || "Gagal menyemak sesi.");
        const waitingRoom = $("waitingRoom");
        const panel = ensurePlayerPanel();

        if (result.status === "waiting") {
          panel.hidden = true;
          panel.style.display = "none";
          if (waitingRoom) {
            waitingRoom.hidden = false;
            waitingRoom.style.display = "block";
          }
          if ($("waitingStatus")) $("waitingStatus").textContent = "Menunggu hos memulakan kuiz…";
          lastQuestionId = "";
          answerSubmittedFor = "";
          return;
        }

        if (result.status === "completed") {
          if (waitingRoom) {
            waitingRoom.hidden = true;
            waitingRoom.style.display = "none";
          }
          panel.hidden = false;
          panel.style.display = "block";
          panel.innerHTML = '<div style="text-align:center;padding:40px 10px"><h2>Kuiz telah tamat</h2><p>Terima kasih kerana menyertai QUIZ LIVE PPAPP.</p></div>';
          document.title = "Kuiz Tamat | QUIZ LIVE PPAPP";
          return;
        }

        if (result.status !== "active" || !result.question) return;
        const question = result.question;
        if (waitingRoom) {
          waitingRoom.hidden = true;
          waitingRoom.style.display = "none";
        }
        panel.hidden = false;
        panel.style.display = "flex";

        if (lastQuestionId === question.questionId) return;
        lastQuestionId = question.questionId;
        answerSubmittedFor = "";
        renderPlayerQuestion(
          panel,
          question,
          sessionId,
          storageGet("qlp_player_id"),
          (questionId) => { answerSubmittedFor = questionId; }
        );
        document.title = "Jawab Kuiz | QUIZ LIVE PPAPP";
      } catch (error) {
        console.error("Semakan sesi peserta gagal:", error);
        const status = $("playerAnswerStatus");
        if (status) {
          status.textContent = `Sambungan sedang terganggu: ${getErrorMessage(error)}`;
          status.style.color = "#b91c1c";
        } else if ($("waitingStatus")) {
          $("waitingStatus").textContent = `Tidak dapat menyemak sesi: ${getErrorMessage(error)} Cuba tunggu sebentar.`;
        }
      } finally {
        polling = false;
      }
    }

    pollParticipant();
    window.setInterval(pollParticipant, POLL_INTERVAL_MS);
  }

  // ---------- Start the app ----------

  document.addEventListener("DOMContentLoaded", () => {
    try {
      initJoinForm();
      initApiAndQuizForm();
      initQuestionForm();
      initSessionControls();
      initLiveHost();
      initLiveParticipant();
    } catch (error) {
      console.error("Ralat semasa memulakan QUIZ LIVE PPAPP:", error);
      const globalError = document.createElement("div");
      globalError.setAttribute("role", "alert");
      globalError.style.cssText = "margin:16px;padding:16px;border-radius:12px;background:#fee2e2;color:#991b1b;font-weight:700";
      globalError.textContent = `Aplikasi gagal dimulakan: ${getErrorMessage(error)}`;
      document.body.prepend(globalError);
    }
  });
})();
