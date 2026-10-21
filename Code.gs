/**
 * QUIZ LIVE PPAPP — Apps Script backend starter.
 * Required spreadsheet tabs and header rows:
 * Quizzes: quizId | title | description | createdAt | createdBy | isActive
 * Questions: questionId | quizId | order | questionText | optionA | optionB | optionC | optionD | correctOption | timeLimitSeconds | points
 * Sessions: sessionId | quizId | pin | status | currentQuestionIndex | startedAt | endedAt | hostToken
 * Players: playerId | sessionId | displayName | joinedAt | totalScore | lastSeenAt
 * Answers: answerId | sessionId | questionId | playerId | selectedOption | submittedAt | responseMs | isCorrect | pointsAwarded
 * Results: resultId | sessionId | playerId | displayName | totalScore | rank | finishedAt
 *
 * Prototype only: add proper host/admin authentication and abuse protection before public use.
 */
function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : "";
  if (action === "test") {
    return jsonResponse({success:true, app:"QUIZ LIVE PPAPP", version:"1.0", message:"Backend aktif."});
  }
  return jsonResponse({success:true, app:"QUIZ LIVE PPAPP", version:"1.0", message:"Backend aktif. Gunakan action=test untuk ujian."});
}

function doPost(e) {
  try {
    const raw = e && e.postData ? e.postData.contents : "{}";
    const data = JSON.parse(raw || "{}");
    if (data.action === "join") return joinSession(data);
    if (data.action === "createQuiz") return createQuiz(data);
    if (data.action === "createSession") return createSession(data);
    return jsonResponse({success:false, message:"Tindakan tidak dikenali."});
  } catch (error) {
    return jsonResponse({success:false, message:error.message});
  }
}

function createQuiz(data) {
  const title = String(data.title || "").trim();
  const description = String(data.description || "").trim();
  if (!title || title.length > 100) return jsonResponse({success:false,message:"Tajuk kuiz diperlukan (maksimum 100 aksara)."});
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Quizzes");
  if (!sheet) throw new Error('Tab "Quizzes" tidak dijumpai.');
  const quizId = Utilities.getUuid();
  sheet.appendRow([quizId,title,description,new Date(),"Admin",true]);
  return jsonResponse({success:true,message:"Kuiz berjaya dicipta!",quizId:quizId,title:title});
}

function createSession(data) {
  const quizId = String(data.quizId || "").trim();
  if (!quizId) return jsonResponse({success:false,message:"ID kuiz diperlukan."});
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const quizSheet = ss.getSheetByName("Quizzes");
  const sessionSheet = ss.getSheetByName("Sessions");
  if (!quizSheet || !sessionSheet) throw new Error("Tab Quizzes atau Sessions tidak dijumpai.");
  const quizzes = quizSheet.getDataRange().getValues();
  const quizHeaders = quizzes[0];
  const idCol = quizHeaders.indexOf("quizId");
  const activeCol = quizHeaders.indexOf("isActive");
  if (idCol < 0 || activeCol < 0) throw new Error("Semak tajuk lajur dalam tab Quizzes.");
  const found = quizzes.slice(1).some(row => String(row[idCol]) === quizId && [true,"true","TRUE",1,"1"].includes(row[activeCol]));
  if (!found) return jsonResponse({success:false,message:"Kuiz tidak dijumpai atau tidak aktif."});
  const existing = sessionSheet.getDataRange().getValues();
  const headers = existing[0];
  const pinCol = headers.indexOf("pin");
  if (pinCol < 0) throw new Error("Lajur pin tidak dijumpai dalam Sessions.");
  const usedPins = new Set(existing.slice(1).map(row => String(row[pinCol])));
  let pin;
  do { pin = String(Math.floor(100000 + Math.random() * 900000)); } while (usedPins.has(pin));
  const sessionId = Utilities.getUuid();
  const hostToken = Utilities.getUuid();
  sessionSheet.appendRow([sessionId,quizId,pin,"waiting",0,"","",hostToken]);
  return jsonResponse({success:true,message:"Sesi kuiz berjaya dicipta!",sessionId:sessionId,pin:pin,hostToken:hostToken});
}

function joinSession(data) {
  const pin = String(data.pin || "").trim();
  const displayName = String(data.displayName || "").trim();
  if (!/^\d{6}$/.test(pin)) return jsonResponse({success:false,message:"PIN mesti 6 digit."});
  if (!displayName || displayName.length > 30) return jsonResponse({success:false,message:"Nama mesti 1 hingga 30 aksara."});
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sessions = ss.getSheetByName("Sessions");
  const players = ss.getSheetByName("Players");
  if (!sessions || !players) throw new Error("Tab Sessions atau Players tidak dijumpai.");
  const sessionData = sessions.getDataRange().getValues();
  const headers = sessionData[0];
  const pinCol = headers.indexOf("pin");
  const statusCol = headers.indexOf("status");
  const sessionIdCol = headers.indexOf("sessionId");
  if ([pinCol,statusCol,sessionIdCol].includes(-1)) throw new Error("Semak tajuk lajur dalam tab Sessions.");
  let sessionId = "";
  for (let i=1;i<sessionData.length;i++) {
    if (String(sessionData[i][pinCol]) === pin && String(sessionData[i][statusCol]).toLowerCase() === "waiting") {
      sessionId = String(sessionData[i][sessionIdCol]); break;
    }
  }
  if (!sessionId) return jsonResponse({success:false,message:"PIN tidak sah atau sesi belum dibuka."});
  const playerId = Utilities.getUuid();
  const now = new Date();
  players.appendRow([playerId,sessionId,displayName,now,0,now]);
  return jsonResponse({success:true,message:"Berjaya menyertai kuiz!",playerId:playerId,sessionId:sessionId,displayName:displayName});
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function testDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const required = ["Quizzes","Questions","Sessions","Players","Answers","Results"];
  const existing = ss.getSheets().map(s => s.getName());
  const missing = required.filter(n => !existing.includes(n));
  if (missing.length) throw new Error("Tab tidak dijumpai: " + missing.join(", "));
  Logger.log("Nama spreadsheet: " + ss.getName());
  Logger.log("Semua 6 tab berjaya dikesan.");
  return "Sambungan database berjaya!";
}
