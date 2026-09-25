import { TYPE_SECTIONS, typeAnchor } from '~/components/api/api';
import { L1MenuItem } from '~/components/sideMenu/L1MenuItem';
import { L2MenuItem } from '~/components/sideMenu/L2MenuItem';

/** The Theme section's headings, in page order: [anchor id, title]. */
const THEME_SECTIONS: [string, string][] = [
    ['theme-random', 'Theme.random'],
    ['theme-nSteps', 'theme.nSteps'],
    ['theme-maxNumberOfColors', 'theme.maxNumberOfColors'],
    ['theme-activePalette', 'theme.activePalette'],
    ['theme-activePaletteHexes', 'theme.activePaletteHexes'],
    ['theme-palette', 'theme.palette'],
    ['theme-targetPalette', 'theme.targetPalette'],
    ['theme-mode', 'theme.mode'],
    ['theme-brightness', 'theme.brightness'],
    ['theme-brightnessMode', 'theme.brightnessMode'],
    ['theme-getColor', 'theme.getColor'],
    ['theme-normalizeIndex', 'theme.normalizeIndex'],
    ['theme-update', 'theme.update'],
    ['theme-setMode', 'theme.setMode'],
    ['theme-rotateMode', 'theme.rotateMode'],
    ['theme-setColors', 'theme.setColors'],
    ['theme-randomFrom', 'theme.randomFrom'],
    ['theme-randomTheme', 'theme.randomTheme'],
    ['theme-pushNewColor', 'theme.pushNewColor'],
    ['theme-pushRandomColor', 'theme.pushRandomColor'],
    ['theme-popOldestColor', 'theme.popOldestColor'],
    ['theme-rotateColor', 'theme.rotateColor'],
    ['theme-rotateRandomColor', 'theme.rotateRandomColor'],
    ['theme-tick', 'theme.tick'],
    ['theme-isTransitioning', 'theme.isTransitioning'],
    ['theme-transitionDistance', 'theme.transitionDistance'],
    ['theme-finishTransition', 'theme.finishTransition'],
    ['theme-subscribe', 'theme.subscribe'],
    ['theme-unsubscribe', 'theme.unsubscribe'],
];

export function SideMenu({
    colorSpace = 20,
    className,
}: {
    colorSpace?: number;
    className?: string;
}) {
    return (
        <div className={className}>
            <ul className="space-y-5">
                <L1MenuItem
                    colorOffset={0}
                    href="#installation"
                    title="Installation"
                />
                <L1MenuItem
                    colorOffset={colorSpace}
                    href="#quick-start"
                    title="Quick Start"
                />
                <L1MenuItem
                    colorOffset={2 * colorSpace}
                    href="#interpolation"
                    title="Interpolation"
                />
                <L1MenuItem
                    colorOffset={3 * colorSpace}
                    href="#theme"
                    title="Theme"
                >
                    {THEME_SECTIONS.map(([id, title], i) => (
                        <L2MenuItem
                            key={id}
                            colorOffset={(4 + i) * colorSpace}
                            href={`#${id}`}
                            title={title}
                        />
                    ))}
                </L1MenuItem>
                <L1MenuItem
                    colorOffset={(4 + THEME_SECTIONS.length) * colorSpace}
                    href="#types"
                    title="Types"
                >
                    {TYPE_SECTIONS.map((name, i) => (
                        <L2MenuItem
                            key={name}
                            colorOffset={
                                (5 + THEME_SECTIONS.length + i) * colorSpace
                            }
                            href={`#${typeAnchor(name)}`}
                            title={name}
                        />
                    ))}
                </L1MenuItem>
            </ul>
        </div>
    );
}
