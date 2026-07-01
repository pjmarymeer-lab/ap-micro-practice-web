const questions = window.AP_MICRO_QUESTIONS || [];

const STORAGE = {
  answers: "apMicroPracticeAnswers",
  wrong: "apMicroWrongBank"
};

const state = {
  activeSection: questions[0]?.section || "all",
  mode: "section",
  submitted: false,
  answers: JSON.parse(localStorage.getItem(STORAGE.answers) || "{}"),
  wrongBank: JSON.parse(localStorage.getItem(STORAGE.wrong) || "[]"),
  search: "",
  sessionIds: null,
  sessionTitle: "",
  timed: false,
  timerEnd: null,
  timerId: null,
  reviewWrongOnly: false,
  submittedByTimer: false
};

const sectionList = document.querySelector("#sectionList");
const unitRandomList = document.querySelector("#unitRandomList");
const questionList = document.querySelector("#questionList");
const activeSectionLabel = document.querySelector("#activeSectionLabel");
const activeTitle = document.querySelector("#activeTitle");
const totalCount = document.querySelector("#totalCount");
const doneCount = document.querySelector("#doneCount");
const scoreCount = document.querySelector("#scoreCount");
const submitButton = document.querySelector("#submitButton");
const resetButton = document.querySelector("#resetButton");
const showAllButton = document.querySelector("#showAllButton");
const allRandomButton = document.querySelector("#allRandomButton");
const wrongReviewButton = document.querySelector("#wrongReviewButton");
const clearWrongButton = document.querySelector("#clearWrongButton");
const wrongCount = document.querySelector("#wrongCount");
const searchBox = document.querySelector("#searchBox");
const summaryPanel = document.querySelector("#summaryPanel");
const timerPanel = document.querySelector("#timerPanel");
const timerText = document.querySelector("#timerText");
const wrongOnlyWrap = document.querySelector("#wrongOnlyWrap");
const wrongOnlyToggle = document.querySelector("#wrongOnlyToggle");

function sections() {
  const map = new Map();
  questions.forEach((question) => {
    if (!map.has(question.section)) {
      map.set(question.section, {
        section: question.section,
        title: question.sectionTitle || "",
        count: 0
      });
    }
    map.get(question.section).count += 1;
  });
  return [...map.values()].sort((a, b) => a.section.localeCompare(b.section, undefined, { numeric: true }));
}

function units() {
  return [...new Set(questions.map((question) => unitOf(question.section)))].sort((a, b) => Number(a) - Number(b));
}

function unitOf(section) {
  return String(section || "").split(".")[0];
}

function baseQuestions() {
  if (state.mode === "wrong") {
    const wrong = new Set(state.wrongBank);
    return questions.filter((question) => wrong.has(question.id));
  }
  if (state.mode === "random" || state.mode === "all-random") {
    const ids = new Set(state.sessionIds || []);
    return questions.filter((question) => ids.has(question.id));
  }
  return questions.filter((question) => state.activeSection === "all" || question.section === state.activeSection);
}

function filteredQuestions() {
  const term = state.search.trim().toLowerCase();
  const base = baseQuestions();
  if (!term) return base;
  return base.filter((question) => {
    const haystack = [
      question.section,
      question.sectionTitle,
      question.question,
      question.focus,
      question.reasoning,
      ...(question.options || [])
    ].join(" ").toLowerCase();
    return haystack.includes(term);
  });
}

function saveAnswers() {
  localStorage.setItem(STORAGE.answers, JSON.stringify(state.answers));
}

function saveWrongBank() {
  state.wrongBank = [...new Set(state.wrongBank.map(Number))].sort((a, b) => a - b);
  localStorage.setItem(STORAGE.wrong, JSON.stringify(state.wrongBank));
  wrongCount.textContent = state.wrongBank.length;
}

function labelFromOption(option, fallbackIndex) {
  const match = option.match(/^\s*\(?([A-E])\)?[.)。]/);
  return match ? match[1] : "ABCDE"[fallbackIndex];
}

function optionBody(option) {
  return option.replace(/^\s*\(?[A-E]\)?[.)。]\s*/, "").trim();
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function sample(items, count) {
  return shuffle(items).slice(0, Math.min(count, items.length));
}

