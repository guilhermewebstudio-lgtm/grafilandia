# Grafilândia

Site da Grafilândia – Artes Gráficas (Odivelas). Node.js/Express, EJS, Postgres (Neon), GSAP.

## Variáveis de ambiente
- `DATABASE_URL` (obrigatória): connection string do Neon
- `SESSION_SECRET` (obrigatória): string aleatória grande
- `NODE_ENV=production`
- `ADMIN_EMAIL`: quem se registar com este e-mail fica administrador
- `WHATSAPP_NUMBER`: ex. 351912345678 (opcional)
- `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` (opcionais: sem eles os emails ficam só no log)
- `BASE_URL`: ex. https://grafilandia.onrender.com (opcional)

## Correr
`npm install && npm start` (porta 3000). Keepalive: `GET /healthz`.
