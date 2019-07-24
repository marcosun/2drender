import PropTypes from 'prop-types';
import { oneLineTrim } from 'common-tags';
import Scheduler from '../Scheduler';
import isNullVoid from '../utils/isNullVoid';

class Grid {
  /**
   * Render a single grid on the given canvas context.
   * Apply image cache to reduce the number of canvas API calls.
   */
  static render(
    gridObject, ctx, cache, cacheCanvas, cacheCtx,
    borderColor, color, dpr, height, origin, width,
  ) {
    /**
     * Round number values because decimal points significantly affects canvas performance.
     */
    const internalHeight = Math.round(height);
    const internalOrigin = [Math.round(origin[0]), Math.round(origin[1])];
    const internalWidth = Math.round(width);

    /**
     * Persist render properties. Render properties are processed via use defined properties, i.e.
     * rounding decimal points, and are passed to canvas render APIs directly.
     */
    const renderProps = {
      borderColor,
      color,
      height: internalHeight,
      origin: internalOrigin,
      width: internalWidth,
    };
    gridObject.renderProps = renderProps;

    /**
     * Skip if any one of width or height is 0.
     */
    if (renderProps.width === 0 || renderProps.height === 0) return;
    /**
     * Declare image variable. Get image either from cache or calling canvas API.
     */
    let image;
    /**
     * Grids have the same width, height, color and borderColor is cached.
     */
    const cacheKey = oneLineTrim`
      ${renderProps.width},${renderProps.height},${renderProps.color},${renderProps.borderColor}
    `;
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
      image = Grid.renderOffscreen(
        cacheCanvas, cacheCtx,
        renderProps.borderColor, renderProps.color, dpr,
        renderProps.height, renderProps.width,
      );
      /**
       * Save image in cache.
       */
      cache[cacheKey] = image;
    }

    /**
     * Put image data method is not affected by ctx.scale.
     */
    ctx.putImageData(image, renderProps.origin[0] * dpr, renderProps.origin[1] * dpr);
  }

  /**
   * Return the grid image with minimal size.
   */
  static renderOffscreen(canvas, ctx, borderColor, color, dpr, height, width) {
    /**
     * Clear canvas and adjust the size appropriate to this grid.
     */
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

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
    /**
     * Get image data method is not affected by ctx.scale.
     */
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
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
     * 4K device has dpr 2. Canvas is painted on a quadruple size area. With canvas CSS scales down
     * by half shall we have sharp images.
     * Change canvas width restores canvas scale. Always set the correct scale so that callers are
     * unaware of the implementation details of DPR.
     */
    canvas.height = height * this.dpr;
    canvas.width = width * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);

    this.data = data;
  }

  /**
   * Return a list of grids that contains the given position.
   */
  findByPosition({ x, y }) {
    return this.data.filter(({ renderProps }) => {
      /**
       * This scenario happens if mouse event triggers before render completes.
       */
      if (isNullVoid(renderProps)) return false;

      const { height, origin, width } = renderProps;

      /**
       * Render properties are not scaled by DPR, therefore, they can compare with mouse pointer
       * position directly.
       */
      return origin[0] <= x
        && x <= origin[0] + width
        && origin[1] <= y
        && y <= origin[1] + height;
    }).map(({ renderProps, ...other }) => {
      /**
       * Internal render properties should not expose.
       */
      return other;
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
        height = 0,
        origin,
        width = 0,
      } = eachGrid;

      /**
       * Assign default values.
       */
      eachGrid.height = height;
      eachGrid.width = width;

      Grid.render(
        eachGrid, this.ctx, this.cache, this.cacheCanvas, this.cacheCtx,
        borderColor, color, this.dpr, height, origin, width,
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
   * This design is in order to compatible with getSnapshotBeforeRender in the future.
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
   * 4K device has dpr 2. Canvas is painted on a quadruple size area. With canvas CSS scales down
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
