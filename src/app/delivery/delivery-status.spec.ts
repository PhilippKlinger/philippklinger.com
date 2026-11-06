import { ApplicationRef, computed, makeStateKey, TransferState } from '@angular/core';
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
    TestBed.inject(TransferState).set(keyOf('conduit'), handedOver);
    expect(TestBed.inject(DeliveryStatus).snapshot('conduit')()).toEqual(handedOver);
  });

  it('stays empty for a project the document does not contain yet', () => {
    const status = serviceWithBuild();
    expect(status.snapshot('conduit')()).toBeNull();
    expect(TestBed.inject(TransferState).hasKey(keyOf('conduit'))).toBe(false);
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
});
