# Better In Me

Better In Me is a personal journal for capturing thoughts and small moments. Sign in or create an account before opening the journal. MySQL stores accounts and entries, with each account's journal isolated from other accounts.

## What it does

- Write, edit, and delete dated journal entries.
- Add a mood to each entry and mark favorites.
- Search entries by title, text, or mood.
- Export a JSON backup and import it later. Importing merges entries by ID.
- Create an account with a unique username and a password stored as a salted scrypt hash.
- Sign in with an HTTP-only session cookie and sign out when finished.
- Store journal entries in MySQL, scoped to the signed-in account.

## Run locally

Requirements: Node.js 18 or newer and a running MySQL server.

```powershell
npm install
Copy-Item .env.example .env
# Edit .env with your MySQL username and password.
npm start
```

Open `http://localhost:3000/` to see the animated Better In Me intro, which continues to sign-in automatically. Create a unique username, then use it to sign in. Set `PORT` to use another port. The MySQL account must be able to create the configured database and tables, or the database must already exist and the account must be able to create tables in it.

## Your data

MySQL connection settings are read from `.env`: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_DATABASE`. The `.env` file is excluded from Git. Passwords are stored as salted scrypt hashes, never as plaintext. Passwords are not required to be globally unique; avoid reusing them across services. Use **Export backup** to download a copy and **Import backup** to restore or merge a copy into the signed-in account. This version binds to localhost and is not configured for public hosting.

## Project files

- `welcome.html`, `welcome.css`, and `welcome.js`: animated startup intro.
- `signin.html`, `auth.css`, and `auth.js`: sign-in and account creation.
- `index.html`, `journal.css`, and `journal.js`: authenticated journal experience.
- `mysql-server.js`: MySQL database setup, authentication, sessions, and journal APIs.
- `data/better-in-me.sqlite`: unused legacy SQLite file from the earlier local-only version; the app no longer reads or writes it.
- `package.json`: start command and Express dependency.
