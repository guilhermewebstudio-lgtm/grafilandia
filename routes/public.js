const path = require('path');
const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');

const { q } = require('../db');
const { ah, wantsJson, csrfCheck, done, fail, handleUpload, clean, EMAIL_RE } = require('../middleware');
const { notifyNewRequest } = require('../mail');

const router = express.Router();

const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const message = 'Fizeste muitos pedidos seguidos. Tenta outra vez dentro de alguns minutos ou fala connosco por telefone.';
    if (wantsJson(req)) return res.status(429).json({ ok: false, error: message });
    return res.status(429).render('erro', { title: 'Demasiados pedidos', code: 429, message });
  },
});

const MAX_FILE_MB = 20;
const FILE_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'tif', 'tiff', 'ai', 'psd', 'eps', 'svg', 'zip', 'rar', 'doc', 'docx'];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 1 } });

async function loadOptions() {
  const { rows } = await q('SELECT kind, label FROM quote_options WHERE active ORDER BY kind, sort_order, id');
  const opts = { produto: [], formato: [], papel: [], acabamento: [] };
  for (const r of rows) if (opts[r.kind]) opts[r.kind].push(r.label);
  return opts;
}

function readContact(b) {
  const name = clean(b.name, 100);
  const email = clean(b.email, 150).toLowerCase();
  const phone = clean(b.phone, 30).replace(/[^\d+ ]/g, '');
  const pref = b.contact_pref === 'whatsapp' ? 'whatsapp' : 'email';
  const errors = [];
  if (name.length < 2) errors.push('Indica o teu nome.');
  if (!EMAIL_RE.test(email)) errors.push('Indica um e-mail válido.');
  if (pref === 'whatsapp' && phone.replace(/\D/g, '').length < 9) errors.push('Para responder por WhatsApp precisamos do teu telemóvel.');
  return { name, email, phone, pref, errors };
}

function readQuantity(v, required) {
  const raw = String(v ?? '').replace(/\D/g, '');
  if (!raw) return { value: null, error: required ? 'Indica a quantidade.' : '' };
  const n = parseInt(raw, 10);
  if (n < 1 || n > 1000000) return { value: null, error: 'A quantidade tem de estar entre 1 e 1 000 000.' };
  return { value: n, error: '' };
}

