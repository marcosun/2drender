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
   * main thread won't be blocked.
   */
  execute(array, callback) {
    /**
     * Instance object can be consumed by functions on prototype chain.
     */
    this.array = [...array];
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
     * Execute function must return a promise instantly.
     * The time consuming functions should be executed after the creation of a promise instance
     * to ensure there is a promise to be resolved.
     */
    window.setTimeout(() => {
      this.id = window.requestIdleCallback(this.requestIdleCallback);
    });

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
  requestIdleCallback = (IdleDeadline) => {
    /* eslint-disable-next-line no-constant-condition */
    while (true) {
      /**
       * If array is empty, the scheduled task is complete.
       */
      if (this.array.length === 0) {
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
       * Mutate array to feed callback function with the first element in the array.
       * The returned value from running callback function is buffered and to be returned
       * when the task completes.
       */
      this.result.push(this.callback(this.array.shift()));
    }

    /**
     * Allow all remaining executions to be delayed into the next frame.
     */
    this.id = window.requestIdleCallback(this.requestIdleCallback);
  }
}

export default Scheduler;
