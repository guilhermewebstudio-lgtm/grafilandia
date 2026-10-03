process.env.TZ = 'Europe/Lisbon';
try { require('dotenv').config(); } catch { /* sem .env, tudo bem */ }

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');

const { pool, q, initDb, getSettings } = require('./db');
const { csrfToken } = require('./middleware');
const { icon, ICON_NAMES } = require('./icons');

const app = express();
const isProd = process.env.NODE_ENV === 'production';
const BUILD = Date.now().toString(36);

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        frameSrc: ['https://www.google.com'],
        connectSrc: ["'self'"],
        formAction: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// Keepalive para o cron-job.org (antes da sessão, para não criar sessões à toa).
app.get('/healthz', (req, res) => res.type('text').send('ok'));

app.use(express.static(path.join(__dirname, 'public'), { maxAge: isProd ? '7d' : 0 }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

if (!process.env.SESSION_SECRET) {
  console.warn('AVISO: define SESSION_SECRET nas variáveis de ambiente (as sessões perdem-se a cada reinício).');
}
app.use(
  session({
    store: new pgSession({ pool, tableName: 'session', createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 30, httpOnly: true, sameSite: 'lax', secure: 'auto' },
  })
);

const STATUS = {
  novo: 'Novo',
  analise: 'Em análise',
  orcamentado: 'Orçamento enviado',
  producao: 'Em produção',
  pronto: 'Pronto a levantar',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

app.use(async (req, res, next) => {
  req.user = null;
  if (req.session.userId) {
    const { rows } = await q('SELECT id, name, email, role FROM users WHERE id = $1', [req.session.userId]);
    if (rows[0]) req.user = rows[0];
    else delete req.session.userId;
  }
  const s = await getSettings();

  res.locals.user = req.user;
  res.locals.s = s;
  res.locals.v = BUILD;
  res.locals.csrf = csrfToken(req);
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  res.locals.icon = icon;
  res.locals.ICON_NAMES = ICON_NAMES;
  res.locals.STATUS = STATUS;
  res.locals.baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  res.locals.currentPath = req.path;
  res.locals.fmtDate = (d) => (d ? new Date(d).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon', dateStyle: 'short', timeStyle: 'short' }) : '');
  res.locals.waLink = (text) => (s.whatsapp ? `https://wa.me/${s.whatsapp}${text ? '?text=' + encodeURIComponent(text) : ''}` : '');
  res.locals.hoursLines = String(s.horario || '').split('\n').map((l) => l.trim()).filter(Boolean);
  res.locals.mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(s.morada + ', Portugal')}&output=embed`;
  res.locals.directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.morada + ', Portugal')}`;
  res.locals.bodyClass = '';
  next();
});

app.use('/', require('./routes/public'));
app.use('/', require('./routes/auth'));
app.use('/conta', require('./routes/account'));
app.use('/admin', require('./routes/admin'));

app.use((req, res) => {
  res.status(404).render('erro', { title: 'Página não encontrada', code: 404, message: 'Esta página não existe ou mudou de sítio.' });
});

app.use((err, req, res, _next) => {
  console.error(err);
  if (res.headersSent) return;
  const wantsJson = req.xhr || (req.get('accept') || '').includes('application/json');
  if (wantsJson) return res.status(500).json({ ok: false, error: 'Aconteceu um erro. Tenta outra vez.' });
  res.status(500).render('erro', { title: 'Erro', code: 500, message: 'Aconteceu um erro do nosso lado. Tenta outra vez dentro de instantes.' });
});

const PORT = process.env.PORT || 3000;
initDb()
  .then(() => app.listen(PORT, () => console.log(`Grafilândia a correr na porta ${PORT}`)))
  .catch((err) => {
    console.error('Falha ao iniciar a base de dados:', err);
    process.exit(1);
  });
