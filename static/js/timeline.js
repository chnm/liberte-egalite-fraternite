/*
 * Timeline of the Revolution — progressive enhancement.
 *
 * The page already contains the canonical, accessible content: an ordered list
 * (#neatlinetime-events) of every dated item, each <li> carrying the data the
 * widget needs in data-* attributes. With JS + vis-timeline present, we read
 * those nodes and render an interactive timeline above the list. With no JS (or
 * no vis), the list alone is the experience.
 */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Roughly a third of the items carry only a year (and some only a year+month).
  // Placing them all on Jan 1 / the 1st would pile dozens of events on a single
  // pixel and force an enormous vertical stack. Spread each imprecise item
  // deterministically across the range we actually know (its year, or its
  // month) so the band reads cleanly. Exact (day-precision) dates are untouched.
  function spreadStart(s, precision, seed) {
    var p = s.split('-');
    var d = new Date(Date.UTC(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)));
    if (precision === 'year') d.setUTCDate(d.getUTCDate() + (seed * 97) % 365);
    else if (precision === 'month') d.setUTCDate(d.getUTCDate() + (seed * 13) % 27);
    return d;
  }

  ready(function () {
    var mount = document.getElementById('neatlinetime-timeline');
    var list = document.getElementById('neatlinetime-events');
    var detail = document.getElementById('timeline-detail');
    if (!mount || !list || typeof vis === 'undefined') return;

    var nodes = list.querySelectorAll('li');
    var items = [];
    nodes.forEach(function (li, i) {
      var start = li.getAttribute('data-start');
      if (!start) return;
      var a = li.querySelector('a');
      var p = li.querySelector('p');
      var title = a ? a.textContent.trim() : '';
      items.push({
        id: i,
        start: spreadStart(start, li.getAttribute('data-precision') || 'day', i),
        // Render as a coloured dot (no inline label): with ~900 dense events,
        // wide text labels would force a near-one-per-row stack. The title shows
        // on hover and on select, and the full labelled list sits below.
        type: 'point',
        content: '',
        className: li.getAttribute('data-classname') || '',
        title: escapeHtml(title), // native hover tooltip
        name: escapeHtml(title),  // shown in the detail panel on select
        link: li.getAttribute('data-link') || (a ? a.getAttribute('href') : '#'),
        image: li.getAttribute('data-image') || '',
        desc: p ? p.textContent.trim() : ''
      });
    });
    if (!items.length) return;

    var dataset = new vis.DataSet(items);

    var timeline = new vis.Timeline(mount, dataset, {
      // The original NeatlineTime timeline centred on 1789. Open on the opening
      // years of the Revolution and let the reader pan/zoom out to the
      // 13th–20th-century outliers. Like the original SIMILE band, events stack
      // into vertical rows (stack:true) so labels stay legible; the band is a
      // fixed height with an internal vertical scrollbar for the dense years.
      start: '1789-01-01',
      end: '1792-01-01',
      min: '1200-01-01',
      max: '1980-01-01',
      height: '460px',
      verticalScroll: true, // safety for a very dense zoom; the default view fits
      zoomMin: 1000 * 60 * 60 * 24 * 30,            // ~1 month
      zoomMax: 1000 * 60 * 60 * 24 * 365 * 900,     // ~900 years
      zoomKey: 'ctrlKey',   // plain wheel scrolls the band; ctrl+wheel zooms time
      stack: true,
      tooltip: { followMouse: true },
      margin: { item: 2, axis: 5 },
      orientation: { axis: 'both' }   // time axis top and bottom, evoking SIMILE's two bands
    });

    function showDetail(id) {
      if (id == null) { detail.hidden = true; detail.innerHTML = ''; return; }
      var it = dataset.get(id);
      if (!it) { detail.hidden = true; return; }
      var html = '';
      if (it.image) {
        html += '<img class="detail-thumb" src="' + escapeHtml(it.image) + '" alt="">';
      }
      html += '<h2>' + it.name + '</h2>';   // already escaped
      if (it.desc) html += '<p>' + escapeHtml(it.desc) + '</p>';
      html += '<p><a href="' + escapeHtml(it.link) + '">View item &rarr;</a></p>';
      detail.innerHTML = html;
      detail.hidden = false;
    }

    timeline.on('select', function (props) {
      showDetail(props.items && props.items.length ? props.items[0] : null);
    });
    // Double-clicking a cluster zooms into it; selecting a real item shows detail.
    timeline.on('doubleClick', function (props) {
      if (props.item != null) {
        var it = dataset.get(props.item);
        if (it && it.link) window.location.href = it.link;
      }
    });
  });
})();
