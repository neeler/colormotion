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
                <li>OKLab</li>
                <li>OKLCH</li>
            </UnorderedList>
            <Text>
                <Code>colormotion</Code> uses the color spaces of{' '}
                <Code>chroma.js</Code> and follows its interpolation, except
                near colors without a hue: in LCH, HCL and OKLCH a mix toward
                black, and in HSI a mix toward white, fades the chroma or
                saturation so it actually arrives there.
            </Text>
        </>
    );
}
