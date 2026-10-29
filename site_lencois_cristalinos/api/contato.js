// POST /api/contato — grava a mensagem do formulário no MySQL
const mysql = require('mysql2/promise');

// Conexão com o MySQL (dados vêm das variáveis de ambiente da Vercel).
// O pool fica guardado entre chamadas da mesma função serverless.
let pool;
function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      charset: 'utf8mb4',
      waitForConnections: true,
      connectionLimit: 2,
      connectTimeout: 5000, // desiste em 5s em vez de deixar a Vercel esperar até o tempo limite
      queueLimit: 0,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined
    });
  }
  return pool;
}

const LIMITES = {
  nome: [2, 120],
  email: [5, 150],
  assunto: [3, 150],
  mensagem: [10, 2000]
};
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function validar(d) {
  for (const campo of Object.keys(LIMITES)) {
    const [min, max] = LIMITES[campo];
    if (d[campo].length < min || d[campo].length > max) {
      return `O campo ${campo} deve ter entre ${min} e ${max} caracteres.`;
    }
  }
  if (!EMAIL_REGEX.test(d.email)) return 'E-mail inválido.';
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, erro: 'Método não permitido.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  body = body || {};

  // Campo isca preenchido = robô. Responde "ok" sem gravar nada.
  if (texto(body.website)) {
    return res.status(201).json({ ok: true });
  }

  const dados = {
    nome: texto(body.nome),
    email: texto(body.email).toLowerCase(),
    assunto: texto(body.assunto),
    mensagem: texto(body.mensagem)
  };

  const erro = validar(dados);
  if (erro) return res.status(400).json({ ok: false, erro });

  let conn;
  try {
    conn = await getPool().getConnection();
    await conn.beginTransaction();

    // Cria o cliente ou atualiza o nome se o e-mail já existe; LAST_INSERT_ID(id) devolve o id nos dois casos
    const [cliente] = await conn.execute(
      `INSERT INTO clientes (nome, email) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE nome = VALUES(nome), id = LAST_INSERT_ID(id)`,
      [dados.nome, dados.email]
    );

    await conn.execute(
      'INSERT INTO mensagens_contato (cliente_id, assunto, mensagem) VALUES (?, ?, ?)',
      [cliente.insertId, dados.assunto, dados.mensagem]
    );

    await conn.commit();
    return res.status(201).json({ ok: true });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    console.error('Erro em /api/contato:', err);
    const codigo = err && err.code ? err.code : 'desconhecido';
    const dica = ['ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'PROTOCOL_CONNECTION_LOST'].includes(codigo) || /timeout/i.test(String(err && err.message))
      ? 'Não foi possível conectar ao MySQL. Confira DB_HOST, DB_PORT e se o servidor aceita conexões de fora.'
      : 'Erro ao salvar no banco. Confira DB_USER, DB_PASSWORD e DB_NAME.';
    return res.status(500).json({ ok: false, erro: dica + ' (código: ' + codigo + ')' });
  } finally {
    if (conn) conn.release();
  }
};