function buildUnitRandom(unit) {
  const candidates = questions.filter((question) => unitOf(question.section) === String(unit));
  const grouped = new Map();
  candidates.forEach((question) => {
    if (!grouped.has(question.section)) grouped.set(question.section, []);
    grouped.get(question.section).push(question);
  });
  const picked = [];
  [...grouped.values()].forEach((group) => picked.push(sample(group, 1)[0]));
  const pickedIds = new Set(picked.map((question) => question.id));
  const remaining = candidates.filter((question) => !pickedIds.has(question.id));
  picked.push(...sample(remaining, Math.max(0, 10 - picked.length)));
  return shuffle(picked).map((question) => question.id);
}

function buildAllRandom() {
  const target = Math.min(40, Math.max(30, Math.min(36, questions.length)));
  const picked = [];
  units().forEach((unit) => {
    const group = questions.filter((question) => unitOf(question.section) === unit);
    picked.push(sample(group, 1)[0]);
  });
  const pickedIds = new Set(picked.map((question) => question.id));
  const remaining = questions.filter((question) => !pickedIds.has(question.id));
  picked.push(...sample(remaining, target - picked.length));
  return shuffle(picked).map((question) => question.id);
}

function renderSections() {
  sectionList.innerHTML = "";
  const allButton = document.createElement("button");
  allButton.className = `section-button ${state.mode === "section" && state.activeSection === "all" ? "active" : ""}`;
  allButton.type = "button";
  allButton.innerHTML = `<div class="section-topline"><span>All Chapters</span><span>${questions.length}</span></div><div class="section-meta">Full mixed practice</div>`;
  allButton.addEventListener("click", () => setSection("all"));
  sectionList.appendChild(allButton);

  sections().forEach((item) => {
    const button = document.createElement("button");
    button.className = `section-button ${state.mode === "section" && state.activeSection === item.section ? "active" : ""}`;
    button.type = "button";
    button.innerHTML = `<div class="section-topline"><span>${item.section}</span><span>${item.count}</span></div><div class="section-meta">${escapeHtml(item.title)}</div>`;
    button.addEventListener("click", () => setSection(item.section));
    sectionList.appendChild(button);
  });

  unitRandomList.innerHTML = "";
  units().forEach((unit) => {
    const button = document.createElement("button");
    button.className = `mode-button ${state.mode === "random" && state.sessionTitle === `Unit ${unit} Random` ? "active" : ""}`;
    button.type = "button";
    button.textContent = `Unit ${unit}`;
    button.addEventListener("click", () => startUnitRandom(unit));
    unitRandomList.appendChild(button);
  });
  wrongReviewButton.classList.toggle("active", state.mode === "wrong");
  allRandomButton.classList.toggle("active", state.mode === "all-random");
  wrongCount.textContent = state.wrongBank.length;
}

function renderHeader(list) {
  const answered = list.filter((question) => state.answers[question.id]).length;
  const score = state.submitted ? list.filter((question) => state.answers[question.id] === question.answerLetter).length : "-";
  totalCount.textContent = list.length;
  doneCount.textContent = answered;
  scoreCount.textContent = score;
  if (state.mode === "wrong") {
    activeSectionLabel.textContent = "Wrong Review";
    activeTitle.textContent = "Saved Wrong Questions";
  } else if (state.mode === "random" || state.mode === "all-random") {
    activeSectionLabel.textContent = state.timed ? "Timed Random Practice" : "Random Practice";
    activeTitle.textContent = state.sessionTitle;
  } else if (state.activeSection === "all") {
    activeSectionLabel.textContent = "Mixed Practice";
    activeTitle.textContent = "All AP Microeconomics Chapters";
  } else {
    const sampleQuestion = questions.find((question) => question.section === state.activeSection);
    activeSectionLabel.textContent = `Section ${state.activeSection}`;
    activeTitle.textContent = sampleQuestion?.sectionTitle || "Chapter Practice";
  }
  submitButton.textContent = state.submitted ? "Submitted" : "Submit Practice";
}

