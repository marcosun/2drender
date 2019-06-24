import PropTypes from 'prop-types';
import {
  add,
  matrix,
  multiply,
  unaryMinus,
} from 'mathjs';
import Scheduler from '../Scheduler';

/**
 * position: A given position [x, y] in the original canvas cartesian coordinate.
 * rotationOrigin: Rotate around this [x, y] point.
 * rotation: Rotation radians.
 * deltaMove: Move [x, y] in the coordinate after rotated.
 * Assume coordinate system rotate around P (rotationOrigin) with rotation angle theta (rotation).
 * Given an arbitrary point A (position), what is its position A' after rotate?
 * We come across this algorithm: OA' = OP + PA', where PA' = M * PA, where M is rotation matrix.
 * If there is a coordinate system move after rotation (deltaMove), the algorithm becomes:
 * OA' = OP + PA' + delta.
 */
function getTransformedAndRotatedPosition(position, rotationOrigin, rotation, deltaMove) {
  /**
   * Marker understands clockwise rotation however rotation matrix algo defines
   * anti-clockwise rotation.
   */
  const rotationMatrix = matrix([
    [Math.cos(-rotation), -Math.sin(-rotation)],
    [Math.sin(-rotation), Math.cos(-rotation)],
  ]);
  const OPVector = rotationOrigin;
  /**
   * PA = PO + OA
   */
  const POVector = unaryMinus(rotationOrigin);
  const OAVector = position;
  const PAVector = add(POVector, OAVector);
  /**
   * A positive delta move actually moves coordinate system to bottom right hand side.
   */
  const deltaVector = unaryMinus(deltaMove);

  return add(
    add(
      OPVector,
      multiply(rotationMatrix, PAVector)),
    deltaVector,
  ).valueOf();
}

/**
 * Image class loads image asynchronously and image is initiated only if onLoad function
 * being called.
 */
function loadImage(imageSource) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.src = imageSource;
  });
}

class Marker {
  /**
   * Render a single marker on the given canvas context.
   * Rotate coordinate first, then transform coordinate, and finally render marker image.
   * Order is critical and must be observed.
   */
  static async render(ctx, icon, height, width, position, anchorOrigin, rotation) {
    const markerImage = await loadImage(icon);

    /**
     * Render marker methods contain coordinate transformation and rotation which must be
     * restored as soon as render completes.
     */
    ctx.save();

    /**
     * Move coordinate centre point to get ready for rotation.
     */
    ctx.translate(position[0], position[1]);
    /**
     * Rotate.
     */
    ctx.rotate(rotation);
    /**
     * Move coordinate centre point back to its origin, and transform anchor origin after rotation.
     */
    ctx.translate(-position[0] + anchorOrigin[0], -position[1] + anchorOrigin[1]);
    /**
     * Scale marker height and width.
     */
    ctx.drawImage(markerImage, position[0], position[1], width, height);

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
      ctx,
      data = [],
    } = props;
    /**
     * Save parameters as instance properties.
     */
    this.ctx = ctx;
    /**
     * Round number values because decimal points significantly affects canvas performance.
     */
    this.data = data.map(({
      anchorOrigin = [0, 0],
      height,
      position,
      rotation = 0,
      width,
      ...other
    }) => {
      return {
        anchorOrigin: [Math.round(anchorOrigin[0]), Math.round(anchorOrigin[1])],
        height: Math.round(height),
        position: [Math.round(position[0]), Math.round(position[1])],
        rotation,
        width: Math.round(width),
        ...other,
      };
    });
  }

  /**
   * Return a list of markers that contains the given position.
   */
  findByPosition({ x, y }) {
    return this.data.filter(({ anchorOrigin, height, position, rotation, width }) => {
      /**
       * Find position in the rotated and moved coordinate system.
       */
      const [
        transformedX,
        transformedY,
      ] = getTransformedAndRotatedPosition(
        [x, y],
        [position[0], position[1]],
        rotation,
        [anchorOrigin[0], anchorOrigin[1]],
      );

      /**
       * Given the fact that both positions are in the same coordinate system,
       * a rectangle contains a given position if the following condition matches.
       */
      return position[0] <= transformedX && transformedX <= position[0] + width &&
        position[1] <= transformedY && transformedY <= position[1] + height;
    });
  }

  /**
   * Draw markers one by one.
   */
  render() {
    this.scheduler.execute(this.data, ({
      anchorOrigin,
      height,
      icon,
      position,
      rotation,
      width,
    }) => {
      Marker.render(this.ctx, icon, height, width, position, anchorOrigin, rotation);
    }).catch(() => { /* Scheduler throws error if previous function is not completed. */ });
  }
}

Marker.propTypes = {
  /**
   * Markers are drawn on this canvas 2D context.
   */
  ctx: PropTypes.object.isRequired,
  /**
   * A list of markers.
   */
  data: PropTypes.arrayOf(PropTypes.shape({
    /**
     * Anchor origin is a point where it will be placed to the given position.
     * A common use case would be defining marker anchor origin point as centre point.
     * i.e. [x, y] Default [0, 0].
     */
    anchorOrigin: PropTypes.arrayOf(PropTypes.number),
    /**
     * Marker height. Scale marker height.
     */
    height: PropTypes.number.isRequired,
    /**
     * Marker icon is whatever can be consumed by Image class, such as base64.
     */
    icon: PropTypes.any,
    /**
     * Marker position. i.e. [x, y].
     * Marker anchor origin point is placed to this position.
     */
    position: PropTypes.arrayOf(PropTypes.number).isRequired,
    /**
     * Rotate marker by the given angle. Default 0.
     * Angles are in radians, not degrees. To convert, please use: radians = (Math.PI/180)*degrees.
     */
    rotation: PropTypes.number,
    /**
     * Marker width. Scale marker width.
     */
    width: PropTypes.number.isRequired,
  })),
};

export default Marker;
