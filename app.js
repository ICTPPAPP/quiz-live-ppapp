/* QUIZ LIVE PPAPP - FULL LOGIC + AUTO TIMER + LOBBY + AUDIO SYSTEM (FIXED BUTTON) */
(() => {
  "use strict";

  const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbxlHmVrFF84wSGQF3z0F_qEvVWZpirbgo0D06FclCDkhZTWXv_YgFTAHIAx381FERKT/exec";
  const POLL_INTERVAL_MS = 1500; 
  const $ = (id) => document.getElementById(id);

  const SOUNDS = {
    bgm_lobby: new Audio("https://cdn.pixabay.com/download/audio/2022/05/16/audio_b2875150c2.mp3?filename=fun-life-112188.mp3"),
    bgm_quiz: new Audio("https://cdn.pixabay.com/download/audio/2022/10/25/audio_24e5264b38.mp3?filename=suspense-113264.mp3"),
    sfx_correct: new Audio("https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3?filename=success-1-6297.mp3"),
    sfx_wrong: new Audio("https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8a73467.mp3?filename=negative_beeps-6008.mp3")
  };
  SOUNDS.bgm_lobby.loop = true; 
  SOUNDS.bgm_quiz.loop = true;  

  function stopAllBGM() {
    SOUNDS.bgm_lobby.pause(); SOUNDS.bgm_lobby.currentTime = 0;
    SOUNDS.bgm_quiz.pause(); SOUNDS.bgm_quiz.currentTime = 0;
  }
  
  function playSound(key) {
    if (SOUNDS[key]) {
      if (key.startsWith('bgm_')) stopAllBGM(); 
      SOUNDS[key].play().catch(e => console.log("Audio tersekat:", e));
    }
  }

  const ANSWER_COLORS = [
    { option: "A", color: "#e53232", shape: "▲", label: "Merah", textColor: "#ffffff" },
    { option: "B", color: "#2878e8", shape: "◆", label: "Biru", textColor: "#ffffff" },
    { option: "C", color: "#20a464", shape: "●", label: "Hijau", textColor: "#ffffff" },
    { option: "D", color: "#f4c430", shape: "■", label: "Kuning", textColor: "#172033" }
  ];

  function getApiUrl() { try { return (localStorage.getItem("qlp_api_url") || DEFAULT_API_URL).trim(); } catch (e) { return DEFAULT_API_URL; } }
  function storageGet(key, fallback = "") { try { return localStorage.getItem(key) ?? fallback; } catch (e) { return fallback; } }
  function storageSet(key, value) { try { localStorage.setItem(key, String(value ?? "")); } catch (e) {} }
  function readStoredArray(key) { const raw = storageGet(key, "[]"); try { const val = JSON.parse(raw); return Array.isArray(val) ? val : []; } catch (e) { return []; } }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (c) => ({"&": "&amp;","<": "&lt;",">": "&gt;",'"': "&quot;","'": "&#39;"})[c]); }

  async function apiPost(payload) {
    const url = getApiUrl();
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(payload) });
    return await response.json();
  }

  // ---------- Join Form ----------
  function initJoinForm() {
    const pinInput = $("pin"), joinButton = $("joinBtn");
    if (!pinInput || !joinButton) return;
    pinInput.addEventListener("input", () => { pinInput.value = pinInput.value.replace(/\D/g, "").slice(0, 6); });
    joinButton.addEventListener("click", async () => {
      const pin = pinInput.value.trim(), name = ($("playerName") ? $("playerName").value.trim() : "");
      if (!/^\d{6}$/.test(pin) || !name) return alert("Sila masukkan 6 digit PIN dan Nama.");
      joinButton.disabled = true; joinButton.textContent = "Menyemak...";
      
      SOUNDS.sfx_correct.play().then(()=>SOUNDS.sfx_correct.pause()).catch(()=>{}); 

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

  // ---------- Admin Panel Logic ----------
  function initAdminLogic() {
    if ($("apiUrl")) $("apiUrl").value = getApiUrl();
    if ($("saveApi")) $("saveApi").addEventListener("click", () => { storageSet("qlp_api_url", $("apiUrl").value.trim()); alert("URL Disimpan!"); });
    
    if ($("quizForm")) {
      $("quizForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = $("quizForm").querySelector("button"); btn.disabled = true; btn.textContent = "Mencipta...";
        try {
          const res = await apiPost({ action: "createQuiz", title: $("quizTitle").value, description: $("quizDescription").value });
          const items = readStoredArray("qlp_quizzes"); items.unshift({ title: $("quizTitle").value, quizId: res.quizId });
          storageSet("qlp_quizzes", JSON.stringify(items));
          alert("Kuiz Berjaya Dicipta!"); location.reload();
        } catch(err) { alert(err.message); } finally { btn.disabled = false; btn.textContent = "Cipta Kuiz"; }
      });
    }

    if ($("questionForm")) {
      const items = readStoredArray("qlp_quizzes");
      const sel = $("questionQuiz"), sel2 = $("sessionQuiz");
      if (sel && items.length) sel.innerHTML = items.map(q => `<option value="${q.quizId}">${escapeHtml(q.title)}</option>`).join("");
      if (sel2 && items.length) sel2.innerHTML = items.map(q => `<option value="${q.quizId}">${escapeHtml(q.title)}</option>`).join("");
      
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
        } catch(err) { alert(err.message); $("createSessionBtn").disabled = false; }
      });
    }
  }

