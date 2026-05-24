const { drawLineChart } = require('../../utils/chart-draw');

Component({
  properties: {
    canvasId: { type: String, value: 'trendCanvas' },
    title: { type: String, value: '' },
    labels: { type: Array, value: [] },
    series: { type: Array, value: [] },
    heightRpx: { type: Number, value: 420 },
  },

  observers: {
    'labels, series': function () {
      wx.nextTick(() => this.draw());
    },
  },

  lifetimes: {
    ready() {
      this.draw();
    },
  },

  methods: {
    draw() {
      const { labels, series, canvasId } = this.properties;
      if (!labels || !labels.length) {
        return;
      }

      const query = this.createSelectorQuery();
      query
        .select(`#${canvasId}`)
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0] || !res[0].node) {
            return;
          }
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = wx.getWindowInfo().pixelRatio || 2;
          const width = res[0].width;
          const height = res[0].height;
          canvas.width = width * dpr;
          canvas.height = height * dpr;
          ctx.scale(dpr, dpr);
          drawLineChart(ctx, width, height, labels, series || []);
        });
    },
  },
});
