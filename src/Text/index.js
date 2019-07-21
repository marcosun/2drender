import PropTypes from 'prop-types';
import isNullVoid from '../utils/isNullVoid';
import Scheduler from '../Scheduler';

class Text {
  /**
   * Render a single text on the given canvas context.
   */
  static render(textObject, ctx, color, fontSize, position, text) {
    /**
     * Skip if it text is empty.
     */
    if (isNullVoid(text) || text === '') return;

    ctx.save();

    /**
     * Set text colour and font.
     */
    ctx.fillStyle = color;
    ctx.font = `${fontSize}px sans-serif`;

    /**
     * Persist render properties. It will be used in mouse events to find whether a mouse pointer is
     * on a text.
     */
    textObject.renderProps = {
      color,
      font: ctx.font,
      fontSize,
      position,
      text,
      /**
       * Measure text width.
       */
      width: ctx.measureText(text).width,
    };

    ctx.fillText(text, position[0], position[1]);

    ctx.restore();
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
   * Return a list of texts that contains the given position.
   * The received coordinates are not scalled by DPR because I presume coordinates to be mouse
   * pointer positions.
   */
  findByPosition({ x, y }) {
    return this.data.filter(({ renderProps }) => {
      /**
       * This scenario happens if mouse event triggers before render completes.
       */
      if (isNullVoid(renderProps)) return false;

      const {
        /**
         * Currently, text cannot wrap.
         */
        font: height,
        position,
        width,
      } = renderProps;

      /**
       * Canvas is scaled to make image sharper in high DPR devices. Therefore, when finding lines
       * by mouse events, mouse pointer position should scale by DPR ratio.
       */
      return position[0] <= x * this.dpr
        && x * this.dpr <= position[0] + width
        && position[1] <= y * this.dpr
        && y * this.dpr <= position[1] + height;
    }).map(({ renderProps, ...other }) => {
      /**
       * Internal render properties should not expose.
       */
      return other;
    });
  }

  /**
   * Draw texts one by one.
   */
  render() {
    this.scheduler.execute(this.data, (eachText) => {
      const {
        color = 'black',
        fontSize = 10,
        position,
        text,
      } = eachText;

      /**
       * Round number values because decimal points significantly affects canvas performance.
       */
      const roundedFontSize = Math.round(fontSize);

      Text.render(eachText, this.ctx, color, roundedFontSize, position, text);
    }).catch(() => { /* Scheduler throws error if previous function is not completed. */ });
  }
}

Text.propTypes = {
  /**
   * Lines are drawn on this canvas.
   */
  canvas: PropTypes.object.isRequired,
  /**
   * A list of texts.
   * Internally, there is a renderProps property which persists properties calling canvas APIs.
   * This design is in order to compatible to getSnapshotBeforeRender in the future.
   */
  data: PropTypes.arrayOf(PropTypes.shape({
    /**
     * Text colour.
     * Default black.
     */
    color: PropTypes.string,
    /**
     * Font size in unit pixel.
     * Default 10.
     */
    fontSize: PropTypes.number,
    /**
     * Text position. i.e. [x, y].
     * Text anchor origin point is placed to this position.
     */
    position: PropTypes.arrayOf(PropTypes.number).isRequired,
    /**
     * Text content.
     * Default ''.
     */
    text: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
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

export default Text;
