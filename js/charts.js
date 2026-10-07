/* Cat Care Log: ECharts rendering. Browser only. */
(function (root) {
  'use strict';

  var INK = '#2e2118';
  var SOFT = '#a08b76';
  var CORAL = '#ff6b4a';
  var TEAL = '#1f9e8e';

  function baseAxis() {
    return {
      axisLine: { lineStyle: { color: '#f0e2d2' } },
      axisTick: { show: false },
      axisLabel: { color: SOFT, fontSize: 10, fontFamily: 'Nunito, sans-serif' }
    };
  }

  function getChart(el) {
    if (!root.echarts) return null;
    var chart = root.echarts.getInstanceByDom(el);
    if (!chart) chart = root.echarts.init(el);
    return chart;
  }

  function fmtDay(ts) {
    var d = new Date(ts);
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  function fmtDayLabel(ts) {
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var d = new Date(ts);
    return days[d.getDay()];
  }

  // points: [{ts, kg}], unit: 'kg' | 'lb'
  function renderWeight(el, points, unit, toDisplay) {
    var chart = getChart(el);
    if (!chart) {
      el.innerHTML = '<div class="chart-empty"><div class="big">📉</div><p>Charts need the chart library, which did not load.<br>Check your connection and reopen.</p></div>';
      return;
    }
    if (!points.length) {
      chart.clear();
      el.innerHTML = '<div class="chart-empty"><div class="big">⚖️</div><p><strong>No weigh-ins yet.</strong><br>Log a weight and the trend line will appear here.</p></div>';
      return;
    }
    el.innerHTML = '';
    var data = points.map(function (p) {
      return [p.ts, Math.round(toDisplay(p.kg) * 10) / 10];
    });
    var unitLabel = unit === 'lb' ? 'lb' : 'kg';
    chart.setOption({
      grid: { left: 44, right: 14, top: 26, bottom: 26 },
      tooltip: {
        trigger: 'axis',
        formatter: function (params) {
          var p = params[0];
          var d = new Date(p.value[0]);
          var date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          return date + '<br><strong>' + p.value[1] + ' ' + unitLabel + '</strong>';
        }
      },
      xAxis: Object.assign({ type: 'time' }, baseAxis(), {
        axisLabel: Object.assign({}, baseAxis().axisLabel, {
          formatter: function (v) { return fmtDay(v); }
        })
      }),
      yAxis: Object.assign({ type: 'value', scale: true }, baseAxis(), {
        splitLine: { lineStyle: { color: '#f7ece0' } },
        axisLabel: Object.assign({}, baseAxis().axisLabel, {
          formatter: function (v) { return v + ' ' + unitLabel; }
        })
      }),
      series: [{
        type: 'line',
        data: data,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { width: 3, color: CORAL },
        itemStyle: { color: CORAL, borderColor: '#fff', borderWidth: 2 },
        areaStyle: { color: 'rgba(255,107,74,0.10)' },
        markPoint: points.length > 1 ? {
          symbol: 'pin',
          symbolSize: 34,
          itemStyle: { color: TEAL },
          label: { color: '#fff', fontSize: 9, fontWeight: 800 },
          data: [{ type: 'max', name: 'max' }, { type: 'min', name: 'min' }]
        } : undefined
      }]
    });
    chart.resize();
  }

  // days: [{ts, count}], last N days oldest first
  function renderFeedings(el, days) {
    var chart = getChart(el);
    if (!chart) {
      el.innerHTML = '<div class="chart-empty"><div class="big">📉</div><p>Charts need the chart library, which did not load.</p></div>';
      return;
    }
    var total = days.reduce(function (s, d) { return s + d.count; }, 0);
    if (!total) {
      chart.clear();
      el.innerHTML = '<div class="chart-empty"><div class="big">🍽️</div><p><strong>No meals logged in the last 7 days.</strong><br>Somebody is either fasting or you forgot to tap.</p></div>';
      return;
    }
    el.innerHTML = '';
    chart.setOption({
      grid: { left: 30, right: 14, top: 18, bottom: 26 },
      tooltip: {
        trigger: 'axis',
        formatter: function (params) {
          var i = params[0].dataIndex;
          var d = new Date(days[i].ts);
          var date = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
          var c = days[i].count;
          return date + '<br><strong>' + c + (c === 1 ? ' meal' : ' meals') + '</strong>';
        }
      },
      xAxis: Object.assign({ type: 'category', data: days.map(function (d) { return fmtDayLabel(d.ts); }) }, baseAxis()),
      yAxis: Object.assign({ type: 'value', minInterval: 1 }, baseAxis(), {
        splitLine: { lineStyle: { color: '#f7ece0' } }
      }),
      series: [{
        type: 'bar',
        data: days.map(function (d) { return d.count; }),
        barWidth: '52%',
        itemStyle: {
          borderRadius: [8, 8, 4, 4],
          color: function (params) {
            return params.value === 0 ? '#f0e2d2' : (params.dataIndex === days.length - 1 ? CORAL : TEAL);
          }
        },
        label: {
          show: true, position: 'top', color: SOFT, fontSize: 10, fontWeight: 800,
          formatter: function (p) { return p.value === 0 ? '' : p.value; }
        }
      }]
    });
    chart.resize();
  }

  function disposeAll() {
    if (!root.echarts) return;
    document.querySelectorAll('.chart-box').forEach(function (el) {
      var c = root.echarts.getInstanceByDom(el);
      if (c) c.dispose();
    });
  }

  root.CatCharts = {
    renderWeight: renderWeight,
    renderFeedings: renderFeedings,
    disposeAll: disposeAll
  };
})(typeof window !== 'undefined' ? window : this);
