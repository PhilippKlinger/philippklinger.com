import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { buildChainView, ChainTable, ChainView } from '../../../../content/delivery-chain';
import { deliveryPlans } from '../../../../content/delivery-plans';
import {
  DeliveryPlan,
  deliveryTexts,
  isMeasured,
  StepState,
} from '../../../../content/software-delivery';
import { DeliveryStatus } from '../../../delivery/delivery-status';
import { ChainHint } from './chain-hint';

// DRAFT: texts of the chain, wording to be approved.
const chainTexts = {
  stations: 'Stationen',
  repo: 'Repo',
  repos: 'Repos',
  private: 'Code privat. Die Läufe zeige ich im Gespräch.',
  verify: 'Selbst prüfen',
  passing: 'passing',
  failed: 'failed',
  hintPointer: 'Klick dich durch die Stationen',
  hintTouch: 'Tippe auf eine Station',
};

/** States whose value is a measurement, so screen readers also hear the state as a word. */
const MEASURED_STATES: StepState[] = ['verified', 'partial', 'deviation'];
const ARROW_STEPS: Partial<Record<string, number>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

// The hint waits until most of the chain is on screen (D5).
const HINT_THRESHOLD = 0.6;
const ACTIVITY_EVENTS = ['pointermove', 'scroll', 'keydown'];

const hasNoPublicChain = (plan: DeliveryPlan) =>
  !plan.statusKey && plan.steps.every((step) => !isMeasured(step) && step.state === 'private');

/** "Stand … · n Repos", without the count when there is no repo to count. */
function standLine({ stand, repoCount }: ChainView): string | null {
  if (!stand || repoCount === 0) return stand;
  const unit = repoCount === 1 ? chainTexts.repo : chainTexts.repos;
  return `${stand} · ${repoCount} ${unit}`;
}

/** Merely reading localStorage throws where the browser blocks storage. */
function browserStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

@Component({
  selector: 'app-delivery-chain',
  templateUrl: './delivery-chain.html',
  styleUrl: './delivery-chain.scss',
  host: {
    '(pointerover)': 'follow($event)',
    '(pointerleave)': 'hoveredSha.set(null)',
  },
})
export class DeliveryChain {
  private readonly status = inject(DeliveryStatus);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tabs = viewChildren<ElementRef<HTMLElement>>('tab');
  private readonly rail = viewChild<ElementRef<HTMLElement>>('rail');
  private readonly hint = signal<ChainHint | null>(null);

  readonly slug = input.required<string>();
  readonly selected = signal(0);

  protected readonly texts = chainTexts;
  protected readonly deliveryTexts = deliveryTexts;
  protected readonly notice = this.status.notice;
  /** False in the prerendered page: there every station shows its field, one below the other. */
  protected readonly enhanced = signal(false);
  protected readonly hoveredSha = signal<string | null>(null);
  protected readonly view = computed<ChainView>(() => {
    const plan = this.plan();
    const key = plan.statusKey;
    return buildChainView(plan, key ? this.status.snapshot(key, this.destroyRef)() : null);
  });
  protected readonly stand = computed(() => standLine(this.view()));
  protected readonly isPrivate = computed(() => hasNoPublicChain(this.plan()));
  protected readonly hintShown = computed(() => this.hint()?.shown() ?? false);

  private readonly plan = computed(() => deliveryPlans[this.slug()]);

  constructor() {
    // Browser only and after hydration, so the prerendered list is what hydration finds.
    afterNextRender(() => {
      this.enhanced.set(true);
      this.startHint();
    });
  }

  select(index: number, byUser: boolean): void {
    this.selected.set(index);
    if (byUser) this.hint()?.chosen();
  }

  // Hydration replays a click on the list; only a click on a tab is a choice of the reader.
  protected clicked(index: number): void {
    if (this.enhanced()) this.select(index, true);
  }

  protected choose(event: KeyboardEvent, index: number): void {
    const next = this.keyTarget(event.key, index);
    if (!this.enhanced() || next === null) return;
    event.preventDefault();
    this.select(next, true);
    this.tabs()[next]?.nativeElement.focus();
  }

  protected follow(event: Event): void {
    const target = event.target instanceof Element ? event.target.closest('[data-sha]') : null;
    this.hoveredSha.set(target?.getAttribute('data-sha') ?? null);
  }

  protected tabId = (index: number) => `chain-tab-${index}`;
  protected panelId = (index: number) => `chain-panel-${index}`;
  protected spoken = (state: StepState) => MEASURED_STATES.includes(state);

  /** Column name in front of a value when the table stacks; the first column needs none. */
  protected labelOf({ head }: ChainTable, column: number): string | null {
    return column > 0 && head[column] ? head[column] : null;
  }

  private startHint(): void {
    const rail = this.rail()?.nativeElement;
    if (!rail) return;
    const hint = new ChainHint(browserStorage());
    const lifetime = new AbortController();
    this.watchView(rail, hint, lifetime.signal);
    this.watchActivity(hint, lifetime.signal);
    this.destroyRef.onDestroy(() => {
      lifetime.abort();
      hint.destroy();
    });
    this.hint.set(hint);
  }

  private watchView(rail: HTMLElement, hint: ChainHint, lifetime: AbortSignal): void {
    // A fast scroll can report out and in at once, so the last entry counts. Its ratio, not
    // isIntersecting: that is true for any overlap, below the threshold as well.
    const observer = new IntersectionObserver(
      (entries) => hint.inView(entries.at(-1)!.intersectionRatio >= HINT_THRESHOLD),
      { threshold: HINT_THRESHOLD },
    );
    observer.observe(rail);
    lifetime.addEventListener('abort', () => observer.disconnect());
  }

  private watchActivity(hint: ChainHint, lifetime: AbortSignal): void {
    const options = { passive: true, signal: lifetime };
    for (const type of ACTIVITY_EVENTS) addEventListener(type, () => hint.activity(), options);
  }

  /** Arrows move and wrap around, Home and End jump to the ends (WAI-ARIA APG tabs). */
  private keyTarget(key: string, index: number): number | null {
    const count = this.view().stations.length;
    if (key === 'Home') return 0;
    if (key === 'End') return count - 1;
    const step = ARROW_STEPS[key];
    return step === undefined ? null : (index + step + count) % count;
  }
}
