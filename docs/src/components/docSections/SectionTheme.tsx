import SyntaxHighlighter from 'react-syntax-highlighter';
import { hybrid } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { Signature } from '~/components/api/Signature';
import { Heading2 } from '~/components/catalyst/Heading2';
import { Heading3 } from '~/components/catalyst/Heading3';
import { Code, Text, TextLink } from '~/components/catalyst/Text';

export function SectionTheme() {
    return (
        <>
            <Heading2 id="theme">Theme</Heading2>
            <Signature of="new Theme" />
            <Text>
                The <Code>Theme</Code> class is the primary interface for
                creating dynamic color palettes. It is responsible for
                maintaining the current color palette, updating the palette over
                time, and transitioning between palettes.
            </Text>
            <Text>
                You&apos;ll likely need to construct just a single theme for
                your entire application. This single theme can then manage the
                active color palette, global brightness, and other settings, as
                well as managing the transition between palettes.
            </Text>
            <Text>
                To instantiate a new theme, simply create a new instance of the{' '}
                <Code>Theme</Code> class. The defaults are shown below:
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const theme = new Theme({
    nColors: 5,
    nSteps: 2048,
    mode: 'rgb',
    deltaEThreshold: 20,
    maxNumberOfColors: 8,
    brightnessMode: 'darken',
    random: Math.random,
});`}
            </SyntaxHighlighter>
            <Text>
                There are three options for selecting the initial palette of the
                theme.
            </Text>
            <Text>
                The <Code>palette</Code> parameter allows you to pass in an
                existing <Code>ColorPalette</Code> instance. This takes
                precedence if provided. The theme builds its own copy from the
                palette&apos;s colors: it uses the theme&apos;s{' '}
                <Code>nSteps</Code> (2048 unless given, whatever the
                palette&apos;s own), and any <Code>mode</Code>,{' '}
                <Code>maxNumberOfColors</Code>, <Code>deltaEThreshold</Code> or{' '}
                <Code>random</Code> parameter given overrides the
                palette&apos;s.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const palette = new ColorPalette({
    colors: ['red', 'green', 'blue'],
    mode: 'lab',
    nSteps: 10, // Required here; the theme uses its own nSteps (2048)
});
const theme = new Theme({
    palette,
});
theme.mode; // 'lab': the palette's mode, as no mode is given
theme.palette.nSteps; // 2048`}
            </SyntaxHighlighter>
            <Text>
                The <Code>colors</Code> parameter allows you to pass in a list
                of color inputs, which can be <Code>chroma.js</Code>{' '}
                <Code>Color</Code> objects, hex strings, CSS color names, or any
                other string that <Code>chroma.js</Code> can parse. This is the
                next highest priority, if provided.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const theme = new Theme({
    colors: ['red', '#00ff00', 'rgb(0,0,255)'],
});`}
            </SyntaxHighlighter>
            <Text>
                The <Code>nColors</Code> parameter allows you to specify the
                number of colors to generate in the initial palette.{' '}
                <Code>nColors</Code> random colors will be generated for the
                initial palette. This is the lowest priority, if provided. If
                none of the three color options are provided, this parameter
                defaults to 5, resulting in a palette of 5 random colors.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const theme = new Theme({
    nColors: 3,
});`}
            </SyntaxHighlighter>
            <Text>
                The <Code>nSteps</Code> parameter specifies the number of colors
                in the full color wheel. The colors defined in the{' '}
                <Code>Theme</Code> palette, along with the defined{' '}
                <TextLink href="#interpolation">interpolation mode</TextLink>,
                will be used to interpolate <Code>nSteps</Code> colors to fill
                out the circle of colors. This defaults to 2048.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const theme1 = new Theme({
    nColors: 5,
    nSteps: 1024,
});`}
            </SyntaxHighlighter>
            <Text>
                The <Code>mode</Code> parameter specifies the{' '}
                <TextLink href="#interpolation">interpolation mode</TextLink>.
                This defaults to the mode of the <Code>palette</Code> parameter
                if one is given, and to <Code>rgb</Code> otherwise.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const theme1 = new Theme({
    nColors: 5,
    nSteps: 1024,
    mode: 'lab',
});`}
            </SyntaxHighlighter>
            <Text>
                The <Code>deltaEThreshold</Code> parameter specifies the
                threshold for the minimum CIEDE2000 color distance between
                colors in the palette. This threshold is used for all
                randomization methods. This defaults to the{' '}
                <Code>deltaEThreshold</Code> of the <Code>palette</Code>{' '}
                parameter if one is given, and to 20 otherwise.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const theme1 = new Theme({
    nColors: 5,
    deltaEThreshold: 50,
});`}
            </SyntaxHighlighter>
            <Text>
                The <Code>maxNumberOfColors</Code> parameter specifies the max
                number of colors in any given palette allowed in the{' '}
                <Code>Theme</Code>. This is enforced when setting, adding or
                generating colors (see{' '}
                <TextLink href="#theme-maxNumberOfColors">
                    theme.maxNumberOfColors
                </TextLink>
                ). This defaults to the <Code>maxNumberOfColors</Code> of the{' '}
                <Code>palette</Code> parameter if one is given, and to 8
                otherwise.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const theme1 = new Theme({
    nColors: 5,
    maxNumberOfColors: 12,
});`}
            </SyntaxHighlighter>
            <Text>
                The <Code>brightnessMode</Code> parameter controls how{' '}
                <TextLink href="#theme-brightness">brightness</TextLink> is
                applied. <Code>darken</Code> (the default) darkens colors in
                CIELAB space, so light and saturated colors can keep some light
                even at brightness 0 (white becomes <Code>#6d6d6d</Code>).{' '}
                <Code>linear</Code> scales the RGB channels, so brightness 0 is
                black (LEDs off) and 0.5 halves every channel. See{' '}
                <TextLink href="#theme-brightnessMode">
                    theme.brightnessMode
                </TextLink>{' '}
                for details.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const theme1 = new Theme({
    nColors: 5,
    brightnessMode: 'linear',
});`}
            </SyntaxHighlighter>
            <Text>
                The <Code>random</Code> parameter supplies the random number
                generator used for all randomization methods. It should return a
                number in the range [0, 1), like <Code>Math.random</Code>. This
                defaults to the generator of the <Code>palette</Code> parameter
                if one is given, and to <Code>Math.random</Code> otherwise.
                Supply a seeded generator to get reproducible palettes.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const theme1 = new Theme({
    nColors: 5,
    random: seededRandom(42),
});`}
            </SyntaxHighlighter>
            <Heading3 id="theme-random">Theme.random</Heading3>
            <Signature of="Theme.random" />
            <Text>
                Creates a new <Code>Theme</Code> with a palette of{' '}
                <Code>nColors</Code> random colors. This is the same as{' '}
                <Code>new Theme(config)</Code>, with <Code>nColors</Code>{' '}
                required, and takes the same options.
            </Text>
            <Text>
                <Code>nColors</Code> should be a whole number of 1 or more, and
                is capped at the{' '}
                <TextLink href="#theme-maxNumberOfColors">
                    max number of colors
                </TextLink>
                . If <Code>palette</Code> or <Code>colors</Code> is also given,
                it takes precedence as in the constructor, and{' '}
                <Code>nColors</Code> is ignored.
            </Text>
            <Text>
                You can explicitly set a <Code>minBrightness</Code> for the
                random colors. Expects a value between 0 and 1. Defaults to 0.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const theme = Theme.random({
    nColors: 4,
    minBrightness: 0.5, // Defaults to 0
});`}
            </SyntaxHighlighter>
            <Heading3 id="theme-nSteps">theme.nSteps</Heading3>
            <Signature of="Theme#nSteps" />
            <Text>
                The number of colors in the <Code>Theme</Code>&apos;s color
                wheel, set by the <Code>nSteps</Code> constructor option.
                Defaults to 2048. It is read-only: set it with the constructor
                option.
            </Text>
            <Text>
                The palette colors are spread evenly around the wheel, with
                interpolated colors filling the steps between them.{' '}
                <Code>theme.getColor</Code> wraps its index around{' '}
                <Code>nSteps</Code>, and each <Code>theme.tick()</Code> turns
                the wheel one step, so <Code>nSteps</Code> ticks turn it all the
                way round.
            </Text>
            <Text>
                Every palette the <Code>Theme</Code> builds uses it, so{' '}
                <Code>theme.activePalette.nSteps</Code> equals it, including the{' '}
                <TextLink href="#theme-palette">copy</TextLink> made of a{' '}
                <Code>palette</Code> passed to the constructor. Use a whole
                number of 1 or more.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const theme = new Theme({ colors: ['red', 'green', 'blue'] });

// Spread the whole wheel along a strip of 100 LEDs
// (setPixel stands for a function that sets the color of an LED)
for (let i = 0; i < 100; i++) {
    setPixel(i, theme.getColor((i * theme.nSteps) / 100).rgb());
}

// Called on each of 60 ticks a second, turns the wheel
// all the way round every 10 seconds
theme.tick(theme.nSteps / (10 * 60));`}
            </SyntaxHighlighter>
            <Heading3 id="theme-maxNumberOfColors">
                theme.maxNumberOfColors
            </Heading3>
            <Signature of="Theme#maxNumberOfColors" />
            <Text>
                The max number of colors in any palette of the{' '}
                <Code>Theme</Code>, set by the <Code>maxNumberOfColors</Code>{' '}
                constructor option. Defaults to the{' '}
                <Code>maxNumberOfColors</Code> of the <Code>palette</Code>{' '}
                option if one is given, and otherwise to 8. It is read-only: set
                it with the constructor option. Use a whole number of 1 or more.
            </Text>
            <Text>
                Longer color lists are cut to their first{' '}
                <Code>maxNumberOfColors</Code> colors by the constructor,{' '}
                <Code>theme.update</Code> and <Code>theme.setColors</Code>. A
                larger <Code>nColors</Code> is capped at it, and pushing a color
                onto a full palette adds nothing.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const theme = new Theme({
    colors: ['red', 'orange', 'yellow', 'green'],
    maxNumberOfColors: 3,
});
theme.maxNumberOfColors; // 3
theme.activePaletteHexes; // ['#ff0000', '#ffa500', '#ffff00']
theme.pushNewColor('blue'); // No change: the palette is full`}
            </SyntaxHighlighter>
            <Heading3 id="theme-activePalette">theme.activePalette</Heading3>
            <Signature of="Theme#activePalette" />
            <Text>
                Returns the active <Code>ColorPalette</Code> of the{' '}
                <Code>Theme</Code>. If the <Code>Theme</Code> is currently
                transitioning between palettes, this will return the palette
                that the theme is transitioning to.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const palette = theme.activePalette;`}
            </SyntaxHighlighter>
            <Heading3 id="theme-activePaletteHexes">
                theme.activePaletteHexes
            </Heading3>
            <Signature of="Theme#activePaletteHexes" />
            <Text>
                Returns the hex values of the active <Code>ColorPalette</Code>{' '}
                of the <Code>Theme</Code>. If the <Code>Theme</Code> is
                currently transitioning between palettes, this will return the
                hex values of the palette that the theme is transitioning to.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const hexes = theme.activePaletteHexes;`}
            </SyntaxHighlighter>
            <Heading3 id="theme-palette">theme.palette</Heading3>
            <Signature of="Theme#palette" />
            <Text>
                The last <Code>ColorPalette</Code> the <Code>Theme</Code>{' '}
                reached: the initial palette, or the target of the most recent
                transition that ended. When the <Code>Theme</Code> is not
                transitioning, <Code>theme.getColor</Code> reads from it, and{' '}
                <Code>theme.activePalette</Code> returns it.
            </Text>
            <Text>
                It does not change during a transition: it becomes the{' '}
                <TextLink href="#theme-targetPalette">target palette</TextLink>{' '}
                only when the transition ends, and a target replaced
                mid-transition never becomes <Code>theme.palette</Code>.
                Meanwhile the colors are a mix that no palette holds, so read
                them with <Code>theme.getColor</Code>.
            </Text>
            <Text>
                A <Code>palette</Code> passed to the constructor is copied with
                the theme&apos;s settings, such as its <Code>nSteps</Code>, so{' '}
                <Code>theme.palette</Code> is not that object.
            </Text>
            <Text>
                Assigning to <Code>palette</Code> directly is not supported:{' '}
                <Code>theme.getColor</Code> keeps returning the old colors while{' '}
                <Code>theme.activePalette</Code> reports the new ones,
                subscribers are not notified, the next transition starts from
                the old colors, and a palette with a different{' '}
                <Code>nSteps</Code> from the theme&apos;s breaks it. To switch
                to a palette you have, pass its colors and mode to{' '}
                <Code>theme.update</Code>, with a{' '}
                <Code>transitionDuration</Code> of 0 to switch at once.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const theme = new Theme({ colors: ['red', 'blue'] });
