/*
 * Advanced item search (/items/search/), run entirely client-side against the
 * inline #adv-items dataset. Approximates Omeka's advanced search: keyword,
 * per-field contains/is-exactly/etc., ID range, Collection, Type, Tags, Featured.
 */
(function () {
  'use strict';

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function getData() {
    var node = document.getElementById('adv-items');
    try { return node ? JSON.parse(node.textContent) : []; } catch (e) { return []; }
  }
  function parseRange(s) {
    if (!s) return null;
    var set = new Set();
    s.split(',').forEach(function (part) {
      part = part.trim();
      if (!part) return;
      var m = part.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) { for (var i = +m[1]; i <= +m[2]; i++) set.add(String(i)); }
      else set.add(part);
    });
    return set.size ? set : null;
  }
  function fieldMatch(val, type, terms) {
    val = String(val || '').toLowerCase().trim();
    terms = String(terms || '').toLowerCase().trim();
    switch (type) {
      case 'is empty': return val === '';
      case 'is not empty': return val !== '';
      case 'is exactly': return val === terms;
      case 'does not contain': return terms === '' || val.indexOf(terms) === -1;
      default: return terms === '' || val.indexOf(terms) !== -1; // contains
    }
  }
  function parseRows(qs) {
    var rows = {};
    qs.forEach(function (v, k) {
      var m = k.match(/^advanced\[(\d+)\]\[(element|type|terms)\]$/);
      if (m) { (rows[m[1]] = rows[m[1]] || {})[m[2]] = v; }
    });
    return Object.keys(rows).map(function (k) { return rows[k]; })
      .filter(function (r) { return r.element && (r.terms || r.type === 'is empty' || r.type === 'is not empty'); });
  }

  function urlForPage(qs, p) { var q = new URLSearchParams(qs); q.set('page', p); return '/items/search/?' + q.toString(); }

  function pager(qs, page, pages) {
    var nav = el('nav', { class: 'pagination-nav', 'aria-label': 'Pagination' });
    var prev = el('div', { class: 'pagination_previous' });
    if (page > 1) prev.innerHTML = '<a class="button" rel="prev" href="' + urlForPage(qs, page - 1) + '"><i class="fas fa-caret-left" aria-hidden="true"></i> Previous</a>';
    var inp = el('div', { class: 'page-input' });
    inp.innerHTML = '<form><label class="show-for-sr">Go to page</label>Page <input type="number" name="page" min="1" max="' + pages + '" value="' + page + '" aria-label="Go to page"><span class="total-count"> of ' + pages + '</span></form>';
    inp.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); var n = parseInt(this.elements.page.value, 10); if (n >= 1 && n <= pages) location.href = urlForPage(qs, n); });
    var next = el('div', { class: 'pagination_next' });
    if (page < pages) next.innerHTML = '<a class="button" rel="next" href="' + urlForPage(qs, page + 1) + '">Next <i class="fas fa-caret-right" aria-hidden="true"></i></a>';
    nav.appendChild(prev); nav.appendChild(inp); nav.appendChild(next);
    return nav;
  }

  function render(results, matched, qs) {
    var heading = document.getElementById('search-heading');
    if (heading) heading.innerHTML = 'Search Items <small>(' + matched.length + ' total)</small>';
    results.innerHTML = '';
    if (!matched.length) { results.appendChild(el('p', {}, 'No items found.')); return; }
    var page = Math.max(1, parseInt(qs.get('page') || '1', 10));
    var perPage = 10, pages = Math.max(1, Math.ceil(matched.length / perPage));
    page = Math.min(page, pages);
    results.appendChild(pager(qs, page, pages));
    var table = el('table', { class: 'search-results-table' });
    table.innerHTML = '<thead><tr><th scope="col">Record Type</th><th scope="col">Title</th></tr></thead>';
    var tb = el('tbody');
    matched.slice((page - 1) * perPage, page * perPage).forEach(function (it) {
      var thumb = it.th ? '<a class="search-thumb" href="' + it.u + '"><img src="' + escapeHtml(it.th) + '" alt="" loading="lazy"></a>' : '';
      var desc = (it.fields && it.fields.description) ? '<div class="excerpt">' + escapeHtml(it.fields.description) + '</div>' : '';
      var tr = el('tr', { class: 'item' });
      tr.appendChild(el('td', { class: 'record-type' }, 'Item'));
      tr.appendChild(el('td', { class: 'item-meta' }, thumb + '<a class="permalink" href="' + it.u + '">' + escapeHtml(it.t) + '</a>' + desc));
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    results.appendChild(table);
    results.appendChild(pager(qs, page, pages));
  }

  function prefill(qs, rows) {
    var set = function (id, v) { var e = document.getElementById(id); if (e) e.value = v; };
    set('keyword-search', qs.get('search') || '');
    set('range', qs.get('range') || '');
    set('collection-search', qs.get('collection') || '');
    set('item-type-search', qs.get('type') || '');
    set('tag-search', qs.get('tags') || '');
    set('featured', qs.get('featured') || '');
    var container = document.getElementById('advanced-rows');
    if (container && rows.length) {
      while (container.querySelectorAll('.advanced-search-row').length < rows.length) addRow();
      var rowEls = container.querySelectorAll('.advanced-search-row');
      rows.forEach(function (r, i) {
        var re = rowEls[i]; if (!re) return;
        re.querySelector('.advanced-search-element').value = r.element || '';
        re.querySelector('.advanced-search-type').value = r.type || 'contains';
        re.querySelector('.advanced-search-terms').value = r.terms || '';
      });
    }
  }
  function addRow() {
    var container = document.getElementById('advanced-rows');
    if (!container) return;
    var rows = container.querySelectorAll('.advanced-search-row');
    var n = rows.length, clone = rows[0].cloneNode(true);
    clone.querySelectorAll('[name]').forEach(function (inp) {
      inp.name = inp.name.replace(/advanced\[\d+\]/, 'advanced[' + n + ']');
      if (inp.tagName === 'SELECT') inp.selectedIndex = 0; else inp.value = '';
    });
    container.appendChild(clone);
  }

  function run() {
    var results = document.getElementById('search-results');
    if (!results) return;
    var data = getData();
    var qs = new URLSearchParams(location.search);
    var keyword = (qs.get('search') || '').trim().toLowerCase();
    var range = parseRange(qs.get('range'));
    var collection = qs.get('collection') || '';
    var type = qs.get('type') || '';
    var tags = (qs.get('tags') || '').trim().toLowerCase().split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var featured = qs.get('featured') || '';
    var rows = parseRows(qs);

    prefill(qs, rows);

    if (!(keyword || range || collection || type || tags.length || featured || rows.length)) {
      results.innerHTML = '<p>Use the fields above to search the items.</p>';
      return;
    }

    var matched = data.filter(function (it) {
      var fields = it.fields || {};
      if (keyword) {
        var hay = (it.t || '').toLowerCase() + ' ' + Object.keys(fields).map(function (k) { return fields[k]; }).join(' ').toLowerCase();
        if (hay.indexOf(keyword) === -1) return false;
      }
      for (var i = 0; i < rows.length; i++) {
        if (!fieldMatch(fields[rows[i].element.toLowerCase()], rows[i].type, rows[i].terms)) return false;
      }
      if (range && !range.has(String(it.id))) return false;
      if (collection && (it.co || []).indexOf(collection) === -1) return false;
      if (type && it.ty !== type) return false;
      if (featured === '1' && it.f !== true) return false;
      if (featured === '0' && it.f !== false) return false;
      if (tags.length) {
        var itTags = (it.tg || []).map(function (s) { return String(s).toLowerCase(); });
        if (!tags.some(function (t) { return itTags.indexOf(t) !== -1; })) return false;
      }
      return true;
    });

    render(results, matched, qs);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var add = document.getElementById('add-field');
    if (add) add.addEventListener('click', addRow);
    run();
  });
})();
