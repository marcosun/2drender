import PropTypes from 'prop-types';
import Scheduler from '../Scheduler';
import isNullVoid from '../utils/isNullVoid';

class Grid {
  /**
   * Render a single grid on the given canvas context.
   * Apply image cache to reduce the number of canvas API calls.
   */
  static render(
    ctx, cache, cacheCanvas, cacheCtx,
    origin, width, height, color, borderColor,
  ) {
    /**
     * Skip if any one of width or height is 0.
     */
    if (width === 0 || height === 0) return;
    /**
     * Declare image variable. Get image either from cache or calling canvas API.
     */
    let image;
    /**
     * Grids have the same width, height, color and borderColor is cached.
     */
    const cacheKey = `${width},${height},${color},${borderColor}`;
    if (cache.hasOwnProperty(cacheKey)) {
      /**
       * Use cached image.
       */
      image = cache[cacheKey];
    } else {
      /**
       * Each grid will be drawn on an offscreen canvas and cached in memory so that we simply
       * return the cached image at the next time.
       */
      image = Grid.renderOffscreen(cacheCanvas, cacheCtx, width, height, color, borderColor);
      /**
       * Save image in cache.
       */
      cache[cacheKey] = image;
    }
    ctx.putImageData(image, origin[0], origin[1]);
  }

  /**
   * Return the grid image with minimal size.
   */
  static renderOffscreen(canvas, ctx, width, height, color, borderColor) {
    /**
     * Clear canvas and adjust the size appropriate to this grid.
     */
    canvas.width = width;
    canvas.height = height;
    /**
     * Draw grid background colour.
     */
    if (!isNullVoid(color)) {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, width, height);
    }
    /**
     * Draw grid border. Currently border width is fixed at 1 pixel. Defining border width greater
     * than 1 requires advanced algorithm because border exceeds canvas area by default.
     */
    if (!isNullVoid(borderColor)) {
      ctx.strokeStyle = borderColor;
      ctx.strokeRect(0, 0, width, height);
    }
    return ctx.getImageData(0, 0, width, height);
  }

  constructor(props = {}) {
    /**
     * Save props.
     */
    this.config(props);
    /**
     * We call canvas API to draw grids of the same size and style for only once by
     * memorising canvas image of that grid at the first time of appearance and duplicate that image
     * next time the exact grid appears again.
     */
    this.cache = {};
    /**
     * Every grid will be drawn on its own offscreen canvas first, then cached, and finally copied
     * to the visible screen canvas.
     */
    this.cacheCanvas = window.document.createElement('canvas');
    this.cacheCtx = this.cacheCanvas.getContext('2d');
    /**
     * Scheduler helps to split a time consuming function to be executed in multiple frames.
     * In this way, time consuming function won't block UI thread.
     */
    this.scheduler = new Scheduler();
  }

  /**
   * Update ctx and dataset.
   */
  config(props) {
    const {
      ctx,
      data = [],
    } = props;
    /**
     * Save parameters as instance properties.
     */
    this.ctx = ctx;
    // this.coordinateTransformation = coordinateTransformation;
    /**
     * Round number values because decimal points significantly affects canvas performance.
     */
    this.data = data.map(({ height = 0, origin, width = 0, ...other }) => {
      /**
       * Math.round and Math.floor have a gap between grids.
       */
      return {
        height: Math.ceil(height),
        origin: [Math.ceil(origin[0]), Math.ceil(origin[1])],
        width: Math.ceil(width),
        ...other,
      };
    });
  }

  /**
   * Return a list of grids that contains the given position.
   */
  findByPosition({ x, y }) {
    return this.data.filter(({ height, origin, width }) => {
      return origin[0] <= x && x <= origin[0] + width && origin[1] <= y && y <= origin[1] + height;
    });
  }

  /**
   * Render grids one by one.
   */
  render() {
    this.scheduler.execute(this.data, ({ borderColor, color, height, origin, width }) => {
      Grid.render(
        this.ctx, this.cache, this.cacheCanvas, this.cacheCtx,
        origin, width, height, color, borderColor,
      );
    }).catch(() => { /* Scheduler throws error if previous function is not completed. */ });
  }
}

Grid.propTypes = {
  /**
   * Grids are drawn on this canvas 2D context.
   */
  ctx: PropTypes.object.isRequired,
  /**
   * A list of grids.
   * Grid definitions include grid shape and styles.
   */
  data: PropTypes.arrayOf(PropTypes.shape({
    /**
     * Grid border colour.
     * Default transparent.
     */
    borderColor: PropTypes.string,
    /**
     * Grid fill colour.
     * Default transparent.
     */
    color: PropTypes.string.isRequired,
    /**
     * Grid height.
     * Default 0.
     */
    height: PropTypes.number,
    /**
     * Grid top left corner geometry location.
     */
    origin: PropTypes.arrayOf(PropTypes.number).isRequired,
    /**
     * Grid width.
     * Default 0.
     */
    width: PropTypes.number,
  })),
};

export default Grid;
