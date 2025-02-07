'use client';

import { SideMenu } from '~/app/SideMenu';
import { Strong, Text, TextLink } from '~/components/catalyst/text';
import { PageTitle } from '~/components/layout/PageTitle';
import { fibonacciSpiralSketch } from '~/components/sketches/fibonacciSpiralSketch';
import { SketchWrapper } from '~/components/sketches/lib';

export default function Home() {
    return (
        <div className="grid grid-cols-7 sm:grid-cols-10">
            <SideMenu className="hidden sm:block col-span-3"></SideMenu>
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
                    <SketchWrapper
                        sketch={fibonacciSpiralSketch}
                        className="border-neutral-50 border-1 h-100"
                    />
                </div>
            </div>
        </div>
    );
}
