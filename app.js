const questions = window.AP_MICRO_QUESTIONS || [];

const state = {
  activeSection: questions[0]?.section || "all",
  submitted: false,
  answers: JSON.parse(localStorage.getItem("apMicroPracticeAnswers") || "{}"),
  search: ""
};

const sectionList = document.querySelector("#sectionList");
const questionList = document.querySelector("#questionList");
const activeSectionLabel = document.querySelector("#activeSectionLabel");
const activeTitle = document.querySelector("#activeTitle");
const totalCount = document.querySelector("#totalCount");
const doneCount = document.querySelector("#doneCount");
const scoreCount = document.querySelector("#scoreCount");
const submitButton = document.querySelector("#submitButton");
const resetButton = document.querySelector("#resetButton");
const showAllButton = document.querySelector("#showAllButton");
const searchBox = document.querySelector("#searchBox");
const summaryPanel = document.querySelector("#summaryPanel");

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

function filteredQuestions() {
  const term = state.search.trim().toLowerCase();
  return questions.filter((question) => {
    const sectionMatch = state.activeSection === "all" || question.section === state.activeSection;
    if (!sectionMatch) return false;
    if (!term) return true;
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
  localStorage.setItem("apMicroPracticeAnswers", JSON.stringify(state.answers));
}

function labelFromOption(option, fallbackIndex) {
  const match = option.match(/^\s*\(?([A-E])\)?[.)。]/);
  return match ? match[1] : "ABCDE"[fallbackIndex];
}

function optionBody(option) {
  return option.replace(/^\s*\(?[A-E]\)?[.)。]\s*/, "").trim();
}

function renderSections() {
  const current = filteredQuestions();
  sectionList.innerHTML = "";
  const allButton = document.createElement("button");
  allButton.className = `section-button ${state.activeSection === "all" ? "active" : ""}`;
  allButton.type = "button";
  allButton.innerHTML = `<div class="section-topline"><span>All Chapters</span><span>${questions.length}</span></div><div class="section-meta">Full mixed practice</div>`;
  allButton.addEventListener("click", () => setSection("all"));
  sectionList.appendChild(allButton);

  sections().forEach((item) => {
    const button = document.createElement("button");
    button.className = `section-button ${state.activeSection === item.section ? "active" : ""}`;
    button.type = "button";
    button.innerHTML = `<div class="section-topline"><span>${item.section}</span><span>${item.count}</span></div><div class="section-meta">${escapeHtml(item.title)}</div>`;
    button.addEventListener("click", () => setSection(item.section));
    sectionList.appendChild(button);
  });
}

function renderHeader(list) {
  const answered = list.filter((question) => state.answers[question.id]).length;
  const score = state.submitted ? list.filter((question) => state.answers[question.id] === question.answerLetter).length : "-";
  totalCount.textContent = list.length;
  doneCount.textContent = answered;
  scoreCount.textContent = score;
  if (state.activeSection === "all") {
    activeSectionLabel.textContent = "Mixed Practice";
    activeTitle.textContent = "All AP Microeconomics Chapters";
  } else {
    const sample = questions.find((question) => question.section === state.activeSection);
    activeSectionLabel.textContent = `Section ${state.activeSection}`;
    activeTitle.textContent = sample?.sectionTitle || "Chapter Practice";
  }
  submitButton.textContent = state.submitted ? "Submitted" : "Submit Practice";
}

function renderSummary(list) {
  if (!state.submitted) {
    summaryPanel.classList.add("hidden");
    summaryPanel.innerHTML = "";
    return;
  }
  const answered = list.filter((question) => state.answers[question.id]).length;
  const correct = list.filter((question) => state.answers[question.id] === question.answerLetter).length;
  const missing = list.length - answered;
  summaryPanel.classList.remove("hidden");
  summaryPanel.innerHTML = `<strong>${correct}/${list.length}</strong> correct. Answered ${answered}; unanswered ${missing}. Review the explanations below.`;
}

function renderQuestions() {
  const list = filteredQuestions();
  renderHeader(list);
  renderSummary(list);
  questionList.innerHTML = "";
  if (!list.length) {
    questionList.innerHTML = `<article class="card"><p class="question-text">No questions match this filter.</p></article>`;
    return;
  }
  list.forEach((question, index) => questionList.appendChild(questionCard(question, index)));
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

function setSection(section) {
  state.activeSection = section;
  state.submitted = false;
  renderSections();
  renderQuestions();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetCurrent() {
  filteredQuestions().forEach((question) => delete state.answers[question.id]);
  state.submitted = false;
  saveAnswers();
  renderQuestions();
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

submitButton.addEventListener("click", () => {
  state.submitted = true;
  renderQuestions();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

resetButton.addEventListener("click", resetCurrent);
showAllButton.addEventListener("click", () => setSection("all"));
searchBox.addEventListener("input", () => {
  state.search = searchBox.value;
  renderQuestions();
});

renderSections();
renderQuestions();
