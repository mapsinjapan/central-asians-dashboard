// ============================================================
// STATE
// ============================================================
let selectedCountry = null; // null = overall view
let map, geoLayer;
let barChart, sexChart, visaChart;

const COUNTRY_COLORS = {
  'Uzbekistan': '#b0522d',
  'Kyrgyzstan': '#5c6f5d',
  'Kazakhstan': '#2b5876',
  'Tajikistan': '#8b6b3d',
  'Turkmenistan': '#7a4a6a'
};

const COUNTRY_DEMONYM_LABELS = {
  'Kyrgyzstan': 'Kyrgyz Pop.',
  'Kazakhstan': 'Kazakh Pop.',
  'Tajikistan': 'Tajik Pop.',
  'Turkmenistan': 'Turkmen Pop.',
  'Uzbekistan': 'Uzbek Pop.'
};

// ============================================================
// COLOR SCALE (diverging, centered at index = 100)
// ============================================================
function getColor(index) {
  // thresholds and matching colors, index-space
  const stops = [
    [0,   '#1f4a63'],
    [20,  '#2b5876'],
    [40,  '#5c86a0'],
    [70,  '#9fb9c6'],
    [90,  '#dcdcd4'],
    [100, '#e8e6df'],
    [110, '#e0c9b8'],
    [140, '#d99a83'],
    [180, '#c1614a'],
    [230, '#9a3324']
  ];
  if (index <= stops[0][0]) return stops[0][1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [v0, c0] = stops[i];
    const [v1, c1] = stops[i+1];
    if (index >= v0 && index <= v1) {
      const t = (index - v0) / (v1 - v0);
      return lerpColor(c0, c1, t);
    }
  }
  return stops[stops.length-1][1];
}
function getCategory(index) {
  if (index < 95) return {label: 'Underrepresented', color: '#2b5876'};
  if (index <= 105) return {label: 'Typical', color: '#8a8175'};
  return {label: 'Above average', color: '#9a3324'};
}

function lerpColor(a, b, t) {
  const ah = parseInt(a.slice(1),16), bh = parseInt(b.slice(1),16);
  const ar = (ah>>16)&255, ag=(ah>>8)&255, ab=ah&255;
  const br = (bh>>16)&255, bg=(bh>>8)&255, bb=bh&255;
  const rr = Math.round(ar+(br-ar)*t), rg=Math.round(ag+(bg-ag)*t), rb=Math.round(ab+(bb-ab)*t);
  return '#' + [rr,rg,rb].map(x=>x.toString(16).padStart(2,'0')).join('');
}

function fmtNum(n) {
  return n.toLocaleString('en-US');
}

// ============================================================
// BADGES
// ============================================================
function renderBadges() {
  const row = document.getElementById('badgeRow');
  row.innerHTML = '';

  const allGroup = document.createElement('div');
  allGroup.className = 'badge-group all-group';
  const allBadge = document.createElement('div');
  allBadge.className = 'badge all' + (selectedCountry === null ? ' active' : '');
  allBadge.textContent = 'All (overall)';
  allBadge.onclick = () => setCountry(null);
  allGroup.appendChild(allBadge);
  row.appendChild(allGroup);

  const divider = document.createElement('div');
  divider.className = 'badge-divider';
  row.appendChild(divider);

  const countryGroup = document.createElement('div');
  countryGroup.className = 'badge-group country-group';
  DATA.meta.countries.forEach(c => {
    const b = document.createElement('div');
    b.className = 'badge' + (selectedCountry === c ? ' active' : '');
    b.textContent = c;
    b.onclick = () => setCountry(c);
    countryGroup.appendChild(b);
  });
  row.appendChild(countryGroup);
}

function setCountry(c) {
  selectedCountry = c;
  renderBadges();
  renderKPIs();
  renderMapTitles();
  updateMapColors();
  renderCharts();
}

// ============================================================
// KPI CARDS
// ============================================================
function renderKPIs() {
  const row = document.getElementById('kpiRow');
  row.innerHTML = '';
  let cards = [];

  if (selectedCountry === null) {
    cards = [
      {label: 'Total Central Asian residents', value: fmtNum(DATA.meta.total_ca), sub: 'across 47 prefectures'},
      {label: 'Top visa category', value: DATA.top_visa_overall, sub: fmtNum(DATA.visa_overall[DATA.top_visa_overall]) + ' residents'},
      {label: 'Share of all foreign residents', value: DATA.meta.national_ca_pct.toFixed(2) + '%', sub: 'of ' + fmtNum(DATA.meta.total_foreign) + ' total'}
    ];
  } else {
    const total = DATA.country_totals[selectedCountry];
    const topVisa = DATA.top_visa_by_country[selectedCountry];
    const pctCA = DATA.country_pct_of_ca[selectedCountry];
    cards = [
      {label: 'Total ' + selectedCountry + ' residents', value: fmtNum(total), sub: 'across Japan'},
      {label: 'Top visa category', value: topVisa, sub: fmtNum(DATA.visa_by_country[selectedCountry][topVisa]) + ' residents'},
      {label: 'Share of all Central Asians', value: pctCA.toFixed(1) + '%', sub: 'of ' + fmtNum(DATA.meta.total_ca) + ' total CA'}
    ];
  }

  cards.forEach(c => {
    const el = document.createElement('div');
    el.className = 'kpi';
    el.innerHTML = `<div class="kpi-label">${c.label}</div><div class="kpi-value">${c.value}</div><div class="kpi-sub">${c.sub}</div>`;
    row.appendChild(el);
  });
}

