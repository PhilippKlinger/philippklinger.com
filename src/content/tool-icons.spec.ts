import { focusAreas } from './focus-areas';
import { toolIcons } from './tool-icons';

const tools = focusAreas.flatMap((area) => area.tools);

describe('toolIcons', () => {
  it.each(tools)('"%s" has a symbol id', (tool) => {
    expect(toolIcons[tool]).toMatch(/^[a-z0-9-]+$/);
  });

  it('has no icon without a tool on the start page', () => {
    expect(Object.keys(toolIcons).sort()).toEqual([...tools].sort());
  });
});
