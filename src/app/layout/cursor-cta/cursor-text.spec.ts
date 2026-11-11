import { cursorText } from './cursor-text';

function renderList(): HTMLElement {
  const page = document.createElement('div');
  page.innerHTML = `
    <a class="row" data-cursor="Details" href="/projekte/vps-plattform/">
      <h3>Titel</h3>
      <span class="cta"><span>CTA</span></span>
    </a>
    <a href="https://github.com/">Code</a>
    <button type="button">Knopf</button>
    <p>Daneben</p>`;
  return page;
}

describe('cursorText', () => {
  it('returns the text of the row under the pointer', () => {
    expect(cursorText(renderList().querySelector('h3'))).toBe('Details');
  });

  it('returns the text on the row link itself and inside its CTA', () => {
    expect(cursorText(renderList().querySelector('a.row'))).toBe('Details');
    expect(cursorText(renderList().querySelector('.cta span'))).toBe('Details');
  });

  it('returns null on another link', () => {
    expect(cursorText(renderList().querySelector('a[href^="https"]'))).toBeNull();
  });

  it('returns null on a button', () => {
    expect(cursorText(renderList().querySelector('button'))).toBeNull();
  });

  it('returns null outside of a row', () => {
    expect(cursorText(renderList().querySelector('p'))).toBeNull();
  });

  it('returns null for no target', () => {
    expect(cursorText(null)).toBeNull();
  });
});
