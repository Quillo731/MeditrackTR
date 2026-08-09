const STORAGE_KEY = "medicationReminderApp";

const personNameDisplay = document.querySelector("#personNameDisplay");
const todayText = document.querySelector("#todayText");
const currentTimeText = document.querySelector("#currentTimeText");
const profileForm = document.querySelector("#profileForm");
const personNameInput = document.querySelector("#personName");
const medicationForm = document.querySelector("#medicationForm");
const medicationList = document.querySelector("#medicationList");
const historyBody = document.querySelector("#historyBody");
const plannedCount = document.querySelector("#plannedCount");
const takenCount = document.querySelector("#takenCount");
const openCount = document.querySelector("#openCount");
const exportButton = document.querySelector("#exportButton");
const menuButton = document.querySelector("#menuButton");
const menuPanel = document.querySelector("#menuPanel");
const showDeletePanelButton = document.querySelector("#showDeletePanelButton");
const showHistoryButton = document.querySelector("#showHistoryButton");
const deletePanel = document.querySelector("#deletePanel");
const historyPanel = document.querySelector("#historyPanel");
const closeDeletePanelButton = document.querySelector("#closeDeletePanelButton");
const closeHistoryButton = document.querySelector("#closeHistoryButton");
const deleteMedicationForm = document.querySelector("#deleteMedicationForm");

let appState = loadState();
let tickTimer = null;

