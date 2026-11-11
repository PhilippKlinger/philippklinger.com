import { dotLook } from './dot-look';

function renderPage(): HTMLElement {
  const page = document.createElement('div');
  page.innerHTML = `
    <p>Text</p>
    <a href="/"><span>Link</span></a>
    <button type="button"><span>Knopf</span></button>
    <input aria-label="Feld" />
    <textarea aria-label="Text"></textarea>
    <a class="row" data-cursor="Details" href="/projekte/vps-plattform/">
      <h3>Titel</h3>
    </a>`;
  return page;
}

describe('dotLook', () => {
  it('is a dot on plain content', () => {
    expect(dotLook(renderPage().querySelector('p'))).toBe('dot');
  });

  it('is a dot for no target', () => {
    expect(dotLook(null)).toBe('dot');
  });

  it('is a circle inside a link', () => {
    expect(dotLook(renderPage().querySelector('a span'))).toBe('circle');
  });

  it('is a circle inside a button', () => {
    expect(dotLook(renderPage().querySelector('button span'))).toBe('circle');
  });

  it('is off on a row of the project list, where the ring is on', () => {
    expect(dotLook(renderPage().querySelector('a.row'))).toBe('off');
    expect(dotLook(renderPage().querySelector('h3'))).toBe('off');
  });

  it('is off over an input and a textarea, they keep the normal pointer', () => {
    expect(dotLook(renderPage().querySelector('input'))).toBe('off');
    expect(dotLook(renderPage().querySelector('textarea'))).toBe('off');
  });
});
