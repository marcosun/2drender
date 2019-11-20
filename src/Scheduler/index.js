/**
 * Scheduler helps to split a time consuming function to be executed in multiple frames.
 * In this way, time consuming functions won't block UI thread.
 */
class Scheduler {
  /**
   * ID returned by requestIdleCallback.
   * It's value is a number if a scheduled task has not completed, undefined otherwise.
   */
  id = void 0;

  /**
   * Apply callback function to array items one by one.
   * Array items will be splitted to be executed in multiple frames so that
   * main thread won't block.
   */
  execute = (array, callback) => {
    this.array = array;
    /**
     * requestIdleCallback function goes through array one by one. Current index represents the
     * index number of processing item in the array.
     */
    this.currentIndex = 0;
    this.callback = callback;
    /**
     * Save the returned value from the callback function, and these values are returned
     * when this execute task completes.
     */
    this.result = [];

    /**
     * Terminate old execution.
     */
    if (this.id) {
      window.cancelIdleCallback(this.id);
      /**
       * Scheduler throws error if previous function is not completed.
       */
      this.reject('Cancelled');
    }

    /**
     * Allow all remaining executions to be delayed into the next frame.
     */
    this.id = window.requestIdleCallback(this.requestIdleCallback);

    /**
     * This promise will be resolved or rejected later.
     */
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  /**
   * Execute callback with one array item at each time. Array will be mutated to empty at the end.
   */
  requestIdleCallback = async (IdleDeadline) => {
    /* eslint-disable-next-line no-constant-condition */
    while (true) {
      /**
       * If array is empty, the scheduled task is complete.
       */
      if (this.currentIndex >= this.array.length) {
        /**
         * Assign undefined to id means execution is complete.
         */
        this.id = void 0;
        /**
         * Resolve promise.
         */
        this.resolve(this.result);
        return;
      }
      /**
       * Calculate how many spare time available in the current frame.
       */
      const timeRemaining = IdleDeadline.timeRemaining();
      /**
       * If there is not enough time in the current frame, allow executions to be delayed
       * into the next frame.
       */
      if (timeRemaining === 0) {
        break;
      }
      /**
       * Execute callback function with array item.
       * The returned value from running callback function is buffered and to be returned
       * when the task completes.
       */
      /* eslint-disable-next-line no-await-in-loop */
      this.result.push(await this.callback(this.array[this.currentIndex]));
      this.currentIndex = this.currentIndex + 1;
    }

    /**
     * Allow all remaining executions to be delayed into the next frame.
     */
    this.id = window.requestIdleCallback(this.requestIdleCallback);
  }
}

export default Scheduler;
