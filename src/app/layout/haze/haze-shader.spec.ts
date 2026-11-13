import { fragmentSource } from './haze-shader';

// The slider mockup is the reference (docs/mockups/2026-11-13-haze-regler in the private
// workspace): radius R gives exp(-d*d*R), strength S scales .55, .45 and .03 by S.
describe('haze shader', () => {
  it('draws the light with radius 7 and strength 1.2 (S7, 13.11.)', () => {
    expect(fragmentSource).toContain('pull=exp(-d*d*7.)');
    expect(fragmentSource).toContain('mix(col,glow,pull*.66)');
    expect(fragmentSource).toContain('mix(col,strong,pull*pull*.54)');
    expect(fragmentSource).toContain('col+=accent*pull*pull*.036');
  });

  it('keeps the upper limit of the colour, so the accent text keeps 4.5:1', () => {
    expect(fragmentSource).toContain('col=min(col,vec3(.115,.315,.275))');
  });
});