function renderSummary(list) {
  if (!state.submitted) {
    summaryPanel.classList.add("hidden");
    wrongOnlyWrap.classList.add("hidden");
    summaryPanel.innerHTML = "";
    return;
  }
  const answered = list.filter((question) => state.answers[question.id]).length;
  const correct = list.filter((question) => state.answers[question.id] === question.answerLetter).length;
  const missing = list.length - answered;
  const percent = list.length ? Math.round((correct / list.length) * 100) : 0;
  const wrong = list.length - correct;
  const timerNote = state.submittedByTimer ? " Time is up; the practice was submitted automatically." : "";
  summaryPanel.classList.remove("hidden");
  wrongOnlyWrap.classList.remove("hidden");
  summaryPanel.innerHTML = `<strong>${correct}/${list.length}</strong> correct (${percent}%). Answered ${answered}; wrong or blank ${wrong}; unanswered ${missing}.${timerNote}`;
}

function renderTimer() {
  if (!state.timed || state.submitted || !state.timerEnd) {
    timerPanel.classList.add("hidden");
    timerPanel.classList.remove("urgent");
    return;
  }
  const remaining = Math.max(0, Math.ceil((state.timerEnd - Date.now()) / 1000));
  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");
  timerText.textContent = `${minutes}:${seconds}`;
  timerPanel.classList.remove("hidden");
  timerPanel.classList.toggle("urgent", remaining <= 120);
  if (remaining <= 0) submitPractice({ byTimer: true });
}

function startTimer(questionCount) {
  stopTimer();
  state.timed = true;
  state.timerEnd = Date.now() + questionCount * 72 * 1000;
  state.timerId = window.setInterval(renderTimer, 1000);
  renderTimer();
}

function stopTimer() {
  if (state.timerId) window.clearInterval(state.timerId);
  state.timerId = null;
  state.timerEnd = null;
  state.timed = false;
  timerPanel.classList.add("hidden");
}

function renderQuestions() {
  const list = filteredQuestions();
  const displayList = state.submitted && state.reviewWrongOnly
    ? list.filter((question) => state.answers[question.id] !== question.answerLetter)
    : list;
  renderHeader(list);
  renderSummary(list);
  renderTimer();
  wrongOnlyToggle.checked = state.reviewWrongOnly;
  questionList.innerHTML = "";
  if (!displayList.length) {
    const message = state.mode === "wrong"
      ? "No saved wrong questions yet."
      : state.reviewWrongOnly
        ? "No wrong answers in this submitted practice."
        : "No questions match this filter.";
    questionList.innerHTML = `<article class="card"><p class="question-text">${message}</p></article>`;
    return;
  }
  displayList.forEach((question, index) => questionList.appendChild(questionCard(question, index)));
}

function questionCard(question, index) {
  const selected = state.answers[question.id] || "";
  const isSubmitted = state.submitted;
  const correct = selected && selected === question.answerLetter;
  const missing = isSubmitted && !selected;
  const article = document.createElement("article");
  article.className = "card";
  const status = isSubmitted
    ? missing
      ? `<span class="status-pill missing">Unanswered</span>`
      : correct
        ? `<span class="status-pill correct">Correct</span>`
        : `<span class="status-pill wrong">Review</span>`
    : `<span class="status-pill">Question ${index + 1}</span>`;

  const figures = (question.figures || []).map((figure) => `<img src="${escapeAttr(figure)}" alt="Question figure">`).join("");
  const optionHtml = (question.options || []).map((option, optionIndex) => {
    const label = labelFromOption(option, optionIndex);
    const body = optionBody(option);
    const checked = selected === label ? "checked" : "";
    const disabled = isSubmitted ? "disabled" : "";
    let className = "option";
    if (isSubmitted && label === question.answerLetter) className += " correct";
    if (isSubmitted && selected === label && selected !== question.answerLetter) className += " wrong";
    return `<label class="${className}">
      <input type="radio" name="q-${question.id}" value="${label}" ${checked} ${disabled}>
      <span class="option-text"><strong>${label}.</strong> ${escapeHtml(body)}</span>
    </label>`;
  }).join("");

  const explanation = isSubmitted ? `<div class="explanation">
    ${selected && selected !== question.answerLetter ? `<p class="missed-line"><strong>Your answer:</strong> ${escapeHtml(selected)}</p>` : ""}
    ${missing ? `<p class="missed-line"><strong>Your answer:</strong> Not answered</p>` : ""}
    <p class="answer-line"><strong>Correct answer:</strong> ${escapeHtml(question.answer)}</p>
    <p><strong>Tested point:</strong> ${escapeHtml(question.focus)}</p>
    <p><strong>Reasoning / Knowledge:</strong> ${escapeHtml(question.reasoning)}</p>
  </div>` : "";

  article.innerHTML = `<div class="card-header">
      <div class="card-kicker">Section ${escapeHtml(question.section)} · ${escapeHtml(question.sectionTitle || "")}</div>
      ${status}
    </div>
    ${figures ? `<div class="figure-wrap">${figures}</div>` : ""}
    <p class="question-text">${escapeHtml(question.question)}</p>
    <div class="options">${optionHtml}</div>
    ${explanation}`;

  article.querySelectorAll("input[type='radio']").forEach((input) => {
    input.addEventListener("change", () => {
      state.answers[question.id] = input.value;
      saveAnswers();
      renderHeader(filteredQuestions());
    });
  });
  return article;
}

