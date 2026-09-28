import SyntaxHighlighter from 'react-syntax-highlighter';
import { hybrid } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { Signature } from '~/components/api/Signature';
import { Heading2 } from '~/components/catalyst/Heading2';
import { Heading3 } from '~/components/catalyst/Heading3';
import { Code, Strong, Text, TextLink } from '~/components/catalyst/Text';
import { UnorderedList } from '~/components/catalyst/UnorderedList';

export function SectionRelationships() {
    return (
        <>
            <Heading2 id="relationships">Theme relationships</Heading2>
            <Text>
                A theme&apos;s colors relate to one another: a family of
                oranges, gold against oxblood, violet and orange bridged by
                magenta. <Code>analyzeTheme</Code> finds that relationship, a
                template turns it into a slot for each color, and colors drawn
                within the slots keep it: near the theme&apos;s own colors (
                <Code>adjacentConstraints</Code>), or in the same shape at
                another hue (<Code>randomLike</Code>). Try them in the
                playground&apos;s Shape group.
            </Text>
            <Heading3 id="relationships-analyzeTheme">analyzeTheme</Heading3>
            <Signature of="analyzeTheme" />
            <Text>
                Measures each color (see{' '}
                <TextLink href="#random-measureColor">measureColor</TextLink>),
                lifted to <Code>minBrightness</Code> so it is measured as it
                shows. Vivid colors (relative chroma 0.75 or more) define the
                hue structure, and hues less than 30° apart chain into a group.
                Muted tints and tones follow the nearest vivid color within 45°,
                or form groups of their own, and greys, whites and blacks (under
                0.12) take no part. The relationship follows from the groups:
            </Text>
            <UnorderedList>
                <li>
                    <Strong>neutral</Strong>: none, every color a grey, white or
                    black.
                </li>
                <li>
                    <Strong>family</Strong>: one (or three packed into less than
                    90°).
                </li>
                <li>
                    <Strong>accent</Strong>: two, less than 90° apart.
                </li>
                <li>
                    <Strong>contrast</Strong>: two, 90° or more apart.
                </li>
                <li>
                    <Strong>bridge</Strong>: three within half the wheel,
                    spanning 90° or more.
                </li>
                <li>
                    <Strong>pair-accent</Strong>: three spread wider, two of
                    them less than 90° apart.
                </li>
                <li>
                    <Strong>triad</Strong>: three, every gap 90° or more.
                </li>
                <li>
                    <Strong>spectrum</Strong>: four or more.
                </li>
            </UnorderedList>
            <Text>
                The anchor is the center of the heaviest group. The thresholds
                are options, and the result (a{' '}
                <TextLink href="#type-ThemeAnalysis">ThemeAnalysis</TextLink>)
                is plain JSON. It depends on the colors, not their order.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const analysis = analyzeTheme(
    ['#e8b450', '#f4dca8', '#7a1a2b', '#b8862f', '#2b1a12'],
    { minBrightness: 0.537 },
);
analysis.relationship; // 'accent': gold against oxblood, 63° apart
analysis.anchor; // 79.2…: the hue of the gold group
analysis.picks[4].role; // 'muted': the umber follows the oxblood`}
            </SyntaxHighlighter>
            <Heading3 id="relationships-relationshipTemplate">
                relationshipTemplate
            </Heading3>
            <Signature of="relationshipTemplate" />
            <Text>
                From an analysis, a slot for each color, in order: its role, its
                offset from the anchor, an arc of hue around it and a band of
                relative chroma that keeps it in its role. The arc reaches{' '}
                <Code>hueWidth</Code> (12° by default) plus a quarter of its
                group&apos;s span either side, up to <Code>maxHueWidth</Code>{' '}
                (20°). The slots are then narrowed where they have to be, so
                that no palette drawn within them changes the relationship or
                the number of groups: groups are never drawn close enough to
                merge, nor a group&apos;s colors far enough apart to split, nor
                a muted color far from its group, and where the theme sits near
                a threshold, no group can move across it (narrowing the chroma
                too, where the colors&apos; chroma alone could move it). That
                holds for colors as drawn: rounded to 8 bits, a hue can move by
                a degree or so, and more for a muted color.
            </Text>
            <Text>
                With <Code>nColors</Code>, it grows a few picks into more slots.
                The extra slots go to the picks by relative chroma (neutral
                picks get none), each in a run after its pick&apos;s own slot,{' '}
                <Code>pickSlots[j]</Code>, and each copies it.
            </Text>
            <Text>
                From a kind (<Code>&apos;triad&apos;</Code>,{' '}
                <Code>&apos;contrast&apos;</Code> and so on) and{' '}
                <Code>nColors</Code>, it draws a template of that kind: its
                geometry within documented ranges, the slots in hue order so the
                gradient runs through the relationship, and <Code>tints</Code>{' '}
                muted slots that follow the groups.
            </Text>
            <Heading3 id="relationships-templateConstraints">
                templateConstraints
            </Heading3>
            <Signature of="templateConstraints" />
            <Text>
                A constraint for each slot, with the template placed at an
                anchor hue: each slot&apos;s arc centered on{' '}
                <Code>anchor + offset</Code>, or <Code>anchor − offset</Code>{' '}
                when mirrored. Neutral slots never rotate or mirror.{' '}
                <Code>avoid</Code> is added to every slot that does.
            </Text>
            <Heading3 id="relationships-adjacentConstraints">
                adjacentConstraints
            </Heading3>
            <Signature of="adjacentConstraints" />
            <Text>
                The template at the theme&apos;s own anchor: the neighbourhood
                of each color. A color drawn within <Code>constraints[i]</Code>{' '}
                stays near color <Code>i</Code>, in its role, so rolling one
                color at a time within them keeps the theme near its colors:
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const nearEachColor = adjacentConstraints(
    analyzeTheme(theme.activePaletteHexes, { minBrightness: 0.5 }),
);

// Replace the oldest color with one near the color in its position
theme.rotateRandomColor({
    minBrightness: 0.5,
    constraints: nearEachColor,
});`}
            </SyntaxHighlighter>
            <Heading3 id="relationships-randomLike">randomLike</Heading3>
            <Signature of="randomLike" />
            <Text>
                A palette in the same relationship at another anchor hue,
                optionally mirrored: a contrast pair stays a contrast pair, a
                bridge a bridge. Each attempt draws the anchor, whether to
                mirror, and a color per slot, each kept{' '}
                <Code>deltaEThreshold</Code> from the one before it and the last
                from the first. The palette is analyzed again, as drawn and
                rounded to 8 bits, and redrawn until it matches (up to{' '}
                <Code>attempts</Code>); otherwise the closest comes back with{' '}
                <Code>verified: false</Code>. The <Code>anchor</Code> option
                fixes the anchor or gives the arcs to draw it from, and with{' '}
                <Code>avoid</Code> no slot is centered in the hues avoided. Keep
                the <Code>constraints</Code> it returns to roll single colors in
                the new shape.
            </Text>
            <Text>
                Each color is kept <Code>deltaEThreshold</Code> from its
                neighbours by drawing candidates until one is far enough, up to
                100. Where the slots are too narrow for that (two groups a few
                degrees wide at a high <Code>minBrightness</Code>, say), every
                color pays all 100 candidates, 300 calls to <Code>random</Code>,
                and <Code>randomLike</Code> pays that for each color of each
                attempt: up to 33,680 calls for 8 colors.{' '}
                <Code>candidateBudget</Code> bounds the whole call: each attempt
                may use half of what is left of it, shared by its colors, and a
                color that runs out keeps the furthest candidate it found. At
                1000, palettes are about as far apart as without it, and 8
                colors take at most 3,416 calls. The random palette methods take
                it too, shared by the colors they draw, and so does{' '}
                <Code>randomColor</Code>, though a single color never looks at
                more than 100 candidates. Left out, every draw is as in 4.2;
                given, a color that stops short leaves <Code>random</Code>{' '}
                elsewhere, so a seeded <Code>random</Code> draws differently
                after it.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const anchor = analysis.anchor ?? 0;
const { colors, constraints } = randomLike(analysis, {
    minBrightness: 0.5,
    // 30° to 90° away, either way round
    anchor: [
        hueArc(anchor + 30, anchor + 90),
        hueArc(anchor - 90, anchor - 30),
    ],
    // no slot centered in olive or lime
    avoid: [hueArc(95, 135)],
    candidateBudget: 1000, // bounds the cost; left out, up to 100 candidates a color
});
theme.setColors(colors);
theme.rotateRandomColor({ minBrightness: 0.5, constraints });

// With no theme to start from
theme.setColors(
    randomLike(relationshipTemplate('triad', { nColors: 5 })).colors,
);`}
            </SyntaxHighlighter>
        </>
    );
}
