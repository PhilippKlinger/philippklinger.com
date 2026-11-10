import { Signal, signal } from '@angular/core';

const SHOW_AFTER_MS = 2500;
const HIDE_AFTER_MS = 6000;
const IDLE_MS = 10000;
const MAX_SHOWINGS = 2;
const STORAGE_KEY = 'pk-chain-hint-done';

type HintStorage = Pick<Storage, 'getItem' | 'setItem'>;
type Timer = ReturnType<typeof setTimeout>;

/** Decides when the click hint of the delivery chain is visible. */
export class ChainHint {
  private readonly _shown = signal(false);
  readonly shown: Signal<boolean> = this._shown.asReadonly();

  private finished: boolean;
  private showings = 0;
  private visible = false;
  private destroyed = false;
  private showTimer?: Timer;
  private hideTimer?: Timer;
  private idleTimer?: Timer;

  constructor(private readonly storage: HintStorage | null) {
    this.finished = this.readDone();
  }

  inView(visible: boolean): void {
    // A repeated report must not cancel the running hide timer.
    if (this.destroyed || visible === this.visible) return;
    this.visible = visible;
    this.cancelTimers();
    if (!visible) {
      this._shown.set(false);
      return;
    }
    // The first showing waits for the reader to settle; later ones follow idleness.
    if (this.showings === 0) this.showTimer = setTimeout(() => this.show(), SHOW_AFTER_MS);
    else this.armIdle();
  }

  activity(): void {
    // Idle time only counts while the hint is hidden, so it never flickers back at once.
    if (this.destroyed || !this.visible || this.showings === 0 || this._shown()) return;
    this.armIdle();
  }

  chosen(): void {
    this.finished = true;
    this.cancelTimers();
    this._shown.set(false);
    this.writeDone();
  }

  destroy(): void {
    this.destroyed = true;
    this.cancelTimers();
  }

  private show(): void {
    if (this.finished || !this.visible || this.showings >= MAX_SHOWINGS) return;
    this.showings++;
    this._shown.set(true);
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.hide(), HIDE_AFTER_MS);
  }

  private hide(): void {
    this._shown.set(false);
    this.armIdle();
  }

  private armIdle(): void {
    clearTimeout(this.idleTimer);
    if (!this.finished) this.idleTimer = setTimeout(() => this.show(), IDLE_MS);
  }

  private cancelTimers(): void {
    clearTimeout(this.showTimer);
    clearTimeout(this.hideTimer);
    clearTimeout(this.idleTimer);
  }

  // Blocked storage (private mode, cookies off) must not break the page.
  private readDone(): boolean {
    try {
      return this.storage?.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  private writeDone(): void {
    try {
      this.storage?.setItem(STORAGE_KEY, '1');
    } catch {
      // The hint stays off for this instance only.
    }
  }
}
