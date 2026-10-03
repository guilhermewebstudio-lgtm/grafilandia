/* Formulários: resumo do orçamento, envio de ficheiros com progresso e submissão sem recarregar. */
(function () {
  'use strict';

  /* ---------- Resumo do orçamento ---------- */
  var quote = document.getElementById('quoteForm');
  if (quote) {
    var list = document.getElementById('quoteSummary');
    var empty = document.getElementById('summaryEmpty');
    var wa = document.getElementById('waQuote');
    var fields = [
      ['product', 'Produto'],
      ['format', 'Formato'],
      ['paper', 'Papel / material'],
      ['finish', 'Acabamento'],
      ['quantity', 'Quantidade'],
    ];

    var render = function () {
      var lines = [];
      list.textContent = '';
      fields.forEach(function (f) {
        var el = quote.elements[f[0]];
        var val = el && el.value ? el.value.trim() : '';
        if (!val) return;
        lines.push(f[1] + ': ' + val);
        var row = document.createElement('div');
        var dt = document.createElement('dt');
        var dd = document.createElement('dd');
        dt.textContent = f[1];
        dd.textContent = val;
        row.appendChild(dt);
        row.appendChild(dd);
        list.appendChild(row);
      });
      empty.hidden = lines.length > 0;
      if (wa) {
        var text = 'Olá! Gostava de pedir um orçamento.' + (lines.length ? '\n' + lines.join('\n') : '');
        var notes = quote.elements.notes && quote.elements.notes.value.trim();
        if (notes) text += '\nNotas: ' + notes;
        wa.href = 'https://wa.me/' + wa.getAttribute('data-wa') + '?text=' + encodeURIComponent(text);
      }
    };

    quote.addEventListener('input', render);
    quote.addEventListener('change', render);
    quote.querySelectorAll('[data-qty]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        quote.elements.quantity.value = btn.getAttribute('data-qty');
        render();
      });
    });
    render();
  }

  /* ---------- Dropzone ---------- */
  var fileForm = document.getElementById('fileForm');
  if (fileForm) {
    var input = document.getElementById('ficheiro');
    var drop = document.getElementById('drop');
    var nameEl = document.getElementById('dropName');
    var maxMb = parseInt(fileForm.getAttribute('data-max-mb'), 10) || 20;
    var exts = (fileForm.getAttribute('data-exts') || '').split(',');

    var showFile = function () {
      var f = input.files && input.files[0];
      nameEl.textContent = f ? f.name + ' (' + (f.size / 1048576).toFixed(1).replace('.', ',') + ' MB)' : '';
    };
    input.addEventListener('change', showFile);
    input.addEventListener('focus', function () { drop.classList.add('is-over'); });
    input.addEventListener('blur', function () { drop.classList.remove('is-over'); });
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('is-over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('is-over'); });
    });
    drop.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files.length) {
        input.files = e.dataTransfer.files;
        showFile();
      }
    });

    fileForm.addEventListener('submit', function (e) {
      var f = input.files && input.files[0];
      var err = null;
      if (!f) err = 'Anexa o ficheiro que queres imprimir.';
      else if (f.size > maxMb * 1048576) err = 'O ficheiro é demasiado grande (máximo ' + maxMb + ' MB).';
      else if (exts.indexOf(f.name.split('.').pop().toLowerCase()) === -1) err = 'Formato não suportado. Podes enviar: ' + exts.join(', ').toUpperCase() + '.';
      if (err) {
        e.preventDefault();
        e.stopImmediatePropagation();
        showError(fileForm, err);
      }
    }, true);
  }

  /* ---------- Submissão por XHR (com barra de progresso nos ficheiros) ---------- */
  function showError(form, msg) {
    var box = form.querySelector('[data-error]');
    if (!box) return;
    box.textContent = msg;
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  document.querySelectorAll('form[data-ajax]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (e.defaultPrevented) return;
      if (!form.checkValidity()) return; // deixa o browser mostrar os avisos
      e.preventDefault();

      var btn = form.querySelector('button[type=submit]');
      var label = btn.textContent;
      var bar = document.getElementById('progressBar');
      var progress = document.getElementById('progress');
      var errBox = form.querySelector('[data-error]');
      if (errBox) errBox.hidden = true;
      btn.disabled = true;
      btn.textContent = 'A enviar…';

      var xhr = new XMLHttpRequest();
      xhr.open('POST', form.action);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

      if (xhr.upload && bar && progress) {
        progress.hidden = false;
        xhr.upload.onprogress = function (ev) {
          if (ev.lengthComputable) bar.style.width = Math.round((ev.loaded / ev.total) * 100) + '%';
        };
      }

      var fail = function (msg) {
        btn.disabled = false;
        btn.textContent = label;
        if (progress) progress.hidden = true;
        showError(form, msg);
      };

      xhr.onload = function () {
        var data = null;
        try { data = JSON.parse(xhr.responseText); } catch { /* resposta não JSON */ }
        if (data && data.ok && data.redirect) {
          if (window.gfLeave) window.gfLeave(data.redirect);
          else window.location.href = data.redirect;
        } else {
          fail((data && data.error) || 'Não foi possível enviar. Tenta outra vez.');
        }
      };
      xhr.onerror = function () { fail('Sem ligação. Verifica a internet e tenta outra vez.'); };
      // Formulários sem ficheiro seguem como urlencoded (é o que essas rotas lêem); com ficheiro, multipart.
      if (form.enctype === 'multipart/form-data') {
        xhr.send(new FormData(form));
      } else {
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.send(new URLSearchParams(new FormData(form)).toString());
      }
    });
  });
})();
