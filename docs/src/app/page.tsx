'use client';

import { SectionInstallation } from '~/app/SectionInstallation';
import { SectionQuickStart } from '~/app/SectionQuickStart';
import { SideMenu } from '~/app/SideMenu';
import { PageTitle } from '~/components/catalyst/PageTitle';
import { Strong, Text, TextLink } from '~/components/catalyst/Text';
import { fibonacciSpiralSketch } from '~/components/sketches/fibonacciSpiralSketch';
import { SketchWrapper } from '~/components/sketches/lib';

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
                        <TextLink href="https://gka.github.io/chroma.js/">
                            chroma.js
                        </TextLink>{' '}
                        library.
                    </Text>
                    <Text>
                        Compatible with Node.js and browser environments.
                    </Text>
                    <SketchWrapper
                        sketch={fibonacciSpiralSketch}
                        className="h-100 w-full"
                    />
                    <SectionInstallation />
                    <SectionQuickStart />
                </div>
            </div>
        </div>
    );
}
