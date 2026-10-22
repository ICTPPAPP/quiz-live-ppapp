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

const result = await apiPost({
  action: "join",
  pin: p,
  displayName: name
});

setMessage(
  $("joinMsg"),
  result.message || (result.success ? "Berjaya!" : "Tidak berjaya."),
  result.success ? "success" : "error"
);

if (result.success) {
// Ambil bilik menunggu dan keluarkan daripada halaman utama
const waitingRoom = $("waitingRoom");
const heroWrap = document.querySelector(".hero-wrap");

if (waitingRoom && heroWrap) {
  heroWrap.insertAdjacentElement("afterend", waitingRoom);
}

// Pastikan halaman utama tidak mengambil ruang
if (heroWrap) {
  heroWrap.style.display = "none";
}

// Jadikan bilik menunggu paparan utama
document.body.classList.add("waiting-page");
document.body.style.minHeight = "100vh";

waitingRoom.style.display = "block";
waitingRoom.style.width = "min(600px, calc(100% - 32px))";
waitingRoom.style.margin = "40px auto";
waitingRoom.style.boxSizing = "border-box";

// Paparkan bilik menunggu
waitingRoom.hidden = false;
waitingRoom.style.display = "block";
waitingRoom.style.width = "min(600px, 100%)";
waitingRoom.style.margin = "60px auto";
waitingRoom.style.padding = "32px";

  $("waitingPin").textContent = p;
  $("waitingName").textContent = "Peserta: " + name;
  $("waitingStatus").textContent =
    "Menunggu hos memulakan kuiz...";

  // Tukar tajuk tab pelayar
  document.title = "Bilik Menunggu | QUIZ LIVE PPAPP";

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}
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

function loadQuestionQuizOptions() {
  const select = $("questionQuiz");
  if (!select) return;

  const items = JSON.parse(localStorage.getItem("qlp_quizzes") || "[]");
  select.innerHTML = '<option value="">Pilih kuiz dahulu</option>';

  items.forEach((q) => {
    if (!q.quizId) return;

    const option = document.createElement("option");
    option.value = q.quizId;
    option.textContent = q.title;
    select.appendChild(option);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const form = $("questionForm");
  if (!form) return;

  loadQuestionQuizOptions();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      action: "addQuestion",
      quizId: $("questionQuiz").value,
      questionText: $("questionText").value.trim(),
      optionA: $("optionA").value.trim(),
      optionB: $("optionB").value.trim(),
      optionC: $("optionC").value.trim(),
      optionD: $("optionD").value.trim(),
      correctOption: $("correctOption").value,
      timeLimitSeconds: Number($("questionTime").value),
      points: 1000
    };

    if (!payload.quizId) {
      return setMessage(
        $("questionMsg"),
        "Pilih kuiz dahulu. Jika senarai kosong, cipta kuiz melalui panel ini.",
        "error"
      );
    }

    setMessage($("questionMsg"), "Sedang menyimpan soalan…");

    try {
      const result = await apiPost(payload);

      if (!result.success) {
        throw new Error(result.message || "Soalan gagal disimpan.");
      }

      setMessage(
        $("questionMsg"),
        "Soalan berjaya disimpan ke Google Sheets!",
        "success"
      );

      $("questionText").value = "";
      $("optionA").value = "";
      $("optionB").value = "";
      $("optionC").value = "";
      $("optionD").value = "";
      $("correctOption").value = "";
      $("questionTime").value = "20";

    } catch (err) {
      setMessage(
        $("questionMsg"),
        "Gagal menyimpan soalan: " + err.message,
        "error"
      );
    }
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const select = $("sessionQuiz");
  const button = $("createSessionBtn");

  if (!select || !button) return;

  function loadSessionQuizzes() {
    const items = JSON.parse(
      localStorage.getItem("qlp_quizzes") || "[]"
    );

    select.innerHTML = '<option value="">Pilih kuiz dahulu</option>';

    items.forEach((q) => {
      if (!q.quizId) return;

      const option = document.createElement("option");
      option.value = q.quizId;
      option.textContent = q.title;
      select.appendChild(option);
    });
  }

  loadSessionQuizzes();

  button.addEventListener("click", async () => {
    const quizId = select.value;

    if (!quizId) {
      setMessage($("sessionMsg"), "Sila pilih kuiz dahulu.", "error");
      return;
    }

    button.disabled = true;
    setMessage($("sessionMsg"), "Sedang menjana PIN sesi…");

    try {
      const result = await apiPost({
        action: "createSession",
        quizId: quizId
      });

      if (!result.success) {
        throw new Error(result.message || "Sesi gagal dicipta.");
      }

      $("sessionPin").textContent = result.pin;
      $("sessionStatus").textContent = "Status: Menunggu peserta";
      $("sessionResult").hidden = false;

      setMessage(
        $("sessionMsg"),
        "Sesi berjaya dicipta!",
        "success"
      );
    } catch (error) {
      setMessage(
        $("sessionMsg"),
        "Gagal menjana PIN: " + error.message,
        "error"
      );
    } finally {
      button.disabled = false;
    }
  });
});
