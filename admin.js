const form = document.getElementById("publish-form");
const message = document.getElementById("admin-message");
const list = document.getElementById("published-list");
const count = document.getElementById("published-count");
const submitButton = form.querySelector("button[type='submit']");
const adminLoginForm = document.getElementById("admin-login-form");
const adminLoginKey = document.getElementById("admin-login-key");
const adminLoginMessage = document.getElementById("admin-login-message");
const adminLoginPanel = document.getElementById("admin-login-panel");
const adminWorkspace = document.getElementById("admin-workspace");
const adminLogoutButton = document.getElementById("admin-logout");
let adminKey = sessionStorage.getItem("workpulse-admin-key") || "";

function setMessage(text, isSuccess = false) {
  message.className = `admin-message${isSuccess ? " success" : ""}`;
  message.textContent = text;
}

function setLoginMessage(text, isSuccess = false) {
  adminLoginMessage.className = `admin-message${isSuccess ? " success" : ""}`;
  adminLoginMessage.textContent = text;
}

async function readResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(text.replace(/^Forbidden:\s*/i, "") || `Request failed (${response.status})`);
  }
}

function formatType(type) {
  return type === "job" ? "Hiring opportunity" : type === "policy" ? "Policy update" : "Announcement";
}

function renderPublished(updates) {
  count.textContent = updates.length;
  list.innerHTML = updates.length ? updates.map((item) => `
    <article class="published-item">
      <div class="published-item-top"><span class="published-type ${item.type}">${formatType(item.type)}</span><span class="published-date">${new Date(item.created_at).toLocaleDateString()}</span></div>
      <h3>${item.title}</h3><p>${item.body}</p>
      <div class="published-footer"><span class="published-meta">${item.department || "WorkPulse"}${item.location ? ` · ${item.location}` : ""}${item.deadline ? ` · ${item.deadline}` : ""}</span><button class="delete-post" data-delete="${item.id}">Delete</button></div>
    </article>
  `).join("") : '<p class="empty-admin">No updates have been published yet.</p>';
}

async function loadPublished() {
  const response = await fetch("/api/admin/updates", { headers: { "x-admin-key": adminKey } });
  const data = await readResponse(response);
  if (!response.ok) throw new Error(data.error || "Invalid admin key");
  renderPublished(data.updates);
}

async function openWorkspace(data) {
  sessionStorage.setItem("workpulse-admin-key", adminKey);
  adminLoginPanel.classList.add("hidden");
  adminWorkspace.classList.remove("hidden");
  adminLogoutButton.classList.remove("hidden");
  document.getElementById("signed-in-admin").textContent = `Signed in as ${data.admin.name}`;
  try {
    await loadPublished();
  } catch (error) {
    setMessage(error.message);
  }
}

async function verifyAdmin() {
  try {
    const response = await fetch("/api/admin/profile", { headers: { "x-admin-key": adminKey } });
    const data = await readResponse(response);
    if (!response.ok) throw new Error(data.error || "Invalid admin key");
    await openWorkspace(data);
  } catch (error) {
    sessionStorage.removeItem("workpulse-admin-key");
    adminKey = "";
    adminLoginPanel.classList.remove("hidden");
    adminWorkspace.classList.add("hidden");
    adminLogoutButton.classList.add("hidden");
    setLoginMessage(error.message);
  }
}

adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminKey = adminLoginKey.value.trim();
  if (!adminKey) {
    setLoginMessage("Enter your admin key.");
    return;
  }
  const button = adminLoginForm.querySelector("button[type='submit']");
  button.disabled = true;
  setLoginMessage("");
  try {
    const response = await fetch("/api/admin/profile", { headers: { "x-admin-key": adminKey } });
    const data = await readResponse(response);
    if (!response.ok) throw new Error(data.error || "Invalid admin key");
    await openWorkspace(data);
  } catch (error) {
    adminKey = "";
    setLoginMessage(error.message);
  } finally {
    button.disabled = false;
  }
});

adminLogoutButton.addEventListener("click", () => {
  sessionStorage.removeItem("workpulse-admin-key");
  adminKey = "";
  adminWorkspace.classList.add("hidden");
  adminLoginPanel.classList.remove("hidden");
  adminLogoutButton.classList.add("hidden");
  adminLoginForm.reset();
  list.innerHTML = '<p class="empty-admin">Enter your admin key to view published updates.</p>';
  count.textContent = "0";
  setMessage("");
  setLoginMessage("You have been signed out.", true);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  submitButton.innerHTML = "Publishing...";
  const payload = {
    type: document.getElementById("type").value,
    title: document.getElementById("title").value.trim(),
    body: document.getElementById("body").value.trim(),
    department: document.getElementById("department").value.trim(),
    location: document.getElementById("location").value.trim(),
    deadline: document.getElementById("deadline").value.trim()
  };

  try {
    const response = await fetch("/api/admin/updates", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify(payload)
    });
    const data = await readResponse(response);
    if (!response.ok) throw new Error(data.error || "Could not publish update");
    setMessage("Published. It is now available on the employee dashboard.", true);
    form.reset();
    await loadPublished();
  } catch (error) {
    setMessage(error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = "<span>✦</span> Publish update";
  }
});

document.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-delete]");
  if (!deleteButton) return;
  deleteButton.disabled = true;
  const response = await fetch(`/api/admin/updates/${deleteButton.dataset.delete}`, {
    method: "DELETE",
    headers: { "x-admin-key": adminKey }
  });
  const data = await readResponse(response);
  if (!response.ok) setMessage(data.error || "Could not delete update");
  else await loadPublished();
});

if (adminKey) verifyAdmin();