// ============================================================
// MAP
// ============================================================
function initMap() {
  map = L.map('map', {zoomControl: true, attributionControl: false, minZoom: 4, maxZoom: 7})
    .setView([37.5, 138.5], 5);

  geoLayer = L.geoJSON(GEO, {
    style: styleFeature,
    onEachFeature: onEachFeature
  }).addTo(map);
}

function getPrefStat(prefCode) {
  if (selectedCountry === null) {
    return DATA.overall_map_data[prefCode];
  } else {
    return DATA.country_map_data[selectedCountry][prefCode];
  }
}

function styleFeature(feature) {
  const pc = feature.properties.id;
  const stat = getPrefStat(pc);
  const idx = stat ? stat.index : 0;
  return {
    fillColor: getColor(idx),
    weight: 0.8,
    color: '#ffffff',
    fillOpacity: 0.9
  };
}

function onEachFeature(feature, layer) {
  layer.on({
    mouseover: (e) => {
      e.target.setStyle({weight: 2, color: '#1c2230'});
      e.target.bringToFront();
    },
    mouseout: (e) => {
      geoLayer.resetStyle(e.target);
    }
  });
  bindTooltip(feature, layer);
}

function bindTooltip(feature, layer) {
  const pc = feature.properties.id;
  const stat = getPrefStat(pc);
  const name = feature.properties.name;
  const cat = getCategory(stat.index);
  const multiplier = (stat.index / 100).toFixed(1);

  const scoreLines = `
      <div class="tip-title-row">
        <span class="tip-title">${name}</span>
        <span class="tip-badge" style="background:${cat.color}">${cat.label}</span>
      </div>
      <div class="tip-row"><span>Concentration score</span><b>${stat.index}</b></div>
      <div class="tip-note">${multiplier}x the national average share.</div>`;

  let html;
  if (selectedCountry === null) {
    html = scoreLines + `
      <div class="tip-row"><span>Central Asians</span><b>${fmtNum(stat.ca_count)}</b></div>
      <div class="tip-row"><span>All foreigners</span><b>${fmtNum(stat.foreign_count)}</b></div>
      <div class="tip-row"><span>CA % of foreigners</span><b>${stat.ca_pct_of_foreign.toFixed(2)}%</b></div>`;
  } else {
    html = scoreLines + `
      <div class="tip-row"><span>${COUNTRY_DEMONYM_LABELS[selectedCountry]}</span><b>${fmtNum(stat.count)}</b></div>
      <div class="tip-row"><span>% of CA in prefecture</span><b>${stat.pct_of_ca_in_pref.toFixed(1)}%</b></div>`;
  }
  layer.unbindTooltip();
  layer.bindTooltip(html, {className: 'pref-tip', sticky: true});
}

function updateMapColors() {
  geoLayer.eachLayer(layer => {
    const feature = layer.feature;
    layer.setStyle(styleFeature(feature));
    bindTooltip(feature, layer);
  });
}

function renderMapTitles() {
  const mapSub = document.getElementById('mapSub');
  if (selectedCountry === null) {
    mapSub.textContent = 'Concentration score of Central Asian share vs. national baseline (100 = average)';
  } else {
    mapSub.textContent = `Concentration score of ${selectedCountry}'s share within Central Asia vs. national baseline (100 = average)`;
  }
}

// ============================================================
// CHARTS
// ============================================================
const CHART_FONT = {family: "'Manrope', sans-serif", size: 11};

function renderCharts() {
  renderBarChart();
  renderSexChart();
  renderVisaChart();
}

function renderBarChart() {
  const titleEl = document.getElementById('barTitle');
  let labels, values, color;
  if (selectedCountry === null) {
    titleEl.textContent = 'Top Prefectures by Central Asian Population';
    labels = DATA.top_prefs_overall.slice(0,8).map(d => d.pref);
    values = DATA.top_prefs_overall.slice(0,8).map(d => d.count);
    color = '#b0522d';
  } else {
    titleEl.textContent = 'Top Prefectures — ' + selectedCountry + ' Pop.';
    const list = DATA.top_prefs_by_country[selectedCountry].slice(0,8);
    labels = list.map(d => d.pref);
    values = list.map(d => d.count);
    color = COUNTRY_COLORS[selectedCountry];
  }

  if (barChart) barChart.destroy();
  barChart = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: {labels, datasets: [{data: values, backgroundColor: color, borderRadius: 4, maxBarThickness: 18}]},
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {legend: {display: false}},
      scales: {
        x: {ticks: {font: CHART_FONT}, grid: {color: '#e2e0d8'}},
        y: {ticks: {font: CHART_FONT}, grid: {display: false}}
      }
    }
  });
}

