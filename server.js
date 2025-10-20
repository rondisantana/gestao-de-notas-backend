// Importação dos módulos necessários
const express = require("express");
const cors = require("cors");
// CORREÇÃO CRÍTICA DO LOWDB: Agora importa a base Low e o adaptador JSONFile corretamente para o Render
const { Low } = require("lowdb");
const { JSONFile } = require("lowdb/node");
const path = require("path");

// --- CONFIGURAÇÃO DA PERSISTÊNCIA ---
// O Render e outras plataformas de nuvem definem a porta via variável de ambiente.
const port = process.env.PORT || 5000;
const app = express();

// Configuração do LowDB para persistência de dados
const file = path.join(__dirname, "db.json");
const adapter = new JSONFile(file);
const db = new Low(adapter); // Inicialização simples do db

// Função para inicializar o banco de dados com valores padrão
async function initializeDatabase() {
  await db.read(); // Lê o estado atual do banco de dados

  // Dados Padrão (necessários se db.json não existir)
  const defaultData = {
    alunos: [
      { id: 1, nome: "João Silva", notas: [8.5, 7.0, 9.5] },
      { id: 2, nome: "Maria Oliveira", notas: [6.0, 7.5] },
    ],
    nextId: 3,
  };

  // Se não houver dados, inicializa com o defaultData
  db.data = db.data || defaultData;
  await db.write(); // Salva o estado inicial
}

// Chama a função de inicialização, garantindo que ela rode antes do listen
initializeDatabase().catch(console.error);

// Middlewares essenciais
// Configuração do CORS para o Vercel ou localhost
const allowedOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
app.use(cors({ origin: allowedOrigin }));
app.use(express.json()); // Habilita o parsing de JSON

// --- Definição das Rotas da API REST ---

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
