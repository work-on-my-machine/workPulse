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

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

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

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});