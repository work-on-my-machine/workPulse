const MOODS = ["Calm", "Good", "Mixed", "Low", "Grateful"];
let entries = [];
let activeView = "all";
let searchTerm = "";
let editingId = null;
let workouts = [];

const form = document.getElementById("entry-form");
const titleInput = document.getElementById("entry-title");
const bodyInput = document.getElementById("entry-body");
const entryList = document.getElementById("entry-list");
const emptyState = document.getElementById("empty-state");
const searchInput = document.getElementById("search-input");
const toast = document.getElementById("toast");
const workoutForm = document.getElementById("workout-form");
const workoutList = document.getElementById("workout-list");
const workoutFilter = document.getElementById("workout-filter");
const workoutExercise = document.getElementById("workout-exercise");
const progressExercise = document.getElementById("progress-exercise");
const progressMetric = document.getElementById("progress-metric");
const faithReminders = {
  quran: [
    { text: "Allah does not charge a soul except [with that within] its capacity.", reference: "Qur’an 2:286", attribution: "Saheeh International translation, via QuranEnc", url: "https://quranenc.com/en/browse/english_saheeh/2/286" },
    { text: "By the remembrance of Allah hearts are assured.", reference: "Qur’an 13:28", attribution: "Saheeh International translation, via QuranEnc", url: "https://quranenc.com/en/browse/english_saheeh/13/28" },
    { text: "So do not weaken and do not grieve, and you will be superior if you are [true] believers.", reference: "Qur’an 3:139", attribution: "Saheeh International translation, via QuranEnc", url: "https://quranenc.com/en/browse/english_saheeh/3/139" },
    { text: "For indeed, with hardship [will be] ease [i.e., relief].", reference: "Qur’an 94:5", attribution: "Saheeh International translation, via QuranEnc", url: "https://quranenc.com/en/browse/english_saheeh/94/5" }
  ],
  hadith: [
    { text: "Your body has a right over you.", reference: "Sahih al-Bukhari 5199", grade: "Sahih", attribution: "Sunnah.com, USC-MSA English translation", url: "https://sunnah.com/bukhari:5199" },
    { text: "A strong believer is better and is more lovable to Allah than a weak believer.", reference: "Sahih Muslim 2664", grade: "Sahih", attribution: "Sunnah.com, USC-MSA English translation", url: "https://sunnah.com/muslim:2664" },
    { text: "The reward of deeds depends upon the intentions.", reference: "Sahih al-Bukhari 1", grade: "Sahih", attribution: "Sunnah.com, USC-MSA English translation", url: "https://sunnah.com/bukhari:1" }
  ]
};
const todayIndex = Math.floor(Date.now() / 86400000);
let activeReminderType = "quran";
const reminderIndexes = {
  quran: todayIndex % faithReminders.quran.length,
  hadith: todayIndex % faithReminders.hadith.length
};

function isValidEntry(entry) {
  return entry && typeof entry.id === "string" && typeof entry.body === "string"
    && typeof entry.createdAt === "string" && typeof entry.updatedAt === "string"
    && typeof entry.title === "string" && MOODS.includes(entry.mood)
    && typeof entry.favorite === "boolean";
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  const result = await response.json().catch(() => ({}));
  if (response.status === 401) {
    window.location.replace("/signin");
    throw new Error("Please sign in again.");
  }
  if (!response.ok) throw new Error(result.error || "Could not save your entry.");
  return result;
}

async function loadEntries() {
  const result = await apiRequest("/api/entries");
  entries = result.entries;
  renderEntries();
}

async function loadWorkouts() {
  const result = await apiRequest("/api/workouts");
  workouts = result.workouts;
  renderWorkouts();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric", year: "numeric"
  });
}

