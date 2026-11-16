import * as WebBrowser from 'expo-web-browser';
import { View } from 'react-native';

import { tokens } from '../tokens.generated';
import { Text } from './Text';

type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] };

/** Markdown subset: `#`/`##`/`###`, paragraphs, `-` lists. Anything else, raw HTML included, stays plain text. */
function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] | null = null;
  const flush = () => {
    if (paragraph.length > 0) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    if (list) blocks.push({ kind: 'list', items: list });
    paragraph = [];
    list = null;
  };
  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const item = /^[-*]\s+(.*)$/.exec(line);
    if (line === '') flush();
    else if (heading) {
      flush();
      blocks.push({ kind: 'heading', level: heading[1].length as 1 | 2 | 3, text: heading[2] });
    } else if (item) {
      if (paragraph.length > 0) flush();
      (list ??= []).push(item[1]);
    } else {
      if (list) flush();
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

/** Only web addresses and mail links are followed; a `javascript:` or `file:` target is shown as plain text. */
const SAFE_URL = /^(https?:\/\/|mailto:)/i;

const INLINE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

function Inline({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const key = match.index;
    if (match[1] !== undefined) {
      parts.push(
        <Text key={key} style={{ fontWeight: '700' }}>
          {match[1]}
        </Text>,
      );
    } else if (SAFE_URL.test(match[3])) {
      const url = match[3];
      parts.push(
        <Text key={key} color="brand" accessibilityRole="link" onPress={() => void WebBrowser.openBrowserAsync(url)}>
          {match[2]}
        </Text>,
      );
    } else {
      parts.push(<Text key={key}>{match[2]}</Text>);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

const HEADING = { 1: 'title-lg', 2: 'title', 3: 'label' } as const;

/** Renders trusted-shape legal text from the API. It never builds markup from the source: everything is native text. */
export function Markdown({ source }: { source: string }) {
  return (
    <View style={{ gap: tokens.space['space-3'] }}>
      {parseBlocks(source).map((block, i) => {
        if (block.kind === 'heading') {
          return (
            <Text key={i} variant={HEADING[block.level]} accessibilityRole="header">
              {block.text}
            </Text>
          );
        }
        if (block.kind === 'list') {
          return (
            <View key={i} style={{ gap: tokens.space['space-1'] }}>
              {block.items.map((item, j) => (
                <View key={j} style={{ flexDirection: 'row', gap: tokens.space['space-2'] }}>
                  <Text>•</Text>
                  <Text style={{ flex: 1 }}>
                    <Inline text={item} />
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <Text key={i}>
            <Inline text={block.text} />
          </Text>
        );
      })}
    </View>
  );
}
