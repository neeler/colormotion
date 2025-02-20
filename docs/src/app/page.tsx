'use client';

import { Heading1 } from '~/components/catalyst/Heading1';
import { Strong, Text, TextLink } from '~/components/catalyst/Text';
import { SectionInstallation } from '~/components/docSections/SectionInstallation';
import { SectionInterpolation } from '~/components/docSections/SectionInterpolation';
import { SectionQuickStart } from '~/components/docSections/SectionQuickStart';
import { SectionTheme } from '~/components/docSections/SectionTheme';
import { MobileSidebar } from '~/components/sideMenu/MobileSidebar';
import { OpenSidebarButton } from '~/components/sideMenu/OpenSidebarButton';
import { SideMenu } from '~/components/sideMenu/SideMenu';
import { SidebarProvider } from '~/components/sideMenu/SidebarContext';
import { ThemedSketch } from '~/components/sketches/ThemedSketch';
import { fibonacciSpiralSketch } from '~/components/sketches/fibonacciSpiralSketch';

export default function Home() {
    return (
        <SidebarProvider>
            <div className="grid grid-cols-7 sm:grid-cols-10">
                {/* Sidebar on mobile */}
                <MobileSidebar>
                    <SideMenu className="p-6" />
                </MobileSidebar>

                {/* Sidebar on desktop */}
                <SideMenu className="col-span-3 hidden pt-28 pr-7.5 pl-10 sm:block" />

                {/* Navbar on mobile */}
                <header className="fixed top-0 left-0 flex w-screen items-center justify-end px-4 sm:hidden">
                    <div className="py-2.5">
                        <OpenSidebarButton />
                    </div>
                </header>

                {/* Content */}
                <div className="col-span-7">
                    <Heading1>colormotion</Heading1>
                    <div className="space-y-4">
                        <Text>
                            <Strong>colormotion</Strong> is a JavaScript library
                            of utilities for creating dynamic color palettes.
                            Its primary use case is for generating color
                            palettes that change over time, such as for
                            animations or visualizations in LED art. It is built
                            on top of the fantastic{' '}
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
                        <div className="flex items-center space-x-4">
                            <a
                                href="https://github.com/neeler/colormotion"
                                target="_blank"
                                rel="nofollow noreferrer"
                                className="block sm:hidden"
                            >
                                <img
                                    alt="GitHub repo"
                                    src="https://img.shields.io/badge/github-%23121011.svg?style=for-the-badge&logo=github&logoColor=white"
                                />
                            </a>
                            <img
                                className="h-full"
                                alt="tests workflow status"
                                src="https://github.com/neeler/colormotion/actions/workflows/tests.yml/badge.svg"
                            />
                            <img
                                className="h-full"
                                alt="npm package minimized gzipped size"
                                src="https://img.shields.io/bundlejs/size/colormotion"
                            />
                        </div>
                        <ThemedSketch sketch={fibonacciSpiralSketch} />
                        <SectionInstallation />
                        <SectionQuickStart />
                        <SectionInterpolation />
                        <SectionTheme />
                    </div>
                </div>
            </div>
        </SidebarProvider>
    );
}
