const express = require("express");
const path = require("path");
const cors = require("cors");
const mysql = require("mysql2/promise");
const crypto = require("crypto");
const { promisify } = require("util");

const scrypt = promisify(crypto.scrypt);
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const PASSWORD_PEPPER = process.env.PASSWORD_PEPPER || "local-development-pepper-change-me";
const ADMIN_KEY = process.env.ADMIN_KEY || "local-workpulse-admin";
const ACCESS_ADMIN_ID = process.env.ACCESS_ADMIN_ID || "admin";
const ACCESS_ADMIN_PASSWORD = process.env.ACCESS_ADMIN_PASSWORD || "sameer.2005";

if (!process.env.PASSWORD_PEPPER) {
  console.warn("PASSWORD_PEPPER is not set; configure it before deploying to production.");
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derivedKey = await scrypt(
    `${password}\0${PASSWORD_PEPPER}`,
    salt,
    64,
    { N: SCRYPT_COST, r: SCRYPT_BLOCK_SIZE, p: SCRYPT_PARALLELIZATION }
  );

  const passwordHash = [
    "scrypt",
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
    derivedKey.toString("base64url")
  ].join("$");

  return { passwordHash, salt: salt.toString("base64url") };
}

async function verifyPassword(password, storedHash, encodedSalt) {
  const parts = storedHash.split("$");

  if (parts[0] !== "scrypt") {
    return false;
  }

  let cost;
  let blockSize;
  let parallelization;
  let encodedHash;

  if (parts.length === 5) {
    [, cost, blockSize, parallelization, encodedHash] = parts;
  } else if (parts.length === 6 && !encodedSalt) {
    [, cost, blockSize, parallelization, encodedSalt, encodedHash] = parts;
  } else {
    return false;
  }

  const salt = Buffer.from(encodedSalt, "base64url");
  const expectedHash = Buffer.from(encodedHash, "base64url");

  if (
    Number(cost) !== SCRYPT_COST ||
    Number(blockSize) !== SCRYPT_BLOCK_SIZE ||
    Number(parallelization) !== SCRYPT_PARALLELIZATION ||
    salt.length !== 16 ||
    expectedHash.length !== 64
  ) {
    return false;
  }

  const actualHash = await scrypt(
    `${password}\0${PASSWORD_PEPPER}`,
    salt,
    expectedHash.length,
    { N: Number(cost), r: Number(blockSize), p: Number(parallelization) }
  );

  return actualHash.length === expectedHash.length && crypto.timingSafeEqual(actualHash, expectedHash);
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

function hashAdminKey(adminKey) {
  return crypto.createHash("sha256").update(adminKey).digest("hex");
}

function hasAccessCredentials(req) {
  return req.get("x-access-admin-id") === ACCESS_ADMIN_ID
    && req.get("x-access-admin-password") === ACCESS_ADMIN_PASSWORD;
}

const app = express();
app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "landing.html"));
});

app.get("/access-management.html", (req, res) => {
  res.status(404).send("Start the separate access-management server with npm run start:access.");
});

app.use(express.static(__dirname));

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "sameer.2005",
  database: "app_db",
  waitForConnections: true,
  connectionLimit: 10
});