const start = theme.palette;

theme.setColors(['green', 'yellow']);
theme.palette === start; // true until the transition ends
const target = theme.targetPalette;

theme.finishTransition();
theme.palette === target; // true`}
            </SyntaxHighlighter>
            <Heading3 id="theme-targetPalette">theme.targetPalette</Heading3>
            <Signature of="Theme#targetPalette" />
            <Text>
                The <Code>ColorPalette</Code> the <Code>Theme</Code> is
                transitioning to, or <Code>undefined</Code> when it is not
                transitioning.{' '}
                <TextLink href="#theme-isTransitioning">
                    theme.isTransitioning
                </TextLink>{' '}
                is true exactly when it is set, and{' '}
                <Code>theme.activePalette</Code> returns it while it is.
            </Text>
            <Text>
                The methods below set it when they start a transition. A call
                for the palette it already holds leaves it as it is; a call for
                a different palette replaces it, and the colors blend on from
                where they are. When the transition ends, on a{' '}
                <Code>theme.tick</Code> or through{' '}
                <Code>theme.finishTransition</Code>, it becomes{' '}
                <TextLink href="#theme-palette">theme.palette</TextLink> and
                returns to <Code>undefined</Code>. A call that changes nothing
                when the <Code>Theme</Code> is not transitioning, such as
                setting the same colors, leaves it <Code>undefined</Code>, and
                so does a <Code>transitionDuration</Code> of 0, which ends any
                transition before the call returns.
            </Text>
            <Text>
                Assigning to <Code>targetPalette</Code> directly is not
                supported: subscribers are not notified that a transition
                started, <Code>theme.mode</Code> is not updated, the colors can
                jump instead of blending, and a palette with a different{' '}
                <Code>nSteps</Code> from the theme&apos;s gives the wrong colors
                or makes <Code>theme.tick</Code>, <Code>theme.getColor</Code> or{' '}
                <Code>theme.transitionDistance</Code> throw. Use the methods
                below to set a new palette, and{' '}
                <Code>theme.finishTransition</Code> to end a transition early.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const theme = new Theme({ colors: ['red', 'blue'] });
