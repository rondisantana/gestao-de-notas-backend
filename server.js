// Importação dos módulos necessários
const express = require("express");
const cors = require("cors");
// CORREÇÃO CRÍTICA DO LOWDB: Importa o adaptador do local correto para o Render
const { Low } = require("lowdb");
const { JSONFile } = require("lowdb/node"); // Importação que funciona com Render
const path = require("path"); // Necessário para usar o path.join()

// --- CONFIGURAÇÃO DA PERSISTÊNCIA ---
const app = express();
// Usa a porta fornecida pelo Render (process.env.PORT) ou 5000 localmente
const port = process.env.PORT || 5000;

// Configuração do LowDB
const file = path.join(__dirname, "db.json");

// Dados Padrão (para inicializar, se o arquivo db.json não existir)
const defaultData = {
  alunos: [
    { id: 1, nome: "João Silva", notas: [8.5, 7.0, 9.5] },
    { id: 2, nome: "Maria Oliveira", notas: [6.0, 7.5] },
  ],
  nextId: 3,
};

// CRÍTICO: Passamos o defaultData diretamente na inicialização do Low
const adapter = new JSONFile(file);
const db = new Low(adapter, defaultData);

// Função para inicializar o banco de dados
async function initializeDatabase() {
  await db.read();

  // Se o db.json existir, mas for inválido, garantimos o defaultData.
  db.data = db.data || defaultData;
  await db.write();
}

// Chama a função de inicialização
initializeDatabase().catch(console.error);

// Middlewares essenciais
// Configuração do CORS para o URL Vercel (process.env.CORS_ORIGIN) ou localhost
const allowedOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

// --- Definição das Rotas da API REST (GET e POST) ---
// CORREÇÃO FINAL: As rotas devem ser /api/alunos para combinar com o FRONT-END!

// Rota principal para verificar se o servidor está no ar
app.get("/", (req, res) => {
  res.send("Servidor Node.js para gestão de alunos está rodando!");
});

// [GET] /api/alunos - Retorna a lista de todos os alunos
app.get("/api/alunos", async (req, res) => {
  await db.read();
  const { alunos } = db.data;
  res.json(alunos);
});

// [POST] /api/alunos - Adiciona um novo aluno
app.post("/api/alunos", async (req, res) => {
  if (!req.body.nome || typeof req.body.nome !== "string") {
    return res
      .status(400)
      .json({ message: "O nome do aluno é obrigatório e deve ser um texto." });
  }

  await db.read();
  const alunos = db.data.alunos;

  const novoAluno = {
    id: db.data.nextId++,
    nome: req.body.nome,
    notas: [],
  };

  alunos.push(novoAluno);
  await db.write();

  res.status(201).json(novoAluno);
});

// --- Inicialização do Servidor ---
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