(async () => {
  try {
    const initConn = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "sameer.2005"
    });

    await initConn.query("CREATE DATABASE IF NOT EXISTS app_db");
    await initConn.query("USE app_db");
    await initConn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100),
        email VARCHAR(100) UNIQUE,
        password VARCHAR(255),
        salt VARCHAR(32)
      )
    `);

    try {
      await initConn.query("ALTER TABLE users ADD COLUMN salt VARCHAR(32) NULL");
    } catch (error) {
      if (error.code !== "ER_DUP_FIELDNAME") {
        throw error;
      }
    }

    await initConn.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        admin_id INT NULL,
        type ENUM('job', 'announcement', 'policy') NOT NULL,
        title VARCHAR(180) NOT NULL,
        body TEXT NOT NULL,
        department VARCHAR(100) NULL,
        location VARCHAR(120) NULL,
        deadline VARCHAR(80) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try {
      await initConn.query("ALTER TABLE announcements ADD COLUMN admin_id INT NULL");
    } catch (error) {
      if (error.code !== "ER_DUP_FIELDNAME") {
        throw error;
      }
    }

    await initConn.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        admin_key VARCHAR(255) NULL UNIQUE,
        admin_key_hash CHAR(64) NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try {
      await initConn.query("ALTER TABLE admins ADD COLUMN admin_key VARCHAR(255) NULL UNIQUE");
    } catch (error) {
      if (error.code !== "ER_DUP_FIELDNAME") {
        throw error;
      }
    }

    try {
      await initConn.query("ALTER TABLE admins MODIFY COLUMN admin_key_hash CHAR(64) NULL");
    } catch (error) {
      if (error.code !== "ER_BAD_FIELD_ERROR") {
        throw error;
      }
    }

    const [adminRows] = await initConn.query("SELECT id FROM admins LIMIT 1");
    if (adminRows.length === 0) {
      await initConn.query(
        "INSERT INTO admins (name, email, admin_key) VALUES (?, ?, ?)",
        ["Primary Admin", "admin@workpulse.local", ADMIN_KEY]
      );
    }

    await initConn.query(
      "UPDATE admins SET admin_key = ?, admin_key_hash = NULL WHERE email = ?",
      [ADMIN_KEY, "admin@workpulse.local"]
    );

    const [primaryAdminRows] = await initConn.query("SELECT id FROM admins ORDER BY id ASC LIMIT 1");
    if (primaryAdminRows.length > 0) {
      await initConn.query("UPDATE announcements SET admin_id = ? WHERE admin_id IS NULL", [primaryAdminRows[0].id]);
    }

    await initConn.end();
    console.log("MySQL database and users table are ready.");
  } catch (error) {
    console.error("MySQL setup failed:", error.message);
    process.exit(1);
  }
})();

app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "Name, email, and a password of at least 8 characters are required" });
  }

  try {
    const { passwordHash, salt } = await hashPassword(password);
    const [result] = await db.execute(
      "INSERT INTO users (name, email, password, salt) VALUES (?, ?, ?, ?)",
      [name, email, passwordHash, salt]
    );

    res.json({ success: true, userId: result.insertId });
  } catch (err) {
    res.status(400).json({ error: "Email already exists or DB error" });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || typeof password !== "string") {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const [rows] = await db.execute(
      "SELECT id, name, email, password, salt FROM users WHERE email = ?",
      [email]
    );

    if (rows.length === 0 || !(await verifyPassword(password, rows[0].password, rows[0].salt))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    res.json({ success: true, user: publicUser(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/google-auth", async (req, res) => {
  const { name, email, googleId } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Google email is required" });
  }

  try {
    const [existingUsers] = await db.execute("SELECT * FROM users WHERE email = ?", [email]);

    if (existingUsers.length > 0) {
      return res.json({ success: true, mode: "login", user: publicUser(existingUsers[0]) });
    }

    const { passwordHash, salt } = await hashPassword(`google_${googleId || Date.now()}`);
    const [result] = await db.execute(
      "INSERT INTO users (name, email, password, salt) VALUES (?, ?, ?, ?)",
      [name || "Google User", email, passwordHash, salt]
    );

    res.json({ success: true, mode: "register", userId: result.insertId });
  } catch (err) {
    res.status(500).json({ error: "Google authentication failed" });
  }
});

async function getAdmin(req) {
  const rawKey = req.get("x-admin-key");
  if (!rawKey) return null;

  const [rows] = await db.execute(
    "SELECT id, name, email FROM admins WHERE admin_key = ? OR (admin_key IS NULL AND admin_key_hash = ?)",
    [rawKey, hashAdminKey(rawKey)]
  );
  return rows[0] || null;
}

app.get("/api/updates", async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT id, type, title, body, department, location, deadline, created_at FROM announcements ORDER BY created_at DESC"
    );
    res.json({ updates: rows });
  } catch (error) {
    res.status(500).json({ error: "Could not load announcements" });
  }
});

app.get("/api/admin/updates", async (req, res) => {
  const admin = await getAdmin(req);
  if (!admin) {
    return res.status(401).json({ error: "Admin access required" });
  }

  try {
    const [rows] = await db.execute(
      "SELECT id, type, title, body, department, location, deadline, created_at FROM announcements WHERE admin_id = ? ORDER BY created_at DESC",
      [admin.id]
    );
    res.json({ updates: rows });
  } catch (error) {
    res.status(500).json({ error: "Could not load admin announcements" });
  }
});

app.post("/api/admin/updates", async (req, res) => {
  const admin = await getAdmin(req);
  if (!admin) {
    return res.status(401).json({ error: "Admin access required" });
  }

  const { type, title, body, department, location, deadline } = req.body;
  if (!['job', 'announcement', 'policy'].includes(type) || !title?.trim() || !body?.trim()) {
    return res.status(400).json({ error: "Type, title, and details are required" });
  }

  try {
    const [result] = await db.execute(
      "INSERT INTO announcements (admin_id, type, title, body, department, location, deadline) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [admin.id, type, title.trim(), body.trim(), department?.trim() || null, location?.trim() || null, deadline?.trim() || null]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: "Could not publish announcement" });
  }
});

app.delete("/api/admin/updates/:id", async (req, res) => {
  const admin = await getAdmin(req);
  if (!admin) {
    return res.status(401).json({ error: "Admin access required" });
  }

  try {
    const [result] = await db.execute("DELETE FROM announcements WHERE id = ? AND admin_id = ?", [req.params.id, admin.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Announcement not found" });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Could not remove announcement" });
  }
});

app.get("/api/admin/profile", async (req, res) => {
  const admin = await getAdmin(req);
  if (!admin) {
    return res.status(401).json({ error: "Admin access required" });
  }
  res.json({ admin });
});

app.get("/api/admin/access-profile", async (req, res) => {
  if (!hasAccessCredentials(req)) {
    return res.status(401).json({ error: "Access-management authentication required" });
  }
  res.json({ admin: { name: "Access administrator", email: ACCESS_ADMIN_ID } });
});

app.get("/api/admin/admins", async (req, res) => {
  if (!await getAdmin(req) && !hasAccessCredentials(req)) {
    return res.status(401).json({ error: "Admin access required" });
  }

  try {
    const [rows] = await db.execute(
      "SELECT id, name, email, created_at FROM admins ORDER BY created_at ASC"
    );
    res.json({ admins: rows });
  } catch (error) {
    res.status(500).json({ error: "Could not load administrators" });
  }
});

app.post("/api/admin/admins", async (req, res) => {
  if (!await getAdmin(req)) {
    return res.status(401).json({ error: "Admin access required" });
  }

  const { name, email, adminKey } = req.body;
  if (!name?.trim() || !email?.trim() || typeof adminKey !== "string" || adminKey.length < 8) {
    return res.status(400).json({ error: "Name, email, and an admin key of at least 8 characters are required" });
  }

  try {
    const [result] = await db.execute(
      "INSERT INTO admins (name, email, admin_key) VALUES (?, ?, ?)",
      [name.trim(), email.trim().toLowerCase(), adminKey]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "That admin email or key is already in use" });
    }
    res.status(500).json({ error: "Could not add administrator" });
  }
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});

app.get("/api/admin/users", async (req, res) => {
  if (!hasAccessCredentials(req)) {
    return res.status(401).json({ error: "Admin access required" });
  }

  try {
    const [rows] = await db.execute("SELECT id, name, email FROM users ORDER BY id DESC");
    res.json({ users: rows });
  } catch (error) {
    res.status(500).json({ error: "Could not load users" });
  }
});

app.get("/api/admin/moderation/updates", async (req, res) => {
  if (!hasAccessCredentials(req)) {
    return res.status(401).json({ error: "Admin access required" });
  }

  try {
    const [rows] = await db.execute(`
      SELECT announcements.id, announcements.type, announcements.title, announcements.body,
        announcements.department, announcements.location, announcements.deadline,
        announcements.created_at, admins.name AS admin_name
      FROM announcements
      LEFT JOIN admins ON admins.id = announcements.admin_id
      ORDER BY announcements.created_at DESC
    `);
    res.json({ updates: rows });
  } catch (error) {
    res.status(500).json({ error: "Could not load moderation content" });
  }
});

app.delete("/api/admin/admins/:id", async (req, res) => {
  if (!hasAccessCredentials(req)) {
    return res.status(401).json({ error: "Admin access required" });
  }
  if (Number(req.params.id) === 1) {
    return res.status(400).json({ error: "The primary administrator cannot be removed" });
  }

  try {
    const [result] = await db.execute("DELETE FROM admins WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Administrator not found" });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Could not remove administrator" });
  }
});

app.delete("/api/admin/users/:id", async (req, res) => {
  if (!hasAccessCredentials(req)) {
    return res.status(401).json({ error: "Admin access required" });
  }

  try {
    const [result] = await db.execute("DELETE FROM users WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Could not remove user" });
  }
});

app.delete("/api/admin/moderation/updates/:id", async (req, res) => {
  if (!hasAccessCredentials(req)) {
    return res.status(401).json({ error: "Admin access required" });
  }

  try {
    const [result] = await db.execute("DELETE FROM announcements WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Content not found" });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Could not remove content" });
  }
});