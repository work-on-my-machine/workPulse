require("dotenv").config();

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { promisify } = require("util");
const mysql = require("mysql2/promise");

const app = express();
const port = Number(process.env.PORT) || 3000;
const databaseName = process.env.MYSQL_DATABASE || "better_in_me";
const SESSION_COOKIE = "better_in_me_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_HASH_BYTES = 64;
const scrypt = promisify(crypto.scrypt);
const moods = new Set(["Calm", "Good", "Mixed", "Low", "Grateful"]);
const workoutMuscleGroups = new Set(["Chest", "Back", "Traps", "Shoulders", "Rotator cuff", "Biceps", "Triceps", "Forearms", "Core", "Quadriceps", "Hamstrings", "Adductors", "Abductors", "Glutes", "Calves", "Tibialis", "Neck", "Full body"]);
const mysqlConfig = {
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4"
};

if (!/^[a-zA-Z0-9_]{1,64}$/.test(databaseName)) {
  throw new Error("MYSQL_DATABASE may contain only letters, numbers, and underscores.");
}

let database;
const dummySalt = crypto.randomBytes(16);
const dummyHash = crypto.scryptSync("not-a-real-user-password", dummySalt, PASSWORD_HASH_BYTES, { N: 16384, r: 8, p: 1 }).toString("base64url");
const DUMMY_PASSWORD_HASH = `scrypt$${dummySalt.toString("base64url")}$${dummyHash}`;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function readSessionToken(req) {
  const cookies = (req.headers.cookie || "").split(";").map((cookie) => cookie.trim());
  const sessionCookie = cookies.find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
  if (!sessionCookie) return null;
  try {
    return decodeURIComponent(sessionCookie.slice(SESSION_COOKIE.length + 1));
  } catch {
    return null;
  }
}

async function getSessionUser(req) {
  const token = readSessionToken(req);
  if (!token) return null;
  const [rows] = await database.execute(`
    SELECT users.id, users.username
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `, [hashToken(token), Math.floor(Date.now() / 1000)]);
  return rows[0] || null;
}

async function requireUser(req, res, next) {
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Sign in to continue." });
  req.user = user;
  next();
}

