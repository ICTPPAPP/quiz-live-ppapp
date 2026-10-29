/* QUIZ LIVE PPAPP - FULL LOGIC + ADMIN AUTH (LOGIN/REG/FORGOT) */
(() => {
  "use strict";

  const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbxlHmVrFF84wSGQF3z0F_qEvVWZpirbgo0D06FclCDkhZTWXv_YgFTAHIAx381FERKT/exec";
  const POLL_INTERVAL_MS = 1500; 
  const $ = (id) => document.getElementById(id);

  // --- AUDIO SYSTEM ---
  const SOUNDS = { bgm_main: new Audio("bgm-lobby.mp3"), sfx_correct: new Audio("sfx-correct.mp3"), sfx_wrong: new Audio("sfx-wrong.mp3") };
  SOUNDS.bgm_main.loop = true; 
  function playBGM() { if (SOUNDS.bgm_main.paused) { const p = SOUNDS.bgm_main.play(); if (p !== undefined) p.catch(() => {}); } }
  function stopBGM() { SOUNDS.bgm_main.pause(); SOUNDS.bgm_main.currentTime = 0; }
  function playSFX(key) { if (SOUNDS[key]) { SOUNDS[key].currentTime = 0; SOUNDS[key].play().catch(() => {}); } }
  document.body.addEventListener('click', () => { if (!window.audioUnlocked) { window.audioUnlocked = true; if (window.hostPhase === "waiting" || window.hostPhase === "active") playBGM(); } }, { capture: true });

  const ANSWER_COLORS = [
    { option: "A", color: "#e53232", shape: "▲", label: "Merah", textColor: "#ffffff" },
    { option: "B", color: "#2878e8", shape: "◆", label: "Biru", textColor: "#ffffff" },
    { option: "C", color: "#20a464", shape: "●", label: "Hijau", textColor: "#ffffff" },
    { option: "D", color: "#f4c430", shape: "■", label: "Kuning", textColor: "#172033" }
  ];

  function getApiUrl() { try { return (localStorage.getItem("qlp_api_url") || DEFAULT_API_URL).trim(); } catch (e) { return DEFAULT_API_URL; } }
  function storageGet(key, fallback = "") { try { return localStorage.getItem(key) ?? fallback; } catch (e) { return fallback; } }
  function storageSet(key, value) { try { localStorage.setItem(key, String(value ?? "")); } catch (e) {} }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (c) => ({"&": "&amp;","<": "&lt;",">": "&gt;",'"': "&quot;","'": "&#39;"})[c]); }
  async function apiPost(payload) { const url = getApiUrl(); const response = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(payload) }); return await response.json(); }

  // ---------- Join Participant ----------
  function initJoinForm() {
    const pinInput = $("pin"), joinButton = $("joinBtn"); if (!pinInput || !joinButton) return;
    pinInput.addEventListener("input", () => { pinInput.value = pinInput.value.replace(/\D/g, "").slice(0, 6); });
    joinButton.addEventListener("click", async () => {
      const pin = pinInput.value.trim(), name = ($("playerName") ? $("playerName").value.trim() : "");
      if (!/^\d{6}$/.test(pin) || !name) return alert("Sila masukkan 6 digit PIN dan Nama.");
      joinButton.disabled = true; joinButton.textContent = "Menyemak...";
      try {
        const res = await apiPost({ action: "join", pin, displayName: name });
        if (!res.success) throw new Error(res.message);
        storageSet("qlp_player_session_id", res.sessionId); storageSet("qlp_player_id", res.playerId);
        if ($("waitingRoom")) { $("waitingRoom").hidden = false; $("waitingRoom").style.display = "block"; }
        if (document.querySelector(".hero-wrap")) document.querySelector(".hero-wrap").style.display = "none";
        document.body.classList.add("waiting-page");
        if ($("waitingPin")) $("waitingPin").textContent = pin;
        if ($("waitingName")) $("waitingName").textContent = `Peserta: ${name}`;
      } catch (err) { alert(err.message); } finally { joinButton.disabled = false; joinButton.textContent = "Sertai Kuiz →"; }
    });
  }

  // ---------- Admin Panel & Authentication ----------
  function initAdminLogic() {
    if (!$("authSection")) return;

    // 1. Semak Status Login (Buka/Tutup Dashboard & Profil)
    const adminName = storageGet("qlp_admin_name");
    if (adminName) {
      $("authSection").style.display = "none";
      $("dashboardSection").style.display = "block";
      $("adminProfile").style.display = "flex";
      $("adminNameDisplay").textContent = adminName;
      $("adminAvatar").textContent = adminName.charAt(0).toUpperCase();
    }

    // 2. Fungsi Logout
    if ($("logoutBtn")) {
      $("logoutBtn").addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.removeItem("qlp_admin_name");
        localStorage.removeItem("qlp_admin_email");
        location.reload();
      });
    }

    // 3. Login
    if ($("loginForm")) {
      $("loginForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = $("loginForm").querySelector("button"); btn.disabled = true; btn.textContent = "Menyemak...";
        try {
          const res = await apiPost({ action: "adminLogin", email: $("loginEmail").value, password: $("loginPassword").value });
          if (!res.success) throw new Error(res.message);
          storageSet("qlp_admin_name", res.name);
          storageSet("qlp_admin_email", res.email);
          location.reload();
        } catch(err) { alert(err.message); btn.disabled = false; btn.textContent = "Log Masuk"; }
      });
    }

    // 4. Daftar
    if ($("registerForm")) {
      $("registerForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const pwd = $("regPassword").value;
        const confirm = $("regConfirmPassword").value;
        
        // Pengesahan Keselamatan Kata Laluan (Regex)
        const strictRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
        if (!strictRegex.test(pwd)) return alert("Kata laluan mesti > 8 aksara, mengandungi Huruf Besar, Huruf Kecil, Nombor dan Simbol.");
        if (pwd !== confirm) return alert("Sahkan kata laluan tidak sepadan!");

        const btn = $("registerForm").querySelector("button"); btn.disabled = true; btn.textContent = "Mendaftar...";
        try {
          const res = await apiPost({ action: "adminRegister", name: $("regName").value, email: $("regEmail").value, password: pwd });
          if (!res.success) throw new Error(res.message);
          alert("Pendaftaran Berjaya! Sila Log Masuk.");
          window.switchAuth('login');
        } catch(err) { alert(err.message); } finally { btn.disabled = false; btn.textContent = "Daftar Sekarang"; }
      });
    }

    // 5. Lupa Kata Laluan
    if ($("forgotForm")) {
      $("forgotForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = $("forgotForm").querySelector("button"); btn.disabled = true; btn.textContent = "Menghantar...";
        try {
          const res = await apiPost({ action: "adminForgot", email: $("forgotEmail").value });
          if (!res.success) throw new Error(res.message);
          alert("Kata laluan sementara telah dihantar ke emel anda!");
          window.switchAuth('login');
        } catch(err) { alert(err.message); } finally { btn.disabled = false; btn.textContent = "Hantar Kata Laluan Sementara"; }
      });
    }

    // --- LOGIK KUIZ DASHBOARD ---
    async function loadQuizzesFromServer() {
      if (!$("questionQuiz") && !$("sessionQuiz")) return;
      try {
        const res = await apiPost({ action: "getQuizzes" });
        if (res.success && res.quizzes) {
          const opts = res.quizzes.map(q => `<option value="${q.quizId}">${escapeHtml(q.title)}</option>`).join("");
          if ($("questionQuiz")) $("questionQuiz").innerHTML = opts || '<option value="">-- Tiada Kuiz --</option>';
          if ($("sessionQuiz")) $("sessionQuiz").innerHTML = opts || '<option value="">-- Tiada Kuiz --</option>';
        }
      } catch (e) {}
    }
    loadQuizzesFromServer();

    if ($("quizForm")) {
      $("quizForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = $("quizForm").querySelector("button"); btn.disabled = true; btn.textContent = "Mencipta...";
        try {
          await apiPost({ action: "createQuiz", title: $("quizTitle").value, description: $("quizDescription").value });
          alert("Kuiz Berjaya Dicipta!"); location.reload();
        } catch(err) { alert(err.message); btn.disabled = false; btn.textContent = "Cipta Kuiz"; }
      });
    }

    if ($("questionForm")) {
      $("questionForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = $("questionForm").querySelector("button"); btn.disabled = true; btn.textContent = "Menyimpan...";
        try {
          await apiPost({
            action: "addQuestion", quizId: $("questionQuiz").value, questionText: $("questionText").value,
            optionA: $("optionA").value, optionB: $("optionB").value, optionC: $("optionC").value, optionD: $("optionD").value,
            correctOption: $("correctOption").value, timeLimitSeconds: Number($("questionTime").value),
            points: $("doublePoints").checked ? 2000 : 1000
          });
          alert("Soalan Disimpan!"); $("questionForm").reset();
        } catch(err) { alert(err.message); } finally { btn.disabled = false; btn.textContent = "Simpan Soalan"; }
      });
    }

    if ($("createSessionBtn")) {
      $("createSessionBtn").addEventListener("click", async () => {
        const quizId = $("sessionQuiz").value; if (!quizId) return alert("Pilih Kuiz");
        $("createSessionBtn").disabled = true; $("createSessionBtn").textContent = "Menjana...";
        try {
          const res = await apiPost({ action: "createSession", quizId });
          storageSet("qlp_session_id", res.sessionId); storageSet("qlp_host_token", res.hostToken); storageSet("qlp_player_pin", res.pin);
          window.location.href = "host.html"; 
        } catch(err) { alert(err.message); $("createSessionBtn").disabled = false; $("createSessionBtn").textContent = "Jana PIN Permainan"; }
      });
    }
  }

  // ---------- Live Host (Singkat) ----------
  function initLiveHost() {
    const lobby = $("lobbyPanel"), panel = $("hostLiveQuestionPanel"), control = $("hostControlPanel");
    if (!lobby && !panel) return;
    let polling = false, currentRenderKey = "", hostTimerInt = null, currentPhase = "";
    
    if ($("lobbyPin")) $("lobbyPin").textContent = storageGet("qlp_player_pin") || "------";

    const startBtn = $("hostStartBtn");
    if (startBtn) {
      startBtn.addEventListener("click", async () => {
        startBtn.disabled = true; startBtn.textContent = "MEMULAKAN...";
        try { await apiPost({ action: "startSession", sessionId: storageGet("qlp_session_id"), hostToken: storageGet("qlp_host_token") }); } catch(e) { startBtn.disabled = false; startBtn.textContent = "▶ MULA KUIZ SEKARANG"; }
      });
    }

    async function pollHost() {
      if (polling) return;
      const sessionId = storageGet("qlp_session_id"); if (!sessionId) return;
      polling = true;
      try {
        const res = await apiPost({ action: "getSessionState", sessionId });
        if (!res || !res.success) throw new Error();
        window.hostPhase = res.status;

        if (res.status === "waiting") {
          if (currentPhase !== "waiting") { currentPhase = "waiting"; playBGM(); }
          if (lobby) { lobby.style.display = "flex"; $("lobbyCount").textContent = (res.players||[]).length;
            $("lobbyPlayers").innerHTML = (res.players||[]).length > 0 ? res.players.map(p => `<div class="player-chip">${escapeHtml(p)}</div>`).join("") : `<p style="color:#94a3b8;">Menunggu pemain...</p>`;
          }
          if (panel) panel.style.display = "none"; if (control) control.style.display = "none"; return;
        } 

        if (lobby) lobby.style.display = "none"; if (panel) panel.style.display = "block"; if (control) control.style.display = "flex";

        if (res.status === "completed") {
          const listHtml = (res.fullLeaderboard || []).map((p, i) => `<div style="font-size:20px; margin:8px auto; max-width:600px; background:${i<3?'#fbbf24':'#1e293b'}; color:${i<3?'#000':'#fff'}; padding:12px 20px; border-radius:10px; display:flex; justify-content:space-between;"><span><b>#${i+1}</b> ${escapeHtml(p.name)}</span><b>${p.score} pt</b></div>`).join("");
          panel.innerHTML = `<div style="text-align:center"><h2 style="font-size:40px; color:#10b981;">🎉 KUIZ TAMAT! 🎉</h2><div style="max-height:60vh; overflow-y:auto; padding:10px;">${listHtml}</div></div>`;
          if (control) control.style.display = "none"; clearInterval(hostTimerInt); stopBGM(); return;
        }

        const newKey = res.status + "_" + (res.question ? res.question.questionId : "0");
        if (currentRenderKey === newKey) return; 
        currentRenderKey = newKey; clearInterval(hostTimerInt); currentPhase = res.status;

        if (res.status === "active") playBGM(); else stopBGM(); 

        if (res.status === "leaderboard") {
          const tops = (res.leaderboard || []).map((p, i) => `<div style="font-size:24px; margin:12px auto; max-width:600px; background:#1e293b; padding:16px 26px; border-radius:14px; display:flex; justify-content:space-between;"><span><b style="color:#3b82f6;">#${i+1}</b> ${escapeHtml(p.name)}</span><b style="color:#fcd34d;">${p.score} pt</b></div>`).join("");
          panel.innerHTML = `<div style="text-align:center"><h2 style="font-size:36px;">🏆 TOP 5 LEADERBOARD 🏆</h2>${tops}</div>`; return;
        }

        const q = res.question; if (!q) return;
        const opts = [q.optionA, q.optionB, q.optionC, q.optionD];
        panel.innerHTML = `<div style="text-align:center;margin-bottom:25px"><div style="color:#a5b4fc;text-transform:uppercase;font-weight:900;">SOALAN ${q.order}</div><h1 style="font-size:clamp(22px,3.5vw,40px);margin:14px 0;">${escapeHtml(q.questionText)}</h1>${res.status === "active" ? `<div style="display:inline-block;padding:6px 20px;background:#1e293b;border-radius:30px;font-size:28px;font-weight:900;color:#ef4444;">⏱ <span id="hostTimerDisplay">${q.timeLimitSeconds}</span>s</div>` : ''}</div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px">${ANSWER_COLORS.map((item, i) => { const isDim = (res.status === "revealing_answer" && item.option !== q.correctOption); return `<div style="opacity:${isDim ? '0.25' : '1'};min-height:120px;display:flex;align-items:center;gap:16px;padding:20px;border-radius:18px;background:${item.color};color:${item.textColor};font-size:24px;font-weight:800;"><span style="font-size:32px;">${item.shape}</span><span style="flex:1">${escapeHtml(opts[i])}</span>${res.status === "revealing_answer" && !isDim ? '<span style="font-size:32px">✅</span>' : ''}</div>`; }).join("")}</div>`;

        if (res.status === "active") {
          let hostTimeLeft = q.timeLimitSeconds;
          const nextBtn = $("nextQuestionBtn");
          hostTimerInt = setInterval(async () => {
            hostTimeLeft--;
            if ($("hostTimerDisplay")) $("hostTimerDisplay").textContent = hostTimeLeft;
            if (hostTimeLeft <= 0) {
              clearInterval(hostTimerInt);
              if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = "Masa Tamat..."; }
              try { await apiPost({ action: "revealAnswer", sessionId, hostToken: storageGet("qlp_host_token") }); } catch(e) {}
              if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = "➡ SETERUSNYA"; }
            }
          }, 1000);
        }
      } catch (err) {} finally { polling = false; }
    }
    pollHost(); window.setInterval(pollHost, POLL_INTERVAL_MS);
  }

  // ---------- Live Participant (Singkat) ----------
  function initLiveParticipant() {
    if (!$("waitingRoom") && !$("joinBtn")) return;
    let polling = false, currentRenderKey = "", playerTimerInt = null, sfxPlayedForQ = ""; 
    
    async function pollParticipant() {
      if (polling) return;
      const sessionId = storageGet("qlp_player_session_id"); if (!sessionId) return;
      polling = true;
      try {
        const res = await apiPost({ action: "getSessionState", sessionId });
        const panel = $("liveQuestionPanel") || document.body.appendChild(Object.assign(document.createElement("section"), { id: "liveQuestionPanel", style: "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;box-sizing:border-box;padding:20px;display:none;flex-direction:column;justify-content:center;background:#0f172a;color:#fff;" }));
        const room = $("waitingRoom");

        if (res.status === "waiting") { panel.style.display = "none"; if (room) { room.hidden = false; room.style.display = "block"; } return; }
        if (room) { room.hidden = true; room.style.display = "none"; }
        panel.style.display = "flex";
        
        if (res.status === "completed") { panel.innerHTML = `<div style="text-align:center;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#10b981;color:white;border-radius:20px;"><div style="font-size:80px;">🎉</div><div style="font-size:32px;font-weight:bold;">Kuiz Tamat!</div></div>`; clearInterval(playerTimerInt); return; }
        
        const newKey = res.status + "_" + (res.question ? res.question.questionId : "0");
        if (currentRenderKey === newKey) return; 
        currentRenderKey = newKey; clearInterval(playerTimerInt);

        if (res.status === "active") { localStorage.removeItem("qlp_last_isCorrect"); localStorage.setItem("qlp_last_earned", "0"); }

        if (res.status === "revealing_answer") {
          const answeredState = localStorage.getItem("qlp_last_isCorrect"), earned = localStorage.getItem("qlp_last_earned") || "0";
          let isCorrect = (answeredState === "true"), message = (answeredState === null) ? "Tidak Menjawab" : (isCorrect ? "Tepat!" : "Salah");
          let icon = (answeredState === null) ? "⏱️" : (isCorrect ? "✅" : "❌"), bgColor = (answeredState === null || !isCorrect) ? "#b91c1c" : "#15803d";
          
          if (sfxPlayedForQ !== (res.question ? res.question.questionId : "0")) { playSFX(isCorrect ? 'sfx_correct' : 'sfx_wrong'); sfxPlayedForQ = (res.question ? res.question.questionId : "0"); }
          panel.innerHTML = `<div style="text-align:center;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${bgColor};color:white;border-radius:20px;"><div style="font-size:120px;">${icon}</div><div style="font-size:32px;font-weight:bold;">${message}</div><div style="font-size:38px; font-weight:900; color:${isCorrect ? '#fcd34d' : '#fca5a5'}; margin-top:20px;">+${earned} XP</div></div>`; return;
        }
        
        if (res.status === "leaderboard") { const score = localStorage.getItem("qlp_last_score") || "0"; panel.innerHTML = `<div style="text-align:center;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#2563eb;color:white;border-radius:20px;"><div style="font-size:24px;font-weight:700;">Jumlah Markah</div><div style="font-size:70px;font-weight:900;color:#fcd34d;">${score}</div></div>`; return; }
        
        const q = res.question; if (!q) return;
        const startTime = Date.now();
        
        panel.innerHTML = `<div style="text-align:center;margin-bottom:20px"><h2 style="font-size:clamp(19px,5vw,26px);margin:0">Pilih Jawapan</h2><div style="font-size:30px; font-weight:900; color:#ef4444; margin:10px 0;">⏱ <span id="playerTimerDisplay">${q.timeLimitSeconds}</span></div></div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;flex:1;align-content:center">${ANSWER_COLORS.map(item => `<button type="button" data-option="${item.option}" style="min-height:clamp(120px,25vh,200px);border:0;border-radius:22px;background:${item.color};color:${item.textColor};font-size:clamp(46px,12vw,76px);font-weight:900;cursor:pointer;box-shadow:0 8px 0 rgba(0,0,0,0.15);">${item.shape}</button>`).join("")}</div><p id="playerAnswerStatus" style="text-align:center;font-weight:800;font-size:16px;margin:20px 0 0;color:#94a3b8">Menunggu jawapan...</p>`;
          
        const btns = [...panel.querySelectorAll("button")];
        let playerTimeLeft = q.timeLimitSeconds;
        playerTimerInt = setInterval(() => {
          playerTimeLeft--;
          if ($("playerTimerDisplay")) $("playerTimerDisplay").textContent = playerTimeLeft;
          if (playerTimeLeft <= 0) {
            clearInterval(playerTimerInt); btns.forEach(b => { b.disabled = true; b.style.opacity = "0.4"; });
            if ($("playerAnswerStatus") && !btns.some(b => b.dataset.answered)) { $("playerAnswerStatus").textContent = "Masa Tamat!"; $("playerAnswerStatus").style.color = "#ef4444"; }
          }
        }, 1000);

        btns.forEach(btn => {
          btn.addEventListener("click", async () => {
            if (btn.dataset.answered || playerTimeLeft <= 0) return;
            btns.forEach(b => { b.disabled = true; b.style.opacity = "0.4"; });
            btn.style.opacity = "1"; btn.style.transform = "translateY(5px)"; btn.style.boxShadow = "none"; btn.dataset.answered = "true";
            clearInterval(playerTimerInt); 
            if ($("playerAnswerStatus")) $("playerAnswerStatus").textContent = "Menghantar…";
            try {
              const res = await apiPost({ action: "submitAnswer", sessionId, playerId: storageGet("qlp_player_id"), questionId: q.questionId, selectedOption: btn.dataset.option, responseMs: Date.now() - startTime });
              localStorage.setItem("qlp_last_isCorrect", res.isCorrect); localStorage.setItem("qlp_last_score", res.totalScore); localStorage.setItem("qlp_last_earned", res.earned || 0);
              if ($("playerAnswerStatus")) { $("playerAnswerStatus").textContent = "Diterima!"; $("playerAnswerStatus").style.color = "#34d399"; }
            } catch (err) {}
          });
        });
      } catch (e) {} finally { polling = false; }
    }
    pollParticipant(); window.setInterval(pollParticipant, POLL_INTERVAL_MS);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if ($("pin")) { localStorage.removeItem("qlp_player_session_id"); localStorage.removeItem("qlp_player_id"); }
    initJoinForm(); initAdminLogic(); initLiveHost(); initLiveParticipant();

    const nextBtn = $("nextQuestionBtn");
    if (nextBtn) {
      nextBtn.addEventListener("click", async () => {
        const sessionId = storageGet("qlp_session_id"), hostToken = storageGet("qlp_host_token");
        nextBtn.disabled = true; nextBtn.textContent = "...";
        let action = window.hostPhase === "revealing_answer" ? "showLeaderboard" : (window.hostPhase === "leaderboard" ? "nextQuestion" : "revealAnswer");
        try { await apiPost({ action, sessionId, hostToken }); } catch (e) {} 
        finally { nextBtn.disabled = false; nextBtn.textContent = "➡ SETERUSNYA"; }
      });
    }
  });
})();
