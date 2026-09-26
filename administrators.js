const loginForm = document.getElementById("admin-login-form");
const loginKeyInput = document.getElementById("admin-login-key");
const loginMessage = document.getElementById("admin-login-message");
const loginPanel = document.getElementById("admin-login-panel");
const management = document.getElementById("admin-management");
const addAdminForm = document.getElementById("add-admin-form");
const addAdminMessage = document.getElementById("add-admin-message");
const createdAdminLogin = document.getElementById("created-admin-login");
const adminsList = document.getElementById("admins-list");
const adminsCount = document.getElementById("admins-count");
let adminKey = sessionStorage.getItem("workpulse-admin-key") || "";
let createdAdminKey = "";

function message(element, text, success = false) {
  element.className = `admin-message${success ? " success" : ""}`;
  element.textContent = text;
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

async function loadAdmins() {
  const response = await fetch("/api/admin/admins", { headers: { "x-admin-key": adminKey } });
  const data = await readResponse(response);
  if (!response.ok) throw new Error(data.error || "Could not load administrators");
  adminsCount.textContent = data.admins.length;
  adminsList.innerHTML = data.admins.map((admin) => {
    const initials = admin.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
    return `<article class="admin-item"><span class="admin-avatar">${initials}</span><div><strong>${admin.name}</strong><p>${admin.email}</p></div><time>${new Date(admin.created_at).toLocaleDateString()}</time></article>`;
  }).join("");
}

async function openManagement(profile) {
  sessionStorage.setItem("workpulse-admin-key", adminKey);
  loginPanel.classList.add("hidden");
  management.classList.remove("hidden");
  document.getElementById("signed-in-admin").textContent = `Signed in as ${profile.name} · ${profile.email}`;
  try {
    await loadAdmins();
  } catch (error) {
    message(addAdminMessage, error.message);
  }
}

async function verifyAdmin() {
  try {
    const response = await fetch("/api/admin/profile", { headers: { "x-admin-key": adminKey } });
    const data = await readResponse(response);
    if (!response.ok) throw new Error(data.error || "Invalid admin key");
    await openManagement(data.admin);
  } catch (error) {
    sessionStorage.removeItem("workpulse-admin-key");
    adminKey = "";
    message(loginMessage, error.message);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminKey = loginKeyInput.value.trim();
  const button = loginForm.querySelector("button[type='submit']");
  button.disabled = true;
  message(loginMessage, "");
  try {
    const response = await fetch("/api/admin/profile", { headers: { "x-admin-key": adminKey } });
    const data = await readResponse(response);
    if (!response.ok) throw new Error(data.error || "Invalid admin key");
    await openManagement(data.admin);
  } catch (error) {
    adminKey = "";
    message(loginMessage, error.message);
  } finally {
    button.disabled = false;
  }
});

addAdminForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  createdAdminKey = "";
  createdAdminLogin.hidden = true;
  const button = addAdminForm.querySelector("button[type='submit']");
  button.disabled = true;
  message(addAdminMessage, "");
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
    if (!response.ok) throw new Error(data.error || "Could not create administrator");
    createdAdminKey = document.getElementById("new-admin-key").value;
    createdAdminLogin.hidden = false;
    message(addAdminMessage, "Administrator created. Share the key securely.", true);
    addAdminForm.reset();
    await loadAdmins();
  } catch (error) {
    message(addAdminMessage, error.message);
  } finally {
    button.disabled = false;
  }
});

createdAdminLogin.addEventListener("click", () => {
  if (createdAdminKey) {
    sessionStorage.setItem("workpulse-admin-key", createdAdminKey);
  }
});

if (adminKey) verifyAdmin();
