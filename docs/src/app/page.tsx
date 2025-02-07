'use client';

import { SideMenu } from '~/app/SideMenu';
import { Heading } from '~/components/catalyst/Heading';
import { PageTitle } from '~/components/catalyst/PageTitle';
import { Strong, Text, TextLink } from '~/components/catalyst/Text';
import { UnorderedList } from '~/components/catalyst/UnorderedList';
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
                    <SketchWrapper
                        sketch={fibonacciSpiralSketch}
                        className="h-100 w-full"
                    />
                    <Heading level={2}>Quick Start</Heading>
                    <Text>
                        Here are a couple things colormotion can do for you:
                    </Text>
                    <UnorderedList>
                        <li>Generate a color palette that changes over time</li>
                        <li>
                            Get colors across the current spectrum that are
                            evenly spaced
                        </li>
                        <li>Smoothly transition between color palettes</li>
                        <li>
                            Smoothly transition between color interpolation
                            modes
                        </li>
                        <li>Adjust the global brightness for a given theme</li>
                    </UnorderedList>
                </div>
            </div>
        </div>
    );
}
