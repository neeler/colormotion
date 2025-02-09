import SyntaxHighlighter from 'react-syntax-highlighter';
import { hybrid } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { Heading2 } from '~/components/catalyst/Heading2';
import { Heading3 } from '~/components/catalyst/Heading3';
import { Code, Text, TextLink } from '~/components/catalyst/Text';

export function SectionTheme() {
    return (
        <>
            <Heading2 id="theme">Theme</Heading2>
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
                To instantiate a new theme, simple create a new instance of the{' '}
                <Code>Theme</Code> class. The defaults are shown below:
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const theme = new Theme({
    nColors: 5,
    nSteps: 2048,
    mode: 'rgb',
    deltaEThreshold: 20,
    maxNumberOfColors: 8,
});`}
            </SyntaxHighlighter>
            <Text>
                There are three options for selecting the initial palette of the
                theme.
            </Text>
            <Text>
                The <Code>palette</Code> parameter allows you to pass in an
                existing <Code>ColorPalette</Code> instance. This takes
                precedence if provided.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const palette = new ColorPalette({
    colors: ['red', 'green', 'blue'],
    mode: 'rgb',
    nSteps: 10,
});
const theme = new Theme({
    palette,
});`}
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
                <Code>Theme</Code>
                palette, along with the defined{' '}
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
                This defaults to <Code>rgb</Code>.
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
                randomization methods. This defaults to 20.
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
                <Code>Theme</Code>. This is enforced when adding new colors to
                the palette or generating a random palette. This defaults to 8.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const theme1 = new Theme({
    nColors: 5,
    maxNumberOfColors: 12,
});`}
            </SyntaxHighlighter>
            <Heading3 id="theme-activePalette">theme.activePalette</Heading3>
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
            <Text>
                Returns the hex values of the active <Code>ColorPalette</Code>{' '}
                of the <Code>Theme</Code>. If the <Code>Theme</Code> is
                currently transitioning between palettes, this will return the
                hex values of the palette that the theme is transitioning to.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const hexes = theme.activePaletteHexes;`}
            </SyntaxHighlighter>
            <Heading3 id="theme-brightness">theme.brightness</Heading3>
            <Text>
                Getter and setter for the brightness of the <Code>Theme</Code>.
                Values range from 1 to 255. The default is 255.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const brightness = theme.brightness;

theme.brightness = 128;`}
            </SyntaxHighlighter>
            <Heading3 id="theme-getColor">theme.getColor</Heading3>
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
    brightness: 128,
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
            <Heading3 id="theme-update">theme.update</Heading3>
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
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`theme.update({
    colors: ['red', 'green', 'blue'],
    nSteps: 10,
    mode: 'hsv',
});
theme.update(
    {
        colors: ['red', 'green', 'blue'],
        nSteps: 10,
        mode: 'hsv',
    },
    {
        transitionSpeed: 0.5, // Defaults to 0.1
    },
);`}
            </SyntaxHighlighter>
            <Heading3 id="theme-setMode">theme.setMode</Heading3>
            <Text>
                Updates the <Code>Theme</Code> to a new interpolation mode. This
                will set a target palette for the theme to transition to with
                the same settings as the current palette other than the new
                interpolation mode.
            </Text>
            <Text>
                The transition will be completed gradually over time, with the
                duration of the transition determined by the set{' '}
                <Code>transitionSpeed</Code>. Same rules for the{' '}
                <Code>transitionSpeed</Code> apply as before.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`theme.setMode('lab');
theme.setMode('lab', {
    transitionSpeed: 0.5, // Defaults to 0.1
});`}
            </SyntaxHighlighter>
            <Heading3 id="theme-rotateMode">theme.rotateMode</Heading3>
            <Text>
                Rotates the <Code>Theme</Code> interpolation mode. This will set
                a target palette for the theme to transition to with the same
                settings as the current palette other than the new interpolation
                mode.
            </Text>
            <Text>
                The transition will be completed gradually over time, with the
                duration of the transition determined by the set{' '}
                <Code>transitionSpeed</Code>. Same rules for the{' '}
                <Code>transitionSpeed</Code> apply as before.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`theme.rotateMode();
theme.rotateMode({
    transitionSpeed: 0.5, // Defaults to 0.1
});`}
            </SyntaxHighlighter>
            <Heading3 id="theme-setColors">theme.setColors</Heading3>
            <Text>
                Updates the <Code>Theme</Code> to a new set of colors. This will
                set a target palette for the theme to transition to with the
                same settings as the current palette other than the new colors.
            </Text>
            <Text>
                The transition will be completed gradually over time, with the
                duration of the transition determined by the set{' '}
                <Code>transitionSpeed</Code>. Same rules for the{' '}
                <Code>transitionSpeed</Code> apply as before.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`theme.setColors(['red', 'green', 'blue']);
