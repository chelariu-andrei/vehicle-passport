import { fireEvent, render, screen } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';

import { ThemeProvider } from '../theme';
import { Markdown } from './Markdown';

const show = (source: string) =>
  render(
    <ThemeProvider>
      <Markdown source={source} />
    </ThemeProvider>,
  );

describe('Markdown', () => {
  it('markdownRendersHeadingsAndLists', async () => {
    await show('# Title\n\n## Part\n\n### Detail\n\nA **bold** word.\n\n- one\n- two');
    expect(screen.getByRole('header', { name: 'Title' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Part' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Detail' })).toBeTruthy();
    expect(screen.getByText('bold')).toBeTruthy();
    expect(screen.getByText('one')).toBeTruthy();
    expect(screen.getByText('two')).toBeTruthy();
    expect(screen.getAllByText('•')).toHaveLength(2);
  });

  it('markdownIgnoresRawHtml', async () => {
    const { toJSON } = await show('<script>alert(1)</script>\n\n<b>shouting</b> <img src="x" onerror="boom()">');
    const hosts = new Set<string>();
    const walk = (node: unknown) => {
      if (node === null || typeof node === 'string') return;
      if (Array.isArray(node)) return node.forEach(walk);
      const n = node as { type: string; children?: unknown[] | null };
      hosts.add(n.type);
      n.children?.forEach(walk);
    };
    walk(toJSON());
    // Only native text and view hosts: nothing HTML-like becomes structure.
    expect([...hosts].every((t) => t === 'View' || t === 'Text')).toBe(true);
    // The markup stays inert, visible text.
    expect(screen.getByText('<script>alert(1)</script>')).toBeTruthy();
    expect(screen.getByText(/<b>shouting<\/b>/)).toBeTruthy();
  });

  it('opens http links in the browser and ignores other schemes', async () => {
    await show('[site](https://example.com/a) and [bad](javascript:alert(1))');
    await fireEvent.press(screen.getByRole('link', { name: 'site' }));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://example.com/a');
    await fireEvent.press(screen.getByText('bad'));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledTimes(1);
  });
});