theme.targetPalette; // undefined

theme.setColors(['green', 'yellow']);
theme.isTransitioning; // true
theme.activePalette === theme.targetPalette; // true

theme.setColors(['white', 'black'], { transitionDuration: 0 });
theme.targetPalette; // undefined: applied before the call returned`}
            </SyntaxHighlighter>
            <Heading3 id="theme-mode">theme.mode</Heading3>
            <Signature of="Theme#mode" />
            <Text>
                The{' '}
                <TextLink href="#interpolation">interpolation mode</TextLink> of{' '}
                <Code>theme.activePalette</Code>. On construction, it is the{' '}
                <Code>mode</Code> option, else the mode of the{' '}
                <Code>palette</Code> option, else <Code>rgb</Code>.
            </Text>
            <Text>
                It changes when a transition to a palette in another mode
                starts, not when it ends: during a <Code>theme.setMode</Code>{' '}
                transition it is already the new mode, while{' '}
                <Code>theme.palette.mode</Code> is still the old one.
                Transitions mix the colors toward the target in this mode,
                subscribers receive it as <Code>event.mode</Code>, and{' '}
                <Code>theme.update</Code> uses it when no <Code>mode</Code> is
                given.
            </Text>
            <Text>
                Assigning to <Code>mode</Code> directly is not supported: the
                palettes keep their own mode, subscribers are not notified,{' '}
                <Code>theme.update</Code> picks it up while the other methods
                reset it, and during a transition the mixed colors come out
                wrong. Use <Code>theme.setMode</Code>,{' '}
                <Code>theme.rotateMode</Code>, or <Code>theme.update</Code> with
                a <Code>mode</Code> instead, and pass a{' '}
                <Code>transitionDuration</Code> of 0 to switch at once.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const theme = new Theme({ colors: ['red', 'blue'] });
