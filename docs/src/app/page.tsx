'use client';

import { PageTitle } from '~/components/catalyst/PageTitle';
import { Strong, Text, TextLink } from '~/components/catalyst/Text';
import { SectionInstallation } from '~/components/docSections/SectionInstallation';
import { SectionInterpolation } from '~/components/docSections/SectionInterpolation';
import { SectionQuickStart } from '~/components/docSections/SectionQuickStart';
import { SideMenu } from '~/components/sideMenu/SideMenu';
import { ThemedSketch } from '~/components/sketches/ThemedSketch';
import { fibonacciSpiralSketch } from '~/components/sketches/fibonacciSpiralSketch';

export default function Home() {
    return (
        <div className="grid grid-cols-7 sm:grid-cols-10">
            <SideMenu className="col-span-3 hidden sm:block"></SideMenu>
            <div className="col-span-7">
                <PageTitle>colormotion</PageTitle>
                <div className="space-y-4">
                    <Text>
                        <Strong>colormotion</Strong> is a JavaScript library of
                        utilities for creating dynamic color palettes. Its
                        primary use case is for generating color palettes that
                        change over time, such as for animations or
                        visualizations in LED art. It is built on top of the
                        fantastic{' '}
                        <TextLink
                            href="https://gka.github.io/chroma.js/"
                            target="_blank"
                            rel="nofollow noreferrer"
                        >
                            chroma.js
                        </TextLink>{' '}
                        library.
                    </Text>
                    <Text>
                        Compatible with Node.js and browser environments.
                    </Text>
                    <ThemedSketch sketch={fibonacciSpiralSketch} />
                    <SectionInstallation />
                    <SectionQuickStart />
                    <SectionInterpolation />
                </div>
            </div>
        </div>
    );
}
