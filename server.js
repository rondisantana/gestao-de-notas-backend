const express = require("express");
const cors = require("cors");
// CORREÇÃO CRÍTICA DO LOWDB: Importa o adaptador do local correto
const { Low } = require("lowdb");
const { JSONFile } = require("lowdb/node");
const path = require("path");

// --- DADOS INICIAIS (Definidos separadamente para clareza) ---
const defaultData = {
  alunos: [
    { id: 1, nome: "João Silva", notas: [8.5, 7.0, 9.5] },
    { id: 2, nome: "Maria Oliveira", notas: [6.0, 7.5] },
  ],
  nextId: 3,
};

// --- FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO DO SERVIDOR ---
async function initializeDBAndStartServer() {
  // 1. Configura o adaptador do banco de dados
  const file = path.join(__dirname, "db.json");
  const adapter = new JSONFile(file);
  const db = new Low(adapter, defaultData); // <--- CORREÇÃO: Passa defaultData na inicialização

  // 2. Tenta ler o banco de dados (se o db.json existir)
  await db.read();

  // 3. Verifica se os dados foram carregados (se o db.json não existe ou está vazio, usa o defaultData)
  if (!db.data || !db.data.alunos) {
    db.data = defaultData; // O Render pode apagar o db.json, então garantimos que ele sempre recarregue os dados.
    await db.write();
  }

  // Garante que 'alunos' é o array que usaremos a partir do objeto de dados
  const alunos = db.data.alunos;

  // Usa a porta fornecida pelo Render (process.env.PORT) ou 5000 localmente
  const app = express();
  const port = process.env.PORT || 5000;

  // --- MIDDLEWARES (CORRETO) ---
  app.use(express.json());
  const allowedOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
  app.use(cors({ origin: allowedOrigin }));

  // ----------------------------------------------------------------------------------
  // ROTAS DA API (MANTIDAS CORRETAS)

  app.get("/", (req, res) => {
    res.send("Servidor Node.js (API REST de Notas) rodando!");
  });

  app.get("/api/alunos", (req, res) => {
    res.json(alunos);
  });

  app.post("/api/alunos", async (req, res) => {
    const novoAlunoNome = req.body.nome;
    if (!novoAlunoNome)
      return res.status(400).send("O campo nome é obrigatório.");

    const novoAluno = {
      id: db.data.nextId++,
      nome: novoAlunoNome,
      notas: [],
    };
    alunos.push(novoAluno);
    await db.write();
    res.status(201).json(novoAluno);
  });

  app.put("/api/alunos/:id/notas", async (req, res) => {
    const alunoId = parseInt(req.params.id);
    const novaNota = req.body.nota;

    if (typeof novaNota !== "number" || novaNota < 0 || novaNota > 10) {
      return res
        .status(400)
        .send("A nota deve ser um número válido entre 0 e 10.");
    }
    const alunoIndex = alunos.findIndex((a) => a.id === alunoId);
    if (alunoIndex === -1) return res.status(404).send("Aluno não encontrado.");

    alunos[alunoIndex].notas.push(novaNota);
    await db.write();
    res.json(alunos[alunoIndex]);
  });

  app.delete("/api/alunos/:id", async (req, res) => {
    const alunoId = parseInt(req.params.id);
    const initialLength = alunos.length;
    db.data.alunos = alunos.filter((a) => a.id !== alunoId);

    if (db.data.alunos.length === initialLength) {
      return res.status(404).send("Aluno não encontrado para exclusão.");
    }
    await db.write();
    res.status(204).send();
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
