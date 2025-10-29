// Importação dos módulos necessários
const express = require("express");
const cors = require("cors");
const { Low } = require("lowdb");
const { JSONFile } = require("lowdb/node");
const path = require("path");

// --- CONFIGURAÇÃO DA PERSISTÊNCIA ---
const file = path.join(__dirname, "db.json");
const defaultData = {
  alunos: [
    {
      id: 1,
      nome: "João Silva",
      disciplinas: [
        { nome: "Matemática", notas: [8.5, 7.0, 9.5] },
        { nome: "Português", notas: [7.0, 8.0] },
      ],
    },
    {
      id: 2,
      nome: "Maria Oliveira",
      disciplinas: [{ nome: "História", notas: [6.0, 7.5, 5.5] }],
    },
  ],
  nextId: 3,
};

const adapter = new JSONFile(file);
const db = new Low(adapter, defaultData);

async function initializeDatabase() {
  await db.read();
  db.data = db.data || defaultData;
  await db.write();
}
initializeDatabase().catch(console.error);

// --- CONFIGURAÇÃO DO SERVIDOR ---
const app = express();
const port = process.env.PORT || 5000;

// Middlewares essenciais
const allowedOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

// --- DEFINIÇÃO DAS ROTAS DA API REST ---

// [GET] /api/alunos - Retorna a lista de todos os alunos
app.get("/api/alunos", async (req, res) => {
  await db.read();
  const { alunos } = db.data;
  // Garante que a estrutura disciplinas existe
  const alunosComDisciplinas = alunos.map((aluno) => ({
    ...aluno,
    disciplinas: aluno.disciplinas || [],
  }));
  res.json(alunosComDisciplinas);
});

// [POST] /api/alunos - Adiciona um novo aluno
app.post("/api/alunos", async (req, res) => {
  if (!req.body.nome || typeof req.body.nome !== "string") {
    return res.status(400).json({ message: "O nome do aluno é obrigatório." });
  }

  await db.read();
  const alunos = db.data.alunos;

  const novoAluno = {
    id: db.data.nextId++,
    nome: req.body.nome,
    disciplinas: [], // Novo aluno começa sem disciplinas
  };

  alunos.push(novoAluno);
  await db.write(); // Garante a PERSISTÊNCIA
  res.status(201).json(novoAluno);
});

// [DELETE] /api/alunos/:id - Exclui um aluno
app.delete("/api/alunos/:id", async (req, res) => {
  const alunoId = parseInt(req.params.id);
  await db.read();
  const initialLength = db.data.alunos.length;

  db.data.alunos = db.data.alunos.filter((a) => a.id !== alunoId);

  if (db.data.alunos.length < initialLength) {
    await db.write();
    return res.status(204).send(); // 204 No Content para exclusão bem-sucedida
  }
  res.status(404).json({ message: "Aluno não encontrado." });
});

// [POST] /api/alunos/:id/disciplinas - Adiciona uma nova disciplina
app.post("/api/alunos/:id/disciplinas", async (req, res) => {
  const alunoId = parseInt(req.params.id);
  await db.read();
  const aluno = db.data.alunos.find((a) => a.id === alunoId);

  if (!aluno) return res.status(404).json({ message: "Aluno não encontrado" });
  const { nome } = req.body;
  if (!nome)
    return res.status(400).json({ message: "Nome da disciplina obrigatório" });

  aluno.disciplinas = aluno.disciplinas || [];

  // Evita duplicidade de disciplina
  if (aluno.disciplinas.some((d) => d.nome === nome)) {
    return res.status(409).json({ message: "Disciplina já existe" });
  }

  aluno.disciplinas.push({ nome, notas: [] });
  await db.write(); // Garante a PERSISTÊNCIA
  res.status(201).json(aluno); // Retorna o aluno completo
});

// [POST] /api/alunos/:id/disciplinas/:disciplinaNome/notas - Lança uma nota
app.post(
  "/api/alunos/:id/disciplinas/:disciplinaNome/notas",
  async (req, res) => {
    // 1. Decodifica o nome da disciplina (CORREÇÃO CRÍTICA)
    const alunoId = parseInt(req.params.id);
    const disciplinaNomeEncoded = req.params.disciplinaNome;
    const disciplinaNome = decodeURIComponent(disciplinaNomeEncoded); // <<-- CORREÇÃO AQUI

    // 2. Leitura e Validação
    await db.read();
    const aluno = db.data.alunos.find((a) => a.id === alunoId);

    if (!aluno)
      return res.status(404).json({ message: "Aluno não encontrado" });
    const disciplina = aluno.disciplinas.find((d) => d.nome === disciplinaNome);
    if (!disciplina)
      return res.status(404).json({ message: "Disciplina não encontrada" });

    const { nota } = req.body;
    if (typeof nota !== "number" || nota < 0 || nota > 10)
      return res
        .status(400)
        .json({ message: "Nota deve ser um número entre 0 e 10." });

    // 3. Adiciona a nota e salva
    disciplina.notas.push(nota);
    await db.write(); // Garante a PERSISTÊNCIA

    // 4. Retorna o aluno completo para o Front-End atualizar a lista
    res.json(aluno);
  }
);

// [PUT] /api/alunos/:id/disciplinas/:disciplinaNome/notas/:index - Altera uma nota específica
app.put(
  "/api/alunos/:id/disciplinas/:disciplinaNome/notas/:index",
  async (req, res) => {
    // 1. Decodifica parâmetros (CORREÇÃO CRÍTICA)
    const alunoId = parseInt(req.params.id);
    const disciplinaNomeEncoded = req.params.disciplinaNome;
    const disciplinaNome = decodeURIComponent(disciplinaNomeEncoded); // <<-- CORREÇÃO AQUI
    const index = parseInt(req.params.index);

    // 2. Leitura e Validação
    await db.read();
    const aluno = db.data.alunos.find((a) => a.id === alunoId);

    if (!aluno)
      return res.status(404).json({ message: "Aluno não encontrado" });
    const disciplina = aluno.disciplinas.find((d) => d.nome === disciplinaNome);
    if (!disciplina)
      return res.status(404).json({ message: "Disciplina não encontrada" });

    // 3. Valida a nova nota e o índice
    const { novaNota } = req.body;
    if (typeof novaNota !== "number" || novaNota < 0 || novaNota > 10) {
      return res
        .status(400)
        .json({ message: "Nova nota deve ser um número entre 0 e 10." });
    }

    if (index < 0 || index >= disciplina.notas.length) {
      return res.status(404).json({ message: "Índice da nota inválido" });
    }

    // 4. Altera a nota no array e salva
    disciplina.notas[index] = novaNota;
    await db.write(); // Garante a PERSISTÊNCIA

    // 5. Retorna o aluno completo
    res.json(aluno);
  }
);

// Rota principal para verificar se o servidor está no ar
app.get("/", (req, res) => {
  res.send("Servidor Node.js para gestão de alunos está rodando!");
});

// --- Inicialização do Servidor ---
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
