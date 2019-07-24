import PropTypes from 'prop-types';
import {
  add,
  matrix,
  multiply,
  unaryMinus,
} from 'mathjs';
import isNullVoid from '../utils/isNullVoid';
import Scheduler from '../Scheduler';

/**
 * position: A given position [x, y] in the original canvas cartesian coordinate system.
 * rotationOrigin: Rotate around this [x, y] point.
 * rotation: Rotation radians.
 * deltaMove: Move horizontally and vertically after rotation.
 * Assume coordinate system rotates around P (rotationOrigin) with rotation angle theta (rotation).
 * Given an arbitrary point A (position), what is its position A' after rotation?
 * We come across this algorithm: OA' = OP + PA', where PA' = M * PA, where M is rotation matrix.
 * If there is a horizontal and vertical move after rotation (deltaMove), the algorithm becomes:
 * OA' = OP + PA' + delta.
 */
function getTransformedAndRotatedPosition(position, rotationOrigin, rotation, deltaMove) {
  /**
   * Marker understands clockwise rotation however rotation matrix algorithm defines
   * anti-clockwise rotation. This is why we always have negative rotation angle.
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
   * A positive delta move moves coordinate system to bottom right hand side.
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
   * Rotate coordinate first, then move horizontally and vertically,
   * and finally render marker image.
   * Order is critical and must be observed.
   */
  static async render(markerObject, ctx, anchorOrigin, height, icon, position, rotation, width) {
    /**
     * Round number values because decimal points significantly affects canvas performance.
     */
    const internalAnchorOrigin = [Math.round(anchorOrigin[0]), Math.round(anchorOrigin[1])];
    const internalHeight = Math.round(height);
    const internalPosition = [Math.round(position[0]), Math.round(position[1])];
    const internalWidth = Math.round(width);

    /**
     * Persist render properties. Render properties are processed via use defined properties, i.e.
     * rounding decimal points, and are passed to canvas render APIs directly.
     */
    const renderProps = {
      anchorOrigin: internalAnchorOrigin,
      height: internalHeight,
      icon,
      position: internalPosition,
      rotation,
      width: internalWidth,
    };
    markerObject.renderProps = renderProps;

    const markerImage = await loadImage(icon);

    /**
     * Methods to render marker contain coordinate horizontal and vertical move and rotation
     * which must be restored as soon as render completes.
     */
    ctx.save();

    /**
     * Move coordinate origin point to rotation point to get ready for rotation.
     */
    ctx.translate(renderProps.position[0], renderProps.position[1]);
    /**
     * Rotate.
     */
    ctx.rotate(renderProps.rotation);
    /**
     * Move coordinate origin point back from rotation point, and move coordinate system
     * horizontally and vertically.
     */
    ctx.translate(
      -renderProps.position[0] + renderProps.anchorOrigin[0],
      -renderProps.position[1] + renderProps.anchorOrigin[1],
    );

    /**
     * Scale marker height and width.
     */
    ctx.drawImage(
      markerImage,
      renderProps.position[0], renderProps.position[1],
      renderProps.width, renderProps.height,
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
      height,
      width,
    } = props;

    /**
     * These are required properties.
     */
    if (isNullVoid(canvas) || isNullVoid(height) || isNullVoid(width)) return;

    /**
     * We will manipulate canvas context later.
     */
    this.ctx = canvas.getContext('2d');
    canvas.height = height;
    canvas.width = width;

    this.data = data;
  }

  /**
   * Return a list of markers that contains the given position.
   */
  findByPosition({ x, y }) {
    return this.data.filter(({ renderProps }) => {
      /**
       * This scenario happens if mouse event triggers before render completes.
       */
      if (isNullVoid(renderProps)) return false;

      const { anchorOrigin, height, position, rotation, width } = renderProps;

      /**
       * Find position in the rotated and horizontally and vertically moved coordinate system.
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
       * a rectangle contains a given position if the following condition passes.
       */
      return position[0] <= transformedX
        && transformedX <= position[0] + width
        && position[1] <= transformedY
        && transformedY <= position[1] + height;
    }).map(({ renderProps, ...other }) => {
      /**
       * Internal render properties should not expose.
       */
      return other;
    });
  }

  /**
   * Draw markers one by one.
   */
  render() {
    this.scheduler.execute(this.data, (eachMarker) => {
      const {
        anchorOrigin = [0, 0],
        height,
        icon,
        position,
        rotation = 0,
        width,
      } = eachMarker;

      /**
       * Assign default values.
       */
      eachMarker.anchorOrigin = anchorOrigin;
      eachMarker.rotation = rotation;

      Marker.render(eachMarker, this.ctx, anchorOrigin, height, icon, position, rotation, width);
    }).catch(() => { /* Scheduler throws error if previous function is not completed. */ });
  }
}

/**
 * Marker natively supports high DPR devices by passing through high resolution images.
 */
Marker.propTypes = {
  /**
   * Markers are drawn on this canvas.
   */
  canvas: PropTypes.object.isRequired,
  /**
   * A list of markers.
   * Internally, there is a renderProps property which persists properties calling canvas APIs.
   * This design is in order to compatible with getSnapshotBeforeRender in the future.
   */
  data: PropTypes.arrayOf(PropTypes.shape({
    /**
     * Anchor origin is a point where it will be placed to the given position.
     * A common use case would be defining marker centre point as anchor origin.
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
  /**
   * Canvas height.
   */
  height: PropTypes.number.isRequired,
  /**
   * Canvas width.
   */
  width: PropTypes.number.isRequired,

};

export default Marker;
