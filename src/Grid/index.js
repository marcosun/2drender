import PropTypes from 'prop-types';
import Scheduler from '../Scheduler';
import isNullVoid from '../utils/isNullVoid';

class Grid {
  /**
   * Render a single grid on the given canvas context.
   * Apply image cache to reduce the number of canvas API calls.
   */
  static render(
    gridObject, ctx, cache, cacheCanvas, cacheCtx,
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

    /**
     * Persist render properties. It will be used in mouse events to find whether a mouse pointer is
     * on a grid.
     */
    gridObject.renderProps = {
      borderColor,
      color,
      height,
      origin,
      width,
    };

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
      canvas,
      data = [],
      dpr = 1,
      height,
      width,
    } = props;

    /**
     * These are required properties.
     */
    if (isNullVoid(canvas) || isNullVoid(height) || isNullVoid(width)) return;

    this.dpr = dpr;

    /**
     * We will manipulate canvas context later.
     */
    this.ctx = canvas.getContext('2d');
    /**
     * Clear canvas. Always clear canvas before render.
     * 2K device has dpr 2. Canvas is painted on a double size area. With canvas CSS scales down
     * by half shall we have sharp images.
     * Change canvas width restores canvas scale. Always set the correct scale so that callers are
     * unaware of the implementation details of DPR.
     */
    canvas.height = height * this.dpr;
    canvas.width = width * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);

    /**
     * Round number values because decimal points significantly affects canvas performance.
     */
    this.data = data.map(({ height: gridHeight = 0, origin, width: gridWidth = 0, ...other }) => {
      return {
        height: Math.round(gridHeight * this.dpr),
        origin: [Math.round(origin[0] * this.dpr), Math.round(origin[1] * this.dpr)],
        width: Math.round(gridWidth * this.dpr),
        ...other,
      };
    });
  }

  /**
   * Return a list of grids that contains the given position.
   */
  findByPosition({ x, y }) {
    return this.data.filter(({ height, origin, width }) => {
      /**
       * Canvas is scaled to make image sharper in high DPR devices. Therefore, when finding lines
       * by mouse events, mouse pointer position should scale by DPR ratio.
       */
      return origin[0] <= x * this.dpr
        && x * this.dpr <= origin[0] + width
        && origin[1] <= y * this.dpr
        && y * this.dpr <= origin[1] + height;
    }).map(({
      height,
      origin,
      renderProps,
      width,
      ...other
    }) => {
      /**
       * Internal render properties should not expose.
       * Scale down by DPR. DPR implementation details should not be awared by callers.
       */
      return {
        height: Math.round(height / this.dpr),
        origin: [Math.round(origin[0] / this.dpr), Math.round(origin[1] / this.dpr)],
        width: Math.round(width / this.dpr),
        ...other,
      };
    });
  }

  /**
   * Render grids one by one.
   */
  render() {
    this.scheduler.execute(this.data, (eachGrid) => {
      const {
        borderColor,
        color,
        height,
        origin,
        width,
      } = eachGrid;

      Grid.render(
        eachGrid, this.ctx, this.cache, this.cacheCanvas, this.cacheCtx,
        origin, width, height, color, borderColor,
      );
    }).catch(() => { /* Scheduler throws error if previous function is not completed. */ });
  }
}

Grid.propTypes = {
  /**
   * Grids are drawn on this canvas.
   */
  canvas: PropTypes.object.isRequired,
  /**
   * A list of grids.
   * Grid definitions include grid shape and styles.
   * Internally, there is a renderProps property which persists properties calling canvas APIs.
   * This design is in order to compatible to getSnapshotBeforeRender in the future.
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
  /**
   * Device pixel ratio.
   * 2K device has dpr 2. Canvas is painted on a double size area. With canvas CSS scales down
   * by half shall we have sharp images. It is caller's duty to scale down canvas area to
   * device screen size by setting CSS.
   * https://www.html5rocks.com/en/tutorials/canvas/hidpi
   * Default 1.
   * I don't want to expose the implementation details of supporting high DPR devices to the user.
   * Therefore, all configuration properties have unit of CSS pixel.
   */
  dpr: PropTypes.number,
  /**
   * Canvas height.
   */
  height: PropTypes.number.isRequired,
  /**
   * Canvas width.
   */
  width: PropTypes.number.isRequired,
};

export default Grid;
