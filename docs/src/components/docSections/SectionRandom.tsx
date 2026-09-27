import SyntaxHighlighter from 'react-syntax-highlighter';
import { hybrid } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { Signature } from '~/components/api/Signature';
import { Heading2 } from '~/components/catalyst/Heading2';
import { Heading3 } from '~/components/catalyst/Heading3';
import { Code, Text, TextLink } from '~/components/catalyst/Text';

export function SectionRandom() {
    return (
        <>
            <Heading2 id="random-colors">Random colors</Heading2>
            <Text>
                The random methods draw colors uniformly in HSV by default: any
                hue, any saturation, and a brightness (HSV value) from{' '}
                <Code>minBrightness</Code> to 1. Uniform HSV hue is uneven to
                the eye: about 22 % of fully saturated draws land in the greens
                between OKLCH hues 120° and 150°, and about 4 % in each 30° of
                gold or cyan. Uniform saturation draws greys and pastels too: at
                a <Code>minBrightness</Code> of 0.537, about a quarter of draws
                are under relative chroma 0.35.
            </Text>
            <Text>
                Give them <Code>constraints</Code> to draw in OKLCH terms
                instead: the hue uniform over the OKLCH hues allowed, the
                relative chroma uniform within a range, and the brightness
                uniform from <Code>minBrightness</Code> to 1, as before. Every
                color drawn meets its constraint, so no draw is rejected.
                Without <Code>constraints</Code>, colors are drawn in HSV
                exactly as before, so a seeded <Code>random</Code> draws the
                same colors as in 4.0. Try both in the playground&apos;s
                Randomness group.
            </Text>
            <Heading3 id="random-constraints">Constraints</Heading3>
            <Text>
                A{' '}
                <TextLink href="#type-ColorConstraint">
                    ColorConstraint
                </TextLink>{' '}
                has three optional parts. <Code>hues</Code> is a list of arcs of
                OKLCH hue, each a <Code>center</Code> and a full{' '}
                <Code>width</Code> in degrees (or built with{' '}
                <TextLink href="#random-hueArc">hueArc</TextLink>); left out,
                every hue. <Code>avoid</Code> takes arcs out of them, unless
                that would leave no hue. <Code>chroma</Code> bounds the relative
                chroma: a color&apos;s OKLCH chroma as a fraction of the most
                sRGB allows at its hue and brightness, so every value from 0
                (grey) to 1 (as saturated as sRGB gets) is a color at every hue.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`// No greys or pastels, and no olive or lime
theme.randomTheme({
    minBrightness: 0.5,
    constraints: {
        chroma: { min: 0.5 },
        avoid: [hueArc(95, 135)],
    },
});`}
            </SyntaxHighlighter>
            <Text>
                <Code>constraints</Code> is one constraint for every color, or a
                list with one for each position in the palette.{' '}
                <Code>theme.randomTheme</Code>, <Code>Theme.random</Code> and a
                theme built with <Code>nColors</Code> draw the color at position{' '}
                <Code>i</Code> within <Code>constraints[i]</Code>;{' '}
                <Code>theme.randomFrom</Code> keeps its seed at position 0 as it
                is and draws the rest from position 1;{' '}
                <Code>theme.pushRandomColor</Code> draws within the constraint
                for the position it adds; and{' '}
                <Code>theme.rotateRandomColor</Code> within the constraint for
                the position it replaces, the oldest (
                <Code>activePalette.ageOrder[0]</Code>). So a palette built from
                a few picks can roll one color at a time and keep each color
                near its pick. The same goes for the <Code>ColorPalette</Code>{' '}
                methods they call.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const theme = new Theme({
    colors: ['#e8b450', '#7a1a2b', '#2b8f6b'],
    mode: 'oklch',
});
const nearEachPick = theme.activePaletteHexes.map((hex) => {
    const { hue, chroma } = measureColor(hex);
    return {
        hues: hue === null ? [] : [{ center: hue, width: 24 }],
        chroma: { min: chroma - 0.2, max: chroma + 0.2 },
    };
});

// Replace the oldest color with one near the pick in its position
theme.rotateRandomColor({ constraints: nearEachPick });`}
            </SyntaxHighlighter>
            <Heading3 id="random-randomColor">randomColor</Heading3>
            <Signature of="randomColor" />
            <Text>
                Draws one random color, at full precision. With a{' '}
                <Code>constraint</Code> (even <Code>{'{}'}</Code>) it is drawn
                in OKLCH within it; without one, in HSV. Each candidate takes
                three calls to <Code>random</Code>, in the order the random
                methods make them, so a seeded <Code>random</Code> gives the
                same colors every time.
            </Text>
            <Text>
                <Code>awayFrom</Code> keeps the color at least{' '}
                <Code>deltaEThreshold</Code> (CIEDE2000, 20 by default) from
                each of the colors given, as the random methods keep a new color
                from its neighbours: candidates are drawn until one is far
                enough, up to 100, and otherwise the one furthest from its
                nearest is used. The constraint always holds; the distance is
                best effort.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const color = randomColor({
    constraint: {
        hues: [hueArc(20, 60)],
        chroma: { min: 0.7 },
    },
    minBrightness: 0.5, // Defaults to 0
    awayFrom: ['#7a1a2b', '#e8b450'], // Defaults to []
    deltaEThreshold: 20, // Defaults to 20
    random: seededRandom(42), // Defaults to Math.random
});`}
            </SyntaxHighlighter>
            <Heading3 id="random-hueArc">hueArc</Heading3>
            <Signature of="hueArc" />
            <Text>
                The arc of hue running up from one hue to another, wrapping
                through 360: <Code>hueArc(330, 30)</Code> is the 60° of reds
                from 330° through 0° to 30°, and <Code>hueArc(30, 330)</Code>{' '}
                the 300° from 30° round to 330°. From a hue to itself is that
                one hue; a span of 360° or more is every hue.
            </Text>
            <Heading3 id="random-meetsConstraint">meetsConstraint</Heading3>
            <Signature of="meetsConstraint" />
            <Text>
                Whether a color meets a constraint: its relative chroma within
                the range and its hue on the hues allowed (a grey, with no hue,
                passes the hue check). <Code>tolerance</Code> is the slack at
                each bound, in relative chroma (0.005 by default). A hue counts
                as allowed if turning it onto the allowed hues would move the
                color no further than that, so a less saturated color has more
                slack in hue. Colors rounded to 8 bits can need more.
            </Text>
            <Heading3 id="random-measureColor">measureColor</Heading3>
            <Signature of="measureColor" />
            <Text>
                A color&apos;s OKLCH hue (<Code>null</Code> for greys, white and
                black), relative chroma and brightness (HSV value). With{' '}
                <Code>minBrightness</Code>, a darker color is first lifted to it
                by scaling its channels together, the lift{' '}
                <Code>theme.randomFrom</Code> gives its seed, so the color is
                measured as it shows at that floor.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`measureColor('#e8b450'); // { hue: 81.18…, chroma: 0.819…, brightness: 0.909… }
measureColor('#808080'); // { hue: null, chroma: 0, brightness: 0.501… }`}
            </SyntaxHighlighter>
            <Heading3 id="random-colorFromHue">colorFromHue</Heading3>
            <Signature of="colorFromHue" />
            <Text>
                The color at an OKLCH hue, brightness and relative chroma, at
                full precision and in gamut: <Code>measureColor</Code> gives the
                three back. Chroma 1 is the most saturated color at that hue and
                brightness, and chroma 0 the grey of that brightness.
            </Text>
            <Heading3 id="random-maxChroma">maxChroma</Heading3>
            <Signature of="maxChroma" />
            <Text>
                The OKLCH chroma of the most saturated sRGB color at a hue and
                brightness: the one relative chroma 1 stands for. It always lies
                on an edge of the sRGB cube, where one channel is the brightness
                and another is 0. Just past blue&apos;s hue, from 264.05° to
                264.21°, the edge passes three times, and the most saturated of
                the three counts, so <Code>#0000ff</Code> measures relative
                chroma 1. The colors of one brightness there have no chroma
                between the first two crossings, and relative chroma leaves that
                gap out, so every value from 0 to 1 is still a color.
            </Text>
        </>
    );
}
