/*
 * Client-side site search using Pagefind's low-level API. Driven by the header
 * form (query + record_types[]) and the advanced form (/items/search/), whose
 * type/collection/tag params become Pagefind filters tagged on item pages.
 * "Quoted phrases" are exact matches (Pagefind). Renders a "Search (N total)"
 * results table like the original results page.
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
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var TYPES = ['Item', 'Exhibit', 'Page'];
  // URL param -> Pagefind filter key (see items/single.html) and display label.
  var FILTERS = { type: ['item_type', 'Type'], collection: ['collection', 'Collection'], tag: ['tag', 'Tag'] };

  function searchUrl(state, overrides) {
    var p = new URLSearchParams();
    if (state.query) p.set('query', state.query);
    state.record_types.forEach(function (t) { p.append('record_types[]', t); });
    for (var f in state.filters) p.set(f, state.filters[f]);
    for (var k in overrides) p.set(k, overrides[k]);
    return '/search/?' + p.toString();
  }

  function pagination(state, page, pages, label) {
    var nav = el('nav', { class: 'pagination-nav', 'aria-label': label });
    var prev = el('div', { class: 'pagination_previous' });
    if (page > 1) prev.innerHTML = '<a class="button" rel="prev" href="' + searchUrl(state, { page: page - 1 }) + '"><i class="fas fa-caret-left" aria-hidden="true"></i> Previous</a>';
    var input = el('div', { class: 'page-input' });
    input.innerHTML = '<form>Page <input type="number" name="page" min="1" max="' + pages + '" value="' + page + '" aria-label="Go to page"><span class="total-count"> of ' + pages + '</span></form>';
    input.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var n = parseInt(this.elements.page.value, 10);
      if (n >= 1 && n <= pages) location.href = searchUrl(state, { page: n });
    });
    var next = el('div', { class: 'pagination_next' });
    if (page < pages) next.innerHTML = '<a class="button" rel="next" href="' + searchUrl(state, { page: page + 1 }) + '">Next <i class="fas fa-caret-right" aria-hidden="true"></i></a>';
    nav.appendChild(prev); nav.appendChild(input); nav.appendChild(next);
    return nav;
  }

  async function run() {
    var results = document.getElementById('search-results');
    var heading = document.getElementById('search-heading');
    if (!results) return;

    var qs = new URLSearchParams(location.search);
    var query = (qs.get('query') || qs.get('q') || '').trim();
    var rtypes = qs.getAll('record_types[]');
    if (!rtypes.length) rtypes = TYPES.slice();
    var page = Math.max(1, parseInt(qs.get('page') || '1', 10));
    var filters = {}, pfFilters = {};
    for (var f in FILTERS) { var v = (qs.get(f) || '').trim(); if (v) { filters[f] = v; pfFilters[FILTERS[f][0]] = v; } }
    var state = { query: query, record_types: rtypes, filters: filters };

    // Reflect the request back into the header form.
    var qi = document.getElementById('query'); if (qi) qi.value = query;
    TYPES.forEach(function (t) {
      var cb = document.getElementById('record_types-' + t);
      if (cb) cb.checked = rtypes.indexOf(t) !== -1;
    });

    if (!query && !Object.keys(filters).length) { results.innerHTML = '<p>Enter a term in the search box above to search the site.</p>'; return; }

    results.innerHTML = '<p>Searching…</p>';
    var pf;
    try { pf = await import('/pagefind/pagefind.js'); }
    catch (err) { results.innerHTML = '<p>Search is unavailable.</p>'; return; }

    if (rtypes.length && rtypes.length < TYPES.length) pfFilters.type = { any: rtypes };
    // A null query with filters returns every page matching the filters.
    var search = await pf.search(query || null, { filters: pfFilters });
    var total = search.results.length;

    if (heading) heading.innerHTML = 'Search <small>(' + total + ' total)</small>';

    results.innerHTML = '';
    var meta = el('div', { class: 'search-meta' });
    if (query) meta.appendChild(el('span', { class: 'label secondary' }, 'Query: ' + escapeHtml(query)));
    for (var k in filters) meta.appendChild(el('span', { class: 'label secondary' }, FILTERS[k][1] + ': ' + escapeHtml(filters[k])));
    meta.appendChild(el('span', { class: 'label secondary' }, 'Record types: ' + escapeHtml(rtypes.join(', ').toLowerCase())));
    results.appendChild(meta);

    if (!total) { results.appendChild(el('p', {}, 'No results found.')); return; }

    var perPage = 10;
    var pages = Math.max(1, Math.ceil(total / perPage));
    page = Math.min(page, pages);
    // Load result data only for the page shown.
    var slice = await Promise.all(search.results.slice((page - 1) * perPage, page * perPage).map(function (r) { return r.data(); }));

    results.appendChild(pagination(state, page, pages, 'Pagination, top'));

    var table = el('table', { class: 'search-results-table' });
    table.innerHTML = '<thead><tr><th scope="col">Record Type</th><th scope="col">Title</th></tr></thead>';
    var tbody = el('tbody');
    slice.forEach(function (d) {
      var type = (d.filters && d.filters.type && d.filters.type[0]) || 'Item';
      var img = d.meta && d.meta.image;
      var thumb = img ? '<a class="search-thumb" href="' + d.url + '" tabindex="-1" aria-hidden="true"><img src="' + escapeHtml(img) + '" alt="" loading="lazy"></a>' : '';
      var title = escapeHtml((d.meta && d.meta.title) || 'Untitled');
      var tr = el('tr', { class: 'item' });
      tr.appendChild(el('td', { class: 'record-type' }, escapeHtml(type)));
      tr.appendChild(el('td', { class: 'item-meta' },
        thumb + '<a class="permalink" href="' + d.url + '">' + title + '</a><div class="excerpt">' + d.excerpt + '</div>'));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    results.appendChild(table);
    results.appendChild(pagination(state, page, pages, 'Pagination, bottom'));
  }

  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run);
})();
