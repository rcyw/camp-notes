/**
 * Autosave debounce + lifecycle flush state machine, decoupled from the DOM so
 * it can be tested without a browser.
 *
 * It owns the pending-timer bookkeeping and the "is it safe to write right
 * now?" guard. The actual localStorage write stays in app.mjs via `write`, and
 * the user-visible status text stays in app.mjs via `onStatus` (for the
 * "Saving…/Saved" indicator).
 *
 * Why this exists: a debounced save that has not yet fired is lost on a fast
 * reload/tab-switch. app.mjs flushes synchronously on `pagehide` and on
 * `visibilitychange`→hidden by calling `flush()`, which cancels the timer and
 * writes the latest state immediately — unless the guard blocks the write
 * (corrupt payload or failed initial read), preserving the never-overwrite rule.
 *
 * `flush()` intentionally writes even when no debounced edit is pending: it is
 * the single funnel app.mjs uses to also persist non-notes metadata (the open
 * selection and active view) that changes without ever going through
 * `schedule()`. Callers such as the view-tab handler rely on that full-persist
 * behavior (they flip `state.view`/`state.selectedId` but never call
 * `schedule()`), so `flush()` must not be narrowed to a "write only when
 * pending" no-op. An unconditional flush is safe because the blocked-write
 * guard is still enforced, and it only rewrites an already-persisted payload on
 * a no-op lifecycle event.
 */

const DEFAULT_DELAY = 400;

/**
 * @param {object} options
 * @param {() => void} options.write  Persist the current state now (sync).
 * @param {() => boolean} [options.isBlocked]  When this returns true the write
 *   is skipped — used to avoid overwriting an unreadable/corrupt saved payload.
 * @param {(status: "saving" | "saved") => void} [options.onStatus]
 * @param {number} [options.delay]
 * @returns {{ schedule: () => void, flush: () => void, cancel: () => void, isPending: () => boolean }}
 */
export function createAutosave({ write, isBlocked = () => false, onStatus = () => {}, delay = DEFAULT_DELAY }) {
  let timer = null;

  function doWrite() {
    if (isBlocked()) return;
    write();
  }

  /** Queue a debounced write (the normal edit path). */
  function schedule() {
    cancel();
    // Check the guard first: when blocked there is nothing to save, so avoid
    // the misleading "Saving…" flash and don't arm a timer that would do nothing.
    // The guard (app.mjs `saveBlocked`) reports the blocked state itself.
    if (isBlocked()) return;
    onStatus("saving");
    timer = setTimeout(() => {
      timer = null;
      doWrite();
    }, delay);
  }

  /**
   * Synchronously flush any pending write. Cancels the timer and writes the
   * current state immediately. Safe to call with nothing pending; the guard
   * still protects existing data from being overwritten.
   */
  function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    doWrite();
  }

  /** Drop the pending timer without writing. */
  function cancel() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function isPending() {
    return timer != null;
  }

  return { schedule, flush, cancel, isPending };
}