theme.mode; // 'rgb'

theme.setMode('oklch');
theme.mode; // 'oklch'
theme.palette.mode; // 'rgb' until the transition ends`}
            </SyntaxHighlighter>
            <Heading3 id="theme-brightness">theme.brightness</Heading3>
            <Signature of="Theme#brightness" />
            <Text>
                Getter and setter for the brightness of the <Code>Theme</Code>.
                Values range from 0 to 1. The default is 1.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const brightness = theme.brightness;

theme.brightness = 0.6;`}
            </SyntaxHighlighter>
            <Heading3 id="theme-brightnessMode">theme.brightnessMode</Heading3>
            <Signature of="Theme#brightnessMode" />
            <Text>
                How the <TextLink href="#theme-brightness">brightness</TextLink>{' '}
                is applied to colors from <Code>theme.getColor</Code>:{' '}
                <Code>darken</Code> (the default) or <Code>linear</Code>, set by
                the <Code>brightnessMode</Code> constructor option. It is
                read-only: set it with the constructor option.
            </Text>
            <Text>
                <Code>linear</Code> multiplies the red, green and blue values by
                the brightness, so hues are kept (until 8-bit rounding near
                black), 0.5 halves every value and 0 is black. The{' '}
                <Code>Theme</Code> brightness and the <Code>brightness</Code>{' '}
                option of <Code>theme.getColor</Code> multiply: 0.5 and 0.5 give
                the same color as 0.25.
            </Text>
            <Text>
                <Code>darken</Code> lowers the CIELAB lightness, by up to 54 (of
                100) at brightness 0. Whether a color reaches black depends on
                its lightness and saturation: white keeps some light at 0 (
                <Code>#6d6d6d</Code>), mid and dark greys reach black (
                <Code>#777777</Code> at 0, <Code>#333333</Code> already at 0.5),
                and saturated colors can keep a dim tint (<Code>#0000ff</Code>{' '}
                is <Code>#000069</Code> at 0). Hues can shift too (
                <Code>#ff8000</Code> is <Code>#a93a00</Code> at 0.5). The{' '}
                <Code>Theme</Code> brightness and the <Code>brightness</Code>{' '}
                option of <Code>theme.getColor</Code> each darken the color, so
                0.5 and 0.5 is about as dark as 0.
            </Text>
            <Text>
                In either mode, <Code>theme.activePalette</Code>,{' '}
                <Code>theme.activePaletteHexes</Code> and the colors in
                subscriber events are at full brightness.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const theme = new Theme({
    colors: ['#ff8000'],
    brightnessMode: 'linear',
});
theme.brightnessMode; // 'linear'
theme.brightness = 0.5;
theme.getColor().hex(); // '#804000'
theme.getColor(0, { brightness: 0.5 }).hex(); // '#402000'`}
            </SyntaxHighlighter>
            <Heading3 id="theme-getColor">theme.getColor</Heading3>
            <Signature of="Theme#getColor" />
            <Text>
                Gets the <Code>Theme</Code> color at the given index. Handles
                rounding and wrapping around the palette, so you don&apos;t need
                to worry about the index being out of bounds or non-integer.
                Returns a <Code>chroma.js</Code> <Code>Color</Code> object.
                Index defaults to 0.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const color0 = theme.getColor();
