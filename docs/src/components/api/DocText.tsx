import { ReactNode } from 'react';
import { Code, Text } from '~/components/catalyst/Text';
import { UnorderedList } from '~/components/catalyst/UnorderedList';

/** Text with its `backticked` spans as code. */
function inline(text: string): ReactNode[] {
    return text
        .split(/`([^`]+)`/)
        .map((part, i) => (i % 2 ? <Code key={i}>{part}</Code> : part));
}

/**
 * A JSDoc comment as prose: blank lines separate paragraphs, lines starting with `- ` are list items
 * (continued by the lines after them), and other line breaks are spaces.
 */
export function DocText({ text }: { text: string }) {
    return text.split(/\n\s*\n/).map((paragraph, p) => {
        const lead: string[] = [];
        const items: string[][] = [];
        for (const line of paragraph.split('\n')) {
            const trimmed = line.trim();
            if (trimmed.startsWith('- ')) {
                items.push([trimmed.slice(2)]);
            } else if (items.length > 0) {
                items[items.length - 1]!.push(trimmed);
            } else {
                lead.push(trimmed);
            }
        }
        return (
            <div key={p} className="space-y-2">
                {lead.length > 0 && <Text>{inline(lead.join(' '))}</Text>}
                {items.length > 0 && (
                    // as wide as the Text around it
                    <div className="sm:max-w-135">
                        <UnorderedList>
                            {items.map((item, i) => (
                                <li key={i}>{inline(item.join(' '))}</li>
                            ))}
                        </UnorderedList>
                    </div>
                )}
            </div>
        );
    });
}
