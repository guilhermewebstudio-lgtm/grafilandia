const crypto = require('crypto');

// Envolve handlers async (o Express 5 já encaminha erros, isto só mantém o código explícito).
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const wantsJson = (req) =>
  req.xhr || req.get('x-requested-with') === 'XMLHttpRequest' || (req.get('accept') || '').includes('application/json');

function flash(req, type, text) {
  req.session.flash = { type, text };
}

function csrfToken(req) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  return req.session.csrf;
}

function csrfCheck(req, res, next) {
  const sent = String((req.body && req.body._csrf) || '');
  const real = req.session && req.session.csrf ? req.session.csrf : '';
  const ok = sent.length > 0 && sent.length === real.length && crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(real));
  if (ok) return next();
  if (wantsJson(req)) return res.status(403).json({ ok: false, error: 'A sessão expirou. Recarrega a página e tenta outra vez.' });
  return res.status(403).render('erro', { title: 'Sessão expirada', code: 403, message: 'A sessão expirou. Volta atrás, recarrega a página e tenta outra vez.' });
}

function requireAuth(req, res, next) {
  if (req.user) return next();
  flash(req, 'error', 'Entra na tua conta para continuar.');
  return res.redirect('/entrar?next=' + encodeURIComponent(req.originalUrl));
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  if (!req.user) {
    flash(req, 'error', 'Entra com a conta de administrador.');
    return res.redirect('/entrar?next=' + encodeURIComponent(req.originalUrl));
  }
  return res.status(403).render('erro', { title: 'Sem acesso', code: 403, message: 'Esta área é só para a equipa da Grafilândia.' });
}

// Resposta final de um formulário: JSON (XHR) ou redirecionamento.
function done(req, res, url) {
  if (wantsJson(req)) return res.json({ ok: true, redirect: url });
  return res.redirect(url);
}

// Erro de formulário: JSON (XHR) ou flash + redirecionamento, guardando o que foi escrito.
function fail(req, res, message, back) {
  if (wantsJson(req)) return res.status(400).json({ ok: false, error: message });
  flash(req, 'error', message);
  req.session.old = req.body || {};
  return res.redirect(back);
}

// Trata erros do multer (tamanho, etc.) com mensagens em português.
function handleUpload(mw, back) {
  return (req, res, next) =>
    mw(req, res, (err) => {
      if (!err) return next();
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'O ficheiro é demasiado grande.' : 'Não foi possível receber o ficheiro.';
      return fail(req, res, msg, back);
    });
}

const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Só aceita caminhos internos como destino após o login.
function safeNext(n) {
  const s = String(n || '');
  return s.startsWith('/') && !s.startsWith('//') && !s.includes('\\') ? s : '';
}

module.exports = { ah, wantsJson, flash, csrfToken, csrfCheck, requireAuth, requireAdmin, done, fail, handleUpload, clean, EMAIL_RE, safeNext };
