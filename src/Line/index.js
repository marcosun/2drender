import PropTypes from 'prop-types';
import isNullVoid from '../utils/isNullVoid';
import Scheduler from '../Scheduler';

class Line {
  /**
   * Render a single line on the given canvas context.
   */
  static render(lineObject, ctx, color, path, width) {
    /**
     * Skip if it doesn't have a line width.
     */
    if (width === 0) return;
    /**
     * Skip if it cannot become a line.
     */
    if (path.length <= 1) return;

    /**
     * Create a path 2D instance to simplify finding whether a given point is on the polyline.
     * See findByPosition function for more details.
     */
    const path2D = new Path2D();

    /**
     * Move pointer to the line starting point.
     */
    const [startingX, startingY] = path[0];
    path2D.moveTo(startingX, startingY);
    /**
     * Go through all points on line path to complete a polyline.
     */
    path.slice(1).forEach(([x, y]) => {
      path2D.lineTo(x, y);
    });

    /**
     * Begin a new line.
     */
    ctx.beginPath();
    /**
     * Set line colour and width.
     */
    ctx.strokeStyle = color;
    ctx.lineWidth = width;

    /**
     * Persist render properties. It will be used in mouse events to find whether a mouse pointer is
     * on a polyline.
     */
    lineObject.renderProps = {
      color,
      path,
      path2D,
      width,
    };

    ctx.stroke(path2D);
  }

  constructor(props = {}) {
    /**
     * Save props.
     */
    this.config(props);
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
      getSnapshotBeforeRender,
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
    this.getSnapshotBeforeRender = getSnapshotBeforeRender;
  }

  /**
   * Return a list of lines that contains the given position.
   * The received coordinates are not scalled by DPR because I presume coordinates to be mouse
   * pointer positions.
   */
  findByPosition({ x, y }) {
    return this.data.filter(({ renderProps }) => {
      /**
       * This scenario happens if mouse event triggers before render completes.
       */
      if (isNullVoid(renderProps)) return false;

      const { path2D, width } = renderProps;

      /**
       * Use isPointInStroke method to find whether a given point is on the polyline.
       */
      this.ctx.lineWidth = width;
      /**
       * Canvas is scaled to make image sharper in high DPR devices. Therefore, when finding lines
       * by mouse events, mouse pointer position should scale by DPR ratio.
       */
      return this.ctx.isPointInStroke(path2D, x * this.dpr, y * this.dpr);
    }).map(({ renderProps, ...other }) => {
      /**
       * Internal render properties should not expose.
       */
      return other;
    });
  }

  /**
   * Draw lines one by one.
   */
  render() {
    this.scheduler.execute(this.data, (eachLine) => {
      let {
        color,
        path,
        width,
      } = eachLine;

      /**
       * If there exists a getSnapshotBeforeRender function, apply segments of each line to
       * getSnapshotBeforeRender.
       */
      if (this.getSnapshotBeforeRender) {
        const snapshot = this.getSnapshotBeforeRender(eachLine);
        color = snapshot.color;
        path = snapshot.path;
        width = snapshot.width;
      }

      /**
       * Round number values because decimal points significantly affects canvas performance.
       */
      const roundedPath = path.map(([x, y]) => {
        return [Math.round(x), Math.round(y)];
      });
      /**
       * Line width default to 1.
       */
      const roundedWidth = Math.round(width || 1);

      Line.render(eachLine, this.ctx, color, roundedPath, roundedWidth);
    }).catch(() => { /* Scheduler throws error if previous function is not completed. */ });
  }
}

Line.propTypes = {
  /**
   * Lines are drawn on this canvas.
   */
  canvas: PropTypes.object.isRequired,
  /**
   * A list of lines.
   * Data structure must contain the following properties if getSnapshotBeforeRender is not defined,
   * can be anything if getSnapshotBeforeRender is defined, only if getSnapshotBeforeRender returns
   * a data structure of this kind.
   * Internally, there is a renderProps property which persists properties calling canvas APIs.
   * These properties are returned value from getSnapshotBeforeRender function.
   */
  data: PropTypes.arrayOf(PropTypes.shape({
    /**
     * Line fill colour.
     * Default transparent.
     */
    color: PropTypes.string,
    /**
     * Line path. Supports line string. i.e. [[0, 0], [10, 10], [20, 20]]
     */
    path: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)),
    /**
     * Line width.
     * Default 1.
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
   * getSnapshotBeforeRender is invoked right before calling canvas API to draw a segment of lines.
   * It enables you to do time consuming manipulations of each line while taking advantage of
   * none UI blocking tricks. If those time consuming works are done by yourself before passing
   * them to Line, it ultimately results to a noticeable time elapse even though you have enough
   * skills in writing non blocking javascript code. getSnapshotBeforeRender must return properties
   * defined in data property (color, path, and width).
   */
  getSnapshotBeforeRender: PropTypes.func,
  /**
   * Canvas height.
   */
  height: PropTypes.number.isRequired,
  /**
   * Canvas width.
   */
  width: PropTypes.number.isRequired,
};

export default Line;
