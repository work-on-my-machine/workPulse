const updates = [
  { id: "bonus", type: "announcement", label: "Announcement", tone: "coral", title: "Performance bonus cycle opens for nominations", text: "Managers can submit nominations for the H2 performance bonus until 30 September.", meta: "People team  ·  2 hours ago" },
  { id: "parental", type: "policy", label: "Policy update", tone: "blue", title: "Paid parental leave expanded to 26 weeks", text: "The updated policy applies to all full-time employees from 01 October 2026. Check your eligibility and plan ahead.", meta: "People policy  ·  Yesterday" },
  { id: "learning", type: "announcement", label: "Learning & growth", tone: "yellow", title: "Applications open: Emerging Leaders programme", text: "A 12-week programme for individual contributors ready to build their leadership toolkit. 20 places available.", meta: "Learning team  ·  2 days ago" },
  { id: "analyst", type: "job", label: "Internal opportunity", tone: "green", title: "Senior Product Analyst", text: "Work with the Growth team to turn customer behaviour into the next big product decision.", meta: "Product  ·  Bengaluru / Hybrid" }
];

const jobs = [
  { id: "job-analyst", initials: "PA", colour: "peach", title: "Senior Product Analyst", team: "Growth · Bengaluru", match: "94% match" },
  { id: "job-design", initials: "SD", colour: "mint", title: "Service Designer", team: "Experience · Mumbai", match: "88% match" },
  { id: "job-engineer", initials: "SE", colour: "lilac", title: "Software Engineer II", team: "Platform · Remote", match: "82% match" }
];

let activeFilter = "all";
let searchTerm = "";
let savedItems = JSON.parse(localStorage.getItem("workpulse-saved") || "[]");
let publishedUpdates = [];

const updateList = document.getElementById("update-list");
const jobList = document.getElementById("job-list");
const emptyState = document.getElementById("empty-state");
const searchInput = document.getElementById("search-input");
const toast = document.getElementById("toast");
const drawer = document.getElementById("detail-drawer");
const backdrop = document.getElementById("drawer-backdrop");

function dashboardUpdates() {
  return [...publishedUpdates, ...updates];
}

function dashboardJobs() {
  return [
    ...publishedUpdates.filter((item) => item.type === "job").map((item) => ({
      id: `published-${item.id}`,
      initials: (item.department || "WP").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
      colour: "mint",
      title: item.title,
      team: `${item.department || "WorkPulse"} · ${item.location || "See details"}`,
      match: item.deadline || "Open now"
    })),
    ...jobs
  ];
}

function personalizeDashboard() {
  const storedUser = JSON.parse(localStorage.getItem("workpulse-user") || "null");
  const fullName = storedUser?.name?.trim() || "Aarav Mehta";
  const firstName = fullName.split(/\s+/)[0];
  const initials = fullName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  document.getElementById("greeting").textContent = greeting;
  document.getElementById("user-name").textContent = firstName;
  document.getElementById("profile-avatar").textContent = initials;
  document.getElementById("profile-name").textContent = storedUser ? "Sign out" : "Sign in";
  document.getElementById("account-link").href = storedUser ? "#sign-out" : "login.html";
  document.getElementById("current-date").textContent = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });
}

function renderUpdates() {
  const visibleUpdates = dashboardUpdates().filter((item) => {
    const matchesFilter = activeFilter === "all" || item.type === activeFilter;
    const searchable = `${item.title} ${item.text} ${item.label} ${item.meta}`.toLowerCase();
    return matchesFilter && searchable.includes(searchTerm);
  });

  updateList.innerHTML = visibleUpdates.map((item) => `
    <article class="update-card">
      <div class="update-icon ${item.tone}">${item.type === "job" ? "↗" : item.type === "policy" ? "▤" : "✦"}</div>
      <div class="update-body"><div class="update-meta"><span class="type-label ${item.tone}">${item.label}</span><span>${item.meta}</span></div><h3>${item.title}</h3><p>${item.text}</p><button class="read-button" data-detail="${item.id}">Read more <span>→</span></button></div>
      <button class="save-button ${savedItems.includes(item.id) ? "saved" : ""}" data-save="${item.id}" aria-label="${savedItems.includes(item.id) ? "Remove from saved" : "Save update"}">${savedItems.includes(item.id) ? "★" : "☆"}</button>
    </article>
  `).join("");
  emptyState.classList.toggle("hidden", visibleUpdates.length > 0);
}

function renderJobs() {
  jobList.innerHTML = dashboardJobs().map((job) => `
    <article class="job-card"><span class="company-mark ${job.colour}">${job.initials}</span><div><h3>${job.title}</h3><p>${job.team}</p></div><span class="match">${job.match}</span><button class="job-arrow" data-detail="${job.id}" aria-label="View ${job.title}">→</button></article>
  `).join("");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("visible"), 2800);
}