async function insertRequest(r) {
  const { rows } = await q(
    `INSERT INTO requests (type, user_id, name, email, phone, contact_pref, product, format, paper, finish, quantity, notes, media_id, file_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [r.type, r.user_id || null, r.name, r.email, r.phone, r.pref, r.product || '', r.format || '', r.paper || '', r.finish || '', r.quantity, r.notes || '', r.media_id || null, r.file_name || '']
  );
  return rows[0];
}

function takeOld(req) {
  const old = req.session.old || {};
  delete req.session.old;
  return old;
}

// ---------- Páginas ----------

router.get(
  '/',
  ah(async (req, res) => {
    const services = (await q('SELECT * FROM services WHERE active ORDER BY sort_order, id')).rows;
    const works = (await q('SELECT p.*, m.id AS mid FROM portfolio p JOIN media m ON m.id = p.media_id ORDER BY p.sort_order, p.id DESC LIMIT 4')).rows;
    res.render('home', { title: '', nav: 'inicio', services, works, jsonld: true });
  })
);

router.get(
  '/servicos',
  ah(async (req, res) => {
    const services = (await q('SELECT * FROM services WHERE active ORDER BY sort_order, id')).rows;
    res.render('servicos', { title: 'Serviços', nav: 'servicos', desc: 'Cartões de visita, folhetos, cartazes, fardamento personalizado e brindes promocionais. Pede o teu orçamento online.', services });
  })
);

router.get(
  '/portefolio',
  ah(async (req, res) => {
    const works = (await q('SELECT * FROM portfolio ORDER BY sort_order, id DESC')).rows;
    const categories = [...new Set(works.map((w) => w.category).filter(Boolean))];
    res.render('portefolio', { title: 'Portefólio', nav: 'portefolio', desc: 'Alguns dos trabalhos que já imprimimos.', works, categories });
  })
);

router.get('/sobre', (req, res) => res.render('sobre', { title: 'Sobre nós', nav: 'sobre', desc: 'Conhece a Grafilândia, empresa de artes gráficas em Odivelas.' }));
router.get('/contactos', (req, res) => res.render('contactos', { title: 'Contactos', nav: 'contactos', desc: 'Morada, horário e contactos da Grafilândia em Odivelas.' }));

// ---------- Orçamento ----------

router.get(
  '/orcamento',
  ah(async (req, res) => {
    const options = await loadOptions();
    const old = takeOld(req);
    const wanted = clean(req.query.produto, 100);
    if (!old.product && wanted && options.produto.includes(wanted)) old.product = wanted;
    if (!old.name && req.user) {
      old.name = req.user.name;
      old.email = req.user.email;
    }
    res.render('orcamento', { title: 'Pedir orçamento', nav: 'orcamento', desc: 'Escolhe o produto, a quantidade e o papel. Respondemos com o preço por e-mail ou WhatsApp.', options, old });
  })
);

router.post(
  '/orcamento',
  formLimiter,
  csrfCheck,
  ah(async (req, res) => {
    const b = req.body;
    const c = readContact(b);
    const qty = readQuantity(b.quantity, true);
    const product = clean(b.product, 100);
    const errors = [...c.errors];
    if (!product) errors.push('Escolhe o produto.');
    if (qty.error) errors.push(qty.error);
    if (errors.length) return fail(req, res, errors.join(' '), '/orcamento');

    const reqRow = await insertRequest({
      type: 'orcamento',
      user_id: req.user && req.user.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      pref: c.pref,
      product,
      format: clean(b.format, 100),
      paper: clean(b.paper, 100),
      finish: clean(b.finish, 100),
      quantity: qty.value,
      notes: clean(b.notes, 2000),
    });
    notifyNewRequest(reqRow, res.locals.s, res.locals.baseUrl).catch((e) => console.error(e));
    return done(req, res, `/pedido/enviado?ref=${reqRow.id}`);
  })
);

// ---------- Envio de ficheiros ----------

router.get(
  '/enviar-ficheiros',
  ah(async (req, res) => {
    const options = await loadOptions();
    const old = takeOld(req);
    if (!old.name && req.user) {
      old.name = req.user.name;
      old.email = req.user.email;
    }
    res.render('ficheiros', { title: 'Enviar ficheiros', nav: 'ficheiros', desc: 'Envia o teu PDF ou imagem para impressão. Dizemos-te o preço por e-mail ou WhatsApp.', options, old, maxMb: MAX_FILE_MB, exts: FILE_EXT });
  })
);

router.post(
  '/enviar-ficheiros',
  formLimiter,
  handleUpload(upload.single('ficheiro'), '/enviar-ficheiros'),
  csrfCheck,
  ah(async (req, res) => {
    const b = req.body;
    const c = readContact(b);
    const qty = readQuantity(b.quantity, false);
    const errors = [...c.errors];
    if (qty.error) errors.push(qty.error);

    const file = req.file;
    let ext = '';
    if (!file) errors.push('Anexa o ficheiro que queres imprimir.');
    else {
      ext = path.extname(file.originalname).replace('.', '').toLowerCase();
      if (!FILE_EXT.includes(ext)) errors.push(`Formato não suportado. Podes enviar: ${FILE_EXT.join(', ').toUpperCase()}.`);
    }
    if (errors.length) return fail(req, res, errors.join(' '), '/enviar-ficheiros');

    const safeName = path.basename(file.originalname).replace(/[^\w.\- ()]/g, '_').slice(0, 120) || `ficheiro.${ext}`;
    const media = await q('INSERT INTO media (kind, filename, mimetype, size, data) VALUES ($1,$2,$3,$4,$5) RETURNING id', [
      'upload',
      safeName,
      file.mimetype || 'application/octet-stream',
      file.size,
      file.buffer,
    ]);

    const reqRow = await insertRequest({
      type: 'ficheiro',
      user_id: req.user && req.user.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      pref: c.pref,
      product: clean(b.product, 100),
      quantity: qty.value,
      notes: clean(b.notes, 2000),
      media_id: media.rows[0].id,
      file_name: safeName,
    });
    notifyNewRequest(reqRow, res.locals.s, res.locals.baseUrl).catch((e) => console.error(e));
    return done(req, res, `/pedido/enviado?ref=${reqRow.id}`);
  })
);

router.get('/pedido/enviado', (req, res) => {
  const ref = parseInt(req.query.ref, 10);
  res.render('enviado', { title: 'Pedido enviado', nav: '', ref: Number.isInteger(ref) ? ref : null });
});

// ---------- Imagens públicas (portefólio e serviços) ----------

router.get(
  '/media/:id',
  ah(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(404).end();
    const { rows } = await q("SELECT mimetype, data FROM media WHERE id = $1 AND kind IN ('portfolio','service')", [id]);
    if (!rows[0]) return res.status(404).end();
    res.set('Content-Type', rows[0].mimetype);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(rows[0].data);
  })
);

module.exports = router;