async function requirePageUser(req, res, next) {
  const user = await getSessionUser(req);
  if (!user) return res.redirect("/signin");
  req.user = user;
  next();
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}${secure}`);
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
}

async function createSession(userId, res) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  await database.execute("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)", [hashToken(token), userId, expiresAt]);
  setSessionCookie(res, token);
}

function normalizeUsername(value) {
  if (typeof value !== "string") return null;
  const username = value.trim().toLowerCase();
  return /^[a-z0-9._-]{3,32}$/.test(username) ? username : null;
}

function validPassword(value) {
  return typeof value === "string" && value.length >= 8 && value.length <= 128;
}

async function makePasswordHash(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, PASSWORD_HASH_BYTES, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

async function verifyPassword(password, storedHash) {
  const [algorithm, encodedSalt, encodedHash] = storedHash.split("$");
  if (algorithm !== "scrypt" || !encodedSalt || !encodedHash) return false;
  const salt = Buffer.from(encodedSalt, "base64url");
  const expected = Buffer.from(encodedHash, "base64url");
  if (salt.length !== 16 || expected.length !== PASSWORD_HASH_BYTES) return false;
  const actual = await scrypt(password, salt, expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(actual, expected);
}

function validEntry(entry) {
  return entry && typeof entry.id === "string" && entry.id.length > 0 && entry.id.length <= 100
    && typeof entry.title === "string" && entry.title.length <= 100
    && typeof entry.body === "string" && entry.body.trim().length > 0 && entry.body.length <= 10000
    && moods.has(entry.mood) && typeof entry.favorite === "boolean"
    && Number.isFinite(Date.parse(entry.createdAt)) && Number.isFinite(Date.parse(entry.updatedAt));
}

function publicEntry(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    mood: row.mood,
    favorite: Boolean(row.favorite),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

app.use(express.json({ limit: "5mb" }));
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.get("/", async (req, res) => {
  if (await getSessionUser(req)) return res.redirect("/journal");
  res.sendFile(path.join(__dirname, "welcome.html"));
});
app.get("/signin", async (req, res) => {
  if (await getSessionUser(req)) return res.redirect("/journal");
  res.sendFile(path.join(__dirname, "signin.html"));
});
app.get("/signin.html", (req, res) => res.redirect("/signin"));
app.get("/journal", requirePageUser, (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/index.html", async (req, res) => res.redirect(await getSessionUser(req) ? "/journal" : "/signin"));
app.get("/journal.css", (req, res) => res.sendFile(path.join(__dirname, "journal.css")));
app.get("/journal.js", (req, res) => res.sendFile(path.join(__dirname, "journal.js")));
app.get("/auth.css", (req, res) => res.sendFile(path.join(__dirname, "auth.css")));
app.get("/auth.js", (req, res) => res.sendFile(path.join(__dirname, "auth.js")));
app.get("/welcome.css", (req, res) => res.sendFile(path.join(__dirname, "welcome.css")));
app.get("/welcome.js", (req, res) => res.sendFile(path.join(__dirname, "welcome.js")));

app.get("/api/session", async (req, res) => {
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Sign in to continue." });
  res.json({ user });
});

app.post("/api/register", async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = req.body?.password;
  if (!username) return res.status(400).json({ error: "Username must be 3–32 characters using letters, numbers, dots, dashes, or underscores." });
  if (!validPassword(password)) return res.status(400).json({ error: "Password must be between 8 and 128 characters." });

  try {
    const passwordHash = await makePasswordHash(password);
    const [result] = await database.execute("INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)", [username, passwordHash, new Date().toISOString()]);
    const userId = Number(result.insertId);
    await createSession(userId, res);
    res.status(201).json({ user: { id: userId, username } });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "That username is already taken. Choose another." });
    console.error("Account creation failed:", error.message);
    res.status(500).json({ error: "Could not create your account." });
  }
});

app.post("/api/login", async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = req.body?.password;
  if (!username || !validPassword(password)) return res.status(401).json({ error: "Username or password is incorrect." });

  const [rows] = await database.execute("SELECT id, username, password_hash FROM users WHERE username = ?", [username]);
  const user = rows[0] || null;
  const matches = await verifyPassword(password, user?.password_hash || DUMMY_PASSWORD_HASH);
  if (!user || !matches) return res.status(401).json({ error: "Username or password is incorrect." });

  await database.execute("DELETE FROM sessions WHERE expires_at <= ?", [Math.floor(Date.now() / 1000)]);
  await createSession(user.id, res);
  res.json({ user: { id: user.id, username: user.username } });
});

app.post("/api/logout", async (req, res) => {
  const token = readSessionToken(req);
  if (token) await database.execute("DELETE FROM sessions WHERE token_hash = ?", [hashToken(token)]);
  clearSessionCookie(res);
  res.json({ success: true });
});

app.get("/api/entries", requireUser, async (req, res) => {
  const [rows] = await database.execute(`
    SELECT id, title, body, mood, favorite, created_at, updated_at
    FROM entries WHERE user_id = ? ORDER BY updated_at DESC
  `, [req.user.id]);
  res.json({ entries: rows.map(publicEntry) });
});

app.post("/api/entries", requireUser, async (req, res) => {
  const { title = "", body, mood = "Good" } = req.body || {};
  if (typeof title !== "string" || title.length > 100 || typeof body !== "string" || !body.trim() || body.length > 10000 || !moods.has(mood)) {
    return res.status(400).json({ error: "Add a journal entry with a valid mood." });
  }

  const now = new Date().toISOString();
  const entry = { id: crypto.randomUUID(), title: title.trim(), body: body.trim(), mood, favorite: false, createdAt: now, updatedAt: now };
  await database.execute(`
    INSERT INTO entries (user_id, id, title, body, mood, favorite, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?)
  `, [req.user.id, entry.id, entry.title, entry.body, entry.mood, now, now]);
  res.status(201).json({ entry });
});

app.put("/api/entries/:id", requireUser, async (req, res) => {
  const { title, body, mood, favorite } = req.body || {};
  if (typeof title !== "string" || title.length > 100 || typeof body !== "string" || !body.trim() || body.length > 10000 || !moods.has(mood) || typeof favorite !== "boolean") {
    return res.status(400).json({ error: "Entry details are invalid." });
  }
  const updatedAt = new Date().toISOString();
  const [result] = await database.execute(`
    UPDATE entries SET title = ?, body = ?, mood = ?, favorite = ?, updated_at = ?
    WHERE user_id = ? AND id = ?
  `, [title.trim(), body.trim(), mood, Number(favorite), updatedAt, req.user.id, req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ error: "Entry not found." });
  const [rows] = await database.execute(`
    SELECT id, title, body, mood, favorite, created_at, updated_at FROM entries WHERE user_id = ? AND id = ?
  `, [req.user.id, req.params.id]);
  res.json({ entry: publicEntry(rows[0]) });
});

app.delete("/api/entries/:id", requireUser, async (req, res) => {
  const [result] = await database.execute("DELETE FROM entries WHERE user_id = ? AND id = ?", [req.user.id, req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ error: "Entry not found." });
  res.json({ success: true });
});

app.post("/api/entries/import", requireUser, async (req, res) => {
  const importedEntries = Array.isArray(req.body?.entries) ? req.body.entries : null;
  if (!importedEntries || importedEntries.length > 5000 || !importedEntries.every(validEntry)) {
    return res.status(400).json({ error: "This file is not a valid Better In Me backup." });
  }

  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    for (const entry of importedEntries) {
      await connection.execute(`
        INSERT INTO entries (user_id, id, title, body, mood, favorite, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE title = VALUES(title), body = VALUES(body), mood = VALUES(mood),
          favorite = VALUES(favorite), updated_at = VALUES(updated_at)
      `, [req.user.id, entry.id, entry.title, entry.body, entry.mood, Number(entry.favorite), entry.createdAt, entry.updatedAt]);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  res.json({ imported: importedEntries.length });
});

app.get("/api/workouts", requireUser, async (req, res) => {
  const [rows] = await database.execute(`
    SELECT id, muscle_group, exercise, sets, reps, weight, weight_unit, notes,
      DATE_FORMAT(performed_at, '%Y-%m-%d') AS performed_at
    FROM workouts WHERE user_id = ? ORDER BY performed_at DESC, created_at DESC
  `, [req.user.id]);
  res.json({ workouts: rows.map((row) => ({
    id: row.id,
    muscleGroup: row.muscle_group,
    exercise: row.exercise,
    sets: row.sets,
    reps: row.reps,
    weight: Number(row.weight),
    weightUnit: row.weight_unit,
    notes: row.notes,
    performedAt: row.performed_at
  })) });
});

app.post("/api/workouts", requireUser, async (req, res) => {
  const { muscleGroup, exercise, sets, reps, weight, weightUnit, notes = "", performedAt } = req.body || {};
  if (!workoutMuscleGroups.has(muscleGroup) || typeof exercise !== "string" || !exercise.trim() || exercise.length > 100
    || !Number.isInteger(sets) || sets < 1 || sets > 20 || !Number.isInteger(reps) || reps < 1 || reps > 100
    || typeof weight !== "number" || !Number.isFinite(weight) || weight < 0 || weight > 9999
    || !["kg", "lb"].includes(weightUnit) || typeof notes !== "string" || notes.length > 500
    || typeof performedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(performedAt) || !Number.isFinite(Date.parse(`${performedAt}T00:00:00Z`))) {
    return res.status(400).json({ error: "Workout details are invalid." });
  }

  const id = crypto.randomUUID();
  const createdAt = new Date();
  await database.execute(`
    INSERT INTO workouts (user_id, id, muscle_group, exercise, sets, reps, weight, weight_unit, notes, performed_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [req.user.id, id, muscleGroup, exercise.trim(), sets, reps, weight, weightUnit, notes.trim(), performedAt, createdAt]);
  res.status(201).json({ workout: { id, muscleGroup, exercise: exercise.trim(), sets, reps, weight, weightUnit, notes: notes.trim(), performedAt } });
});

