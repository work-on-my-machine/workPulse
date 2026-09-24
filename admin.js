const form = document.getElementById("publish-form");
const message = document.getElementById("admin-message");
const list = document.getElementById("published-list");
const count = document.getElementById("published-count");
const keyInput = document.getElementById("admin-key");
const submitButton = form.querySelector("button[type='submit']");
const addAdminForm = document.getElementById("add-admin-form");
const addAdminMessage = document.getElementById("add-admin-message");
const adminsList = document.getElementById("admins-list");
let adminKey = sessionStorage.getItem("workpulse-admin-key") || "";

if (adminKey) {
  keyInput.value = adminKey;
  loadPublished();
  loadAdmins();
}

function setMessage(text, isSuccess = false) {
  message.className = `admin-message${isSuccess ? " success" : ""}`;
  message.textContent = text;
}

function formatType(type) {
  return type === "job" ? "Hiring opportunity" : type === "policy" ? "Policy update" : "Announcement";
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
  try {
    const response = await fetch("/api/admin/updates", { headers: { "x-admin-key": adminKey } });
    const data = await readResponse(response);
    if (!response.ok) throw new Error(data.error || "Invalid admin key");
    renderPublished(data.updates);
  } catch (error) {
    sessionStorage.removeItem("workpulse-admin-key");
    keyInput.value = "";
    renderPublished([]);
    setMessage(error.message);
  }
}

function setAdminMessage(text, isSuccess = false) {
  addAdminMessage.className = `admin-message${isSuccess ? " success" : ""}`;
  addAdminMessage.textContent = text;
}

async function loadAdmins() {
  try {
    const response = await fetch("/api/admin/admins", { headers: { "x-admin-key": adminKey } });
    const data = await readResponse(response);
    if (!response.ok) throw new Error(data.error || "Could not load administrators");
    adminsList.innerHTML = data.admins.map((admin) => {
      const initials = admin.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
      return `<article class="admin-item"><span class="admin-avatar">${initials}</span><div><strong>${admin.name}</strong><p>${admin.email}</p></div></article>`;
    }).join("");
  } catch (error) {
    adminsList.innerHTML = `<p class="empty-admin">${error.message}</p>`;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminKey = keyInput.value.trim();
  if (!adminKey) {
    setMessage("Enter your admin key to publish.");
    return;
  }

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
    sessionStorage.setItem("workpulse-admin-key", adminKey);
    setMessage("Published. It is now available on the employee dashboard.", true);
    form.reset();
    keyInput.value = adminKey;
    await loadPublished();
    await loadAdmins();
  } catch (error) {
    setMessage(error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = "<span>✦</span> Publish update";
  }
});

addAdminForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminKey = keyInput.value.trim() || adminKey;
  if (!adminKey) {
    setAdminMessage("Enter your current admin key above first.");
    return;
  }

  const button = addAdminForm.querySelector("button[type='submit']");
  button.disabled = true;
  setAdminMessage("");
  try {
    const response = await fetch("/api/admin/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({
        name: document.getElementById("new-admin-name").value.trim(),
        email: document.getElementById("new-admin-email").value.trim(),
        adminKey: document.getElementById("new-admin-key").value
      })
    });
    const data = await readResponse(response);
    if (!response.ok) throw new Error(data.error || "Could not add administrator");
    setAdminMessage("Administrator added. Share their key securely.", true);
    addAdminForm.reset();
    await loadAdmins();
  } catch (error) {
    setAdminMessage(error.message);
  } finally {
    button.disabled = false;
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
