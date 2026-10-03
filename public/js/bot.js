/* Assistente da Grafilândia: 100% local (palavras-chave), sem APIs externas.
   O idioma é detetado em cada mensagem (PT ou EN), independente do site. */
(function () {
  'use strict';

  var root = document.getElementById('bot');
  if (!root) return;

  var D = root.dataset;
  var toggle = root.querySelector('.bot-toggle');
  var panel = root.querySelector('.bot-panel');
  var closeBtn = root.querySelector('.bot-close');
  var msgs = root.querySelector('.bot-msgs');
  var chipsBox = root.querySelector('.bot-chips');
  var form = root.querySelector('.bot-form');
  var input = form.elements.msg;

  var norm = function (s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  /* ---------- Deteção de idioma ---------- */
  var EN_WORDS = ['the', 'what', 'how', 'you', 'your', 'do', 'does', 'is', 'are', 'can', 'where', 'when', 'hello', 'hi', 'please', 'thanks', 'thank', 'need', 'want', 'have', 'my', 'of', 'to', 'and', 'for', 'with', 'much', 'long', 'open', 'price', 'quote', 'print', 'printing', 'file', 'send', 'address', 'hours', 'contact'];
  var PT_WORDS = ['o', 'a', 'os', 'as', 'que', 'como', 'voces', 'tem', 'tens', 'onde', 'quando', 'ola', 'obrigado', 'obrigada', 'preciso', 'quero', 'posso', 'para', 'com', 'de', 'e', 'um', 'uma', 'quanto', 'custa', 'fazem', 'estao', 'esta', 'sao', 'faz', 'orcamento', 'preco', 'ficheiro', 'horario', 'morada', 'imprimir', 'bom', 'boa'];

  function detectLang(text) {
    var words = norm(text).split(/[^a-z0-9]+/).filter(Boolean);
    var en = 0;
    var pt = 0;
    words.forEach(function (w) {
      if (EN_WORDS.indexOf(w) !== -1) en++;
      if (PT_WORDS.indexOf(w) !== -1) pt++;
    });
    return en > pt ? 'en' : 'pt';
  }

  /* ---------- Conhecimento ---------- */
  var waLink = function (t) { return D.wa ? 'https://wa.me/' + D.wa + '?text=' + encodeURIComponent(t) : ''; };
  var tel = 'tel:+351' + String(D.phone).replace(/\D/g, '');

  var L = {
    quote: { pt: 'Pedir orçamento', en: 'Request a quote', href: '/orcamento' },
    file: { pt: 'Enviar ficheiro', en: 'Send a file', href: '/enviar-ficheiros' },
    services: { pt: 'Ver serviços', en: 'See services', href: '/servicos' },
    portfolio: { pt: 'Ver portefólio', en: 'See portfolio', href: '/portefolio' },
    contacts: { pt: 'Contactos', en: 'Contacts', href: '/contactos' },
    call: { pt: 'Ligar', en: 'Call', href: tel },
    login: { pt: 'Entrar', en: 'Log in', href: '/entrar' },
    wa: { pt: 'WhatsApp', en: 'WhatsApp', href: waLink('Olá! Tenho uma dúvida.') },
    mail: { pt: 'Enviar e-mail', en: 'Send e-mail', href: 'mailto:' + D.email },
  };

  var INTENTS = [
    {
      id: 'greet', k: ['ola', 'bom dia', 'boa tarde', 'boa noite', 'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'],
      pt: 'Olá! Sou o assistente da Grafilândia. Posso ajudar com serviços, orçamentos, ficheiros, horário e morada.',
      en: 'Hello! I am the Grafilândia assistant. I can help with services, quotes, files, opening hours and our address.',
      links: ['quote', 'file'],
    },
    {
      id: 'services', k: ['servico', 'servicos', 'produto', 'produtos', 'fazem', 'trabalham', 'imprimem', 'imprimir', 'o que fazem', 'services', 'products', 'what do you', 'print'],
      pt: 'Fazemos cartões de visita, folhetos, cartazes, fardamento personalizado e brindes promocionais. Se precisares de outra coisa, pergunta-nos.',
      en: 'We make business cards, flyers, posters, custom workwear and promotional gifts. If you need something else, just ask.',
      links: ['services', 'quote'],
    },
    {
      id: 'cards', k: ['cartao', 'cartoes', 'visita', 'business card', 'business cards'],
      pt: 'Fazemos cartões de visita. Diz-nos a quantidade, o papel e o acabamento no formulário de orçamento e respondemos com o preço.',
      en: 'We make business cards. Tell us the quantity, paper and finish in the quote form and we will reply with the price.',
      links: ['quote'],
    },
    {
      id: 'flyers', k: ['folheto', 'folhetos', 'flyer', 'flyers', 'panfleto', 'panfletos', 'leaflet'],
      pt: 'Fazemos folhetos e flyers em vários formatos e papéis. Pede o orçamento com o formato e a quantidade.',
      en: 'We make flyers and leaflets in several formats and papers. Request a quote with the format and quantity.',
      links: ['quote'],
    },
    {
      id: 'posters', k: ['cartaz', 'cartazes', 'poster', 'posters'],
      pt: 'Fazemos cartazes para montras, eventos e campanhas. Indica o tamanho e a quantidade no pedido de orçamento.',
      en: 'We make posters for shop windows, events and campaigns. Add the size and quantity to your quote request.',
      links: ['quote'],
    },
    {
      id: 'workwear', k: ['fardamento', 'roupa', 'tshirt', 't-shirt', 'camisola', 'camisolas', 'polo', 'uniforme', 'uniformes', 'workwear', 'clothes', 'shirt'],
      pt: 'Fazemos fardamento personalizado com o nome e a marca da tua empresa. Diz-nos as peças e quantidades e respondemos com o preço.',
      en: 'We make custom workwear with your company name and brand. Tell us the items and quantities and we will reply with a price.',
      links: ['quote'],
    },
    {
      id: 'gifts', k: ['brinde', 'brindes', 'promocional', 'promocionais', 'caneca', 'canecas', 'merchandising', 'gift', 'gifts', 'promotional'],
      pt: 'Temos brindes promocionais personalizados. Diz-nos o que tens em mente e a quantidade, e respondemos com o preço.',
      en: 'We offer personalised promotional gifts. Tell us what you have in mind and the quantity and we will reply with a price.',
      links: ['quote'],
    },
    {
      id: 'quote', k: ['orcamento', 'orcamentos', 'preco', 'precos', 'quanto custa', 'quanto', 'custa', 'valor', 'price', 'prices', 'quote', 'cost', 'how much'],
      pt: 'Para saber o preço, preenche o pedido de orçamento (produto, quantidade e papel). Respondemos com o valor exato por e-mail ou WhatsApp.',
      en: 'To get a price, fill in the quote request (product, quantity and paper). We reply with the exact price by e-mail or WhatsApp.',
      links: ['quote', 'wa'],
    },
    {
      id: 'files', k: ['ficheiro', 'ficheiros', 'pdf', 'enviar', 'formato', 'formatos', 'resolucao', 'dpi', 'sangria', 'cmyk', 'cores', 'arte final', 'design', 'file', 'files', 'upload', 'artwork', 'bleed', 'resolution'],
      pt: 'Podes enviar o ficheiro pelo site. Em geral, PDF com 300 dpi, sangria de 3 mm e cores em CMYK dá os melhores resultados. Se tiveres dúvidas, envia na mesma ou pergunta-nos por WhatsApp.',
      en: 'You can send your file through the website. In general, a PDF at 300 dpi with 3 mm bleed and CMYK colours gives the best results. If in doubt, send it anyway or ask us on WhatsApp.',
      links: ['file', 'wa'],
    },
    {
      id: 'deadline', k: ['prazo', 'prazos', 'urgente', 'urgencia', 'quando', 'demora', 'demoram', 'rapido', 'entrega', 'deadline', 'urgent', 'how long', 'delivery', 'fast'],
      pt: 'O prazo depende do produto e da quantidade. Para trabalhos urgentes, fala connosco por telefone ou WhatsApp e dizemos-te o que é possível.',
      en: 'The turnaround depends on the product and quantity. For urgent jobs, call or message us on WhatsApp and we will tell you what is possible.',
      links: ['call', 'wa'],
    },
    {
      id: 'hours', k: ['horario', 'horarios', 'hora', 'horas', 'aberto', 'aberta', 'fechado', 'abre', 'fecha', 'abrem', 'fecham', 'open', 'hours', 'closed', 'opening'],
      pt: function () { return 'O nosso horário: ' + D.hours + '.'; },
      en: function () { return 'Our opening hours: ' + D.hours + '.'; },
      links: ['contacts'],
    },
    {
      id: 'address', k: ['morada', 'onde', 'localizacao', 'mapa', 'chegar', 'loja', 'odivelas', 'address', 'where', 'location', 'map', 'directions', 'shop', 'store'],
      pt: function () { return 'Estamos em ' + D.address + '. O mapa está no fundo do site.'; },
      en: function () { return 'We are at ' + D.address + '. The map is at the bottom of the site.'; },
      links: ['contacts'],
    },
    {
      id: 'pickup', k: ['levantar', 'levantamento', 'buscar', 'recolher', 'recolha', 'pick up', 'pickup', 'collect'],
      pt: function () { return 'Podes levantar as tuas impressões na nossa loja: ' + D.address + '. Horário: ' + D.hours + '.'; },
      en: function () { return 'You can pick up your prints at our shop: ' + D.address + '. Hours: ' + D.hours + '.'; },
      links: ['contacts'],
    },
    {
      id: 'contact', k: ['telefone', 'telemovel', 'ligar', 'contacto', 'contactos', 'email', 'e-mail', 'whatsapp', 'falar', 'phone', 'call', 'contact', 'talk'],
      pt: function () { return 'Podes falar connosco pelo telefone ' + D.phone + ' ou por e-mail (' + D.email + ').' + (D.wa ? ' Também respondemos por WhatsApp.' : ''); },
      en: function () { return 'You can reach us by phone at ' + D.phone + ' or by e-mail (' + D.email + ').' + (D.wa ? ' We also answer on WhatsApp.' : ''); },
      links: ['call', 'wa', 'mail'],
    },
    {
      id: 'portfolio', k: ['portefolio', 'trabalhos', 'exemplos', 'fotos', 'portfolio', 'examples', 'work', 'gallery'],
      pt: 'No portefólio podes ver exemplos de trabalhos que já imprimimos.',
      en: 'In the portfolio you can see examples of jobs we have already printed.',
      links: ['portfolio'],
    },
    {
      id: 'account', k: ['conta', 'login', 'registar', 'entrar', 'password', 'palavra-passe', 'pedidos', 'estado', 'account', 'register', 'sign in', 'log in', 'status'],
      pt: 'Com uma conta podes acompanhar o estado dos teus pedidos. Se te esqueceste da palavra-passe, usa a opção "Esqueci-me" no ecrã de entrada.',
      en: 'With an account you can follow the status of your requests. If you forgot your password, use the "forgot password" link on the login page.',
      links: ['login'],
    },
    {
      id: 'thanks', k: ['obrigado', 'obrigada', 'obg', 'valeu', 'thanks', 'thank you', 'thx'],
      pt: 'De nada! Se precisares de mais alguma coisa, é só dizer.',
      en: 'You are welcome! If you need anything else, just ask.',
      links: [],
    },
    {
      id: 'bye', k: ['adeus', 'tchau', 'ate logo', 'bye', 'goodbye', 'see you'],
      pt: 'Até já! Estamos por aqui quando precisares.',
      en: 'See you soon! We are here whenever you need us.',
      links: [],
    },
  ];

  var FALLBACK = {
    pt: 'Não tenho a certeza de ter percebido. Podes escolher uma das opções abaixo ou falar diretamente com a equipa.',
    en: 'I am not sure I understood. You can pick one of the options below or talk to the team directly.',
    links: ['quote', 'call', 'wa'],
  };

  var CHIPS = {
    pt: [['Pedir orçamento', 'quero um orçamento'], ['Enviar ficheiro', 'como envio o ficheiro'], ['Horário', 'qual é o horário'], ['Como chegar', 'qual é a morada'], ['Prazos', 'quais os prazos']],
    en: [['Request a quote', 'I want a quote'], ['Send a file', 'how do I send a file'], ['Opening hours', 'what are the opening hours'], ['Where are you', 'what is the address'], ['Turnaround', 'how long does it take']],
  };

  /* ---------- Escolha da resposta ---------- */
  function match(text) {
    var n = norm(text);
    var tokens = n.split(/[^a-z0-9-]+/).filter(Boolean);
    var best = null;
    var bestScore = 0;
    INTENTS.forEach(function (it) {
      var score = 0;
      it.k.forEach(function (kw) {
        if (kw.indexOf(' ') !== -1) {
          if (n.indexOf(kw) !== -1) score += 3;
        } else if (tokens.indexOf(kw) !== -1) {
          score += 2;
        } else if (kw.length >= 5 && tokens.some(function (t) { return t.indexOf(kw) === 0; })) {
          score += 1;
        }
      });
      if (score > bestScore) { best = it; bestScore = score; }
    });
    return bestScore >= 1 ? best : null;
  }

  /* ---------- Interface ---------- */
  function addMsg(who, text, links, lang) {
    var el = document.createElement('div');
    el.className = 'msg msg-' + who;
    el.textContent = text;
    (links || []).forEach(function (key) {
      var l = L[key];
      if (!l || !l.href) return;
      var a = document.createElement('a');
      a.className = 'msg-link';
      a.href = l.href;
      a.textContent = l[lang];
      if (/^https?:/.test(l.href)) { a.target = '_blank'; a.rel = 'noopener'; }
      el.appendChild(a);
    });
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }

  function setChips(lang) {
    chipsBox.textContent = '';
    CHIPS[lang].forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = c[0];
      b.addEventListener('click', function () { ask(c[1], lang); });
      chipsBox.appendChild(b);
    });
  }

  function reply(text, forcedLang) {
    var lang = forcedLang || detectLang(text);
    var it = match(text);
    var data = it || FALLBACK;
    var body = typeof data[lang] === 'function' ? data[lang]() : data[lang];

    var typing = document.createElement('div');
    typing.className = 'msg msg-bot msg-typing';
    typing.innerHTML = '<i></i><i></i><i></i>';
    typing.setAttribute('aria-label', lang === 'en' ? 'Typing' : 'A escrever');
    msgs.appendChild(typing);
    msgs.scrollTop = msgs.scrollHeight;

    setTimeout(function () {
      typing.remove();
      addMsg('bot', body, data.links, lang);
      setChips(lang);
    }, 450);
  }

  function ask(text, forcedLang) {
    var t = String(text || '').trim();
    if (!t) return;
    addMsg('user', t);
    reply(t, forcedLang);
  }

  var started = false;
  function open() {
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    if (!started) {
      started = true;
      addMsg('bot', 'Olá! Sou o assistente da Grafilândia. Posso ajudar com serviços, orçamentos, ficheiros, horário e morada.', ['quote', 'file'], 'pt');
      setChips('pt');
    }
    setTimeout(function () { input.focus(); }, 50);
  }
  function close() {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus();
  }

  toggle.addEventListener('click', function () { if (panel.hidden) open(); else close(); });
  closeBtn.addEventListener('click', close);
  root.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) close(); });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = input.value;
    input.value = '';
    ask(v);
  });
})();