const donutPercentLabels = {
  id: 'donutPercentLabels',
  afterDraw(chart) {
    const meta = chart.getDatasetMeta(0);
    const values = chart.data.datasets[0].data;
    const total = values.reduce((a, b) => a + b, 0);
    if (!total) return;
    const ctx = chart.ctx;
    ctx.save();
    ctx.font = "700 12px 'Manrope', sans-serif";
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    meta.data.forEach((arc, i) => {
      if (!values[i]) return;
      const pct = Math.round(values[i] / total * 100) + '%';
      const pos = arc.tooltipPosition();
      ctx.fillText(pct, pos.x, pos.y);
    });
    ctx.restore();
  }
};

// Draws on-slice percentage text (white, matching donutPercentLabels styling)
// for only the first `n` slices of the dataset — callers sort data descending
// beforehand so "first n" means "top n by value".
function topSlicePercentLabels(n) {
  return {
    id: 'topSlicePercentLabels',
    afterDraw(chart) {
      const meta = chart.getDatasetMeta(0);
      const values = chart.data.datasets[0].data;
      const total = values.reduce((a, b) => a + b, 0);
      if (!total) return;
      const ctx = chart.ctx;
      ctx.save();
      ctx.font = "700 12px 'Manrope', sans-serif";
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      meta.data.forEach((arc, i) => {
        if (i >= n || !values[i]) return;
        const pct = Math.round(values[i] / total * 100) + '%';
        const pos = arc.tooltipPosition();
        ctx.fillText(pct, pos.x, pos.y);
      });
      ctx.restore();
    }
  };
}

function renderSexChart() {
  const titleEl = document.getElementById('pieSexTitle');
  let dataObj;
  if (selectedCountry === null) {
    titleEl.textContent = 'Gender Ratio — overall';
    dataObj = DATA.sex_overall;
  } else {
    titleEl.textContent = 'Gender Ratio — ' + selectedCountry;
    dataObj = DATA.sex_by_country[selectedCountry];
  }
  const labels = Object.keys(dataObj);
  const values = Object.values(dataObj);
  const SEX_COLORS = {'Female': '#d99a83', 'Male': '#2b5876'};
  const colors = labels.map(l => SEX_COLORS[l]);

  if (sexChart) sexChart.destroy();
  sexChart = new Chart(document.getElementById('sexChart'), {
    type: 'doughnut',
    data: {labels, datasets: [{data: values, backgroundColor: colors, borderWidth: 2, borderColor: '#fff'}]},
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {legend: {position: 'right', labels: {font: CHART_FONT, boxWidth: 12, padding: 10}}}
    },
    plugins: [donutPercentLabels]
  });
}

function renderVisaChart() {
  const titleEl = document.getElementById('pieVisaTitle');
  let dataObj;
  if (selectedCountry === null) {
    titleEl.textContent = 'Visa Types — overall';
    dataObj = DATA.visa_overall;
  } else {
    titleEl.textContent = 'Visa Types — ' + selectedCountry;
    dataObj = DATA.visa_by_country[selectedCountry];
  }
  const entries = Object.entries(dataObj).sort((a, b) => b[1] - a[1]);
  const labels = entries.map(e => e[0]);
  const values = entries.map(e => e[1]);
  const palette = ['#b0522d','#5c6f5d','#2b5876','#8b6b3d','#7a4a6a','#c1614a','#3d5a4c','#9a8461'];
  const total = values.reduce((a, b) => a + b, 0);

  if (visaChart) visaChart.destroy();
  visaChart = new Chart(document.getElementById('visaChart'), {
    type: 'doughnut',
    data: {labels, datasets: [{data: values, backgroundColor: palette, borderWidth: 2, borderColor: '#fff'}]},
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            font: {family: "'Manrope', sans-serif", size: 10}, boxWidth: 10, padding: 6,
            generateLabels(chart) {
              const defaultLabels = Chart.overrides.doughnut.plugins.legend.labels.generateLabels(chart);
              defaultLabels.forEach(item => {
                const pct = total ? (values[item.index] / total * 100).toFixed(1) : '0.0';
                item.text = `${labels[item.index]} - ${pct}%`;
              });
              return defaultLabels;
            }
          }
        }
      }
    },
    plugins: [topSlicePercentLabels(4)]
  });
}

// ============================================================
// FOOTER
// ============================================================
function renderFooter() {
  document.getElementById('srcNote').innerHTML = DATA.meta.data_source
    .replace('Japan Ministry of Justice', '<a href="https://www.moj.go.jp/isa/policies/statistics/index.html" target="_blank" rel="noopener">Japan Ministry of Justice</a>')
    .replace('e-Stat residence statistics', '<a href="https://www.e-stat.go.jp/stat-search/files?stat_infid=000040472266" target="_blank" rel="noopener">e-Stat residence statistics</a>');
  document.getElementById('updNote').textContent = DATA.meta.last_updated;
}

// ============================================================
// INIT
// ============================================================
function init() {
  renderBadges();
  renderKPIs();
  initMap();
  renderMapTitles();
  renderCharts();
  renderFooter();
}

document.addEventListener('DOMContentLoaded', init);
