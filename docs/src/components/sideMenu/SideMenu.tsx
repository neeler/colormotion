import { L1MenuItem } from '~/components/sideMenu/L1MenuItem';
import { L2MenuItem } from '~/components/sideMenu/L2MenuItem';

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
                    <L2MenuItem
                        colorOffset={4 * colorSpace}
                        href="#theme-activePalette"
                        title="theme.activePalette"
                    />
                    <L2MenuItem
                        colorOffset={5 * colorSpace}
                        href="#theme-activePaletteHexes"
                        title="theme.activePaletteHexes"
                    />
                    <L2MenuItem
                        colorOffset={6 * colorSpace}
                        href="#theme-brightness"
                        title="theme.brightness"
                    />
                    <L2MenuItem
                        colorOffset={7 * colorSpace}
                        href="#theme-getColor"
                        title="theme.getColor"
                    />
                    <L2MenuItem
                        colorOffset={8 * colorSpace}
                        href="#theme-update"
                        title="theme.update"
                    />
                    <L2MenuItem
                        colorOffset={9 * colorSpace}
                        href="#theme-setMode"
                        title="theme.setMode"
                    />
                    <L2MenuItem
                        colorOffset={10 * colorSpace}
                        href="#theme-rotateMode"
                        title="theme.rotateMode"
                    />
                    <L2MenuItem
                        colorOffset={11 * colorSpace}
                        href="#theme-setColors"
                        title="theme.setColors"
                    />
                    <L2MenuItem
                        colorOffset={12 * colorSpace}
                        href="#theme-randomFrom"
                        title="theme.randomFrom"
                    />
                    <L2MenuItem
                        colorOffset={13 * colorSpace}
                        href="#theme-randomTheme"
                        title="theme.randomTheme"
                    />
                    <L2MenuItem
                        colorOffset={14 * colorSpace}
                        href="#theme-pushNewColor"
                        title="theme.pushNewColor"
                    />
                    <L2MenuItem
                        colorOffset={15 * colorSpace}
                        href="#theme-pushRandomColor"
                        title="theme.pushRandomColor"
                    />
                    <L2MenuItem
                        colorOffset={16 * colorSpace}
                        href="#theme-popOldestColor"
                        title="theme.popOldestColor"
                    />
                    <L2MenuItem
                        colorOffset={17 * colorSpace}
                        href="#theme-rotateColor"
                        title="theme.rotateColor"
                    />
                    <L2MenuItem
                        colorOffset={18 * colorSpace}
                        href="#theme-rotateRandomColor"
                        title="theme.rotateRandomColor"
                    />
                    <L2MenuItem
                        colorOffset={19 * colorSpace}
                        href="#theme-tick"
                        title="theme.tick"
                    />
                    <L2MenuItem
                        colorOffset={20 * colorSpace}
                        href="#theme-subscribe"
                        title="theme.subscribe"
                    />
                    <L2MenuItem
                        colorOffset={21 * colorSpace}
                        href="#theme-unsubscribe"
                        title="theme.unsubscribe"
                    />
                </L1MenuItem>
            </ul>
        </div>
    );
}
