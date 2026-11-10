import {
  ApplicationRef,
  Component,
  computed,
  DestroyRef,
  inject,
  makeStateKey,
  TransferState,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { deliveryTexts, ProjectSnapshot } from '../../content/software-delivery';
import { ProjectKey, StatusDocument } from '../../content/status';
import { healthyStatus } from '../../content/status.fixture';
import { DeliveryStatus } from './delivery-status';
import { STATUS_SNAPSHOT } from './status-snapshot';

const generatedAt = '2026-11-06T00:58:11.069Z';

function statusDocument(): StatusDocument {
  return {
    schemaVersion: 1,
    generatedAt,
    projects: { videoflix: healthyStatus(), portfolio: healthyStatus() },
  };
}

const keyOf = (project: ProjectKey) =>
  makeStateKey<ProjectSnapshot | null>(`status-snapshot-${project}`);

function serviceWithBuild(): DeliveryStatus {
  TestBed.configureTestingModule({
    providers: [{ provide: STATUS_SNAPSHOT, useValue: statusDocument() }],
  });
  return TestBed.inject(DeliveryStatus);
}

@Component({ template: '' })
class ShowingPage {
  readonly ref = inject(DestroyRef);
}

const showingPage = () => TestBed.createComponent(ShowingPage);

/** Without a server behind it the real request fails, no mock involved. */
async function afterFailedRequest(status: DeliveryStatus, asked: () => void): Promise<void> {
  asked();
  TestBed.tick();
  await vi.waitFor(() => expect(status.notice()).toBe(deliveryTexts.refreshFailed));
}

describe('DeliveryStatus', () => {
  it('offers the snapshot of the build at once', () => {
    const snapshot = serviceWithBuild().snapshot('videoflix')();
    expect(snapshot?.generatedAt).toBe(generatedAt);
    expect(snapshot?.status.code.reachable).toBe(true);
  });

  it('writes only the requested project into the transfer state', () => {
    serviceWithBuild().snapshot('videoflix');
    const state = TestBed.inject(TransferState);
    expect(state.hasKey(keyOf('videoflix'))).toBe(true);
    expect(state.hasKey(keyOf('portfolio'))).toBe(false);
    expect(state.get(keyOf('videoflix'), null)).not.toHaveProperty('projects');
  });

  it('reads the snapshot from the transfer state in the browser', () => {
    const handedOver = { generatedAt, status: healthyStatus() };
    TestBed.inject(TransferState).set(keyOf('vps-plattform'), handedOver);
    expect(TestBed.inject(DeliveryStatus).snapshot('vps-plattform')()).toEqual(handedOver);
  });

  it('stays empty for a project the document does not contain yet', () => {
    const status = serviceWithBuild();
    expect(status.snapshot('vps-plattform')()).toBeNull();
    expect(TestBed.inject(TransferState).hasKey(keyOf('vps-plattform'))).toBe(false);
  });

  it('stays empty without any data', () => {
    expect(TestBed.inject(DeliveryStatus).snapshot('videoflix')()).toBeNull();
  });

  it('can be asked from a computed, as the cards do', () => {
    const status = serviceWithBuild();
    const generated = computed(() => status.snapshot('videoflix')()?.generatedAt);
    expect(generated()).toBe(generatedAt);
  });

  it('has no notice before anything was asked', () => {
    expect(TestBed.inject(DeliveryStatus).notice()).toBeNull();
  });

  it('asks for nothing as long as no measured project is shown', async () => {
    const status = TestBed.inject(DeliveryStatus);
    await TestBed.inject(ApplicationRef).whenStable();
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));
    expect(status.notice()).toBeNull();
  });

  // Without a server behind it the real request fails, no mock involved.
  it('keeps the snapshot and tells so when the request fails', async () => {
    const status = serviceWithBuild();
    const snapshot = status.snapshot('videoflix');
    TestBed.tick();
    await vi.waitFor(() => expect(status.notice()).toBe(deliveryTexts.refreshFailed));
    expect(snapshot()?.generatedAt).toBe(generatedAt);
  });

  it('counts a project asked after the request at once', async () => {
    const status = TestBed.inject(DeliveryStatus);
    const page = showingPage();
    await afterFailedRequest(status, () =>
      status.snapshot('videoflix', page.componentInstance.ref),
    );
    page.destroy();
    expect(status.notice()).toBeNull();
    status.snapshot('vps-plattform');
    expect(status.notice()).toBe(deliveryTexts.refreshFailed);
  });

  it('stops counting a project when the page showing it is gone', async () => {
    const status = TestBed.inject(DeliveryStatus);
    const page = showingPage();
    const ask = () => status.snapshot('vps-plattform', page.componentInstance.ref);
    await afterFailedRequest(status, ask);
    // Cards ask again whenever their view is recomputed; one leaving must release all of that.
    ask();
    page.destroy();
    expect(status.notice()).toBeNull();
  });

  it('keeps counting a project while another page still shows it', async () => {
    const status = TestBed.inject(DeliveryStatus);
    const [first, second] = [showingPage(), showingPage()];
    await afterFailedRequest(status, () => {
      status.snapshot('vps-plattform', first.componentInstance.ref);
      status.snapshot('vps-plattform', second.componentInstance.ref);
    });
    first.destroy();
    expect(status.notice()).toBe(deliveryTexts.refreshFailed);
    second.destroy();
    expect(status.notice()).toBeNull();
  });

  it('keeps the value for a page that asks for a released project again', async () => {
    const status = serviceWithBuild();
    const page = showingPage();
    await afterFailedRequest(status, () =>
      status.snapshot('videoflix', page.componentInstance.ref),
    );
    page.destroy();
    expect(status.snapshot('videoflix')()?.generatedAt).toBe(generatedAt);
    expect(status.notice()).toBe(deliveryTexts.refreshFailed);
  });

  it('can be asked by a page from a computed', () => {
    const status = serviceWithBuild();
    const page = showingPage();
    const generated = computed(
      () => status.snapshot('videoflix', page.componentInstance.ref)()?.generatedAt,
    );
    expect(generated()).toBe(generatedAt);
  });
});
