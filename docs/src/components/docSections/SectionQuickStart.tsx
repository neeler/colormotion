import SyntaxHighlighter from 'react-syntax-highlighter';
import { hybrid } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { Heading2 } from '~/components/catalyst/Heading2';
import { Code, Text } from '~/components/catalyst/Text';
import { UnorderedList } from '~/components/catalyst/UnorderedList';

export function SectionQuickStart() {
    return (
        <>
            <Heading2 id="quick-start">Quick Start</Heading2>
            <Text>
                With <Code>colormotion</Code> you can:
            </Text>
            <UnorderedList>
                <li>Generate a color palette that changes over time</li>
                <li>
                    Get colors across the current spectrum that are evenly
                    spaced
                </li>
                <li>Smoothly transition between color palettes</li>
                <li>Smoothly transition between color interpolation modes</li>
                <li>Adjust the global brightness for a given theme</li>
            </UnorderedList>
            <Text>
                Import the <Code>Theme</Code> class from{' '}
                <Code>colormotion</Code> using CommonJS or ES modules:
            </Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`// CommonJS
const { Theme } = require('colormotion');

// ES modules
import { Theme } from 'colormotion';`}
            </SyntaxHighlighter>
            <Text>Make a theme:</Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const theme = new Theme();`}
            </SyntaxHighlighter>
            <Text>Get a color:</Text>
            <SyntaxHighlighter language="typescript" style={hybrid}>
                {`const color = theme.getColor();`}
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

// Suppose this function runs in a loop
function draw() {
    // Suppose we have an LED strip with 100 LEDs
    for (let i = 0; i < 100; i++) {
        const color = theme.getColor(i);
        // Set the color of the i-th LED to \`color\`
        // Suppose \`setPixel\` is a function
        // that sets the color of an LED
        setPixel(i, color.rgb());
    }

    // Advance the theme to the next frame
    theme.tick();
}`}
            </SyntaxHighlighter>
        </>
    );
}
