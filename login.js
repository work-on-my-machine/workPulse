const form = document.getElementById("login-form");
const message = document.getElementById("form-message");
const submitButton = form.querySelector("button[type='submit']");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.className = "form-message";
  message.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    message.textContent = "Please enter your email and password.";
    return;
  }

  submitButton.disabled = true;
  submitButton.innerHTML = "Signing in...";

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to sign in. Please try again.");
    }

    localStorage.setItem("workpulse-user", JSON.stringify(data.user));
    message.className = "form-message success";
    message.textContent = "Signed in. Opening your dashboard...";
    window.setTimeout(() => { window.location.href = "index.html"; }, 600);
  } catch (error) {
    message.textContent = error.message;
    submitButton.disabled = false;
    submitButton.innerHTML = "Sign in <span>→</span>";
  }
});
