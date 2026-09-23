// Get elements from HTML
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const switchButton = document.getElementById("switch-button");
const switchText = document.getElementById("switch-text");
const formTitle = document.getElementById("form-title");
const formSubtitle = document.getElementById("form-subtitle");
const googleAuthButton = document.getElementById("google-auth-button");

const GOOGLE_CLIENT_ID = window.GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";

// Current form
let isLogin = true;

function updateForm() {
  if (isLogin) {
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
    formTitle.textContent = "Welcome Back";
    formSubtitle.textContent = "Login to continue to your account";
    switchText.textContent = "Don't have an account?";
    switchButton.textContent = "Create Account";
  } else {
    loginForm.classList.add("hidden");
    registerForm.classList.remove("hidden");
    formTitle.textContent = "Create Account";
    formSubtitle.textContent = "Create a new account to get started";
    switchText.textContent = "Already have an account?";
    switchButton.textContent = "Login";
  }
}

function loadGoogleScript() {
  if (window.google && window.google.accounts) {
    return;
  }

  const existingScript = document.querySelector("script[src='https://accounts.google.com/gsi/client']");
  if (existingScript) {
    return;
  }

  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  script.async = true;
  script.defer = true;
  script.onload = () => {
    if (window.google && window.google.accounts) {
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredentialResponse
      });
    }
  };
  document.head.appendChild(script);
}

function isGoogleClientConfigured() {
  return !!GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.includes("YOUR_GOOGLE_CLIENT_ID");
}

async function handleGoogleCredentialResponse(response) {
  if (!response || !response.credential) {
    alert("Google login was cancelled.");
    return;
  }

  if (!isGoogleClientConfigured()) {
    alert("Add your real Google Client ID in index.html to enable Continue with Google.");
    return;
  }

  try {
    const payload = JSON.parse(atob(response.credential.split(".")[1]));

    const res = await fetch("http://localhost:3000/api/google-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: payload.name || payload.email?.split("@")[0] || "Google User",
        email: payload.email,
        googleId: payload.sub
      })
    });

    const data = await res.json();

    if (res.ok) {
      alert(`Google ${data.mode === "register" ? "registration" : "login"} successful!`);
    } else {
      alert(data.error || "Google authentication failed");
    }
  } catch (error) {
    console.error("Google auth failed:", error);
    alert("Something went wrong with Google authentication.");
  }
}

// Switch between Login and Register
switchButton.addEventListener("click", function () {
  isLogin = !isLogin;
  updateForm();
});

googleAuthButton.addEventListener("click", function () {
  if (!isGoogleClientConfigured()) {
    alert("Add your real Google Client ID in index.html to enable Continue with Google.");
    return;
  }

  loadGoogleScript();

  if (window.google && window.google.accounts) {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredentialResponse
    });
    google.accounts.id.prompt();
  }
});

// Login form
loginForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  const response = await fetch("http://localhost:3000/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();

  if (response.ok) {
    alert("Login successful!");
  } else {
    alert(data.error || "Login failed");
  }
});

// Register form
registerForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const name = document.getElementById("name").value;
  const email = document.getElementById("register-email").value;
  const password = document.getElementById("register-password").value;
  const confirmPassword = document.getElementById("confirm-password").value;

  if (password !== confirmPassword) {
    alert("Passwords do not match!");
    return;
  }

  const response = await fetch("http://localhost:3000/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password })
  });

  const data = await response.json();

  if (response.ok) {
    alert("Account created successfully!");
  } else {
    alert(data.error || "Registration failed");
  }
});

updateForm();
