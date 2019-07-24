import PropTypes from 'prop-types';
import isNullVoid from '../utils/isNullVoid';
import Scheduler from '../Scheduler';

class Text {
  /**
   * Render a single text on the given canvas context.
   */
  static render(
    textObject, ctx,
    anchorOrigin, anchorOriginDescription, color, fontSize, position, text,
  ) {
    /**
     * Skip if it text is empty.
     */
    if (isNullVoid(text) || text === '') return;

    /**
     * Round number values because decimal points significantly affects canvas performance.
     */
    const internalFontSize = Math.round(fontSize);
    const internalPosition = [Math.round(position[0]), Math.round(position[1])];

    /**
     * Persist render properties. Render properties are processed via use defined properties, i.e.
     * rounding decimal points, and are passed to canvas render APIs directly.
     */
    const renderProps = {
      anchorOriginDescription,
      color,
      font: `${internalFontSize}px sans-serif`,
      fontSize: internalFontSize,
      position: internalPosition,
      text,
    };
    textObject.renderProps = renderProps;

    ctx.save();

    /**
     * Set text colour and font.
     */
    ctx.fillStyle = renderProps.color;
    ctx.font = renderProps.font;

    /**
     * Measure text width.
     */
    const internalWidth = Math.round(ctx.measureText(text).width);
    renderProps.width = internalWidth;

    /**
     * anchorOriginDescription has higher priority if both anchorOrigin and anchorOriginDescription
     * are defined.
     */
    let internalAnchorOrigin = anchorOrigin;
    if (anchorOriginDescription) {
      /**
       * Anchor origin will be overriden by anchor description if it is defined.
       */
      const textHeight = renderProps.fontSize;
      const textWidth = renderProps.width;

      switch (anchorOriginDescription) {
        case 'bottom-center':
          internalAnchorOrigin = [-Math.round(textWidth / 2), 0];
          break;
        case 'bottom-left':
          internalAnchorOrigin = [0, 0];
          break;
        case 'bottom-right':
          internalAnchorOrigin = [-Math.round(textWidth), 0];
          break;
        case 'center':
          internalAnchorOrigin = [-Math.round(textWidth / 2), Math.round(textHeight / 2)];
          break;
        case 'middle-left':
          internalAnchorOrigin = [0, Math.round(textHeight / 2)];
          break;
        case 'middle-right':
          internalAnchorOrigin = [-Math.round(textWidth), Math.round(textHeight / 2)];
          break;
        case 'top-center':
          internalAnchorOrigin = [-Math.round(textWidth / 2), Math.round(textHeight)];
          break;
        case 'top-left':
          internalAnchorOrigin = [0, Math.round(textHeight)];
          break;
        case 'top-right':
          internalAnchorOrigin = [-Math.round(textWidth), Math.round(textHeight)];
          break;
        default:
          internalAnchorOrigin = [0, 0];
      }
    } else if (anchorOrigin) {
      internalAnchorOrigin = anchorOrigin;
    } else {
      /**
       * Anchor origin is set as bottom-left point of the text if both anchor origin and anchor
       * origin description are ommited.
       */
      internalAnchorOrigin = [0, 0];
    }
    textObject.anchorOrigin = internalAnchorOrigin;
    renderProps.anchorOrigin = internalAnchorOrigin;

    ctx.fillText(
      renderProps.text,
      renderProps.position[0] + renderProps.anchorOrigin[0],
      renderProps.position[1] + renderProps.anchorOrigin[1],
    );

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
        anchorOrigin,
        /**
         * Currently, text cannot wrap.
         */
        fontSize: height,
        position,
        width,
      } = renderProps;

      /**
       * Canvas is scaled to make image sharper in high DPR devices. Therefore, when finding lines
       * by mouse events, mouse pointer position should scale by DPR ratio.
       */
      return position[0] + anchorOrigin[0] <= x
        && x <= position[0] + anchorOrigin[0] + width
        && position[1] + anchorOrigin[1] >= y
        && y >= position[1] + anchorOrigin[1] - height;
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
        anchorOrigin,
        anchorOriginDescription,
        color = 'black',
        fontSize = 10,
        position,
        text,
      } = eachText;

      /**
       * Assign default values.
       */
      eachText.color = color;
      eachText.fontSize = fontSize;

      Text.render(
        eachText, this.ctx,
        anchorOrigin, anchorOriginDescription, color, fontSize, position, text,
      );
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
   * This design is in order to compatible with getSnapshotBeforeRender in the future.
   */
  data: PropTypes.arrayOf(PropTypes.shape({
    /**
     * Anchor origin is a point where it will be placed to the given position.
     * A common use case would be defining text top left point as anchor origin [0, -10].
     * It has lower priority if both anchorOrigin and anchorOriginDescription are defined.
     * i.e. [x, y]. Default text bottom left point: [0, 0].
     */
    anchorOrigin: PropTypes.arrayOf(PropTypes.number),
    /**
     * Anchor origin is a point where it will be placed to the given position.
     * A common use case would be defining text top left point as anchor origin.
     * It has higher priority if both anchorOrigin and anchorOriginDescription are defined.
     * i.e. [x, y] Default bottom-left.
     */
    anchorOriginDescription: PropTypes.oneOf([
      'bottom-center', 'bottom-left', 'bottom-right', 'center', 'middle-left', 'middle-right',
      'top-center', 'top-left', 'top-right',
    ]),
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