function renderEntries() {
  const visibleEntries = entries
    .filter((entry) => activeView !== "favorites" || entry.favorite)
    .filter((entry) => `${entry.title} ${entry.body} ${entry.mood}`.toLowerCase().includes(searchTerm))
    .sort((first, second) => new Date(second.updatedAt) - new Date(first.updatedAt));

  entryList.innerHTML = visibleEntries.map((entry) => `
    <article class="entry-card">
      <div class="entry-date"><span class="date-dot"></span><time datetime="${escapeHtml(entry.createdAt)}">${escapeHtml(formatDate(entry.createdAt))}</time></div>
      <div class="entry-content">
        <div class="entry-meta"><span class="mood-tag mood-${entry.mood.toLowerCase()}">${escapeHtml(entry.mood)}</span>${entry.updatedAt !== entry.createdAt ? '<span class="edited-label">Edited</span>' : ""}</div>
        <h3>${escapeHtml(entry.title || "A moment to remember")}</h3>
        <p>${escapeHtml(entry.body).replace(/\n/g, "<br>")}</p>
        <div class="entry-actions">
          <button class="entry-action" type="button" data-edit="${escapeHtml(entry.id)}">Edit</button>
          <button class="entry-action delete-action" type="button" data-delete="${escapeHtml(entry.id)}">Delete</button>
        </div>
      </div>
      <button class="favorite-button ${entry.favorite ? "is-favorite" : ""}" type="button" data-favorite="${escapeHtml(entry.id)}" aria-label="${entry.favorite ? "Remove from favorites" : "Add to favorites"}" title="${entry.favorite ? "Remove from favorites" : "Add to favorites"}">${entry.favorite ? "★" : "☆"}</button>
    </article>
  `).join("");

  const hasEntries = visibleEntries.length > 0;
  entryList.classList.toggle("hidden", !hasEntries);
  emptyState.classList.toggle("hidden", hasEntries);
  document.getElementById("entry-count").textContent = entries.length;
  document.getElementById("entry-count-label").textContent = entries.length === 1 ? "entry kept" : "entries kept";

  const isFavorites = activeView === "favorites";
  document.getElementById("entries-heading").textContent = isFavorites ? "Keep close what matters." : "The little things add up.";
  document.getElementById("list-eyebrow").textContent = isFavorites ? "Your favorites" : "Your reflections";
  document.getElementById("empty-heading").textContent = searchTerm
    ? "Nothing found just yet."
    : isFavorites ? "No favorites saved yet." : "Your first page is waiting.";
  document.getElementById("empty-copy").textContent = searchTerm
    ? "Try another word or clear your search."
    : isFavorites ? "Tap the star on an entry to keep it close." : "You don’t need the perfect words. Just begin with today.";
}

function renderWorkouts() {
  const filter = workoutFilter.value;
  const visibleWorkouts = workouts.filter((workout) => filter === "all" || workout.muscleGroup === filter);
  workoutList.innerHTML = visibleWorkouts.map((workout) => `
    <article class="workout-card">
      <div class="workout-card-date">${escapeHtml(formatDate(`${workout.performedAt}T12:00:00`))}</div>
      <div class="workout-card-main">
        <div class="workout-card-meta"><span class="muscle-tag">${escapeHtml(workout.muscleGroup)}</span><span>${workout.sets} sets × ${workout.reps} reps</span></div>
        <h3>${escapeHtml(workout.exercise)}</h3>
        <p class="workout-card-load">${workout.weight > 0 ? `${escapeHtml(workout.weight)} ${escapeHtml(workout.weightUnit)} load` : "Bodyweight / unweighted"}${workout.notes ? ` · ${escapeHtml(workout.notes)}` : ""}</p>
      </div>
      <button class="workout-delete" type="button" data-workout-delete="${escapeHtml(workout.id)}" aria-label="Delete ${escapeHtml(workout.exercise)} log" title="Delete log">×</button>
    </article>
  `).join("");

  const hasWorkouts = visibleWorkouts.length > 0;
  workoutList.classList.toggle("hidden", !hasWorkouts);
  document.getElementById("workout-empty").classList.toggle("hidden", hasWorkouts);
  document.getElementById("workout-count").textContent = workouts.length;
  renderWorkoutInsights();
}

