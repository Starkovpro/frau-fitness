/* ═══════════════════════════════════════════════════════════════
   Frau Fitness — постер расписания (общий рендер для сайта и админки)
   Данные: data/schedule.json  ·  Редактор: /admin
   ═══════════════════════════════════════════════════════════════ */
(function () {
  var DAYS = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /**
   * hall   = { label: 'Зал 1 (Зелёный)', rows: [ { time: '10.00-10.55', cells: [ {n,tr} × 7 ] } ] }
   * period = 'с 29 июня по 5 июля'
   */
  function render(hall, period) {
    var h = '';
    h += '<div class="ffp-scope"><div class="ffp">';
    h += renderHead(period);
    h += renderBody(hall);
    h += '</div></div>';
    return h;
  }

  /* Чёрная шапка: логотип + заголовок + период */
  function renderHead(period) {
    var h = '';
    h += '<div class="ffp-head">';
    h += '<div class="ffp-brand">';
    h += '<img class="ffp-logo" src="images/schedule-logo.png" alt="Frau Fitness — Woman Club">';
    h += '</div>';
    h += '<div class="ffp-title">';
    h += '<span class="ffp-title-main">Расписание<br>групповых занятий</span>';
    h += '<span class="ffp-period" data-edit="period">' + esc(period) + '</span>';
    h += '</div></div>';
    return h;
  }

  /* Белое тело: подпись зала + таблица */
  function renderBody(hall) {
    var h = '';
    h += '<div class="ffp-body">';
    h += '<div class="ffp-hall" data-edit="label">' + esc(hall.label) + '</div>';
    h += '<table class="ffp-table"><thead><tr><th class="ffp-th-time"></th>';
    for (var d = 0; d < 7; d++) h += '<th>' + DAYS[d] + '</th>';
    h += '</tr></thead><tbody>';

    var rows = hall.rows || [];
    for (var ri = 0; ri < rows.length; ri++) {
      var row = rows[ri] || {};
      h += '<tr data-row="' + ri + '">';
      h += '<td class="ffp-time" data-edit="time" data-row="' + ri + '">' + esc(row.time) + '</td>';
      for (var di = 0; di < 7; di++) {
        var c = (row.cells && row.cells[di]) || {};
        var hasTr = c.tr && String(c.tr).trim();
        h += '<td class="ffp-cell" data-row="' + ri + '" data-day="' + di + '">';
        h += '<span class="ffp-name" data-edit="n" data-row="' + ri + '" data-day="' + di + '">' + esc(c.n) + '</span>';
        h += '<span class="ffp-tr' + (hasTr ? '' : ' ffp-tr-empty') + '">(<span class="ffp-trainer" data-edit="tr" data-row="' + ri + '" data-day="' + di + '">' + esc(c.tr) + '</span>)</span>';
        h += '</td>';
      }
      h += '</tr>';
    }

    h += '</tbody></table></div>';
    return h;
  }

  window.FFPoster = { render: render, renderHead: renderHead, renderBody: renderBody, DAYS: DAYS, esc: esc };
})();
