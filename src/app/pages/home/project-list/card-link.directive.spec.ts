import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CardLink } from './card-link.directive';

@Component({
  imports: [CardLink],
  template: `
    <article appCardLink>
      <p class="text">Text on the card</p>
      <a class="quiet" href="/quiet">Quiet link</a>
      <button class="button" type="button">Button</button>
      <a class="cta" data-card-cta href="/target">Details</a>
    </article>
  `,
})
class HostCard {}

// The forwarded click waits for a possible second click, so "nothing happened" takes this long.
const afterSelectionWindow = () => new Promise((resolve) => setTimeout(resolve, 400));

function renderCard() {
  const fixture = TestBed.createComponent(HostCard);
  fixture.detectChanges();
  const card = fixture.nativeElement as HTMLElement;
  document.body.append(card);
  const clicks: EventTarget[] = [];
  card.querySelector('.cta')?.addEventListener('click', (event) => {
    event.preventDefault();
    clicks.push(event.target!);
  });
  return { card, clicks, text: card.querySelector('.text') as HTMLElement };
}

const plainClick = (detail = 1, init: MouseEventInit = {}) =>
  new MouseEvent('click', { bubbles: true, cancelable: true, detail, ...init });

describe('CardLink', () => {
  afterEach(() => {
    document.getSelection()?.removeAllRanges();
  });

  it('marks its host for the styles and the cursor ring', () => {
    expect(renderCard().card.querySelector('article')?.hasAttribute('data-card-link')).toBe(true);
  });

  it('forwards a click on the surface to the CTA', async () => {
    const { card, clicks, text } = renderCard();
    text.dispatchEvent(plainClick());
    await vi.waitFor(() => expect(clicks).toEqual([card.querySelector('.cta')]));
    await afterSelectionWindow();
    expect(clicks).toHaveLength(1);
  });

  it('leaves a click on a link alone', async () => {
    const { card, clicks } = renderCard();
    const quiet = card.querySelector('.quiet') as HTMLElement;
    quiet.addEventListener('click', (event) => event.preventDefault());
    quiet.dispatchEvent(plainClick());
    await afterSelectionWindow();
    expect(clicks).toEqual([]);
  });

  it('leaves a click on a button alone', async () => {
    const { card, clicks } = renderCard();
    card.querySelector('.button')?.dispatchEvent(plainClick());
    await afterSelectionWindow();
    expect(clicks).toEqual([]);
  });

  it.each(['ctrlKey', 'metaKey', 'shiftKey', 'altKey'])(
    'leaves a click with %s alone',
    async (modifier) => {
      const { clicks, text } = renderCard();
      text.dispatchEvent(plainClick(1, { [modifier]: true }));
      await afterSelectionWindow();
      expect(clicks).toEqual([]);
    },
  );

  it('does not navigate while text is selected', async () => {
    const { clicks, text } = renderCard();
    document.getSelection()?.selectAllChildren(text);
    text.dispatchEvent(plainClick());
    await afterSelectionWindow();
    expect(clicks).toEqual([]);
  });

  // A double or triple click selects text, but its first click arrives with nothing selected yet.
  it('does not navigate when the following click selects the text', async () => {
    const { clicks, text } = renderCard();
    text.dispatchEvent(plainClick(1));
    document.getSelection()?.selectAllChildren(text);
    text.dispatchEvent(plainClick(2));
    await afterSelectionWindow();
    expect(clicks).toEqual([]);
  });

  it('drops a waiting click when the card is destroyed', async () => {
    const fixture = TestBed.createComponent(HostCard);
    fixture.detectChanges();
    const cta = (fixture.nativeElement as HTMLElement).querySelector('.cta') as HTMLElement;
    const clicks = vi.fn((event: Event) => event.preventDefault());
    cta.addEventListener('click', clicks);
    (fixture.nativeElement as HTMLElement).querySelector('.text')?.dispatchEvent(plainClick());
    fixture.destroy();
    await afterSelectionWindow();
    expect(clicks).not.toHaveBeenCalled();
  });

  // A quick second click on a link must not be replaced by the waiting click of the surface.
  it.each([
    ['plain', {}],
    ['ctrl', { ctrlKey: true }],
  ])('drops a waiting click when a link is clicked with a %s click', async (_name, init) => {
    const { card, clicks, text } = renderCard();
    const quiet = card.querySelector('.quiet') as HTMLElement;
    quiet.addEventListener('click', (event) => event.preventDefault());
    text.dispatchEvent(plainClick());
    quiet.dispatchEvent(plainClick(1, init));
    await afterSelectionWindow();
    expect(clicks).toEqual([]);
  });

  it('forwards only once for two single clicks on the surface', async () => {
    const { clicks, text } = renderCard();
    text.dispatchEvent(plainClick());
    text.dispatchEvent(plainClick());
    await afterSelectionWindow();
    expect(clicks).toHaveLength(1);
  });

  it('drops every waiting click when the card is destroyed after two clicks', async () => {
    const fixture = TestBed.createComponent(HostCard);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const clicks = vi.fn((event: Event) => event.preventDefault());
    host.querySelector('.cta')?.addEventListener('click', clicks);
    host.querySelector('.text')?.dispatchEvent(plainClick());
    host.querySelector('.text')?.dispatchEvent(plainClick());
    fixture.destroy();
    await afterSelectionWindow();
    expect(clicks).not.toHaveBeenCalled();
  });

  it('forwards only once for a double click that selects nothing', async () => {
    const { clicks, text } = renderCard();
    text.dispatchEvent(plainClick(1));
    text.dispatchEvent(plainClick(2));
    await afterSelectionWindow();
    expect(clicks).toHaveLength(1);
  });
});
