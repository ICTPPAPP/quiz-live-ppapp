/* QUIZ LIVE PPAPP - FULL LOGIC + PREMIUM UI + IMAGE + PODIUM ANIMATION */
(() => {
  "use strict";

  const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbxlHmVrFF84wSGQF3z0F_qEvVWZpirbgo0D06FclCDkhZTWXv_YgFTAHIAx381FERKT/exec";
  const POLL_INTERVAL_MS = 1500; 
  const $ = (id) => document.getElementById(id);

  // TAMBAH BUNYI PODIUM DI SINI
  const SOUNDS = { 
    bgm_main: new Audio("bgm-lobby.mp3"), sfx_correct: new Audio("sfx-correct.mp3"), 
    sfx_wrong: new Audio("sfx-wrong.mp3"), sfx_reveal: new Audio("sfx-reveal.mp3"), 
    sfx_count: new Audio("sfx-count.mp3"), sfx_podium: new Audio("sfx-podium.mp3") 
  };
  SOUNDS.bgm_main.loop = true; SOUNDS.sfx_count.loop = true; 
  
  function playBGM() { if (SOUNDS.bgm_main.paused) { const p = SOUNDS.bgm_main.play(); if (p !== undefined) p.catch(() => {}); } }
  function stopBGM() { SOUNDS.bgm_main.pause(); SOUNDS.bgm_main.currentTime = 0; }
  function playSFX(key) { if (SOUNDS[key]) { SOUNDS[key].currentTime = 0; SOUNDS[key].play().catch(() => {}); } }
  function stopSFX(key) { if (SOUNDS[key]) { SOUNDS[key].pause(); SOUNDS[key].currentTime = 0; } }
  
  document.body.addEventListener('click', () => { if (!window.audioUnlocked) { window.audioUnlocked = true; if (window.hostPhase === "waiting" || window.hostPhase === "active") playBGM(); } }, { capture: true });

  function animateValue(id, start, end, duration, onComplete) {
    const obj = $(id); if (!obj) return; let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 4); 
      obj.textContent = Math.floor(ease * (end - start) + start);
      if (progress < 1) { window.requestAnimationFrame(step); } else { obj.textContent = end; if (onComplete) onComplete(); }
    };
    window.requestAnimationFrame(step);
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
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (c) => ({"&": "&amp;","<": "&lt;",">": "&gt;",'"': "&quot;","'": "&#39;"})[c]); }
  
  async function apiPost(payload) { const url = getApiUrl(); const response = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(payload) }); return await response.json(); }

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

  function initAdminLogic() {
    // Logik admin kekal sama seperti sebelum ini...
    if (!$("authSection")) return; const myName = storageGet("qlp_admin_name"), myEmail = storageGet("qlp_admin_email"), myRole = storageGet("qlp_admin_role");
    if (myName) { $("authSection").style.display = "none"; $("adminProfile").style.display = "flex"; $("adminNav").style.display = "flex"; $("adminNameDisplay").textContent = myName; $("adminAvatar").textContent = myName.charAt(0).toUpperCase(); $("view-papanPemuka").style.display = "block"; $("setMyName").value = myName; $("setMyEmail").value = myEmail; if (myRole === "master" && $("masterNavBtn")) $("masterNavBtn").style.display = "inline-block"; }
    if ($("logoutBtn")) $("logoutBtn").addEventListener("click", () => { localStorage.clear(); location.reload(); });
    if ($("loginForm")) $("loginForm").addEventListener("submit", async (e) => { e.preventDefault(); const b = $("loginForm").querySelector("button"); b.textContent = "Menyemak..."; try { const r = await apiPost({action:"adminLogin", email:$("loginEmail").value, password:$("loginPassword").value}); if(!r.success) throw new Error(r.message); storageSet("qlp_admin_name", r.name); storageSet("qlp_admin_email", r.email); storageSet("qlp_admin_role", r.role); location.reload(); } catch(e) { alert(e.message); b.textContent = "Masuk"; } });
    if ($("forgotForm")) $("forgotForm").addEventListener("submit", async (e) => { e.preventDefault(); try{ await apiPost({action:"adminForgot", email:$("forgotEmail").value}); alert("Kata laluan dihantar ke emel!"); window.switchAuth('login'); } catch(e) { alert(e.message); } });
    if ($("settingsForm")) $("settingsForm").addEventListener("submit", async (e) => { e.preventDefault(); const np = $("setMyPassword").value; if(np && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/.test(np)) return alert("Kata laluan lemah!"); try { const r = await apiPost({action:"updateAccount", oldEmail:myEmail, newName:$("setMyName").value, newEmail:$("setMyEmail").value, newPassword:np}); if(!r.success) throw new Error(r.message); alert("Akaun dikemas kini!"); storageSet("qlp_admin_name", r.newName); storageSet("qlp_admin_email", r.newEmail); location.reload(); } catch(e) { alert(e.message); } });
    async function loadQ() { if(!$("questionQuiz")) return; try { const r = await apiPost({action:"getQuizzes"}); if(r.success && r.quizzes) { const o = r.quizzes.map(x => `<option value="${x.quizId}">${escapeHtml(x.title)}</option>`).join(""); $("questionQuiz").innerHTML = o || '<option value="">-- Tiada Kuiz --</option>'; $("sessionQuiz").innerHTML = o || '<option value="">-- Tiada Kuiz --</option>'; } } catch(e) {} }
    if(myName) loadQ();
    window.loadHistory = async () => { if (!$("historyContainer")) return; $("historyContainer").innerHTML = "Sedang memuat turun rekod..."; const r = await apiPost({action:"getHistory"}); if(!r.success || r.history.length === 0) return $("historyContainer").innerHTML = "Tiada rekod kuiz."; $("historyContainer").innerHTML = r.history.map(h => `<div style="background:#0f172a; padding:15px; border-radius:10px; margin-bottom:15px; border:1px solid #334155;"><div style="color:#3b82f6; font-weight:bold; font-size:16px;">${escapeHtml(h.quizTitle)}</div><div style="font-size:12px; margin-bottom:10px;">Dimainkan: ${h.date ? new Date(h.date).toLocaleString('ms-MY') : 'Tarikh tiada'}</div>${h.tops.length ? h.tops.map((p,i)=>`<div>#${i+1} ${escapeHtml(p.name)} - ${p.score}pt</div>`).join("") : "Tiada peserta selesai."}</div>`).join(""); };
    window.loadAdmins = async () => { if (!$("adminTableBody")) return; const r = await apiPost({action:"getAdmins"}); if(r.success) { $("adminTableBody").innerHTML = r.admins.map(a => `<tr><td><div style="font-size:11px;color:#64748b;">${a.id}</div>${escapeHtml(a.email)}</td><td>${escapeHtml(a.name)}</td><td><span class="badge ${a.role==='master'?'master':''}">${a.role.toUpperCase()}</span></td><td><button onclick="editAdm('${a.id}','${escapeHtml(a.name)}','${escapeHtml(a.email)}','${a.role}')" style="background:#3b82f6;color:white;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;">Edit</button> <button onclick="delAdm('${a.id}')" style="background:#ef4444;color:white;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;">Padam</button></td></tr>`).join(""); } };
    window.editAdm = (id, nm, em, rl) => { $("targetAdminId").value=id; $("mName").value=nm; $("mEmail").value=em; $("mPassword").value=""; $("mRole").value=rl; $("mSubmitBtn").textContent="Simpan Perubahan"; $("mSubmitBtn").style.background="#f59e0b"; $("mCancelBtn").style.display="inline-block"; };
    window.delAdm = async (id) => { if(confirm("Padam akaun ini?")) { await apiPost({action:"deleteAdmin", targetId:id}); window.loadAdmins(); } };
    if($("mCancelBtn")) $("mCancelBtn").addEventListener("click", () => { $("masterManageForm").reset(); $("targetAdminId").value=""; $("mSubmitBtn").textContent="Cipta Akaun Baru"; $("mSubmitBtn").style.background="#3b82f6"; $("mCancelBtn").style.display="none"; });
    if($("masterManageForm")) $("masterManageForm").addEventListener("submit", async(e) => { e.preventDefault(); const t = $("targetAdminId").value, np = $("mPassword").value; if(!t) { if(!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/.test(np)) return alert("Kata laluan lemah!"); await apiPost({action:"adminRegister", name:$("mName").value, email:$("mEmail").value, password:np, role:$("mRole").value}); alert("Akaun Dicipta"); } else { if(np && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/.test(np)) return alert("Kata laluan lemah!"); await apiPost({action:"updateAdminMaster", targetId:t, newName:$("mName").value, newEmail:$("mEmail").value, newPassword:np, newRole:$("mRole").value}); alert("Dikemas kini!"); } $("mCancelBtn").click(); window.loadAdmins(); });
    if ($("apiUrl")) $("apiUrl").value = getApiUrl();
    if ($("saveApiBtn")) $("saveApiBtn").addEventListener("click", () => { storageSet("qlp_api_url", $("apiUrl").value.trim()); alert("Pautan API Sistem Berjaya Disimpan!"); });
    if ($("quizForm")) $("quizForm").addEventListener("submit", async (e) => { e.preventDefault(); const btn = $("quizForm").querySelector("button"); btn.disabled = true; btn.textContent="..."; try { await apiPost({ action: "createQuiz", title: $("quizTitle").value, description: $("quizDescription").value }); alert("Kuiz Dicipta!"); location.reload(); } catch(e) { btn.disabled = false; btn.textContent="Cipta"; } });
    if ($("questionForm")) $("questionForm").addEventListener("submit", async (e) => { e.preventDefault(); const btn = $("questionForm").querySelector("button"); btn.disabled = true; btn.textContent="..."; try { await apiPost({ action: "addQuestion", quizId: $("questionQuiz").value, questionText: $("questionText").value, optionA: $("optionA").value, optionB: $("optionB").value, optionC: $("optionC").value, optionD: $("optionD").value, correctOption: $("correctOption").value, timeLimitSeconds: Number($("questionTime").value), points: $("doublePoints").checked ? 2000 : 1000, imageUrl: $("questionImage") ? $("questionImage").value.trim() : "" }); alert("Soalan Disimpan!"); $("questionForm").reset(); } catch(e) {} finally { btn.disabled = false; btn.textContent="Simpan"; } });
    if ($("createSessionBtn")) $("createSessionBtn").addEventListener("click", async () => { const qid = $("sessionQuiz").value; if(!qid) return alert("Sila Pilih Kuiz"); $("createSessionBtn").disabled = true; $("createSessionBtn").textContent = "Menjana..."; try { const r = await apiPost({action:"createSession", quizId:qid}); storageSet("qlp_session_id", r.sessionId); storageSet("qlp_host_token", r.hostToken); storageSet("qlp_player_pin", r.pin); window.location.href="host.html"; } catch(e) { $("createSessionBtn").disabled = false; $("createSessionBtn").textContent = "Jana PIN Permainan"; } });
  }

  function initLiveHost() {
    const lobby = $("lobbyPanel"), panel = $("hostLiveQuestionPanel"), control = $("hostControlPanel");
    if (!lobby && !panel) return;
    let polling = false, currentRenderKey = "", hostTimerInt = null, currentPhase = "", sfxPlayedForQ = "";
    
    if ($("lobbyPin")) $("lobbyPin").textContent = storageGet("qlp_player_pin") || "------";
    const startBtn = $("hostStartBtn");
    if (startBtn) startBtn.addEventListener("click", async () => { startBtn.disabled = true; startBtn.textContent = "MEMULAKAN..."; try { await apiPost({ action: "startSession", sessionId: storageGet("qlp_session_id"), hostToken: storageGet("qlp_host_token") }); } catch(e) { startBtn.disabled = false; startBtn.textContent = "▶ MULA KUIZ SEKARANG"; } });

    // FUNGSI UNTUK TUKAR PANDANGAN PENUH
    window.tunjukLeaderboardPenuh = () => { window.hostCompletedView = "full"; };

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
          if (lobby) { lobby.style.display = "flex"; if ($("lobbyPin")) $("lobbyPin").textContent = storageGet("qlp_player_pin") || "------"; const players = Array.isArray(res.players) ? res.players : []; if ($("lobbyCount")) $("lobbyCount").textContent = players.length; if ($("lobbyPlayers")) { $("lobbyPlayers").innerHTML = players.length > 0 ? players.map(p => `<div class="player-chip">${escapeHtml(p)}</div>`).join("") : `<p style="color:#94a3b8;">Menunggu pemain masuk...</p>`; } }
          if (panel) panel.style.display = "none"; if (control) control.style.display = "flex"; return;
        } 
        
        if (lobby) lobby.style.display = "none"; if (panel) panel.style.display = "block"; if (control) control.style.display = "flex";

        if (res.status === "completed") {
          if (control) control.style.display = "none"; clearInterval(hostTimerInt); stopBGM();
          
          if (!window.hostCompletedView) window.hostCompletedView = "podium";
          const ap = res.fullLeaderboard || [];

          if (window.hostCompletedView === "podium") {
            if (!window.podiumSfxPlayed) { playSFX('sfx_podium'); window.podiumSfxPlayed = true; }
            
            const p1 = ap[0] || {name:"-", score:0};
            const p2 = ap[1] || {name:"-", score:0};
            const p3 = ap[2] || {name:"-", score:0};

            panel.innerHTML = `
              <div style="text-align:center;">
                <h2 style="font-size:50px; color:#f8fafc; margin-bottom:20px; text-transform:uppercase; letter-spacing:3px;">🏆 Pemenang Utama 🏆</h2>
                <div class="podium-wrap">
                  <div class="podium-col pos-2"><div class="p-name">${escapeHtml(p2.name)}</div><div class="p-score">${p2.score} pt</div>2</div>
                  <div class="podium-col pos-1"><div class="p-name">${escapeHtml(p1.name)}</div><div class="p-score">${p1.score} pt</div>1</div>
                  <div class="podium-col pos-3"><div class="p-name">${escapeHtml(p3.name)}</div><div class="p-score">${p3.score} pt</div>3</div>
                </div>
                <button onclick="tunjukLeaderboardPenuh()" style="background:#3b82f6; color:white; border:none; padding:15px 30px; font-size:18px; font-weight:bold; border-radius:30px; margin-top:40px; cursor:pointer; box-shadow:0 10px 20px rgba(59,130,246,0.3);">Lihat Kedudukan Penuh ➡</button>
              </div>`;
          } else {
            const listHtml = ap.map((p, i) => {
              const totalAttempts = p.correct + p.wrong;
              const accuracy = totalAttempts > 0 ? Math.round((p.correct / totalAttempts) * 100) : 0;
              return `<tr>
                <td style="font-weight:bold; color:${i<3?'#fbbf24':'white'};">#${i+1}</td>
                <td style="text-align:left; font-weight:bold;">${escapeHtml(p.name)}</td>
                <td style="color:#10b981;">✔ ${p.correct}</td>
                <td style="color:#ef4444;">✖ ${p.wrong}</td>
                <td style="color:#a855f7; font-weight:bold;">${accuracy}%</td>
                <td>🔥 ${p.maxStreak}</td>
                <td style="font-weight:900; color:#3b82f6; font-size:18px;">${p.score}</td>
              </tr>`;
            }).join("");

            panel.innerHTML = `
              <div style="text-align:center;">
                <h2 style="font-size:35px; color:#10b981; margin-bottom:10px;">Laporan Terperinci Kuiz</h2>
                <table class="stats-table">
                  <thead><tr><th>Rank</th><th style="text-align:left;">Nama Peserta</th><th>Betul</th><th>Salah</th><th>Ketepatan</th><th>Max Streak</th><th>Jumlah Markah</th></tr></thead>
                  <tbody>${listHtml}</tbody>
                </table>
                <button onclick="window.location.href='admin.html'" style="background:#ef4444; color:white; border:none; padding:15px 30px; font-size:18px; font-weight:bold; border-radius:10px; margin-top:30px; cursor:pointer;">🚪 Tamat & Kembali Ke Admin</button>
              </div>`;
          }
          return;
        }

        const newKey = res.status + "_" + (res.question ? res.question.questionId : "0");
        if (currentRenderKey === newKey) return; 
        currentRenderKey = newKey; clearInterval(hostTimerInt); currentPhase = res.status;
        if (res.status === "active") { playBGM(); } else { stopBGM(); }

        if (res.status === "leaderboard") {
          const tops = (res.leaderboard || []).map((p, i) => `<div style="font-size:24px; margin:12px auto; max-width:600px; background:#1e293b; padding:16px 26px; border-radius:14px; display:flex; justify-content:space-between; align-items:center; border:1px solid #334155;"><span><b style="color:#3b82f6;">#${i+1}</b> ${escapeHtml(p.name)}</span><span style="font-weight:900;color:#fcd34d;font-size:30px;"><span id="hostLdbAnim_${i}">0</span> pt</span></div>`).join("");
          panel.innerHTML = `<div style="text-align:center"><h2 style="font-size:36px; margin-bottom:30px;">🏆 TOP 5 LEADERBOARD 🏆</h2>${tops}</div>`; 
          let animationDone = 0; const totalTops = (res.leaderboard || []).length;
          if (totalTops > 0) { playSFX('sfx_count'); (res.leaderboard || []).forEach((p, i) => { animateValue(`hostLdbAnim_${i}`, 0, p.score, 1500, () => { animationDone++; if (animationDone === totalTops) stopSFX('sfx_count'); }); }); }
          return;
        }

        const q = res.question; if (!q) return;
        if (res.status === "revealing_answer") { if (sfxPlayedForQ !== q.questionId) { playSFX('sfx_reveal'); sfxPlayedForQ = q.questionId; } }

        const opts = [q.optionA, q.optionB, q.optionC, q.optionD]; const votes = res.voteCounts || {A:0, B:0, C:0, D:0}; 
        const imgHtml = q.imageUrl ? `<img src="${escapeHtml(q.imageUrl)}" style="max-height:25vh; border-radius:15px; margin: 15px auto; display:block; box-shadow:0 10px 30px rgba(0,0,0,0.5); object-fit:contain;">` : '';

        panel.innerHTML = `
          <div style="text-align:center;margin-bottom:25px"><div style="font-size:14px;font-weight:900;letter-spacing:3px;color:#a5b4fc;text-transform:uppercase">SOALAN ${q.order} ${q.points > 1000 ? '🌟 MARKAH BERGANDA' : ''}</div><h1 style="font-size:clamp(22px,3.5vw,40px);margin:14px 0;line-height:1.3;color:#ffffff">${escapeHtml(q.questionText)}</h1>${imgHtml}${res.status === "active" ? `<div style="display:inline-block;padding:6px 20px;background:#1e293b;border-radius:30px;font-size:28px;font-weight:900;color:#ef4444;border:1px solid #334155;margin-top:6px">⏱ <span id="hostTimerDisplay">${q.timeLimitSeconds}</span>s</div>` : ''}</div>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;padding:10px;">${ANSWER_COLORS.map((item, i) => { 
              const isDim = (res.status === "revealing_answer" && item.option !== q.correctOption); const vCount = votes[item.option] || 0;
              const voteBadge = res.status === "revealing_answer" ? `<div style="position:absolute; top:-15px; left:-15px; background:#f8fafc; color:#0f172a; padding:6px 16px; border-radius:30px; font-size:18px; font-weight:900; box-shadow:0 4px 10px rgba(0,0,0,0.5); z-index:10; display:flex; align-items:center; gap:6px;">👤 ${vCount}</div>` : '';
              return `<div style="position:relative; opacity:${isDim ? '0.35' : '1'}; min-height:120px; display:flex; align-items:center; gap:16px; padding:20px 20px 20px 40px; border-radius:18px; background:${item.color}; color:${item.textColor}; font-size:clamp(18px,2vw,24px); font-weight:800; box-sizing:border-box; transition: opacity 0.3s ease;">${voteBadge}<span style="font-size:32px;line-height:1">${item.shape}</span><span style="flex:1">${escapeHtml(opts[i])}</span></div>`; 
            }).join("")}</div>`;

        if (res.status === "active") { let hostTimeLeft = q.timeLimitSeconds; const nextBtn = $("nextQuestionBtn"); hostTimerInt = setInterval(async () => { hostTimeLeft--; if ($("hostTimerDisplay")) $("hostTimerDisplay").textContent = hostTimeLeft; if (hostTimeLeft <= 0) { clearInterval(hostTimerInt); if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = "Masa Tamat..."; } try { await apiPost({ action: "revealAnswer", sessionId, hostToken: storageGet("qlp_host_token") }); } catch(e) {} if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = "➡ SETERUSNYA"; } } }, 1000); }
      } catch (err) {} finally { polling = false; }
    }
    pollHost(); window.setInterval(pollHost, POLL_INTERVAL_MS);
  }

  function initLiveParticipant() {
    if (!$("waitingRoom") && !$("joinBtn")) return; let polling = false, currentRenderKey = "", playerTimerInt = null, sfxPlayedForQ = ""; 
    async function pollParticipant() {
      if (polling) return; const sessionId = storageGet("qlp_player_session_id"); if (!sessionId) return; polling = true;
      try {
        const res = await apiPost({ action: "getSessionState", sessionId });
        const panel = $("liveQuestionPanel") || document.body.appendChild(Object.assign(document.createElement("section"), { id: "liveQuestionPanel", style: "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;box-sizing:border-box;padding:20px;display:none;flex-direction:column;justify-content:center;background:#0f172a;color:#fff;" }));
        const room = $("waitingRoom");

        if (res.status === "waiting") { panel.style.display = "none"; if (room) { room.hidden = false; room.style.display = "block"; } return; }
        if (room) { room.hidden = true; room.style.display = "none"; } panel.style.display = "flex";
        
        if (res.status === "completed") { panel.innerHTML = `<div style="text-align:center;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0f172a;color:white;"><div style="background:#1e293b; border:1px solid #334155; border-radius:24px; padding:40px 30px; box-shadow:0 20px 40px rgba(0,0,0,0.5); width:100%; max-width:400px;"><div style="font-size:80px;line-height:1;margin-bottom:10px;">🎉</div><div style="font-size:32px;font-weight:bold;color:#10b981;">Kuiz Tamat!</div><div style="font-size:16px;color:#94a3b8;margin-top:15px;">Sila lihat skrin utama untuk kedudukan.</div></div></div>`; clearInterval(playerTimerInt); return; }
        
        const newKey = res.status + "_" + (res.question ? res.question.questionId : "0");
        if (currentRenderKey === newKey) return; currentRenderKey = newKey; clearInterval(playerTimerInt);

        if (res.status === "active") { localStorage.removeItem("qlp_last_isCorrect"); localStorage.setItem("qlp_last_earned", "0"); }
        if (res.status === "revealing_answer") {
          const answeredState = localStorage.getItem("qlp_last_isCorrect"); const earned = parseInt(localStorage.getItem("qlp_last_earned") || "0"); const totalScore = parseInt(localStorage.getItem("qlp_last_score") || "0");
          let isCorrect = (answeredState === "true"); let message = (answeredState === null) ? "Masa Tamat" : (isCorrect ? "Tepat!" : "Salah"); let icon = (answeredState === null) ? "⏱️" : (isCorrect ? "✅" : "❌"); let glowColor = (answeredState === null) ? "#f59e0b" : (isCorrect ? "#10b981" : "#ef4444");
          if (sfxPlayedForQ !== (res.question ? res.question.questionId : "0")) { playSFX(isCorrect ? 'sfx_correct' : 'sfx_wrong'); sfxPlayedForQ = (res.question ? res.question.questionId : "0"); }
          panel.innerHTML = `<div style="text-align:center;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0f172a;color:white;border-radius:20px;"><div style="background:#1e293b; border: 1px solid #334155; border-radius: 24px; padding: 40px 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); width: 100%; max-width: 400px; display: flex; flex-direction: column; align-items: center; justify-content: center;"><div style="font-size:90px; line-height:1; margin-bottom:15px; filter: drop-shadow(0 0 25px ${glowColor});">${icon}</div><div style="font-size:28px; font-weight:800; color: #f8fafc; letter-spacing:1px;">${message}</div><div style="font-size:24px; font-weight:900; color:${glowColor}; margin: 10px 0;">+${earned} XP</div><div style="margin-top:20px; background:rgba(0,0,0,0.3); padding:15px 30px; border-radius:16px; width:80%;"><div style="font-size:14px; color:#94a3b8; text-transform:uppercase; font-weight:bold;">Jumlah Markah</div><div style="font-size:40px; font-weight:900; color:#3b82f6; margin-top:5px;">${totalScore}</div></div></div></div>`; 
          return;
        }
        if (res.status === "leaderboard") { const score = parseInt(localStorage.getItem("qlp_last_score") || "0"); panel.innerHTML = `<div style="text-align:center;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0f172a;color:white;"><div style="background:#1e293b; border: 1px solid #334155; border-radius: 24px; padding: 40px 30px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); width: 100%; max-width: 400px;"><div style="font-size:18px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Jumlah Markah</div><div style="font-size:70px;font-weight:900;color:#3b82f6;margin-top:10px;">${score}</div></div></div>`; return; }
        
        const q = res.question; if (!q) return; const startTime = Date.now();
        const imgHtml = q.imageUrl ? `<img src="${escapeHtml(q.imageUrl)}" style="max-height:12vh; border-radius:10px; margin: 5px auto; display:block; object-fit:contain;">` : '';
        panel.innerHTML = `<div style="text-align:center;margin-bottom:20px"><h2 style="font-size:clamp(19px,5vw,26px);margin:0">${q.points > 1000 ? '🌟 MARKAH BERGANDA' : 'Pilih Jawapan'}</h2>${imgHtml}<div style="font-size:30px; font-weight:900; color:#ef4444; margin:5px 0;">⏱ <span id="playerTimerDisplay">${q.timeLimitSeconds}</span></div></div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;flex:1;align-content:center">${ANSWER_COLORS.map(item => `<button type="button" data-option="${item.option}" style="min-height:clamp(120px,25vh,200px);border:0;border-radius:22px;background:${item.color};color:${item.textColor};font-size:clamp(46px,12vw,76px);font-weight:900;cursor:pointer;box-shadow:0 8px 0 rgba(0,0,0,0.15);">${item.shape}</button>`).join("")}</div><p id="playerAnswerStatus" style="text-align:center;font-weight:800;font-size:16px;margin:20px 0 0;color:#94a3b8">Menunggu jawapan anda...</p>`;
          
        const btns = [...panel.querySelectorAll("button")]; let playerTimeLeft = q.timeLimitSeconds;
        playerTimerInt = setInterval(() => { playerTimeLeft--; if ($("playerTimerDisplay")) $("playerTimerDisplay").textContent = playerTimeLeft; if (playerTimeLeft <= 0) { clearInterval(playerTimerInt); btns.forEach(b => { b.disabled = true; b.style.opacity = "0.4"; }); if ($("playerAnswerStatus") && !btns.some(b => b.dataset.answered)) { $("playerAnswerStatus").textContent = "Masa Tamat!"; $("playerAnswerStatus").style.color = "#ef4444"; } } }, 1000);
        btns.forEach(btn => { btn.addEventListener("click", async () => { if (btn.dataset.answered || playerTimeLeft <= 0) return; btns.forEach(b => { b.disabled = true; b.style.opacity = "0.4"; }); btn.style.opacity = "1"; btn.style.transform = "translateY(5px)"; btn.style.boxShadow = "none"; btn.dataset.answered = "true"; clearInterval(playerTimerInt); if ($("playerAnswerStatus")) $("playerAnswerStatus").textContent = "Menghantar…"; try { const res = await apiPost({ action: "submitAnswer", sessionId, playerId: storageGet("qlp_player_id"), questionId: q.questionId, selectedOption: btn.dataset.option, responseMs: Date.now() - startTime }); localStorage.setItem("qlp_last_isCorrect", res.isCorrect); localStorage.setItem("qlp_last_score", res.totalScore); localStorage.setItem("qlp_last_earned", res.earned || 0); if ($("playerAnswerStatus")) { $("playerAnswerStatus").textContent = "Jawapan Diterima!"; $("playerAnswerStatus").style.color = "#34d399"; } } catch (err) {} }); });
      } catch (e) {} finally { polling = false; }
    }
    pollParticipant(); window.setInterval(pollParticipant, POLL_INTERVAL_MS);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if ($("pin")) { localStorage.removeItem("qlp_player_session_id"); localStorage.removeItem("qlp_player_id"); }
    initJoinForm(); initAdminLogic(); initLiveHost(); initLiveParticipant();
    const nextBtn = $("nextQuestionBtn");
    if (nextBtn) { nextBtn.addEventListener("click", async () => { const sessionId = storageGet("qlp_session_id"), hostToken = storageGet("qlp_host_token"); nextBtn.disabled = true; nextBtn.textContent = "..."; let action = window.hostPhase === "revealing_answer" ? "showLeaderboard" : (window.hostPhase === "leaderboard" ? "nextQuestion" : "revealAnswer"); try { await apiPost({ action, sessionId, hostToken }); } catch (e) { alert("Ralat."); } finally { nextBtn.disabled = false; nextBtn.textContent = "➡ SETERUSNYA"; } }); }
  });
})();
