const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');

const { q } = require('../db');
const { ah, flash, csrfCheck, clean, EMAIL_RE, safeNext } = require('../middleware');
const { sendResetEmail } = require('../mail');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).render('erro', { title: 'Demasiadas tentativas', code: 429, message: 'Fizeste demasiadas tentativas. Espera alguns minutos e tenta outra vez.' }),
});

// Hash falso para igualar o tempo de resposta quando o e-mail não existe.
const DUMMY_HASH = bcrypt.hashSync('grafilandia-dummy', 10);

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function loginUser(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = userId;
      req.session.save((e) => (e ? reject(e) : resolve()));
    });
  });
}

async function promoteIfAdmin(user) {
  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (adminEmail && user.email.toLowerCase() === adminEmail && user.role !== 'admin') {
    await q("UPDATE users SET role = 'admin' WHERE id = $1", [user.id]);
    user.role = 'admin';
  }
}

// ---------- Entrar ----------

router.get('/entrar', (req, res) => {
  if (req.user) return res.redirect('/conta');
  res.render('auth/entrar', { title: 'Entrar', nav: '', next: safeNext(req.query.next) });
});

router.post(
  '/entrar',
  authLimiter,
  csrfCheck,
  ah(async (req, res) => {
    const email = clean(req.body.email, 150).toLowerCase();
    const password = String(req.body.password || '');
    const next = safeNext(req.body.next);
    const { rows } = await q('SELECT * FROM users WHERE LOWER(email) = $1', [email]);
    const user = rows[0];
    const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) {
      flash(req, 'error', 'E-mail ou palavra-passe incorretos.');
      return res.redirect('/entrar' + (next ? '?next=' + encodeURIComponent(next) : ''));
    }
    await promoteIfAdmin(user);
    await loginUser(req, user.id);
    res.redirect(next || (user.role === 'admin' ? '/admin' : '/conta'));
  })
);

// ---------- Registar ----------

router.get('/registar', (req, res) => {
  if (req.user) return res.redirect('/conta');
  res.render('auth/registar', { title: 'Criar conta', nav: '' });
});

router.post(
  '/registar',
  authLimiter,
  csrfCheck,
  ah(async (req, res) => {
    const name = clean(req.body.name, 100);
    const email = clean(req.body.email, 150).toLowerCase();
    const password = String(req.body.password || '');
    const confirm = String(req.body.confirm || '');

    const errors = [];
    if (name.length < 2) errors.push('Indica o teu nome.');
    if (!EMAIL_RE.test(email)) errors.push('Indica um e-mail válido.');
    if (password.length < 8) errors.push('A palavra-passe tem de ter pelo menos 8 caracteres.');
    if (password !== confirm) errors.push('As palavras-passe não coincidem.');
    if (errors.length) {
      flash(req, 'error', errors.join(' '));
      return res.redirect('/registar');
    }

    const exists = await q('SELECT 1 FROM users WHERE LOWER(email) = $1', [email]);
    if (exists.rows[0]) {
      flash(req, 'error', 'Já existe uma conta com esse e-mail. Tenta entrar.');
      return res.redirect('/entrar');
    }

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await q('INSERT INTO users (name, email, password_hash) VALUES ($1,$2,$3) RETURNING *', [name, email, hash]);
    const user = rows[0];
    await promoteIfAdmin(user);
    await loginUser(req, user.id);
    flash(req, 'ok', 'Conta criada. Bem-vindo(a)!');
    res.redirect(user.role === 'admin' ? '/admin' : '/conta');
  })
);

// ---------- Sair ----------

router.post('/sair', csrfCheck, (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ---------- Recuperar palavra-passe ----------

router.get('/recuperar', (req, res) => res.render('auth/recuperar', { title: 'Recuperar palavra-passe', nav: '' }));

router.post(
  '/recuperar',
  authLimiter,
  csrfCheck,
  ah(async (req, res) => {
    const email = clean(req.body.email, 150).toLowerCase();
    const { rows } = await q('SELECT id, name, email FROM users WHERE LOWER(email) = $1', [email]);
    const user = rows[0];
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      await q("UPDATE users SET reset_hash = $1, reset_expires = NOW() + INTERVAL '1 hour' WHERE id = $2", [sha256(token), user.id]);
      sendResetEmail(user, `${res.locals.baseUrl}/redefinir/${token}`).catch((e) => console.error(e));
    }
    flash(req, 'ok', 'Se o e-mail existir, enviámos um link para escolheres uma nova palavra-passe.');
    res.redirect('/recuperar');
  })
);

async function findByResetToken(token) {
  const { rows } = await q('SELECT id FROM users WHERE reset_hash = $1 AND reset_expires > NOW()', [sha256(String(token || ''))]);
  return rows[0] || null;
}

router.get(
  '/redefinir/:token',
  ah(async (req, res) => {
    const user = await findByResetToken(req.params.token);
    if (!user) {
      flash(req, 'error', 'Este link já expirou. Pede um novo.');
      return res.redirect('/recuperar');
    }
    res.render('auth/redefinir', { title: 'Nova palavra-passe', nav: '', token: req.params.token });
  })
);

router.post(
  '/redefinir/:token',
  authLimiter,
  csrfCheck,
  ah(async (req, res) => {
    const user = await findByResetToken(req.params.token);
    if (!user) {
      flash(req, 'error', 'Este link já expirou. Pede um novo.');
      return res.redirect('/recuperar');
    }
    const password = String(req.body.password || '');
    if (password.length < 8 || password !== String(req.body.confirm || '')) {
      flash(req, 'error', 'A palavra-passe tem de ter pelo menos 8 caracteres e as duas têm de coincidir.');
      return res.redirect(`/redefinir/${req.params.token}`);
    }
    const hash = await bcrypt.hash(password, 10);
    await q('UPDATE users SET password_hash = $1, reset_hash = NULL, reset_expires = NULL WHERE id = $2', [hash, user.id]);
    flash(req, 'ok', 'Palavra-passe alterada. Já podes entrar.');
    res.redirect('/entrar');
  })
);

module.exports = router;
