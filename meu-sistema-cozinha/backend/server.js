const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const xlsx = require("xlsx");
const path = require("path");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Banco SQLite
const db = new sqlite3.Database("./cozinha.db", (err) => {
  if (err) console.error("Erro ao abrir DB:", err);
  else console.log("✅ Banco conectado!");
});

// Tabelas
db.run(`CREATE TABLE IF NOT EXISTS produtos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT UNIQUE
)`);
db.run(`CREATE TABLE IF NOT EXISTS consumos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  produto TEXT,
  quantidade REAL,
  unidade TEXT,
  data TEXT
)`);

// --- Rotas API ---
// Produtos
app.get("/api/produtos", (req, res) => {
  db.all("SELECT * FROM produtos", [], (err, rows) => res.json(rows));
});

app.post("/api/produtos", (req, res) => {
  const { nome } = req.body;
  db.run("INSERT INTO produtos (nome) VALUES (?)", [nome], function (err) {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ id: this.lastID, nome });
  });
});

// Consumos
app.post("/api/consumos", (req, res) => {
  const { produto, quantidade, unidade, data } = req.body;
  db.run(
    "INSERT INTO consumos (produto, quantidade, unidade, data) VALUES (?,?,?,?)",
    [produto, quantidade, unidade, data],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });
      res.json({ id: this.lastID, produto, quantidade, unidade, data });
    }
  );
});

app.get("/api/consumos", (req, res) => {
  db.all("SELECT * FROM consumos ORDER BY data DESC", [], (err, rows) =>
    res.json(rows)
  );
});

// Dashboard
app.get("/api/dashboard", (req, res) => {
  const { inicio, fim } = req.query;
  let query = `
    SELECT produto, unidade, strftime('%W', data) as semana,
           SUM(quantidade) as total
    FROM consumos
  `;
  let params = [];

  if (inicio && fim) {
    query += " WHERE date(data) BETWEEN date(?) AND date(?) ";
    params.push(inicio, fim);
  }

  query += " GROUP BY produto, unidade, semana ORDER BY produto;";

  db.all(query, params, (err, rows) => res.json(rows));
});

// Exportar Excel
app.get("/api/exportar", (req, res) => {
  db.all("SELECT * FROM consumos", [], (err, rows) => {
    const ws = xlsx.utils.json_to_sheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Consumos");
    const filename = "relatorio.xlsx";
    xlsx.writeFile(wb, filename);
    res.download(filename);
  });
});

// --- Servir Frontend buildado ---
app.use(express.static(path.join(__dirname, "../frontend/dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