function defaultState() {
  return {
    personName: "",
    medications: [],
    history: [],
  };
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed || typeof parsed !== "object") return defaultState();

    return {
      personName: typeof parsed.personName === "string" ? parsed.personName : "",
      medications: Array.isArray(parsed.medications) ? parsed.medications : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch (error) {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

function makeId() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getScheduledDateTime(medication, date = new Date()) {
  const [hours, minutes] = medication.time.split(":").map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours || 0, minutes || 0, 0, 0);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("tr-TR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatShortDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatTime(date) {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function getTodayRecord(medicationId, dateKey = getDateKey()) {
  return appState.history.find((entry) => entry.medicationId === medicationId && entry.dateKey === dateKey);
}

function getMedicationStatus(medication, now = new Date()) {
  const dateKey = getDateKey(now);
  const record = getTodayRecord(medication.id, dateKey);
  const scheduledAt = getScheduledDateTime(medication, now);

  if (record) {
    return {
      key: "taken",
      label: "Bugün alındı",
      buttonDisabled: true,
      detail: `${record.actualTime} saatinde onaylandı`,
      scheduledAt,
    };
  }

  if (now >= scheduledAt) {
    return {
      key: "due",
      label: "Bugün henüz alınmadı",
      buttonDisabled: false,
      detail: "Şimdi onaylanabilir",
      scheduledAt,
    };
  }

  return {
    key: "waiting",
    label: `Bugün ${medication.time} saatinden sonra`,
    buttonDisabled: true,
    detail: "Planlanan saat henüz gelmedi",
    scheduledAt,
  };
}

function render() {
  const now = new Date();
  const name = appState.personName.trim() || "Misafir";
  personNameDisplay.textContent = name;
  personNameInput.value = appState.personName;
  todayText.textContent = formatDate(now);
  currentTimeText.textContent = formatTime(now);

  renderSummary(now);
  renderMedications(now);
  renderDeleteList();
  renderHistory();
  scheduleNextTick();
}

function renderSummary(now) {
  let taken = 0;
  let open = 0;

  for (const medication of appState.medications) {
    const status = getMedicationStatus(medication, now);
    if (status.key === "taken") taken += 1;
    if (status.key === "due") open += 1;
  }

  plannedCount.textContent = appState.medications.length;
  takenCount.textContent = taken;
  openCount.textContent = open;
}

function renderMedications(now) {
  medicationList.innerHTML = "";

  if (appState.medications.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Henüz ilaç eklenmedi. Sağ taraftan ilacın adını, alma saatini ve istersen notunu ekleyebilirsin.";
    medicationList.append(empty);
    return;
  }

  const sorted = [...appState.medications].sort((a, b) => a.time.localeCompare(b.time));

  for (const medication of sorted) {
    const status = getMedicationStatus(medication, now);
    const card = document.createElement("article");
    card.className = `med-card ${status.key}`;

    const main = document.createElement("div");
    main.className = "med-main";
    main.innerHTML = `
      <h3>${escapeHtml(medication.name)}</h3>
      <div class="med-meta">
        <span class="pill">Planlanan: ${medication.time}</span>
        <span class="pill status-pill ${status.key}">${status.label}</span>
      </div>
      <p class="notes">${medication.notes ? escapeHtml(medication.notes) : escapeHtml(status.detail)}</p>
    `;

    const actions = document.createElement("div");
    actions.className = "med-actions";

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.textContent = "Aldım";
    confirmButton.disabled = status.buttonDisabled;
    confirmButton.addEventListener("click", () => confirmMedication(medication.id));

    actions.append(confirmButton);
    card.append(main, actions);
    medicationList.append(card);
  }
}

function renderDeleteList() {
  deleteMedicationForm.innerHTML = "";

  if (appState.medications.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Es sind keine Tabletten eingetragen, die gelöscht werden können.";
    deleteMedicationForm.append(empty);
    return;
  }

  const sorted = [...appState.medications].sort((a, b) => a.time.localeCompare(b.time));

  for (const medication of sorted) {
    const label = document.createElement("label");
    label.className = "delete-option";
    label.innerHTML = `
      <input type="checkbox" name="medicationToDelete" value="${medication.id}" />
      <span>
        <strong>${escapeHtml(medication.name)}</strong>
        <span>${medication.time} Uhr${medication.notes ? ` · ${escapeHtml(medication.notes)}` : ""}</span>
      </span>
    `;
    deleteMedicationForm.append(label);
  }

  const deleteButton = document.createElement("button");
  deleteButton.className = "danger-button delete-submit";
  deleteButton.type = "submit";
  deleteButton.textContent = "Ausgewählte löschen";
  deleteMedicationForm.append(deleteButton);
}

function renderHistory() {
  historyBody.innerHTML = "";

  if (appState.history.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="4">Noch keine Einnahmen bestätigt.</td>`;
    historyBody.append(row);
    return;
  }

  const sorted = [...appState.history].sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt));

  for (const entry of sorted) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${formatShortDate(entry.dateKey)}</td>
      <td>${escapeHtml(entry.medicationName)}</td>
      <td>${entry.scheduledTime} Uhr</td>
      <td>${entry.actualTime} Uhr</td>
    `;
    historyBody.append(row);
  }
}

function confirmMedication(medicationId) {
  const medication = appState.medications.find((item) => item.id === medicationId);
  if (!medication) return;

  const now = new Date();
  const dateKey = getDateKey(now);
  const status = getMedicationStatus(medication, now);
  if (status.buttonDisabled || getTodayRecord(medicationId, dateKey)) return;

  appState.history.push({
    id: makeId(),
    medicationId: medication.id,
    medicationName: medication.name,
    scheduledTime: medication.time,
    dateKey,
    actualTime: formatTime(now),
    confirmedAt: now.toISOString(),
  });

  saveState();
  render();
}

function deleteMedications(medicationIds) {
  if (medicationIds.length === 0) return;

  const countText = medicationIds.length === 1 ? "1 Tablette" : `${medicationIds.length} Tabletten`;
  const confirmed = window.confirm(`${countText} löschen? Der bisherige Einnahmeverlauf bleibt erhalten.`);
  if (!confirmed) return;

  const ids = new Set(medicationIds);
  appState.medications = appState.medications.filter((item) => !ids.has(item.id));
  saveState();
  render();
}

function scheduleNextTick() {
  if (tickTimer) window.clearTimeout(tickTimer);

  const now = new Date();
  const nextTimes = appState.medications
    .map((medication) => getScheduledDateTime(medication, now))
    .filter((date) => date > now)
    .map((date) => date.getTime());

  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0).getTime();
  const nextTarget = Math.min(nextMidnight, ...nextTimes);
  const delay = Math.max(250, Math.min(nextTarget - now.getTime() + 250, 1000));

  tickTimer = window.setTimeout(render, delay);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

menuButton.addEventListener("click", () => {
  const willOpen = menuPanel.hidden;
  menuPanel.hidden = !willOpen;
  menuButton.setAttribute("aria-expanded", String(willOpen));
});

showDeletePanelButton.addEventListener("click", () => {
  deletePanel.hidden = false;
  historyPanel.hidden = true;
  menuPanel.hidden = true;
  menuButton.setAttribute("aria-expanded", "false");
  deletePanel.scrollIntoView({ behavior: "smooth", block: "start" });
});

showHistoryButton.addEventListener("click", () => {
  historyPanel.hidden = false;
  deletePanel.hidden = true;
  menuPanel.hidden = true;
  menuButton.setAttribute("aria-expanded", "false");
  historyPanel.scrollIntoView({ behavior: "smooth", block: "start" });
});

closeDeletePanelButton.addEventListener("click", () => {
  deletePanel.hidden = true;
});

closeHistoryButton.addEventListener("click", () => {
  historyPanel.hidden = true;
});

deleteMedicationForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const checked = Array.from(deleteMedicationForm.querySelectorAll("input[name='medicationToDelete']:checked"));
  deleteMedications(checked.map((input) => input.value));
});

document.addEventListener("click", (event) => {
  if (menuPanel.hidden) return;
  if (event.target === menuButton || menuButton.contains(event.target) || menuPanel.contains(event.target)) return;
  menuPanel.hidden = true;
  menuButton.setAttribute("aria-expanded", "false");
});

profileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  appState.personName = personNameInput.value.trim();
  saveState();
  render();
});

medicationForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(medicationForm);
  const name = String(formData.get("medName") || "").trim();
  const time = String(formData.get("medTime") || "").trim();
  const notes = String(formData.get("medNotes") || "").trim();

  if (!name || !time) return;

  appState.medications.push({
    id: makeId(),
    name,
    time,
    notes,
    createdAt: new Date().toISOString(),
  });

  saveState();
  medicationForm.reset();
  render();
});

exportButton.addEventListener("click", () => {
  const data = JSON.stringify(appState, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `medikamenten-verlauf-${getDateKey()}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

render();
