import { Heading2 } from '~/components/catalyst/Heading2';
import { Code, Text } from '~/components/catalyst/Text';
import { UnorderedList } from '~/components/catalyst/UnorderedList';

export function SectionInterpolation() {
    return (
        <>
            <Heading2 id="interpolation">Interpolation</Heading2>
            <Text>
                Interpolation is the process of generating a sequence of values
                between two points. When generating colors between the base
                colors of a palette, <Code>colormotion</Code> uses the selected
                interpolation mode to determine how to generate the intermediate
                colors. The interpolation mode selects the color space in which
                the interpolation occurs.
            </Text>
            <Text>The supported color modes for interpolation are:</Text>
            <UnorderedList>
                <li>RGB</li>
                <li>LAB</li>
                <li>LRGB</li>
                <li>HSL</li>
                <li>LCH</li>
                <li>HSV</li>
                <li>HSI</li>
                <li>HCL</li>
            </UnorderedList>
            <Text>
                <Code>colormotion</Code> leverages the scales feature of{' '}
                <Code>chroma.js</Code> under the hood for interpolation.
            </Text>
        </>
    );
}
