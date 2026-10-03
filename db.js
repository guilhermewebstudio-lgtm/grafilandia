const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: connectionString && /sslmode=|neon\.tech/.test(connectionString) ? { rejectUnauthorized: false } : false,
  max: 8,
  idleTimeoutMillis: 30000,
});
pool.on('error', (err) => console.error('Erro no pool Postgres:', err.message));

const q = (text, params) => pool.query(text, params);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client',
  reset_hash TEXT,
  reset_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS media (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  filename TEXT NOT NULL,
  mimetype TEXT NOT NULL,
  size INTEGER NOT NULL,
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'card',
  media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS portfolio (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quote_options (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS requests (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  contact_pref TEXT NOT NULL DEFAULT 'email',
  product TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT '',
  paper TEXT NOT NULL DEFAULT '',
  finish TEXT NOT NULL DEFAULT '',
  quantity INTEGER,
  notes TEXT NOT NULL DEFAULT '',
  media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'novo',
  admin_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS requests_user_idx ON requests (user_id);
CREATE INDEX IF NOT EXISTS requests_status_idx ON requests (status);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
`;

// Valores iniciais. O horário é um PLACEHOLDER: confirmar com a loja e editar em Admin > Definições.
const DEFAULT_SETTINGS = {
  telefone: '21 937 0688',
  email: 'grafilandia@gmail.com',
  morada: 'Largo António Aleixo N-10 Cv-Dtª, Odivelas',
  horario: 'Segunda a sexta: 09:00 – 19:00 (a confirmar)\nSábado e domingo: a confirmar',
  whatsapp: '',
  facebook: '',
  descricao: 'Somos uma empresa de Artes Gráficas, vocacionada para a produção e comercialização.',
};

const SEED_SERVICES = [
  ['Cartões de visita', 'A apresentação do teu negócio em cada mão. Escolhe o papel, o formato e o acabamento.', 'card'],
  ['Folhetos e flyers', 'Para divulgar promoções, eventos e serviços, em vários formatos e papéis.', 'flyer'],
  ['Cartazes', 'Cartazes para montras, eventos e campanhas, em vários tamanhos.', 'poster'],
  ['Fardamento personalizado', 'Roupa de trabalho com o nome e a marca da tua empresa.', 'shirt'],
  ['Brindes promocionais', 'Artigos personalizados para oferecer a clientes, parceiros e equipas.', 'gift'],
];

// Opções de exemplo para a calculadora: editáveis em Admin > Opções do orçamento.
const SEED_OPTIONS = {
  produto: ['Cartões de visita', 'Folhetos e flyers', 'Cartazes', 'Fardamento personalizado', 'Brindes promocionais', 'Outro trabalho'],
  formato: ['Cartão 85×55 mm', 'A6', 'A5', 'A4', 'A3', 'A2', 'Outro formato / não sei'],
  papel: ['Couché mate 135 g', 'Couché brilho 135 g', 'Couché 170 g', 'Cartolina 300–350 g', 'Papel offset 80 g', 'Papel reciclado', 'Não sei / aceito sugestão'],
  acabamento: ['Sem acabamento', 'Plastificação mate', 'Plastificação brilho', 'Verniz UV', 'Dobra', 'Corte especial'],
};

async function initDb() {
  await pool.query(SCHEMA);

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await q('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [key, value]);
  }

  const sc = await q('SELECT COUNT(*)::int AS n FROM services');
  if (sc.rows[0].n === 0) {
    let i = 1;
    for (const [name, description, icon] of SEED_SERVICES) {
      await q('INSERT INTO services (name, description, icon, sort_order) VALUES ($1, $2, $3, $4)', [name, description, icon, i++]);
    }
  }

  const oc = await q('SELECT COUNT(*)::int AS n FROM quote_options');
  if (oc.rows[0].n === 0) {
    for (const [kind, labels] of Object.entries(SEED_OPTIONS)) {
      let i = 1;
      for (const label of labels) {
        await q('INSERT INTO quote_options (kind, label, sort_order) VALUES ($1, $2, $3)', [kind, label, i++]);
      }
    }
  }
}

// Definições com cache curto (o admin limpa a cache ao guardar).
let cache = null;
let cacheAt = 0;

async function getSettings() {
  if (cache && Date.now() - cacheAt < 30000) return cache;
  const { rows } = await q('SELECT key, value FROM settings');
  const s = { ...DEFAULT_SETTINGS };
  for (const r of rows) s[r.key] = r.value;
  s.whatsapp = String(s.whatsapp || process.env.WHATSAPP_NUMBER || '').replace(/\D/g, '');
  cache = s;
  cacheAt = Date.now();
  return s;
}

function clearSettingsCache() {
  cache = null;
}

module.exports = { pool, q, initDb, getSettings, clearSettingsCache, DEFAULT_SETTINGS };