theme.setColors(['red', 'green', 'blue'], {
    transitionSpeed: 0.5, // Defaults to 0.1
});`}
            </SyntaxHighlighter>
            <Heading3 id="theme-randomFrom">theme.randomFrom</Heading3>
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
                <Code>transitionSpeed</Code>. Same rules for the{' '}
                <Code>transitionSpeed</Code> apply as before.
            </Text>
            <Text>
                You can explicitly set a <Code>minBrightness</Code> for the new
                random colors. Expects a value between 0 and 255. Defaults to 0.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`theme.randomFrom('red');
theme.randomFrom('red', {
    minBrightness: 150, // Defaults to 0
    nColors: 5, // Defaults to the number of colors in the current palette
    transitionSpeed: 0.5, // Defaults to 0.1
});`}
            </SyntaxHighlighter>
            <Heading3 id="theme-randomTheme">theme.randomTheme</Heading3>
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
                <Code>transitionSpeed</Code>. Same rules for the{' '}
                <Code>transitionSpeed</Code> apply as before.
            </Text>
            <Text>
                You can explicitly set a <Code>minBrightness</Code> for the new
                random colors. Expects a value between 0 and 255. Defaults to 0.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`theme.randomTheme();
theme.randomTheme({
    minBrightness: 150, // Defaults to 0
    nColors: 5, // Defaults to the number of colors in the current palette
    transitionSpeed: 0.5, // Defaults to 0.1
});`}
            </SyntaxHighlighter>
            <Heading3 id="theme-pushNewColor">theme.pushNewColor</Heading3>
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
                <Code>transitionSpeed</Code>. Same rules for the{' '}
                <Code>transitionSpeed</Code> apply as before.
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
            <Text>
                Pushes a new random color to the <Code>Theme</Code> palette.
                This will set a target palette for the theme to transition to
                with the same settings as the current palette other than the new
                colors.
            </Text>
            <Text>
                The transition will be completed gradually over time, with the
                duration of the transition determined by the set{' '}
                <Code>transitionSpeed</Code>. Same rules for the{' '}
                <Code>transitionSpeed</Code> apply as before.
            </Text>
            <Text>
                If the number of colors in the palette is already at the{' '}
                <Code>maxNumberOfColors</Code>, this will not add a new color.
            </Text>
            <Text>
                You can explicitly set a <Code>minBrightness</Code> for the new
                random color. Expects a value between 0 and 255. Defaults to 0.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`theme.pushRandomColor();
theme.pushRandomColor({
    minBrightness: 150, // Defaults to 0
    transitionSpeed: 0.5, // Defaults to 0.1
});`}
            </SyntaxHighlighter>
            <Heading3 id="theme-popOldestColor">theme.popOldestColor</Heading3>
            <Text>
                Drops the oldest color from the <Code>Theme</Code> palette. This
                will set a target palette for the theme to transition to with
                the same settings as the current palette other than the new
                colors.
            </Text>
            <Text>
                The transition will be completed gradually over time, with the
                duration of the transition determined by the set{' '}
                <Code>transitionSpeed</Code>. Same rules for the{' '}
                <Code>transitionSpeed</Code> apply as before.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`theme.popOldestColor();
theme.popOldestColor({
    transitionSpeed: 0.5, // Defaults to 0.1
});`}
            </SyntaxHighlighter>
            <Heading3 id="theme-rotateColor">theme.rotateColor</Heading3>
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
                <Code>transitionSpeed</Code>. Same rules for the{' '}
                <Code>transitionSpeed</Code> apply as before.
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
            <Text>
                Drops the oldest color from the <Code>Theme</Code> palette and
                adds a random color. This will set a target palette for the
                theme to transition to with the same settings as the current
                palette other than the new colors.
            </Text>
            <Text>
                The transition will be completed gradually over time, with the
                duration of the transition determined by the set{' '}
                <Code>transitionSpeed</Code>. Same rules for the{' '}
                <Code>transitionSpeed</Code> apply as before.
            </Text>
            <Text>
                You can explicitly set a <Code>minBrightness</Code> for the new
                random color. Expects a value between 0 and 255. Defaults to 0.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`theme.rotateRandomColor();
theme.rotateRandomColor({
    minBrightness: 150, // Defaults to 0
    transitionSpeed: 0.5, // Defaults to 1
});`}
            </SyntaxHighlighter>
            <Heading3 id="theme-tick">theme.tick</Heading3>
            <Text>
                Arguably the most important method. This advances the color
                index by a given number of frames, and updates the current
                palette towards the target palette if one is set. This should
                probably be called once per frame in an animation context.
            </Text>
            <Text>
                The number of frames defaults to 1. If you want to advance the
                color index by more than one frame, you can pass the number of
                frames as an argument. This does not affect the transition speed
                between palettes.
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`theme.tick();
theme.tick(10);`}
            </SyntaxHighlighter>
        </>
    );
}
