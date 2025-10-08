// IMPORTAÇÕES
const express = require("express");
const cors = require("cors");
// CORREÇÃO CRÍTICA DO LOWDB: Importa o adaptador do local correto
const { Low } = require("lowdb");
const { JSONFile } = require("lowdb/node");
const path = require("path");

// --- CONFIGURAÇÃO DO LOWDB (BANCO DE DADOS EM ARQUIVO JSON) ---
const file = path.join(__dirname, "db.json");
const adapter = new JSONFile(file); // JSONFile agora é um construtor
const db = new Low(adapter);

// --- DADOS INICIAIS ---
const defaultData = {
  alunos: [
    { id: 1, nome: "João Silva", notas: [8.5, 7.0, 9.5] },
    { id: 2, nome: "Maria Oliveira", notas: [6.0, 7.5] },
  ],
  nextId: 3,
};

// --- FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO DO SERVIDOR ---
async function initializeDBAndStartServer() {
  await db.read();

  // Se o banco de dados estiver vazio, use os dados padrões e salve
  if (!db.data || !db.data.alunos) {
    db.data = defaultData;
    await db.write();
  }

  // Garante que db.data.alunos é o array que usaremos
  const alunos = db.data.alunos;

  // Usa a porta fornecida pelo Render (process.env.PORT) ou 5000 localmente
  const app = express();
  const port = process.env.PORT || 5000;

  // --- MIDDLEWARES ---
  app.use(express.json());

  // Configuração do CORS para produção e desenvolvimento
  const allowedOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
  app.use(cors({ origin: allowedOrigin }));

  // ----------------------------------------------------------------------------------
  // ROTAS DA API

  // ROTA 1: Obter a lista completa de alunos (GET /api/alunos)
  app.get("/api/alunos", (req, res) => {
    res.json(alunos);
  });

  // ROTA 2: Adicionar um novo aluno (POST /api/alunos)
  app.post("/api/alunos", async (req, res) => {
    const novoAlunoNome = req.body.nome;

    if (!novoAlunoNome) {
      return res.status(400).send("O campo nome é obrigatório.");
    }

    const novoAluno = {
      id: db.data.nextId++,
      nome: novoAlunoNome,
      notas: [],
    };

    alunos.push(novoAluno);
    await db.write(); // Salva no db.json
    res.status(201).json(novoAluno);
  });

  // ROTA 3: Adicionar nota a um aluno específico (PUT /api/alunos/:id/notas)
  app.put("/api/alunos/:id/notas", async (req, res) => {
    const alunoId = parseInt(req.params.id);
    const novaNota = req.body.nota;

    if (typeof novaNota !== "number" || novaNota < 0 || novaNota > 10) {
      return res
        .status(400)
        .send("A nota deve ser um número válido entre 0 e 10.");
    }

    const alunoIndex = alunos.findIndex((a) => a.id === alunoId);

    if (alunoIndex === -1) {
      return res.status(404).send("Aluno não encontrado.");
    }

    alunos[alunoIndex].notas.push(novaNota);
    await db.write(); // Salva no db.json

    res.json(alunos[alunoIndex]);
  });

  // ROTA 4: Excluir um aluno (DELETE /api/alunos/:id)
  app.delete("/api/alunos/:id", async (req, res) => {
    const alunoId = parseInt(req.params.id);

    // Filtra o array, mantendo apenas os alunos que NÃO têm o ID fornecido
    const initialLength = alunos.length;
    db.data.alunos = alunos.filter((a) => a.id !== alunoId);

    if (db.data.alunos.length === initialLength) {
      return res.status(404).send("Aluno não encontrado para exclusão.");
    }

    await db.write(); // Salva no db.json
    res.status(204).send(); // 204 No Content indica sucesso na exclusão
  });

  // ----------------------------------------------------------------------------------
  // INICIA O EXPRESS APÓS O BANCO DE DADOS ESTAR PRONTO
  app.listen(port, () => {
    console.log(`Servidor na porta ${port}`);
    console.log(`API REST disponível em http://localhost:${port}/api/alunos`);
  });
}

// Chama a função principal para iniciar tudo
initializeDBAndStartServer().catch(console.error);