app.delete("/api/workouts/:id", requireUser, async (req, res) => {
  const [result] = await database.execute("DELETE FROM workouts WHERE user_id = ? AND id = ?", [req.user.id, req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ error: "Workout not found." });
  res.json({ success: true });
});

app.use((error, req, res, next) => {
  console.error("Request failed:", error.message);
  if (res.headersSent) return next(error);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

async function initializeDatabase() {
  const bootstrapConnection = await mysql.createConnection({
    host: mysqlConfig.host,
    port: mysqlConfig.port,
    user: mysqlConfig.user,
    password: mysqlConfig.password
  });
  try {
    await bootstrapConnection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } catch (error) {
    if (error.code !== "ER_DBACCESS_DENIED_ERROR") throw error;
  } finally {
    await bootstrapConnection.end();
  }

  database = mysql.createPool({ ...mysqlConfig, database: databaseName });
  await database.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(32) COLLATE utf8mb4_unicode_ci NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at VARCHAR(35) NOT NULL
    ) ENGINE=InnoDB
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash CHAR(64) NOT NULL PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      expires_at BIGINT UNSIGNED NOT NULL,
      KEY sessions_expiry_idx (expires_at),
      CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS entries (
      user_id BIGINT UNSIGNED NOT NULL,
      id VARCHAR(100) NOT NULL,
      title VARCHAR(100) NOT NULL DEFAULT '',
      body TEXT NOT NULL,
      mood VARCHAR(16) NOT NULL,
      favorite TINYINT(1) NOT NULL DEFAULT 0,
      created_at VARCHAR(35) NOT NULL,
      updated_at VARCHAR(35) NOT NULL,
      PRIMARY KEY (user_id, id),
      KEY entries_user_date_idx (user_id, updated_at),
      CONSTRAINT entries_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);
  await database.query(`
    CREATE TABLE IF NOT EXISTS workouts (
      user_id BIGINT UNSIGNED NOT NULL,
      id CHAR(36) NOT NULL,
      muscle_group VARCHAR(32) NOT NULL,
      exercise VARCHAR(100) NOT NULL,
      sets SMALLINT UNSIGNED NOT NULL,
      reps SMALLINT UNSIGNED NOT NULL,
      weight DECIMAL(8, 2) NOT NULL DEFAULT 0,
      weight_unit VARCHAR(2) NOT NULL DEFAULT 'kg',
      notes VARCHAR(500) NOT NULL DEFAULT '',
      performed_at DATE NOT NULL,
      created_at DATETIME NOT NULL,
      PRIMARY KEY (user_id, id),
      KEY workouts_user_date_idx (user_id, performed_at),
      CONSTRAINT workouts_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);
}

initializeDatabase().then(() => {
  app.listen(port, "127.0.0.1", () => {
    console.log(`Better In Me is ready at http://localhost:${port} using MySQL database ${databaseName}`);
  });
}).catch((error) => {
  if (error.code === "ER_ACCESS_DENIED_ERROR") {
    console.error("MySQL rejected the configured credentials. Check MYSQL_USER and MYSQL_PASSWORD in your local .env file.");
  } else {
    console.error("Could not connect to or initialize MySQL:", error.message);
  }
  process.exitCode = 1;
});
