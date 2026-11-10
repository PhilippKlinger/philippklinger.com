import { cursorText } from './cursor-text';

function renderCard(): HTMLElement {
  const page = document.createElement('div');
  page.innerHTML = `
    <article data-card-link>
      <h3>Titel</h3>
      <a data-card-cta data-cursor="Projekt ansehen" href="/projekte/vps-plattform/"><span>CTA</span></a>
      <a href="https://github.com/">Code</a>
      <button type="button">Knopf</button>
    </article>
    <p>Daneben</p>`;
  return page;
}

describe('cursorText', () => {
  it('returns the text of the card under the pointer', () => {
    expect(cursorText(renderCard().querySelector('h3'))).toBe('Projekt ansehen');
  });

  it('returns null on a link inside the card', () => {
    expect(cursorText(renderCard().querySelector('a[href^="https"]'))).toBeNull();
  });

  it('returns null inside the CTA, which already says it', () => {
    expect(cursorText(renderCard().querySelector('a[data-card-cta] span'))).toBeNull();
  });

  it('returns null on a button inside the card', () => {
    expect(cursorText(renderCard().querySelector('button'))).toBeNull();
  });

  it('returns null outside of a card', () => {
    expect(cursorText(renderCard().querySelector('p'))).toBeNull();
  });

  it('returns null for no target', () => {
    expect(cursorText(null)).toBeNull();
  });
});