function renderWorkoutInsights() {
  const exerciseNames = [...new Set(workouts.map((workout) => workout.exercise))];
  const selectedExercise = exerciseNames.includes(progressExercise.value) ? progressExercise.value : exerciseNames[0] || "";
  progressExercise.innerHTML = exerciseNames.map((exercise) => `<option value="${escapeHtml(exercise)}">${escapeHtml(exercise)}</option>`).join("");
  progressExercise.value = selectedExercise;

  const exerciseWorkouts = workouts
    .filter((workout) => workout.exercise === selectedExercise)
    .sort((first, second) => first.performedAt.localeCompare(second.performedAt));
  const metric = progressMetric.value;
  const metricLabel = metric === "weight" ? "Load (kg)" : metric === "reps" ? "Reps per set" : "Total reps";
  const progressChart = document.getElementById("progress-chart");

  if (!exerciseWorkouts.length) {
    progressChart.innerHTML = '<p class="chart-empty">Log an exercise to see your progress here.</p>';
  } else {
    const values = exerciseWorkouts.map((workout) => {
      if (metric === "reps") return workout.reps;
      if (metric === "total-reps") return workout.sets * workout.reps;
      return workout.weight * (workout.weightUnit === "lb" ? 0.453592 : 1);
    });

    if (metric === "weight" && values.every((value) => value === 0)) {
      progressChart.innerHTML = '<p class="chart-empty">No weighted sets recorded for this exercise yet.</p>';
    } else {
      const maxValue = Math.max(...values, 1);
      const formatValue = (value) => metric === "weight" ? `${value.toFixed(1)} kg` : `${value} reps`;
      const dateLabel = (date) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      progressChart.innerHTML = `
        <div class="progress-chart-axis" aria-hidden="true"><span>${escapeHtml(formatValue(maxValue))}</span><span>0</span></div>
        <ol class="progress-chart-plot" aria-label="${escapeHtml(selectedExercise)} ${escapeHtml(metricLabel)} by workout">
          ${exerciseWorkouts.map((workout, index) => {
            const value = values[index];
            const height = value === 0 ? 0 : Math.max(7, value / maxValue * 100);
            return `<li class="progress-point" aria-label="${escapeHtml(dateLabel(workout.performedAt))}: ${escapeHtml(formatValue(value))}"><span class="progress-value">${escapeHtml(formatValue(value))}</span><span class="progress-bar" style="--bar-height: ${height}%"></span><time class="progress-date" datetime="${escapeHtml(workout.performedAt)}">${escapeHtml(dateLabel(workout.performedAt))}</time></li>`;
          }).join("")}
        </ol>
      `;
    }
  }

  const groupCounts = workouts.reduce((counts, workout) => {
    counts[workout.muscleGroup] = (counts[workout.muscleGroup] || 0) + 1;
    return counts;
  }, {});
  const muscleEntries = Object.entries(groupCounts).sort((first, second) => second[1] - first[1]).slice(0, 8);
  const muscleChart = document.getElementById("muscle-chart");
  if (!muscleEntries.length) {
    muscleChart.innerHTML = '<p class="chart-empty">Your training mix will appear here.</p>';
  } else {
    const maxCount = muscleEntries[0][1];
    muscleChart.innerHTML = muscleEntries.map(([group, count]) => `
      <div class="muscle-chart-row"><span class="muscle-chart-label">${escapeHtml(group)}</span><span class="muscle-track"><span class="muscle-fill" style="--bar-width: ${count / maxCount * 100}%"></span></span><span class="muscle-chart-count">${count}</span></div>
    `).join("");
  }
}

function showWorkoutPanel(showWorkout) {
  showContentPanel(showWorkout ? "workout" : "journal");
}

function showContentPanel(panel) {
  document.getElementById("journal-panel").classList.toggle("hidden", panel !== "journal");
  document.getElementById("workout-panel").classList.toggle("hidden", panel !== "workout");
  document.getElementById("faith-panel").classList.toggle("hidden", panel !== "faith");
  document.getElementById("gym-nav-button").classList.toggle("active", panel === "workout");
  document.getElementById("faith-nav-button").classList.toggle("active", panel === "faith");
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", panel === "journal" && button.dataset.view === activeView);
  });
}

