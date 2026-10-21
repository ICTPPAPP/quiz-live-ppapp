/* QUIZ LIVE PPAPP - frontend starter
 * Browser-only demo list; API actions require compatible Apps Script deployment.
 */
const $ = (id) => document.getElementById(id);
const getApiUrl = () => (localStorage.getItem("qlp_api_url") || "").trim();
const setMessage = (el, text, kind="") => { if(!el) return; el.textContent=text; el.className="message"+(kind ? " "+kind : ""); };

async function apiPost(payload) {
  const url = getApiUrl();
  if (!url) throw new Error("Masukkan URL Web App Apps Script dahulu.");
  // Apps Script ContentService cross-origin behavior must be tested in your browser/deployment.
  const response = await fetch(url, {
    method: "POST",
    headers: {"Content-Type":"text/plain;charset=utf-8"},
    body: JSON.stringify(payload),
    redirect: "follow"
  });
  return await response.json();
}

document.addEventListener("DOMContentLoaded", () => {
  const pin = $("pin");
  if (pin) {
    pin.addEventListener("input", () => { pin.value = pin.value.replace(/\D/g,"").slice(0,6); });
    $("joinBtn").addEventListener("click", async () => {
      const p = pin.value.trim(), name = $("playerName").value.trim();
      if (!/^\d{6}$/.test(p)) return setMessage($("joinMsg"), "PIN perlu mengandungi 6 digit.", "error");
      if (!name) return setMessage($("joinMsg"), "Masukkan nama paparan dahulu.", "error");
      setMessage($("joinMsg"), "Sedang menyemak PIN…");
      try {
        const result = await apiPost({action:"join", pin:p, displayName:name});
        setMessage($("joinMsg"), result.message || (result.success ? "Berjaya!" : "Tidak berjaya."), result.success ? "success":"error");
      } catch (e) {
        setMessage($("joinMsg"), "Sambungan API belum berjaya. Semak URL deployment dan tetapan akses Apps Script. ("+e.message+")", "error");
      }
    });
  }

  if ($("apiUrl")) {
    $("apiUrl").value = getApiUrl();
    $("saveApi").addEventListener("click", () => {
      const url = $("apiUrl").value.trim();
      if (url && !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url)) {
        return setMessage($("apiMsg"), "URL biasanya bermula https://script.google.com/macros/s/ dan berakhir /exec.", "error");
      }
      localStorage.setItem("qlp_api_url", url);
      setMessage($("apiMsg"), url ? "URL disimpan pada pelayar ini." : "URL dipadam.", "success");
    });
    $("testApi").addEventListener("click", async () => {
      setMessage($("apiMsg"), "Sedang menguji…");
      try {
        const url = getApiUrl();
        if (!url) throw new Error("Simpan URL API dahulu.");
        const response = await fetch(url + (url.includes("?") ? "&" : "?") + "action=test");
        const result = await response.json();
        setMessage($("apiMsg"), result.message || "API memberi respons.", result.success ? "success":"error");
      } catch(e) {
        setMessage($("apiMsg"), "Ujian gagal atau disekat oleh CORS/akses. Semak URL dan deployment. "+e.message, "error");
      }
    });
    renderQuizList();
    $("quizForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = $("quizTitle").value.trim();
      const description = $("quizDescription").value.trim();
      setMessage($("quizMsg"), "Sedang mencipta kuiz…");
      try {
        const result = await apiPost({action:"createQuiz", title, description});
        if (!result.success) throw new Error(result.message || "Kuiz tidak berjaya dicipta.");
        const items = JSON.parse(localStorage.getItem("qlp_quizzes") || "[]");
        items.unshift({title, description, quizId:result.quizId || "", createdAt:new Date().toISOString()});
        localStorage.setItem("qlp_quizzes", JSON.stringify(items));
        $("quizTitle").value=""; $("quizDescription").value="";
        renderQuizList();
        setMessage($("quizMsg"), "Kuiz berjaya dihantar ke backend. ID: "+(result.quizId || "—"), "success");
      } catch (err) {
        setMessage($("quizMsg"), "Tidak berjaya: "+err.message+" Jika mesej menyebut CORS, kita perlu laraskan kaedah sambungan.", "error");
      }
    });
  }
});

function renderQuizList() {
  const target = $("quizList"); if (!target) return;
  const items = JSON.parse(localStorage.getItem("qlp_quizzes") || "[]");
  if (!items.length) { target.innerHTML = '<div class="empty-state">Belum ada kuiz dicipta melalui panel ini.</div>'; return; }
  target.innerHTML = items.map(q => `<div class="quiz-row"><div><b>${escapeHtml(q.title)}</b><small>${escapeHtml(q.description || "Tiada penerangan")} · ${q.quizId ? "ID: "+escapeHtml(q.quizId.slice(0,8))+"…" : "Demo setempat"}</small></div><span class="pill">KUIZ</span></div>`).join("");
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
