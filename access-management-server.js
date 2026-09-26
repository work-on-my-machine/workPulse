const express = require("express");
const path = require("path");

const app = express();
const projectDirectory = __dirname;
const port = Number(process.env.ACCESS_MANAGEMENT_PORT) || 3001;

app.get(["/", "/access-management.html"], (req, res) => {
  res.sendFile(path.join(projectDirectory, "access-management.html"));
});

for (const asset of ["access-management.js", "style.css", "admin.css"]) {
  app.get(`/${asset}`, (req, res) => {
    res.sendFile(path.join(projectDirectory, asset));
  });
}

app.listen(port, () => {
  console.log(`Access management page running on http://localhost:${port}`);
});