function renderFaithReminder() {
  const items = faithReminders[activeReminderType];
  const reminder = items[reminderIndexes[activeReminderType]];
  const isHadith = activeReminderType === "hadith";
  document.querySelectorAll("[data-reminder-type]").forEach((button) => {
    const isActive = button.dataset.reminderType === activeReminderType;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  document.getElementById("faith-heading").textContent = isHadith ? "A hadith to reflect on." : "A verse to reflect on.";
  document.getElementById("reminder-card").innerHTML = `
    <p class="reminder-kind">${isHadith ? "Hadith excerpt" : "Qur’an verse"}</p>
    <blockquote class="reminder-quote">“${escapeHtml(reminder.text)}”</blockquote>
    <div class="reminder-source">
      <div><strong>${escapeHtml(reminder.reference)}</strong>${isHadith ? `<span class="hadith-grade">${escapeHtml(reminder.grade)}</span>` : ""}</div>
      <p>${escapeHtml(reminder.attribution)}</p>
    </div>
    <a class="source-link" href="${escapeHtml(reminder.url)}" target="_blank" rel="noopener noreferrer">Read the source <span aria-hidden="true">↗</span></a>
  `;
}

function resetForm() {
  form.reset();
  document.querySelector('input[name="mood"][value="Good"]').checked = true;
  editingId = null;
  document.getElementById("composer-heading").textContent = "Start with what’s on your mind.";
  document.getElementById("save-button").innerHTML = 'Save entry <span aria-hidden="true">↗</span>';
  document.getElementById("cancel-edit").classList.add("hidden");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("visible"), 2600);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = bodyInput.value.trim();
  if (!body) return;

  const entry = {
    title: titleInput.value.trim(),
    body,
    mood: document.querySelector('input[name="mood"]:checked').value
  };
  const mood = document.querySelector('input[name="mood"]:checked').value;

  try {
    if (editingId) {
      const existing = entries.find((item) => item.id === editingId);
      await apiRequest(`/api/entries/${encodeURIComponent(editingId)}`, {
        method: "PUT",
        body: JSON.stringify({ ...entry, mood, favorite: existing?.favorite || false })
      });
      showToast("Your entry has been updated.");
    } else {
      await apiRequest("/api/entries", { method: "POST", body: JSON.stringify(entry) });
      showToast("A moment saved.");
    }
    await loadEntries();
    resetForm();
  } catch (error) {
    showToast(error.message);
  }
});

