// Importação dos módulos necessários
const express = require("express");
const cors = require("cors");
const path = require("path"); // Necessário para manipulação de caminhos

// --- CONFIGURAÇÃO DA PERSISTÊNCIA (usando LowDB V3 para async/await) ---
// A LowDB V3 usa `JSONFile` e `Low`
const { Low } = require("lowdb");
const { JSONFile } = require("lowdb/node");

// Define o caminho do arquivo db.json
const file = path.join(__dirname, "db.json");

// Dados Padrão para inicializar o banco de dados
const defaultData = {
  // Atualizando o modelo de dados para suportar a nova estrutura de DISCIPLINAS
  alunos: [
    {
      id: 1,
      nome: "João Silva",
      disciplinas: [{ nome: "Matemática", notas: [8.5, 7.0] }],
    },
    {
      id: 2,
      nome: "Maria Oliveira",
      disciplinas: [{ nome: "Português", notas: [6.0, 7.5] }],
    },
  ],
  nextId: 3,
};

// CRÍTICO: Inicializamos o LowDB. O adapter é o 'JSONFile'.
const adapter = new JSONFile(file);
const db = new Low(adapter, defaultData);

// Função para garantir que o banco de dados esteja lido e escrito (se for a primeira vez)
async function initializeDatabase() {
  await db.read();
  // Garante que db.data existe e, se estiver vazio/inválido, usa os dados padrão.
  db.data = db.data || defaultData;
  await db.write();
}

// Chama a função de inicialização
initializeDatabase().catch(console.error);
// --- FIM DA CONFIGURAÇÃO DA PERSISTÊNCIA ---

// --- CONFIGURAÇÃO GERAL DO SERVIDOR ---
const app = express();
// Usa a porta fornecida pelo Render (process.env.PORT) ou 5000 localmente
const port = process.env.PORT || 5000;

// Middlewares essenciais
// Configuração do CORS para o URL Vercel (process.env.CORS_ORIGIN) ou localhost
const allowedOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

// --- Definição das Rotas da API REST ---

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

  // Novo modelo deve inicializar disciplinas como um array vazio
  const novoAluno = {
    id: db.data.nextId++,
    nome: req.body.nome,
    disciplinas: [], // <-- AQUI A MUDANÇA MAIS IMPORTANTE
  };

  alunos.push(novoAluno);
  await db.write();

  res.status(201).json(novoAluno);
});

// [DELETE] /api/alunos/:id - Exclui um aluno
app.delete("/api/alunos/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.read();

  const initialLength = db.data.alunos.length;
  db.data.alunos = db.data.alunos.filter((aluno) => aluno.id !== id);

  if (db.data.alunos.length === initialLength) {
    return res.status(404).json({ message: "Aluno não encontrado." });
  }

  await db.write();
  res.status(204).send();
});

// =========================================================
// NOVOS ENDPOINTS DO CAPÍTULO 7 (Disciplinas e Notas)
// =========================================================

// [POST] /api/alunos/:id/disciplinas - Adiciona uma disciplina a um aluno
app.post("/api/alunos/:id/disciplinas", async (req, res) => {
  await db.read();
  const alunoId = parseInt(req.params.id);
  const aluno = db.data.alunos.find((a) => a.id === alunoId);

  if (!aluno) return res.status(404).send("Aluno não encontrado");

  const { nome } = req.body;
  if (!nome) return res.status(400).send("Nome da disciplina obrigatório");

  aluno.disciplinas = aluno.disciplinas || [];

  // Checa se a disciplina já existe
  if (
    aluno.disciplinas.some((d) => d.nome.toLowerCase() === nome.toLowerCase())
  ) {
    return res.status(400).send("Disciplina já cadastrada para este aluno");
  }

  aluno.disciplinas.push({ nome, notas: [] });
  await db.write();

  // Retorna o aluno completo para que o front-end possa atualizar o estado
  res.status(201).json(aluno);
});

// [POST] /api/alunos/:id/disciplinas/:disciplinaNome/notas - Lança nota em uma disciplina
app.post(
  "/api/alunos/:id/disciplinas/:disciplinaNome/notas",
  async (req, res) => {
    // 1. Decodifica o nome da disciplina (CORREÇÃO CRÍTICA)
    const alunoId = parseInt(req.params.id);
    const disciplinaNomeEncoded = req.params.disciplinaNome;
    const disciplinaNome = decodeURIComponent(disciplinaNomeEncoded); // <<-- AQUI ESTÁ A CORREÇÃO

    // 2. Leitura dos dados
    await db.read();
    const aluno = db.data.alunos.find((a) => a.id === alunoId);

    // Validação
    if (!aluno) return res.status(404).json("Aluno não encontrado");
    const disciplina = aluno.disciplinas.find((d) => d.nome === disciplinaNome);
    if (!disciplina) return res.status(404).json("Disciplina não encontrada");

    const { nota } = req.body;
    if (typeof nota !== "number" || nota < 0 || nota > 10)
      return res.status(400).json("Nota deve ser um número entre 0 e 10.");

    // 3. Adiciona a nota e salva
    disciplina.notas.push(nota);
    await db.write();

    // 4. Retorna o aluno completo para o Front-End atualizar a lista
    res.json(aluno);
  }
);

// [PUT] /api/alunos/:id/disciplinas/:disciplinaNome/notas/:index - Altera uma nota lançada
app.put(
  "/api/alunos/:id/disciplinas/:disciplinaNome/notas/:index",
  async (req, res) => {
    await db.read();
    const alunoId = parseInt(req.params.id);
    const disciplinaNome = req.params.disciplinaNome;
    const index = parseInt(req.params.index);
    const aluno = db.data.alunos.find((a) => a.id === alunoId);

    if (!aluno) return res.status(404).send("Aluno não encontrado");

    const disciplina = aluno.disciplinas.find(
      (d) => encodeURI(d.nome).toLowerCase() === disciplinaNome.toLowerCase()
    );

    if (!disciplina) return res.status(404).send("Disciplina não encontrada.");

    const { novaNota } = req.body;
    const novaNotaFloat = parseFloat(novaNota);

    // Validação
    if (isNaN(novaNotaFloat) || novaNotaFloat < 0 || novaNotaFloat > 10) {
      return res.status(400).send("Nova nota deve ser um número entre 0 e 10.");
    }
    if (index < 0 || index >= disciplina.notas.length) {
      return res.status(404).send("Índice da nota inválido.");
    }

    disciplina.notas[index] = novaNotaFloat;
    await db.write();

    // Retorna o aluno completo
    res.json(aluno);
  }
);
// =========================================================

// --- Inicialização do Servidor ---
app.listen(port, () => {
  // A mensagem de log foi corrigida para usar a variável 'port'
  console.log(`Servidor rodando na porta ${port}`);
});
