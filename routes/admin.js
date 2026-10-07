const path = require('path');
const express = require('express');
const multer = require('multer');

const { q, clearSettingsCache, DEFAULT_SETTINGS } = require('../db');
const { ah, flash, csrfCheck, requireAdmin, handleUpload, clean } = require('../middleware');

const router = express.Router();
router.use(requireAdmin);
router.use((req, res, next) => {
  res.locals.adminNav = req.path.split('/')[1] || 'inicio';
  next();
});

const IMG_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const IMG_MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
const imgUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024, files: 12 } });

const OPTION_KINDS = { produto: 'Produtos', formato: 'Formatos', papel: 'Papel / material', acabamento: 'Acabamentos' };
const STATUS_KEYS = ['novo', 'analise', 'orcamentado', 'producao', 'pronto', 'concluido', 'cancelado'];

const toId = (v) => {
  const n = parseInt(v, 10);
  return Number.isInteger(n) ? n : null;
};

// Guarda uma imagem enviada (só formatos seguros, nunca SVG) e devolve o id do media.
async function saveImage(file, kind) {
  if (!file) return null;
  const ext = path.extname(file.originalname).replace('.', '').toLowerCase();
  if (!IMG_EXT.includes(ext)) return null;
  const { rows } = await q('INSERT INTO media (kind, filename, mimetype, size, data) VALUES ($1,$2,$3,$4,$5) RETURNING id', [
    kind,
    path.basename(file.originalname).slice(0, 120),
    IMG_MIME[ext],
    file.size,
    file.buffer,
  ]);
  return rows[0].id;
}

// ---------- Painel ----------

router.get(
  '/',
  ah(async (req, res) => {
    const byStatus = {};
    (await q('SELECT status, COUNT(*)::int AS n FROM requests GROUP BY status')).rows.forEach((r) => (byStatus[r.status] = r.n));
    const totals = (await q("SELECT COUNT(*) FILTER (WHERE type='orcamento')::int AS quotes, COUNT(*) FILTER (WHERE type='ficheiro')::int AS files FROM requests")).rows[0];
    const users = (await q('SELECT COUNT(*)::int AS n FROM users')).rows[0].n;
    const recent = (await q('SELECT * FROM requests ORDER BY created_at DESC LIMIT 8')).rows;

    const warnings = [];
    if (/confirmar/i.test(res.locals.s.horario)) warnings.push({ text: 'O horário ainda é um exemplo. Confirma-o e edita em Definições.', href: '/admin/definicoes' });
    if (!res.locals.s.whatsapp) warnings.push({ text: 'Falta o número de WhatsApp: o botão de WhatsApp está escondido.', href: '/admin/definicoes' });

    res.render('admin/painel', { title: 'Painel', byStatus, totals, users, recent, warnings });
  })
);

// ---------- Pedidos ----------