document.addEventListener("click", async (event) => {
  const viewButton = event.target.closest("[data-view]");
  const reminderTypeButton = event.target.closest("[data-reminder-type]");
  const workoutDeleteButton = event.target.closest("[data-workout-delete]");
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");
  const favoriteButton = event.target.closest("[data-favorite]");

  if (viewButton) {
    activeView = viewButton.dataset.view;
    showContentPanel("journal");
    renderEntries();
  }

  if (event.target.closest("#gym-nav-button")) showWorkoutPanel(true);
  if (event.target.closest("#faith-nav-button")) showContentPanel("faith");
  if (reminderTypeButton) {
    activeReminderType = reminderTypeButton.dataset.reminderType;
    renderFaithReminder();
  }
  if (event.target.closest("#next-reminder")) {
    const items = faithReminders[activeReminderType];
    reminderIndexes[activeReminderType] = (reminderIndexes[activeReminderType] + 1) % items.length;
    renderFaithReminder();
  }

  if (workoutDeleteButton) {
    if (!window.confirm("Delete this workout log? This cannot be undone.")) return;
    try {
      await apiRequest(`/api/workouts/${encodeURIComponent(workoutDeleteButton.dataset.workoutDelete)}`, { method: "DELETE" });
      await loadWorkouts();
      showToast("Workout removed.");
    } catch (error) {
      showToast(error.message);
    }
  }

  if (editButton) {
    const entry = entries.find((item) => item.id === editButton.dataset.edit);
    if (!entry) return;
    editingId = entry.id;
    titleInput.value = entry.title;
    bodyInput.value = entry.body;
    document.querySelector(`input[name="mood"][value="${entry.mood}"]`).checked = true;
    document.getElementById("composer-heading").textContent = "Make this entry your own.";
    document.getElementById("save-button").innerHTML = 'Update entry <span aria-hidden="true">↗</span>';
    document.getElementById("cancel-edit").classList.remove("hidden");
    titleInput.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (deleteButton) {
    const entry = entries.find((item) => item.id === deleteButton.dataset.delete);
    if (entry && window.confirm("Delete this journal entry? This cannot be undone.")) {
      try {
        await apiRequest(`/api/entries/${encodeURIComponent(entry.id)}`, { method: "DELETE" });
        if (editingId === entry.id) resetForm();
        await loadEntries();
        showToast("Entry deleted.");
      } catch (error) {
        showToast(error.message);
      }
    }
  }

  if (favoriteButton) {
    const entry = entries.find((item) => item.id === favoriteButton.dataset.favorite);
    if (!entry) return;
    try {
      await apiRequest(`/api/entries/${encodeURIComponent(entry.id)}`, {
        method: "PUT",
        body: JSON.stringify({ ...entry, favorite: !entry.favorite })
      });
      await loadEntries();
    } catch (error) {
      showToast(error.message);
    }
  }
});

workoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(workoutForm);
  const workout = {
    exercise: data.get("exercise"),
    muscleGroup: workoutExercise.selectedOptions[0].dataset.muscle,
    performedAt: data.get("performedAt"),
    sets: Number(data.get("sets")),
    reps: Number(data.get("reps")),
    weight: Number(data.get("weight")),
    weightUnit: data.get("weightUnit"),
    notes: data.get("notes").trim()
  };

  try {
    await apiRequest("/api/workouts", { method: "POST", body: JSON.stringify(workout) });
    await loadWorkouts();
    workoutForm.elements.sets.value = 3;
    workoutForm.elements.reps.value = 10;
    workoutForm.elements.weight.value = 0;
    workoutForm.elements.notes.value = "";
    showToast("Workout saved.");
  } catch (error) {
    showToast(error.message);
  }
});

document.getElementById("cancel-edit").addEventListener("click", resetForm);

searchInput.addEventListener("input", () => {
  searchTerm = searchInput.value.toLowerCase().trim();
  renderEntries();
});

document.getElementById("current-date").textContent = new Date().toLocaleDateString(undefined, {
  weekday: "long", month: "long", day: "numeric", year: "numeric"
});
document.getElementById("workout-current-date").textContent = new Date().toLocaleDateString(undefined, {
  weekday: "long", month: "long", day: "numeric", year: "numeric"
});
document.getElementById("faith-current-date").textContent = new Date().toLocaleDateString(undefined, {
  weekday: "long", month: "long", day: "numeric", year: "numeric"
});
document.getElementById("workout-date").value = new Date().toLocaleDateString("en-CA");
workoutExercise.addEventListener("change", () => {
  document.getElementById("selected-muscle").textContent = workoutExercise.selectedOptions[0].dataset.muscle;
});
workoutFilter.addEventListener("change", renderWorkouts);
progressExercise.addEventListener("change", renderWorkoutInsights);
progressMetric.addEventListener("change", renderWorkoutInsights);
renderFaithReminder();

document.getElementById("signout-button").addEventListener("click", async () => {
  try {
    await apiRequest("/api/logout", { method: "POST" });
  } finally {
    window.location.replace("/signin");
  }
});

async function startJournal() {
  try {
    const { user } = await apiRequest("/api/session");
    const name = user.username || "friend";
    const hour = new Date().getHours();
    let greeting = "Hello";

    if (hour < 12) greeting = "Good morning";
    else if (hour < 18) greeting = "Good afternoon";
    else greeting = "Good evening";

    document.getElementById("account-name").textContent = `${greeting}, ${name}`;
    await Promise.all([loadEntries(), loadWorkouts()]);
  } catch (error) {
    if (error.message !== "Please sign in again.") showToast(error.message);
  }
}

startJournal();