const color100 = theme.getColor(100);
const color100Hex = theme.getColor(100).hex();
const [r, g, b] = theme.getColor(100).rgb();`}
            </SyntaxHighlighter>
            <Text>
                You can optionally adjust the brightness of this specific color,
                without affecting the overall <Code>Theme</Code> brightness.
                This brightness factor compounds with the overall brightness.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const colorDimmed = theme.getColor(100, {
    brightness: 0.6,
});`}
            </SyntaxHighlighter>
            <Text>
                Here&apos;s an example of creating a theme with an initial
                rainbow palette and using it to control an LED strip:
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const theme = new Theme({
    colors: ['red', 'green', 'blue'],
    nSteps: 2048,
    mode: 'rgb',
});

for (let i = 0; i < 100; i++) {
    const color = theme.getColor(i);
    // Set the color of the i-th LED to \`color\`
    // Suppose \`setPixel\` is a function
    // that sets the color of an LED
    setPixel(i, color.rgb());
}`}
            </SyntaxHighlighter>
            <Heading3 id="theme-normalizeIndex">theme.normalizeIndex</Heading3>
            <Signature of="Theme#normalizeIndex" />
            <Text>
                Returns the step of the color wheel that{' '}
                <TextLink href="#theme-getColor">theme.getColor</TextLink> reads
                for the given index: a whole number from 0 to{' '}
                <Code>nSteps - 1</Code>. The index is an offset from the color
                index, which <TextLink href="#theme-tick">theme.tick</TextLink>{' '}
                advances, so the same index reads a different step as the color
                index moves. Index defaults to 0, so{' '}
                <Code>theme.normalizeIndex()</Code> is the color index itself,
                rounded to a whole step and wrapped around the wheel.
            </Text>
            <Text>
                The index and the color index are each rounded to the nearest
                whole step (halves round up), then added and wrapped around the
                wheel, so negative and out-of-range indexes are fine. An index
                that is not a finite number (NaN, Infinity) counts as 0. Calling
                it does not change the <Code>Theme</Code>.
            </Text>
            <Text>
                When the <Code>Theme</Code> is not transitioning and is at full
                brightness, <Code>getColor(index)</Code> is the color at this
                step of <Code>activePalette.scaleColors</Code>. During a
                transition,{' '}
                <TextLink href="#theme-activePalette">activePalette</TextLink>{' '}
                is the target palette, so that entry is the color the step is
                heading to, and <Code>getColor</Code> returns a mix between it
                and the color the transition started from.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const theme = new Theme({ nSteps: 100 });

theme.normalizeIndex(5); // 5
theme.normalizeIndex(-1); // 99
theme.normalizeIndex(102.4); // 2

theme.tick(10);
theme.normalizeIndex(); // 10
theme.normalizeIndex(5); // 15
theme.normalizeIndex(-11); // 99

// Not transitioning, at full brightness: the same color
const color = theme.getColor(5);
const sameColor = theme.activePalette.scaleColors[theme.normalizeIndex(5)];`}
            </SyntaxHighlighter>
            <Heading3 id="theme-update">theme.update</Heading3>
            <Signature of="Theme#update" />
            <Text>
                Updates the <Code>Theme</Code> to a new palette. This will set a
                target palette for the theme to transition to.
            </Text>
            <Text>
                The transition will be completed gradually over time, with the
                duration of the transition determined by the set{' '}
                <Code>transitionSpeed</Code>. The <Code>transitionSpeed</Code>{' '}
                should be between 0 and 1. The input value will be clamped to
                this range. A higher value will result in a faster transition,
                while a lower value will result in a slower transition. Defaults
                to 0.1.
            </Text>
            <Text>
                The <Code>mode</Code> is optional and defaults to the current
                interpolation mode.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`theme.update({
    colors: ['red', 'green', 'blue'],
    mode: 'hsv', // Defaults to the current mode
    transitionSpeed: 0.5, // Defaults to 0.1
});`}
            </SyntaxHighlighter>
            <Text>
                To end a transition at a set time instead, pass a{' '}
                <Code>transitionDuration</Code>: the number of ticks the
                transition takes. The colors ease in and out from where they are
                and become exactly the new palette on the last tick. The same
                option works with every method below that sets a new palette,
                and takes precedence over <Code>transitionSpeed</Code>. A value
                that is not a finite number is ignored, and{' '}
                <Code>transitionSpeed</Code> applies instead.
            </Text>
            <Text>
                A duration of 0 applies the palette before the call returns, and
                subscribers are notified once, with <Code>isTransitioning</Code>{' '}
                false.
            </Text>
            <Text>
                Sending the same duration again for the palette the theme is
                already transitioning to changes nothing, so an update can be
                re-sent every tick. A different duration re-times the transition
                to end that many ticks from now, continuing from the current
                colors. The easing starts again from rest, so re-send the same
                duration rather than a countdown of the ticks left.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`// 6 seconds when theme.tick() is called 60 times a second
theme.update({
    colors: ['red', 'green', 'blue'],
    transitionDuration: 6 * 60,
});`}
            </SyntaxHighlighter>
            <Heading3 id="theme-setMode">theme.setMode</Heading3>
            <Signature of="Theme#setMode" />
            <Text>
                Updates the <Code>Theme</Code> to a new interpolation mode. This
                will set a target palette for the theme to transition to with
                the same settings as the current palette other than the new
                interpolation mode.
            </Text>
            <Text>
                The transition will be completed gradually over time, with the
                duration of the transition determined by the set{' '}
                <Code>transitionSpeed</Code>, or by{' '}
                <Code>transitionDuration</Code> if given. The same rules apply
                as for <Code>theme.update</Code>.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`theme.setMode('lab');
theme.setMode('lab', {
    transitionSpeed: 0.5, // Defaults to 0.1
});`}
            </SyntaxHighlighter>
            <Heading3 id="theme-rotateMode">theme.rotateMode</Heading3>
            <Signature of="Theme#rotateMode" />
            <Text>
                Rotates the <Code>Theme</Code> interpolation mode. This will set
                a target palette for the theme to transition to with the same
                settings as the current palette other than the new interpolation
                mode.
            </Text>
            <Text>
                The transition will be completed gradually over time, with the
                duration of the transition determined by the set{' '}
                <Code>transitionSpeed</Code>, or by{' '}
                <Code>transitionDuration</Code> if given. The same rules apply
                as for <Code>theme.update</Code>.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`theme.rotateMode();
theme.rotateMode({
    transitionSpeed: 0.5, // Defaults to 0.1
});`}
            </SyntaxHighlighter>
            <Heading3 id="theme-setColors">theme.setColors</Heading3>
            <Signature of="Theme#setColors" />
            <Text>
                Updates the <Code>Theme</Code> to a new set of colors. This will
                set a target palette for the theme to transition to with the
                same settings as the current palette other than the new colors.
            </Text>
            <Text>
                The transition will be completed gradually over time, with the
                duration of the transition determined by the set{' '}
                <Code>transitionSpeed</Code>, or by{' '}
                <Code>transitionDuration</Code> if given. The same rules apply
                as for <Code>theme.update</Code>.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`theme.setColors(['red', 'green', 'blue']);
theme.setColors(['red', 'green', 'blue'], {
    transitionSpeed: 0.5, // Defaults to 0.1
});`}
            </SyntaxHighlighter>
            <Heading3 id="theme-randomFrom">theme.randomFrom</Heading3>
            <Signature of="Theme#randomFrom" />
            <Text>
                Updates the <Code>Theme</Code> to a new set of colors randomized
                based on a seed color, which will become the first color of the
                new palette. Defaults to the same number of colors as the
                current palette, though this can be explicitly set. The max
                number of colors defined in the theme config is always
                respected. This will set a target palette for the theme to
                transition to with the same settings as the current palette
                other than the new colors.
            </Text>
            <Text>
                The transition will be completed gradually over time, with the
                duration of the transition determined by the set{' '}
                <Code>transitionSpeed</Code>, or by{' '}
                <Code>transitionDuration</Code> if given. The same rules apply
                as for <Code>theme.update</Code>.
            </Text>
            <Text>
                You can explicitly set a <Code>minBrightness</Code> for the new
                random colors. Expects a value between 0 and 1. Defaults to 0.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`theme.randomFrom('red');
theme.randomFrom('red', {
    minBrightness: 0.5, // Defaults to 0
    nColors: 5, // Defaults to the number of colors in the current palette
    transitionSpeed: 0.5, // Defaults to 0.1
});`}
            </SyntaxHighlighter>
            <Heading3 id="theme-randomTheme">theme.randomTheme</Heading3>
            <Signature of="Theme#randomTheme" />
            <Text>
                Updates the <Code>Theme</Code> to a new set of random colors.
                Defaults to the same number of colors as the current palette,
                though this can be explicitly set. The max number of colors
                defined in the theme config is always respected. This will set a
                target palette for the theme to transition to with the same
                settings as the current palette other than the new colors.
            </Text>
            <Text>
                The transition will be completed gradually over time, with the
                duration of the transition determined by the set{' '}
                <Code>transitionSpeed</Code>, or by{' '}
                <Code>transitionDuration</Code> if given. The same rules apply
                as for <Code>theme.update</Code>.
            </Text>
            <Text>
                You can explicitly set a <Code>minBrightness</Code> for the new
                random colors. Expects a value between 0 and 1. Defaults to 0.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`theme.randomTheme();
theme.randomTheme({
    minBrightness: 0.5, // Defaults to 0
    nColors: 5, // Defaults to the number of colors in the current palette
    transitionSpeed: 0.5, // Defaults to 0.1
});`}
            </SyntaxHighlighter>
            <Heading3 id="theme-pushNewColor">theme.pushNewColor</Heading3>
            <Signature of="Theme#pushNewColor" />
            <Text>
                Pushes a new color to the <Code>Theme</Code> palette. This will
                set a target palette for the theme to transition to with the
                same settings as the current palette other than the new colors.
            </Text>
            <Text>
                The input can be a <Code>chroma.js</Code> <Code>Color</Code>{' '}
                object, hex string, CSS color name, or any other string that{' '}
                <Code>chroma.js</Code> can parse.
            </Text>
            <Text>
                The transition will be completed gradually over time, with the
                duration of the transition determined by the set{' '}
                <Code>transitionSpeed</Code>, or by{' '}
                <Code>transitionDuration</Code> if given. The same rules apply
                as for <Code>theme.update</Code>.
            </Text>
            <Text>
                If the number of colors in the palette is already at the{' '}
                <Code>maxNumberOfColors</Code>, this will not add a new color.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`theme.pushNewColor('red');
theme.pushNewColor('red', {
    transitionSpeed: 0.5, // Defaults to 0.1
});`}
            </SyntaxHighlighter>
            <Heading3 id="theme-pushRandomColor">
                theme.pushRandomColor
            </Heading3>
            <Signature of="Theme#pushRandomColor" />
            <Text>
                Pushes a new random color to the <Code>Theme</Code> palette.
                This will set a target palette for the theme to transition to
                with the same settings as the current palette other than the new
                colors.
            </Text>
            <Text>
                The transition will be completed gradually over time, with the
                duration of the transition determined by the set{' '}
                <Code>transitionSpeed</Code>, or by{' '}
                <Code>transitionDuration</Code> if given. The same rules apply
                as for <Code>theme.update</Code>.
            </Text>
            <Text>
                If the number of colors in the palette is already at the{' '}
                <Code>maxNumberOfColors</Code>, this will not add a new color.
            </Text>
            <Text>
                You can explicitly set a <Code>minBrightness</Code> for the new
                random color. Expects a value between 0 and 1. Defaults to 0.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`theme.pushRandomColor();
theme.pushRandomColor({
    minBrightness: 0.5, // Defaults to 0
    transitionSpeed: 0.5, // Defaults to 0.1
});`}
            </SyntaxHighlighter>
            <Heading3 id="theme-popOldestColor">theme.popOldestColor</Heading3>
            <Signature of="Theme#popOldestColor" />
            <Text>
                Drops the oldest color from the <Code>Theme</Code> palette. This
                will set a target palette for the theme to transition to with
                the same settings as the current palette other than the new
                colors.
            </Text>
            <Text>
                The transition will be completed gradually over time, with the
                duration of the transition determined by the set{' '}
                <Code>transitionSpeed</Code>, or by{' '}
                <Code>transitionDuration</Code> if given. The same rules apply
                as for <Code>theme.update</Code>.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`theme.popOldestColor();
theme.popOldestColor({
    transitionSpeed: 0.5, // Defaults to 0.1
});`}
            </SyntaxHighlighter>
            <Heading3 id="theme-rotateColor">theme.rotateColor</Heading3>
            <Signature of="Theme#rotateColor" />
            <Text>
                Drops the oldest color from the <Code>Theme</Code> palette and
                adds the new color. This will set a target palette for the theme
                to transition to with the same settings as the current palette
                other than the new colors.
            </Text>
            <Text>
                The input can be a <Code>chroma.js</Code> <Code>Color</Code>{' '}
                object, hex string, CSS color name, or any other string that{' '}
                <Code>chroma.js</Code> can parse.
            </Text>
            <Text>
                The transition will be completed gradually over time, with the
                duration of the transition determined by the set{' '}
                <Code>transitionSpeed</Code>, or by{' '}
                <Code>transitionDuration</Code> if given. The same rules apply
                as for <Code>theme.update</Code>.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`theme.rotateColor('red');
theme.rotateColor('red', {
    transitionSpeed: 0.5, // Defaults to 0.1
});`}
            </SyntaxHighlighter>
            <Heading3 id="theme-rotateRandomColor">
                theme.rotateRandomColor
            </Heading3>
            <Signature of="Theme#rotateRandomColor" />
            <Text>
                Drops the oldest color from the <Code>Theme</Code> palette and
                adds a random color. This will set a target palette for the
                theme to transition to with the same settings as the current
                palette other than the new colors.
            </Text>
            <Text>
                The transition will be completed gradually over time, with the
                duration of the transition determined by the set{' '}
                <Code>transitionSpeed</Code>, or by{' '}
                <Code>transitionDuration</Code> if given. The same rules apply
                as for <Code>theme.update</Code>.
            </Text>
            <Text>
                You can explicitly set a <Code>minBrightness</Code> for the new
                random color. Expects a value between 0 and 1. Defaults to 0.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`theme.rotateRandomColor();
theme.rotateRandomColor({
    minBrightness: 0.5, // Defaults to 0
    transitionSpeed: 0.5, // Defaults to 0.1
});`}
            </SyntaxHighlighter>
            <Heading3 id="theme-tick">theme.tick</Heading3>
            <Signature of="Theme#tick" />
            <Text>
                Arguably the most important method. This advances the color
                index by a given number of frames, and moves the colors toward
                the target palette if one is set. This should probably be called
                once per frame in an animation context.
            </Text>
            <Text>
                The number of frames defaults to 1. If you want to advance the
                color index by more than one frame, you can pass the number of
                frames as an argument. Fractional frames add up, and colors are
                read at the nearest whole step. This does not affect the
                transition between palettes, which advances once per call, so{' '}
                <Code>theme.tick(0)</Code> advances a transition without moving
                the color index.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`theme.tick();
theme.tick(10);
theme.tick(0); // Transition only`}
            </SyntaxHighlighter>
            <Heading3 id="theme-isTransitioning">
                theme.isTransitioning
            </Heading3>
            <Signature of="Theme#isTransitioning" />
            <Text>
                Whether the <Code>Theme</Code> is transitioning to a target
                palette.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`if (theme.isTransitioning) {
    // A transition is in progress
}`}
            </SyntaxHighlighter>
            <Heading3 id="theme-transitionDistance">
                theme.transitionDistance
            </Heading3>
            <Signature of="Theme#transitionDistance" />
            <Text>
                How far the <Code>Theme</Code>&apos;s colors are from the target
                palette: the average CIEDE2000 distance between the colors it
                shows and the target palette&apos;s colors, from 0 (identical)
                to 100. It is estimated from up to 128 evenly spaced colors of
                the full color wheel, and ignores{' '}
                <TextLink href="#theme-brightness">brightness</TextLink> and the
                color index. It is an average, so single colors can be further
                off.
            </Text>
            <Text>
                It is <Code>undefined</Code> whenever{' '}
                <Code>theme.isTransitioning</Code> is false, so it reads{' '}
                <Code>undefined</Code>, not 0, once a transition ends. During a{' '}
                <Code>transitionDuration</Code> transition, it is measured from
                the current colors when read, so it is defined as soon as the
                new palette is set. During a <Code>transitionSpeed</Code>{' '}
                transition, it is measured on each tick, before the colors move:
                it is <Code>undefined</Code> until the first tick after the
                target palette changes, and then one tick behind the colors{' '}
                <Code>theme.getColor</Code> returns.
            </Text>
            <Text>
                It usually falls toward 0, but it can hold or rise before it
                falls, most often in hue-based{' '}
                <TextLink href="#interpolation">interpolation modes</TextLink>:
                from cyan to red in <Code>hsl</Code>, it rises from 71 to 87
                first. It need not get small before the transition ends: a short{' '}
                <Code>transitionDuration</Code> transition can end on its last
                tick while the distance is still above 1, and it then goes
                straight to <Code>undefined</Code>.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const theme = new Theme({ colors: ['red', 'blue'] });
