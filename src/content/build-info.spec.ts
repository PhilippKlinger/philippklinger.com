import { buildRunUrl, parseBuildInfo } from './build-info';

const sha = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

describe('parseBuildInfo', () => {
  it('reads valid build info', () => {
    const text = JSON.stringify({ sha, runId: '25123456789' });
    expect(parseBuildInfo(text)).toEqual({ sha, runId: '25123456789' });
  });

  it('drops fields it does not know', () => {
    const text = JSON.stringify({ sha, runId: '1', host: 'example.com' });
    expect(parseBuildInfo(text)).toEqual({ sha, runId: '1' });
  });

  it.each([
    '',
    'not json',
    'null',
    '[]',
    '{"sha":"abc"}',
    `{"sha":"${sha}"}`,
    `{"sha":"${sha}","runId":"1;rm"}`,
    `{"sha":"${sha}","runId":1}`,
    `{"sha":"${sha}","runId":""}`,
    `{"sha":"${sha}0","runId":"1"}`,
    `{"sha":"${sha.toUpperCase()}","runId":"1"}`,
    '{"sha":null,"runId":"1"}',
  ])('rejects %s', (text) => {
    expect(parseBuildInfo(text)).toBeNull();
  });
});

describe('buildRunUrl', () => {
  it('builds the link to the run', () => {
    const url = buildRunUrl({ sha, runId: '25123456789' }, 'https://github.com/owner/repo');
    expect(url).toBe('https://github.com/owner/repo/actions/runs/25123456789');
  });
});