router.get(
  '/pedidos',
  ah(async (req, res) => {
    const tipo = ['orcamento', 'ficheiro'].includes(req.query.tipo) ? req.query.tipo : '';
    const estado = STATUS_KEYS.includes(req.query.estado) ? req.query.estado : '';
    const search = clean(req.query.q, 80);

    const where = [];
    const params = [];
    if (tipo) { params.push(tipo); where.push(`type = $${params.length}`); }
    if (estado) { params.push(estado); where.push(`status = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length} OR product ILIKE $${params.length} OR phone ILIKE $${params.length} OR CAST(id AS TEXT) = $${params.length + 1})`);
      params.push(search.replace(/^#/, ''));
    }
    const sql = `SELECT * FROM requests ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT 200`;
    const rows = (await q(sql, params)).rows;
    res.render('admin/pedidos', { title: 'Pedidos', rows, tipo, estado, search });
  })
);

router.get(
  '/pedidos/:id',
  ah(async (req, res) => {
    const id = toId(req.params.id);
    const { rows } = await q('SELECT * FROM requests WHERE id = $1', [id]);
    if (!rows[0]) return res.status(404).render('erro', { title: 'Pedido não encontrado', code: 404, message: 'Este pedido não existe.' });
    const r = rows[0];

    // Número para WhatsApp: se tiver 9 dígitos assume Portugal (+351).
    let digits = String(r.phone || '').replace(/\D/g, '');
    if (digits.length === 9) digits = '351' + digits;
    const waText = `Olá ${r.name}, é da Grafilândia. Sobre o seu pedido #${r.id}: `;
    const waUrl = digits.length >= 11 ? `https://wa.me/${digits}?text=${encodeURIComponent(waText)}` : '';
    const mailUrl = `mailto:${r.email}?subject=${encodeURIComponent('Pedido #' + r.id + ' – Grafilândia')}`;
    res.render('admin/pedido', { title: `Pedido #${r.id}`, r, waUrl, mailUrl, STATUS_KEYS });
  })
);

router.post(
  '/pedidos/:id',
  csrfCheck,
  ah(async (req, res) => {
    const id = toId(req.params.id);
    const status = STATUS_KEYS.includes(req.body.status) ? req.body.status : 'novo';
    await q('UPDATE requests SET status = $1, admin_notes = $2, updated_at = NOW() WHERE id = $3', [status, clean(req.body.admin_notes, 3000), id]);
    flash(req, 'ok', 'Pedido atualizado.');
    res.redirect(`/admin/pedidos/${id}`);
  })
);

router.post(
  '/pedidos/:id/apagar',
  csrfCheck,
  ah(async (req, res) => {
    const id = toId(req.params.id);
    const { rows } = await q('DELETE FROM requests WHERE id = $1 RETURNING media_id', [id]);
    if (rows[0] && rows[0].media_id) await q("DELETE FROM media WHERE id = $1 AND kind = 'upload'", [rows[0].media_id]);
    flash(req, 'ok', 'Pedido apagado.');
    res.redirect('/admin/pedidos');
  })
);

// Download de qualquer ficheiro enviado por clientes.
router.get(
  '/ficheiro/:id',
  ah(async (req, res) => {
    const id = toId(req.params.id);
    const { rows } = await q("SELECT filename, mimetype, data FROM media WHERE id = $1 AND kind = 'upload'", [id]);
    if (!rows[0]) return res.status(404).end();
    res.set('Content-Type', rows[0].mimetype);
    res.attachment(rows[0].filename);
    res.send(rows[0].data);
  })
);

// ---------- Serviços ----------

router.get(
  '/servicos',
  ah(async (req, res) => {
    const rows = (await q('SELECT * FROM services ORDER BY sort_order, id')).rows;
    res.render('admin/servicos', { title: 'Serviços', rows });
  })
);

router.post(
  '/servicos',
  handleUpload(imgUpload.single('imagem'), '/admin/servicos'),
  csrfCheck,
  ah(async (req, res) => {
    const name = clean(req.body.name, 100);
    if (!name) {
      flash(req, 'error', 'O serviço precisa de um nome.');
      return res.redirect('/admin/servicos');
    }
    const mediaId = await saveImage(req.file, 'service');
    const next = (await q('SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM services')).rows[0].n;
    await q('INSERT INTO services (name, description, icon, media_id, sort_order) VALUES ($1,$2,$3,$4,$5)', [
      name,
      clean(req.body.description, 400),
      clean(req.body.icon, 20) || 'card',
      mediaId,
      next,
    ]);
    flash(req, 'ok', 'Serviço adicionado.');
    res.redirect('/admin/servicos');
  })
);

router.post(
  '/servicos/:id',
  handleUpload(imgUpload.single('imagem'), '/admin/servicos'),
  csrfCheck,
  ah(async (req, res) => {
    const id = toId(req.params.id);
    const name = clean(req.body.name, 100);
    if (!name) {
      flash(req, 'error', 'O serviço precisa de um nome.');
      return res.redirect('/admin/servicos');
    }
    const mediaId = await saveImage(req.file, 'service');
    await q('UPDATE services SET name=$1, description=$2, icon=$3, sort_order=$4, active=$5 WHERE id=$6', [
      name,
      clean(req.body.description, 400),
      clean(req.body.icon, 20) || 'card',
      parseInt(req.body.sort_order, 10) || 0,
      req.body.active === 'on',
      id,
    ]);
    if (mediaId) await q('UPDATE services SET media_id = $1 WHERE id = $2', [mediaId, id]);
    if (req.body.remove_image === 'on') await q('UPDATE services SET media_id = NULL WHERE id = $1', [id]);
    flash(req, 'ok', 'Serviço guardado.');
    res.redirect('/admin/servicos');
  })
);

router.post(
  '/servicos/:id/apagar',
  csrfCheck,
  ah(async (req, res) => {
    await q('DELETE FROM services WHERE id = $1', [toId(req.params.id)]);
    flash(req, 'ok', 'Serviço apagado.');
    res.redirect('/admin/servicos');
  })
);

// ---------- Portefólio ----------

router.get(
  '/portfolio',
  ah(async (req, res) => {
    const rows = (await q('SELECT * FROM portfolio ORDER BY sort_order, id DESC')).rows;
    res.render('admin/portfolio', { title: 'Portefólio', rows });
  })
);

router.post(
  '/portfolio',
  handleUpload(imgUpload.array('imagens', 12), '/admin/portfolio'),
  csrfCheck,
  ah(async (req, res) => {
    const files = req.files || [];
    if (!files.length) {
      flash(req, 'error', 'Escolhe pelo menos uma imagem (JPG, PNG, WEBP ou GIF até 6 MB).');
      return res.redirect('/admin/portfolio');
    }
    const category = clean(req.body.category, 60);
    const title = clean(req.body.title, 100);
    let added = 0;
    for (const f of files) {
      const mediaId = await saveImage(f, 'portfolio');
      if (!mediaId) continue;
      const fallback = path.basename(f.originalname, path.extname(f.originalname)).replace(/[-_]+/g, ' ').slice(0, 100);
      await q('INSERT INTO portfolio (title, category, media_id, sort_order) VALUES ($1,$2,$3,0)', [title || fallback, category, mediaId]);
      added++;
    }
    flash(req, added ? 'ok' : 'error', added ? `${added} imagem(ns) adicionada(s).` : 'Nenhuma imagem era válida. Usa JPG, PNG, WEBP ou GIF.');
    res.redirect('/admin/portfolio');
  })
);

router.post(
  '/portfolio/:id',
  csrfCheck,
  ah(async (req, res) => {
    await q('UPDATE portfolio SET title=$1, category=$2, sort_order=$3 WHERE id=$4', [
      clean(req.body.title, 100) || 'Sem título',
      clean(req.body.category, 60),
      parseInt(req.body.sort_order, 10) || 0,
      toId(req.params.id),
    ]);
    flash(req, 'ok', 'Guardado.');
    res.redirect('/admin/portfolio');
  })
);

router.post(
  '/portfolio/:id/apagar',
  csrfCheck,
  ah(async (req, res) => {
    const { rows } = await q('DELETE FROM portfolio WHERE id = $1 RETURNING media_id', [toId(req.params.id)]);
    if (rows[0]) await q("DELETE FROM media WHERE id = $1 AND kind = 'portfolio'", [rows[0].media_id]);
    flash(req, 'ok', 'Imagem apagada.');
    res.redirect('/admin/portfolio');
  })
);

// ---------- Opções do orçamento ----------

router.get(
  '/opcoes',
  ah(async (req, res) => {
    const rows = (await q('SELECT * FROM quote_options ORDER BY kind, sort_order, id')).rows;
    const groups = {};
    for (const k of Object.keys(OPTION_KINDS)) groups[k] = rows.filter((r) => r.kind === k);
    res.render('admin/opcoes', { title: 'Opções do orçamento', groups, OPTION_KINDS });
  })
);

router.post(
  '/opcoes',
  csrfCheck,
  ah(async (req, res) => {
    const kind = Object.keys(OPTION_KINDS).includes(req.body.kind) ? req.body.kind : null;
    const label = clean(req.body.label, 100);
    if (!kind || !label) {
      flash(req, 'error', 'Escreve a opção que queres adicionar.');
      return res.redirect('/admin/opcoes');
    }
    const next = (await q('SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM quote_options WHERE kind = $1', [kind])).rows[0].n;
    await q('INSERT INTO quote_options (kind, label, sort_order) VALUES ($1,$2,$3)', [kind, label, next]);
    flash(req, 'ok', 'Opção adicionada.');
    res.redirect('/admin/opcoes');
  })
);

router.post(
  '/opcoes/:id/apagar',
  csrfCheck,
  ah(async (req, res) => {
    await q('DELETE FROM quote_options WHERE id = $1', [toId(req.params.id)]);
    flash(req, 'ok', 'Opção removida.');
    res.redirect('/admin/opcoes');
  })
);

// ---------- Utilizadores ----------

router.get(
  '/utilizadores',
  ah(async (req, res) => {
    const rows = (await q('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC')).rows;
    res.render('admin/utilizadores', { title: 'Utilizadores', rows });
  })
);

router.post(
  '/utilizadores/:id/papel',
  csrfCheck,
  ah(async (req, res) => {
    const id = toId(req.params.id);
    if (id === req.user.id) {
      flash(req, 'error', 'Não podes mudar o teu próprio papel.');
      return res.redirect('/admin/utilizadores');
    }
    await q("UPDATE users SET role = CASE WHEN role = 'admin' THEN 'client' ELSE 'admin' END WHERE id = $1", [id]);
    flash(req, 'ok', 'Papel atualizado.');
    res.redirect('/admin/utilizadores');
  })
);

router.post(
  '/utilizadores/:id/apagar',
  csrfCheck,
  ah(async (req, res) => {
    const id = toId(req.params.id);
    if (id === req.user.id) {
      flash(req, 'error', 'Não podes apagar a tua própria conta.');
      return res.redirect('/admin/utilizadores');
    }
    await q('DELETE FROM users WHERE id = $1', [id]);
    flash(req, 'ok', 'Utilizador apagado.');
    res.redirect('/admin/utilizadores');
  })
);

// ---------- Definições ----------

router.get('/definicoes', (req, res) => res.render('admin/definicoes', { title: 'Definições' }));

router.post(
  '/definicoes',
  csrfCheck,
  ah(async (req, res) => {
    const b = req.body;
    const values = {
      telefone: clean(b.telefone, 40),
      email: clean(b.email, 150),
      morada: clean(b.morada, 200),
      horario: clean(b.horario, 600),
      whatsapp: clean(b.whatsapp, 20).replace(/\D/g, ''),
      facebook: clean(b.facebook, 200),
      descricao: clean(b.descricao, 400),
    };
    if (values.facebook && !/^https:\/\//i.test(values.facebook)) values.facebook = '';
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      await q('INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [key, values[key] ?? '']);
    }
    clearSettingsCache();
    flash(req, 'ok', 'Definições guardadas.');
    res.redirect('/admin/definicoes');
  })
);

module.exports = router;
