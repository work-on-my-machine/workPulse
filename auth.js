let mode = "signin";

const form = document.getElementById("auth-form");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const confirmInput = document.getElementById("confirm-password");
const errorMessage = document.getElementById("auth-error");
const confirmField = document.getElementById("confirm-field");

function setMode(nextMode) {
  mode = nextMode;
  const registering = mode === "register";
  document.getElementById("signin-tab").classList.toggle("active", !registering);
  document.getElementById("register-tab").classList.toggle("active", registering);
  document.getElementById("signin-tab").setAttribute("aria-selected", String(!registering));
  document.getElementById("register-tab").setAttribute("aria-selected", String(registering));
  document.getElementById("form-eyebrow").textContent = registering ? "Start with a space of your own" : "Your journal is waiting";
  document.getElementById("form-heading").textContent = registering ? "Make it yours." : "Welcome back.";
  document.getElementById("form-subtitle").textContent = registering ? "Create your account to begin." : "Sign in to continue where you left off.";
  document.getElementById("submit-button").innerHTML = `${registering ? "Create account" : "Sign in"} <span aria-hidden="true">↗</span>`;
  document.getElementById("auth-footnote").textContent = registering
    ? "Choose a username no one else has. Your password is stored as a secure hash."
    : "Your writing is linked to your account and stored in this app’s database.";
  confirmField.classList.toggle("hidden", !registering);
  passwordInput.autocomplete = registering ? "new-password" : "current-password";
  errorMessage.classList.add("hidden");
  errorMessage.textContent = "";
}

document.getElementById("signin-tab").addEventListener("click", () => setMode("signin"));
document.getElementById("register-tab").addEventListener("click", () => setMode("register"));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorMessage.classList.add("hidden");
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (mode === "register" && password !== confirmInput.value) {
    errorMessage.textContent = "Those passwords don’t match.";
    errorMessage.classList.remove("hidden");
    confirmInput.focus();
    return;
  }

  const submitButton = document.getElementById("submit-button");
  submitButton.disabled = true;
  try {
    const response = await fetch(`/api/${mode === "register" ? "register" : "login"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not sign in.");
    window.location.replace("/journal");
  } catch (error) {
    errorMessage.textContent = error.message || "Could not reach the server. Try again.";
    errorMessage.classList.remove("hidden");
  } finally {
    submitButton.disabled = false;
  }
});