// ---------- Live Host (Lobby, Game, AUTO TIMER & BGM) ----------
  function initLiveHost() {
    const lobby = $("lobbyPanel");
    const panel = $("hostLiveQuestionPanel");
    const control = $("hostControlPanel");

    if (!lobby && !panel) return;

    let polling = false;
    let currentRenderKey = ""; 
    let hostTimerInt = null;
    let currentPhase = "";
    window.hostAudioUnlocked = false;
    
    const storedPin = storageGet("qlp_player_pin");
    if ($("lobbyPin") && storedPin) $("lobbyPin").textContent = storedPin;

    // FUNGSI UNMUTE AUDIO HOS
    const unmuteBtn = $("unmuteBtn");
    if (unmuteBtn) {
      unmuteBtn.addEventListener("click", () => {
        window.hostAudioUnlocked = true;
        unmuteBtn.style.background = "#10b981";
        unmuteBtn.textContent = "🔊 Audio Aktif";
        if (currentPhase === "waiting") playSound('bgm_lobby');
        else if (currentPhase === "active") playSound('bgm_quiz');
      });
    }

    const startBtn = $("hostStartBtn");
    if (startBtn) {
      startBtn.addEventListener("click", async () => {
        startBtn.disabled = true; startBtn.textContent = "MEMULAKAN...";
        // Jika hos tak tekan butang unmute, tindakan klik "Mula Kuiz" ini akan automatik benarkan audio
        window.hostAudioUnlocked = true; 
        if (unmuteBtn) { unmuteBtn.style.background = "#10b981"; unmuteBtn.textContent = "🔊 Audio Aktif"; }
        try {
          await apiPost({ action: "startSession", sessionId: storageGet("qlp_session_id"), hostToken: storageGet("qlp_host_token") });
        } catch(e) {
          alert("Gagal memulakan: " + e.message);
          startBtn.disabled = false; startBtn.textContent = "▶ MULA KUIZ SEKARANG";
        }
      });
    }

    async function pollHost() {
      if (polling) return;
      const sessionId = storageGet("qlp_session_id"); if (!sessionId) return;
      polling = true;

      try {
        const res = await apiPost({ action: "getSessionState", sessionId });
        if (!res || !res.success) throw new Error(res ? res.message : "Ralat respons");

        window.hostPhase = res.status;

        if (res.status === "waiting") {
          if (currentPhase !== "waiting") { 
            currentPhase = "waiting"; 
            if (window.hostAudioUnlocked) playSound('bgm_lobby'); 
          }
          if (lobby) { 
            lobby.style.display = "flex"; 
            if ($("lobbyPin")) $("lobbyPin").textContent = storageGet("qlp_player_pin") || "------";
            const players = Array.isArray(res.players) ? res.players : [];
            if ($("lobbyCount")) $("lobbyCount").textContent = players.length;
            if ($("lobbyPlayers")) {
              $("lobbyPlayers").innerHTML = players.length > 0 
                ? players.map(p => `<div class="player-chip">${escapeHtml(p)}</div>`).join("")
                : `<p style="color:#94a3b8;font-size:16px;">Menunggu pemain masuk...</p>`;
            }
          }
          if (panel) panel.style.display = "none";
          if (control) control.style.display = "none";
          return;
        } 

        if (lobby) lobby.style.display = "none";
        if (panel) panel.style.display = "block";
        if (control) control.style.display = "flex";

        if (res.status === "completed") {
          panel.innerHTML = '<h2 style="text-align:center; font-size:48px; color:#f8fafc; margin:40px 0;">KUIZ TAMAT!</h2>';
          if (control) control.style.display = "none";
          clearInterval(hostTimerInt);
          stopAllBGM();
          return;
        }

        const newKey = res.status + "_" + (res.question ? res.question.questionId : "0");
        if (currentRenderKey === newKey) return; 
        currentRenderKey = newKey;
        clearInterval(hostTimerInt);
        currentPhase = res.status;

        if (res.status === "active") { if (window.hostAudioUnlocked) playSound('bgm_quiz'); }
        else stopAllBGM(); 

        if (res.status === "leaderboard") {
          const tops = (res.leaderboard || []).map((p, i) => `
            <div style="font-size:24px; margin:12px auto; max-width:600px; background:#1e293b; padding:16px 26px; border-radius:14px; display:flex; justify-content:space-between; align-items:center; border:1px solid #334155;">
              <span><b style="color:#3b82f6;">#${i+1}</b> ${escapeHtml(p.name)}</span>
              <span style="font-weight:900;color:#fcd34d;font-size:30px;">${p.score} pt</span>
            </div>`).join("");
          panel.innerHTML = `<div style="text-align:center"><h2 style="font-size:36px; margin-bottom:30px;">🏆 TOP 5 LEADERBOARD 🏆</h2>${tops}</div>`;
          return;
        }

        const q = res.question;
        if (!q) return;
        const opts = [q.optionA, q.optionB, q.optionC, q.optionD];

        panel.innerHTML = `
          <div style="text-align:center;margin-bottom:25px">
            <div style="font-size:14px;font-weight:900;letter-spacing:3px;color:#a5b4fc;text-transform:uppercase">
              SOALAN ${q.order} ${q.points > 1000 ? '🌟 MARKAH BERGANDA' : ''}
            </div>
            <h1 style="font-size:clamp(22px,3.5vw,40px);margin:14px 0;line-height:1.3;color:#ffffff">
              ${escapeHtml(q.questionText)}
            </h1>
            ${res.status === "active" ? `
              <div style="display:inline-block;padding:6px 20px;background:#1e293b;border-radius:30px;font-size:28px;font-weight:900;color:#ef4444;border:1px solid #334155;margin-top:6px">
                ⏱ <span id="hostTimerDisplay">${q.timeLimitSeconds}</span>s
              </div>` : ''}
          </div>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px">
            ${ANSWER_COLORS.map((item, i) => {
              const isDim = (res.status === "revealing_answer" && item.option !== q.correctOption);
              return `
                <div style="opacity:${isDim ? '0.25' : '1'};min-height:120px;display:flex;align-items:center;gap:16px;padding:20px;border-radius:18px;background:${item.color};color:${item.textColor};font-size:clamp(18px,2vw,24px);font-weight:800;box-sizing:border-box">
                  <span style="font-size:32px;line-height:1">${item.shape}</span>
                  <span style="flex:1">${escapeHtml(opts[i])}</span>
                  ${res.status === "revealing_answer" && !isDim ? '<span style="font-size:32px">✅</span>' : ''}
                </div>`;
            }).join("")}
          </div>`;

        if (res.status === "active") {
          let hostTimeLeft = q.timeLimitSeconds;
          hostTimerInt = setInterval(async () => {
            hostTimeLeft--;
            if ($("hostTimerDisplay")) $("hostTimerDisplay").textContent = hostTimeLeft;

            if (hostTimeLeft <= 0) {
              clearInterval(hostTimerInt);
              const nextBtn = $("nextQuestionBtn");
              if (nextBtn) {
                nextBtn.disabled = true;
                nextBtn.textContent = "Masa Tamat...";
              }
              try {
                await apiPost({ action: "revealAnswer", sessionId, hostToken: storageGet("qlp_host_token") });
              } catch(e) {}
              if (nextBtn) {
                nextBtn.disabled = false;
                nextBtn.textContent = "➡ SETERUSNYA";
              }
            }
          }, 1000);
        }

      } catch (err) {
      } finally {
        polling = false;
      }
    }

    pollHost();
    window.setInterval(pollHost, POLL_INTERVAL_MS);
  }
  
  // ---------- Live Participant (AUTO TIMER & SFX) ----------
  function initLiveParticipant() {
    if (!$("waitingRoom") && !$("joinBtn")) return;
    let polling = false;
    let currentRenderKey = "";
    let playerTimerInt = null;
    let sfxPlayedForQ = ""; 
    
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
        if (res.status === "completed") { panel.innerHTML = '<div style="text-align:center;"><h2>Kuiz Tamat!</h2></div>'; clearInterval(playerTimerInt); return; }
        
        const newKey = res.status + "_" + (res.question ? res.question.questionId : "0");
        if (currentRenderKey === newKey) return; 
        currentRenderKey = newKey;
        clearInterval(playerTimerInt);

        if (res.status === "revealing_answer") {
          const isCorrect = localStorage.getItem("qlp_last_isCorrect") === "true";
          const earned = localStorage.getItem("qlp_last_earned") || "0";
          
          if (sfxPlayedForQ !== (res.question ? res.question.questionId : "0")) {
            playSound(isCorrect ? 'sfx_correct' : 'sfx_wrong');
            sfxPlayedForQ = (res.question ? res.question.questionId : "0");
          }

          panel.innerHTML = `<div style="text-align:center;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${isCorrect ? "#15803d" : "#b91c1c"};color:white;border-radius:20px;">
            <div style="font-size:120px;line-height:1;margin-bottom:10px;">${isCorrect ? "✅" : "❌"}</div>
            <div style="font-size:32px;font-weight:bold;">${isCorrect ? "Tepat!" : "Salah"}</div>
            <div style="font-size:38px; font-weight:900; color:${isCorrect ? '#fcd34d' : '#fca5a5'}; margin-top:20px;">+${earned} XP</div>
          </div>`; return;
        }
        
        if (res.status === "leaderboard") {
          const score = localStorage.getItem("qlp_last_score") || "0";
          panel.innerHTML = `<div style="text-align:center;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#2563eb;color:white;border-radius:20px;">
            <div style="font-size:24px;font-weight:700;">Jumlah Markah</div>
            <div style="font-size:70px;font-weight:900;color:#fcd34d;">${score}</div>
          </div>`; return;
        }
        
        const q = res.question; if (!q) return;
        const startTime = Date.now();
        
        panel.innerHTML = `
          <div style="text-align:center;margin-bottom:20px">
            <h2 style="font-size:clamp(19px,5vw,26px);margin:0">${q.points > 1000 ? '🌟 MARKAH BERGANDA' : 'Pilih Jawapan'}</h2>
            <div style="font-size:30px; font-weight:900; color:#ef4444; margin:10px 0;">⏱ <span id="playerTimerDisplay">${q.timeLimitSeconds}</span></div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;flex:1;align-content:center">
            ${ANSWER_COLORS.map(item => `<button type="button" data-option="${item.option}" style="min-height:clamp(120px,25vh,200px);border:0;border-radius:22px;background:${item.color};color:${item.textColor};font-size:clamp(46px,12vw,76px);font-weight:900;cursor:pointer;box-shadow:0 8px 0 rgba(0,0,0,0.15);">${item.shape}</button>`).join("")}
          </div>
          <p id="playerAnswerStatus" style="text-align:center;font-weight:800;font-size:16px;margin:20px 0 0;color:#94a3b8">Menunggu jawapan anda...</p>`;
          
        const btns = [...panel.querySelectorAll("button")];
        
        let playerTimeLeft = q.timeLimitSeconds;
        playerTimerInt = setInterval(() => {
          playerTimeLeft--;
          if ($("playerTimerDisplay")) $("playerTimerDisplay").textContent = playerTimeLeft;
          if (playerTimeLeft <= 0) {
            clearInterval(playerTimerInt);
            btns.forEach(b => { b.disabled = true; b.style.opacity = "0.4"; });
            if ($("playerAnswerStatus") && !btns.some(b => b.dataset.answered)) {
              $("playerAnswerStatus").textContent = "Masa Tamat!"; $("playerAnswerStatus").style.color = "#ef4444";
            }
          }
        }, 1000);

        btns.forEach(btn => {
          btn.addEventListener("click", async () => {
            if (btn.dataset.answered || playerTimeLeft <= 0) return;
            btns.forEach(b => { b.disabled = true; b.style.opacity = "0.4"; });
            btn.style.opacity = "1"; btn.style.transform = "translateY(5px)"; btn.style.boxShadow = "none";
            btn.dataset.answered = "true";
            clearInterval(playerTimerInt); 
            if ($("playerAnswerStatus")) $("playerAnswerStatus").textContent = "Menghantar…";
            try {
              const res = await apiPost({ action: "submitAnswer", sessionId, playerId: storageGet("qlp_player_id"), questionId: q.questionId, selectedOption: btn.dataset.option, responseMs: Date.now() - startTime });
              localStorage.setItem("qlp_last_isCorrect", res.isCorrect); localStorage.setItem("qlp_last_score", res.totalScore); localStorage.setItem("qlp_last_earned", res.earned || 0);
              if ($("playerAnswerStatus")) { $("playerAnswerStatus").textContent = "Jawapan Diterima!"; $("playerAnswerStatus").style.color = "#34d399"; }
            } catch (err) {}
          });
        });
      } catch (e) {} finally { polling = false; }
    }
    pollParticipant(); window.setInterval(pollParticipant, POLL_INTERVAL_MS);
  }

  // ---------- Init ----------
  document.addEventListener("DOMContentLoaded", () => {
    if ($("pin")) { localStorage.removeItem("qlp_player_session_id"); localStorage.removeItem("qlp_player_id"); }
    initJoinForm(); initAdminLogic(); initLiveHost(); initLiveParticipant();

    const nextBtn = $("nextQuestionBtn");
    if (nextBtn) {
      nextBtn.addEventListener("click", async () => {
        const sessionId = storageGet("qlp_session_id"), hostToken = storageGet("qlp_host_token");
        nextBtn.disabled = true; nextBtn.textContent = "...";
        let action = window.hostPhase === "revealing_answer" ? "showLeaderboard" : (window.hostPhase === "leaderboard" ? "nextQuestion" : "revealAnswer");
        try { await apiPost({ action, sessionId, hostToken }); } 
        catch (e) { alert("Ralat."); } 
        finally { nextBtn.disabled = false; nextBtn.textContent = "➡ SETERUSNYA"; }
      });
    }
  });
})();
