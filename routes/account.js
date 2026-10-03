const express = require('express');
const { q } = require('../db');
const { ah, requireAuth } = require('../middleware');

const router = express.Router();
router.use(requireAuth);

router.get(
  '/',
  ah(async (req, res) => {
    const { rows } = await q('SELECT * FROM requests WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.render('conta', { title: 'A minha conta', nav: '', requests: rows });
  })
);

// Download do ficheiro que o próprio cliente enviou.
router.get(
  '/ficheiro/:id',
  ah(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(404).end();
    const { rows } = await q(
      `SELECT m.filename, m.mimetype, m.data FROM media m
       JOIN requests r ON r.media_id = m.id
       WHERE m.id = $1 AND r.user_id = $2`,
      [id, req.user.id]
    );
    if (!rows[0]) return res.status(404).end();
    res.set('Content-Type', rows[0].mimetype);
    res.attachment(rows[0].filename);
    res.send(rows[0].data);
  })
);

module.exports = router;
