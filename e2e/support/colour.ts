import type { Page } from '@playwright/test';

/** Relative luminance after WCAG of a colour such as "rgb(31, 83, 74)". */
export function luminance(color: string): number {
  const [red = 0, green = 0, blue = 0] = (color.match(/\d+/g) ?? []).map((part) => {
    const channel = Number(part) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** Contrast ratio after WCAG, from 1 to 21. */
export function contrast(first: string, second: string): number {
  const [dark = 0, light = 0] = [luminance(first), luminance(second)].sort((a, b) => a - b);
  return (light + 0.05) / (dark + 0.05);
}

/** RGBA values of a screenshot, decoded by the browser itself, so the tests need no image library. */
export const decodeRgba = (page: Page, png: Buffer) =>
  page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    return [...context.getImageData(0, 0, bitmap.width, bitmap.height).data];
  }, png.toString('base64'));

/** The pixels of decoded RGBA values as "rgb(r, g, b)", in reading order. */
export function pixelColours(rgba: number[]): string[] {
  const colours: string[] = [];
  for (let pixel = 0; pixel < rgba.length; pixel += 4) {
    colours.push(`rgb(${rgba[pixel]}, ${rgba[pixel + 1]}, ${rgba[pixel + 2]})`);
  }
  return colours;
}
