const form = document.getElementById("register-form");
const message = document.getElementById("form-message");
const submitButton = form.querySelector("button[type='submit']");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.className = "form-message";
  message.textContent = "";

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirm-password").value;
  const termsAccepted = document.getElementById("terms").checked;

  if (!name || !email || !password || !confirmPassword) {
    message.textContent = "Please complete all fields.";
    return;
  }
  if (password.length < 8) {
    message.textContent = "Your password must be at least 8 characters.";
    return;
  }
  if (password !== confirmPassword) {
    message.textContent = "Passwords do not match.";
    return;
  }
  if (!termsAccepted) {
    message.textContent = "Please agree to receive WorkPulse updates.";
    return;
  }

  submitButton.disabled = true;
  submitButton.innerHTML = "Creating account...";

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Registration failed. Please try again.");
    }

    message.className = "form-message success";
    message.textContent = "Account created. Taking you to your dashboard...";
    localStorage.setItem("workpulse-user", JSON.stringify({ name, email }));
    form.reset();
    window.setTimeout(() => { window.location.href = "index.html"; }, 900);
  } catch (error) {
    message.textContent = error.message;
    submitButton.disabled = false;
    submitButton.innerHTML = "Create my account <span>→</span>";
  }
});