function updateWrongBankFrom(list) {
  const wrongSet = new Set(state.wrongBank);
  list.forEach((question) => {
    const selected = state.answers[question.id];
    if (selected === question.answerLetter) {
      wrongSet.delete(question.id);
    } else {
      wrongSet.add(question.id);
    }
  });
  state.wrongBank = [...wrongSet];
  saveWrongBank();
}

function submitPractice(options = {}) {
  state.submitted = true;
  state.submittedByTimer = Boolean(options.byTimer);
  const list = filteredQuestions();
  updateWrongBankFrom(list);
  stopTimer();
  renderSections();
  renderQuestions();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetCurrent() {
  filteredQuestions().forEach((question) => delete state.answers[question.id]);
  state.submitted = false;
  state.submittedByTimer = false;
  state.reviewWrongOnly = false;
  if (state.mode === "all-random") startTimer(filteredQuestions().length);
  saveAnswers();
  renderQuestions();
}

function setSection(section) {
  stopTimer();
  state.mode = "section";
  state.activeSection = section;
  state.sessionIds = null;
  state.sessionTitle = "";
  state.submitted = false;
  state.submittedByTimer = false;
  state.reviewWrongOnly = false;
  renderSections();
  renderQuestions();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startWrongReview() {
  stopTimer();
  state.mode = "wrong";
  state.sessionIds = null;
  state.sessionTitle = "Saved Wrong Questions";
  state.submitted = false;
  state.submittedByTimer = false;
  state.reviewWrongOnly = false;
  renderSections();
  renderQuestions();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startUnitRandom(unit) {
  stopTimer();
  state.mode = "random";
  state.sessionIds = buildUnitRandom(unit);
  state.sessionTitle = `Unit ${unit} Random`;
  state.submitted = false;
  state.submittedByTimer = false;
  state.reviewWrongOnly = false;
  renderSections();
  renderQuestions();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startAllRandom() {
  state.mode = "all-random";
  state.sessionIds = buildAllRandom();
  state.sessionTitle = "All Content Random · 36 Questions";
  state.submitted = false;
  state.submittedByTimer = false;
  state.reviewWrongOnly = false;
  renderSections();
  renderQuestions();
  startTimer(filteredQuestions().length);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function clearWrongBank() {
  if (!state.wrongBank.length) return;
  if (!window.confirm("Clear all saved wrong questions?")) return;
  state.wrongBank = [];
  saveWrongBank();
  if (state.mode === "wrong") renderQuestions();
  renderSections();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

submitButton.addEventListener("click", () => submitPractice());
resetButton.addEventListener("click", resetCurrent);
showAllButton.addEventListener("click", () => setSection("all"));
wrongReviewButton.addEventListener("click", startWrongReview);
allRandomButton.addEventListener("click", startAllRandom);
clearWrongButton.addEventListener("click", clearWrongBank);
wrongOnlyToggle.addEventListener("change", () => {
  state.reviewWrongOnly = wrongOnlyToggle.checked;
  renderQuestions();
});
searchBox.addEventListener("input", () => {
  state.search = searchBox.value;
  renderQuestions();
});

saveWrongBank();
renderSections();
renderQuestions();