theme.setColors(['green', 'yellow']);

// Once per frame
theme.tick();
const distance = theme.transitionDistance;
if (!theme.isTransitioning || (distance !== undefined && distance < 1)) {
    // Not transitioning, or on average within about one
    // just-noticeable difference of the target palette
}`}
            </SyntaxHighlighter>
            <Heading3 id="theme-finishTransition">
                theme.finishTransition
            </Heading3>
            <Signature of="Theme#finishTransition" />
            <Text>
                Finishes the current transition now. The target palette is
                applied exactly, and subscribers are notified as when a
                transition ends on its own. Does nothing when the{' '}
                <Code>Theme</Code> is not transitioning.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`theme.finishTransition();`}
            </SyntaxHighlighter>
            <Heading3 id="theme-subscribe">theme.subscribe</Heading3>
            <Signature of="Theme#subscribe" />
            <Text>
                Subscribe to updates to the <Code>Theme</Code>. The callback
                will be called whenever the target palette of the{' '}
                <Code>Theme</Code> is updated, whenever the <Code>Theme</Code>{' '}
                reaches the target palette, and whenever{' '}
                <TextLink href="#theme-brightness">theme.brightness</TextLink>{' '}
                changes.
            </Text>
            <Text>
                The <Code>subscribe</Code> function also returns the current
                theme state, which can be used to initialize some variable.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const myCallback = (event: ThemeUpdateEvent)=> {
    // Do something with the event
}

theme.subscribe(myCallback);`}
            </SyntaxHighlighter>
            <Text>
                Here&apos;s an example of the actual React hook being used in
                the demo above to show the currently selected interpolation
                mode:
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`import { ThemeUpdateCallback, ThemeUpdateEvent } from 'colormotion';
import { useEffect, useState } from 'react';
import { theme } from '~/components/theme/theme';

export function useInterpolationMode() {
    const [mode, setMode] = useState<ThemeUpdateEvent['mode'] | undefined>(
        undefined,
    );

    useEffect(() => {
        const updatePalette: ThemeUpdateCallback = (event) => {
            setMode(event.mode);
        };
        
        // Subscribe to theme updates and capture the current state
        const initialState = theme.subscribe(updatePalette);

        // Initialize the state upon mounting
        updatePalette(initialState);

        return () => {
            theme.unsubscribe(updatePalette);
        };
    }, []);

    return mode;
}`}
            </SyntaxHighlighter>
            <Heading3 id="theme-unsubscribe">theme.unsubscribe</Heading3>
            <Signature of="Theme#unsubscribe" />
            <Text>
                Unsubscribe a given callback from <Code>Theme</Code> updates.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`theme.unsubscribe(myCallback);`}
            </SyntaxHighlighter>
        </>
    );
}
