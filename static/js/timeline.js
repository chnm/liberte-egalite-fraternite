/*
 * Timeline of the Revolution: progressive enhancement.
 *
 * The page already contains the canonical, accessible content: an ordered list
 * (#neatlinetime-events) of every dated item, each <li> carrying the data the
 * widget needs in data-* attributes. With JS + vis-timeline present, we read
 * those nodes and recreate the original NeatlineTime (SIMILE) widget above the
 * list: a detail band (gold dot + title per event, months at 100px) synced with
 * an overview band (a tick per event, years at 200px, the detail span
 * highlighted). Clicking an event opens a popup like SIMILE's info bubble.
 */
(function () {
  'use strict';

  var DAY = 864e5;
  var MONTH_PX = 100;   // SIMILE detail band: intervalPixels 100, unit MONTH
  var YEAR_PX = 200;    // SIMILE overview band: intervalPixels 200, unit YEAR
  var CENTER = Date.UTC(1789, 0, 1);  // the original's centerDate

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
  // pixel. Spread each imprecise item deterministically across the range we
  // actually know (its year, or its month). Exact dates are untouched.
  function spreadStart(s, precision, seed) {
    var p = s.split('-');
    var d = new Date(Date.UTC(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)));
    if (precision === 'year') d.setUTCDate(d.getUTCDate() + (seed * 97) % 365);
    else if (precision === 'month') d.setUTCDate(d.getUTCDate() + (seed * 13) % 27);
    return d;
  }

  // Visible time span for a band of this width at a given pixels-per-unit.
  function span(el, px, unitDays) { return (el.clientWidth / px) * unitDays * DAY; }

  ready(function () {
    var detailEl = document.getElementById('timeline-detail-band');
    var overviewEl = document.getElementById('timeline-overview-band');
    var list = document.getElementById('neatlinetime-events');
    var bubble = document.getElementById('timeline-bubble');
    var controls = document.getElementById('timeline-controls');
    if (!detailEl || !overviewEl || !list || typeof vis === 'undefined') return;

    var events = [], ticks = [];
    list.querySelectorAll('li').forEach(function (li, i) {
      var start = li.getAttribute('data-start');
      if (!start) return;
      var a = li.querySelector('a'), p = li.querySelector('p'), d = li.querySelector('.event-date');
      var at = spreadStart(start, li.getAttribute('data-precision') || 'day', i);
      var title = a ? a.textContent.trim() : '';
      events.push({
        id: i, start: at, type: 'point', content: escapeHtml(title),
        name: title, link: li.getAttribute('data-link') || (a ? a.getAttribute('href') : '#'),
        image: li.getAttribute('data-image') || '', desc: p ? p.textContent.trim() : '',
        date: d ? d.textContent.trim() : ''
      });
      ticks.push({ id: i, start: at, type: 'point', content: '' });
    });
    if (!events.length) return;

    var bounds = { min: '1200-01-01', max: '1980-01-01' };
    var detailSpan = span(detailEl, MONTH_PX, 30.44);

    var data = new vis.DataSet(events);
    var detail = new vis.Timeline(detailEl, data, {
      height: '200px',
      start: new Date(CENTER - detailSpan / 2), end: new Date(CENTER + detailSpan / 2),
      min: bounds.min, max: bounds.max,
      // SIMILE's detail band only zooms in from 100px/month (to hours).
      zoomMax: detailSpan, zoomMin: 2 * DAY,
      // Live zoomed on a plain wheel, trapping page scroll; require Ctrl
      // (trackpad pinch sends ctrl+wheel). The buttons below zoom too.
      zoomKey: 'ctrlKey',
      stack: true, verticalScroll: false, showCurrentTime: false,
      orientation: { axis: 'bottom', item: 'top' },
      margin: { item: { horizontal: 2, vertical: 2 }, axis: 4 },
      format: { minorLabels: { month: 'MMM', day: 'D' }, majorLabels: { month: 'YYYY', day: 'MMMM YYYY' } }
    });

    var overviewItems = new vis.DataSet(ticks);
    var windowItem = { id: 'window', type: 'background', className: 'window' };
    var overviewSpan = span(overviewEl, YEAR_PX, 365.25);
    var overview = new vis.Timeline(overviewEl, overviewItems, {
      height: '50px',
      start: new Date(CENTER - overviewSpan / 2), end: new Date(CENTER + overviewSpan / 2),
      min: bounds.min, max: bounds.max,
      zoomable: false, selectable: false, stack: false, showCurrentTime: false,
      showMajorLabels: false, timeAxis: { scale: 'year', step: 1 },
      orientation: { axis: 'bottom', item: 'top' },
      margin: { item: { horizontal: 0, vertical: 4 }, axis: 0 }
    });

    // Keep the bands centred on the same date, and the overview's highlight on
    // the detail band's span. byUser stops the two from echoing each other.
    function center(r) { return (r.start.valueOf() + r.end.valueOf()) / 2; }
    function highlight(r) {
      overviewItems.update(Object.assign({}, windowItem, { start: r.start, end: r.end }));
    }
    detail.on('rangechange', function (r) {
      if (!r.byUser) return;
      overview.moveTo(center(r), { animation: false });
      highlight(r);
      closeBubble();
    });
    // After any move of the detail band (drag end, zoom, buttons), recentre the overview.
    detail.on('rangechanged', function (r) { overview.moveTo(center(r), { animation: false }); highlight(r); });
    overview.on('rangechange', function (r) {
      if (!r.byUser) return;
      detail.moveTo(center(r), { animation: false });
      highlight(detail.getWindow());
      closeBubble();
    });
    highlight(detail.getWindow());

    // Single-pointer alternatives to dragging and wheel-zooming (WCAG 2.2 SC 2.5.7).
    controls.hidden = false;
    controls.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var w = detail.getWindow(), size = w.end - w.start;
      var a = b.getAttribute('data-action');
      if (a === 'zoom-in') detail.zoomIn(0.5);
      else if (a === 'zoom-out') detail.zoomOut(0.5);
      else detail.moveTo(center(w) + (a === 'later' ? 1 : -1) * size * 0.75);
    });

    // Event popup, like SIMILE's info bubble: image, linked title, description, date.
    function closeBubble() {
      if (bubble.hidden) return;
      bubble.hidden = true;
      detail.setSelection([]);
    }
    function openBubble(it, x, y) {
      var html = '<button type="button" class="button small bubble-close" aria-label="Close">&times;</button>';
      if (it.image) html += '<img src="' + escapeHtml(it.image) + '" alt="">';
      html += '<p class="bubble-title" id="timeline-bubble-title"><a href="' + escapeHtml(it.link) + '">' + escapeHtml(it.name) + '</a></p>';
      if (it.desc) html += '<div class="bubble-body">' + escapeHtml(it.desc) + '</div>';
      if (it.date) html += '<p class="bubble-time">' + escapeHtml(it.date) + '</p>';
      bubble.innerHTML = html;
      bubble.hidden = false;
      var box = document.getElementById('neatlinetime');
      var left = Math.max(0, Math.min(x - bubble.offsetWidth / 2, box.clientWidth - bubble.offsetWidth));
      bubble.style.left = left + 'px';
      bubble.style.top = (y + 16) + 'px';
      bubble.querySelector('.bubble-title a').focus();
    }
    bubble.addEventListener('click', function (e) { if (e.target.closest('.bubble-close')) closeBubble(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeBubble(); });

    detail.on('click', function (props) {
      if (props.item == null) { closeBubble(); return; }
      openBubble(data.get(props.item), props.x, props.y);
    });
  });
})();
