const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:3000`;
const loginForm = document.getElementById("access-login-form");
const loginId = document.getElementById("access-login-id");
const loginPassword = document.getElementById("access-login-password");
const loginMessage = document.getElementById("access-login-message");
const loginPanel = document.getElementById("access-login-panel");
const workspace = document.getElementById("access-workspace");
const adminList = document.getElementById("access-admins-list");
const userList = document.getElementById("access-users-list");
const contentList = document.getElementById("access-content-list");
let accessAdminId = sessionStorage.getItem("workpulse-access-admin-id") || "";
let accessAdminPassword = sessionStorage.getItem("workpulse-access-admin-password") || "";

function showMessage(text, success = false) {
  loginMessage.className = `admin-message${success ? " success" : ""}`;
  loginMessage.textContent = text;
}

async function readResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch (error) { throw new Error(text.replace(/^Forbidden:\s*/i, "") || `Request failed (${response.status})`); }
}

function headers() {
  return { "x-access-admin-id": accessAdminId, "x-access-admin-password": accessAdminPassword };
}

async function loadData() {
  const [adminsResponse, usersResponse, contentResponse] = await Promise.all([
    fetch(`${API_BASE_URL}/api/admin/admins`, { headers: headers() }),
    fetch(`${API_BASE_URL}/api/admin/users`, { headers: headers() }),
    fetch(`${API_BASE_URL}/api/admin/moderation/updates`, { headers: headers() })
  ]);
  const admins = await readResponse(adminsResponse);
  const users = await readResponse(usersResponse);
  const content = await readResponse(contentResponse);
  if (!adminsResponse.ok) throw new Error(admins.error || "Could not load administrators");
  if (!usersResponse.ok) throw new Error(users.error || "Could not load users");
  if (!contentResponse.ok) throw new Error(content.error || "Could not load content");

  document.getElementById("access-admins-count").textContent = admins.admins.length;
  document.getElementById("access-users-count").textContent = users.users.length;
  document.getElementById("access-content-count").textContent = content.updates.length;
  adminList.innerHTML = admins.admins.map((admin) => `<article class="admin-item"><span class="admin-avatar">${admin.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><div><strong>${admin.name}</strong><p>${admin.email}</p></div><time>${new Date(admin.created_at).toLocaleDateString()}</time><button class="remove-access" data-remove-admin="${admin.id}">Remove access</button></article>`).join("");
  userList.innerHTML = users.users.length ? users.users.map((user) => `<article class="admin-item"><span class="admin-avatar">${user.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><div><strong>${user.name}</strong><p>${user.email}</p></div><button class="remove-access" data-remove-user="${user.id}">Remove user</button></article>`).join("") : '<p class="empty-admin">No registered users found.</p>';
  contentList.innerHTML = content.updates.length ? content.updates.map((item) => `<article class="moderation-item"><div class="published-item-top"><span class="published-type ${item.type}">${item.type === "job" ? "Hiring opportunity" : item.type === "policy" ? "Policy update" : "Announcement"}</span><span class="published-date">${new Date(item.created_at).toLocaleDateString()}</span></div><h3>${item.title}</h3><p>${item.body}</p><div class="published-footer"><span class="published-meta">Published by ${item.admin_name || "Unknown admin"}</span><button class="moderation-remove" data-remove-content="${item.id}">Remove content</button></div></article>`).join("") : '<p class="empty-admin">No published content found.</p>';
}

async function openWorkspace(profile) {
  sessionStorage.setItem("workpulse-access-admin-id", accessAdminId);
  sessionStorage.setItem("workpulse-access-admin-password", accessAdminPassword);
  loginPanel.classList.add("hidden");
  workspace.classList.remove("hidden");
  document.getElementById("access-admin-name").textContent = `Signed in as ${profile.name} · ${profile.email}`;
  try { await loadData(); } catch (error) { showMessage(error.message); }
}

async function verifyAdmin() {
  if (!accessAdminId || !accessAdminPassword) return;
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/access-profile`, { headers: headers() });
    const data = await readResponse(response);
    if (!response.ok) throw new Error(data.error || "Invalid access credentials");
    await openWorkspace(data.admin);
  } catch (error) {
    sessionStorage.removeItem("workpulse-access-admin-id");
    sessionStorage.removeItem("workpulse-access-admin-password");
    accessAdminId = "";
    accessAdminPassword = "";
    showMessage(error.message);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  accessAdminId = loginId.value.trim();
  accessAdminPassword = loginPassword.value;
  const button = loginForm.querySelector("button[type='submit']");
  button.disabled = true;
  showMessage("");
  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/access-profile`, { headers: headers() });
    const data = await readResponse(response);
    if (!response.ok) throw new Error(data.error || "Invalid access credentials");
    await openWorkspace(data.admin);
  } catch (error) {
    accessAdminId = "";
    accessAdminPassword = "";
    showMessage(error.message);
  } finally { button.disabled = false; }
});

document.addEventListener("click", async (event) => {
  const removeAdmin = event.target.closest("[data-remove-admin]");
  const removeUser = event.target.closest("[data-remove-user]");
  const removeContent = event.target.closest("[data-remove-content]");
  const target = removeAdmin || removeUser || removeContent;
  if (!target || !window.confirm("Remove this record? This cannot be undone.")) return;
  target.disabled = true;
  const endpoint = removeAdmin ? `/api/admin/admins/${removeAdmin.dataset.removeAdmin}` : removeUser ? `/api/admin/users/${removeUser.dataset.removeUser}` : `/api/admin/moderation/updates/${removeContent.dataset.removeContent}`;
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { method: "DELETE", headers: headers() });
    const data = await readResponse(response);
    if (!response.ok) throw new Error(data.error || "Could not remove record");
    await loadData();
  } catch (error) { showMessage(error.message); target.disabled = false; }
});

verifyAdmin();