function updateSavedCount() {
  document.getElementById("saved-count").textContent = savedItems.length;
  document.getElementById("saved-copy").textContent = savedItems.length ? `${savedItems.length} item${savedItems.length === 1 ? "" : "s"} saved for later.` : "Save an update to find it quickly later.";
  const savedUpdates = dashboardUpdates().filter((item) => savedItems.includes(item.id));
  document.getElementById("saved-list").innerHTML = savedUpdates.map((item) => `<button class="saved-item" data-detail="${item.id}"><span class="saved-item-icon ${item.tone}">${item.type === "job" ? "↗" : item.type === "policy" ? "▤" : "✦"}</span><span><strong>${item.title}</strong><small>${item.label}</small></span><span class="saved-item-arrow">→</span></button>`).join("");
}

function openDetail(id) {
  const item = dashboardUpdates().find((update) => update.id === id);
  const job = dashboardJobs().find((role) => role.id === id);
  const content = item ? `<p class="eyebrow">${item.label}</p><h2>${item.title}</h2><p class="drawer-meta">${item.meta}</p><p>${item.text}</p><p>This update is curated for your workspace. Check with your People team if you need help understanding how it applies to you.</p><button class="primary-button drawer-action" data-save="${id}">${savedItems.includes(id) ? "★ Saved" : "☆ Save for later"}</button>` : `<p class="eyebrow">Internal opportunity</p><h2>${job.title}</h2><p class="drawer-meta">${job.team} · ${job.match}</p><p>This role is currently open to internal applicants. Review the role profile and connect with the hiring team to learn more.</p><button class="primary-button drawer-action">View role details <span>→</span></button>`;
  document.getElementById("drawer-content").innerHTML = content;
  drawer.classList.add("open");
  backdrop.classList.add("visible");
  drawer.setAttribute("aria-hidden", "false");
}

function closeDetail() {
  drawer.classList.remove("open");
  backdrop.classList.remove("visible");
  drawer.setAttribute("aria-hidden", "true");
}

document.addEventListener("click", (event) => {
  const accountLink = event.target.closest("#account-link");
  const filter = event.target.closest(".filter-tab");
  const detail = event.target.closest("[data-detail]");
  const save = event.target.closest("[data-save]");

  if (accountLink && localStorage.getItem("workpulse-user")) {
    event.preventDefault();
    localStorage.removeItem("workpulse-user");
    window.location.href = "login.html";
    return;
  }

  if (filter) {
    activeFilter = filter.dataset.filter;
    document.querySelectorAll(".filter-tab").forEach((tab) => tab.classList.toggle("active", tab === filter));
    renderUpdates();
  }
  if (detail) openDetail(detail.dataset.detail);
  if (save) {
    const id = save.dataset.save;
    savedItems = savedItems.includes(id) ? savedItems.filter((item) => item !== id) : [...savedItems, id];
    localStorage.setItem("workpulse-saved", JSON.stringify(savedItems));
    renderUpdates();
    updateSavedCount();
    if (drawer.classList.contains("open")) openDetail(id);
    showToast(savedItems.includes(id) ? "Saved for later" : "Removed from saved items");
  }
  if (event.target.id === "digest-button") showToast("Your weekly digest is on its way.");
  if (event.target.id === "clear-filters") {
    activeFilter = "all";
    searchTerm = "";
    searchInput.value = "";
    document.querySelector('[data-filter="all"]').click();
  }
});

searchInput.addEventListener("input", (event) => {
  searchTerm = event.target.value.toLowerCase().trim();
  renderUpdates();
});

document.getElementById("close-drawer").addEventListener("click", closeDetail);
backdrop.addEventListener("click", closeDetail);
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeDetail(); });

async function loadPublishedUpdates() {
  try {
    const response = await fetch("/api/updates");
    const data = await response.json();
    if (response.ok) {
      publishedUpdates = data.updates.map((item) => ({
        id: `published-${item.id}`,
        type: item.type,
        label: item.type === "job" ? "Internal opportunity" : item.type === "policy" ? "Policy update" : "Announcement",
        tone: item.type === "job" ? "green" : item.type === "policy" ? "blue" : "coral",
        title: item.title,
        text: item.body,
        meta: [item.department, item.location, item.deadline].filter(Boolean).join("  ·  ") || "WorkPulse team"
      }));
      renderUpdates();
      renderJobs();
      updateSavedCount();
    }
  } catch (error) {
    console.warn("Published updates are unavailable:", error.message);
  }
}

renderUpdates();
renderJobs();
updateSavedCount();
personalizeDashboard();
loadPublishedUpdates();
