import {
    BrightnessModes,
    DEFAULT_DELTA_E_THRESHOLD,
    InterpolationMode,
} from '@colormotion';
import {
    FRAME_RATE,
    PlaygroundSettings,
    TransitionKinds,
    WHEEL_DRIFT,
} from '~/components/playground/settings';
import { formatNumber } from '~/components/playground/share';
import { MAX_NUMBER_OF_COLORS, ThemeOptions } from '~/components/theme/theme';
import { SEEDED_RANDOM_CODE } from '~/lib/seededRandom';

/**
 * Lines are kept to this length (prettier's printWidth, in effect), so the
 * code fits the content column on a desktop without scrolling sideways.
 */
const MAX_LINE_LENGTH = 64;

/**
 * A string as a single-quoted literal.
 */
function quote(text: string) {
    return `'${text.replace(/[\\']/g, '\\$&')}'`;
}

/**
 * A call with an options object: on one line if it fits, and one option per
 * line otherwise, as prettier would.
 */
function callWithOptions(call: string, options: string[]) {
    const oneLine = `${call}({ ${options.join(', ')} });`;
    if (oneLine.length <= MAX_LINE_LENGTH) {
        return [oneLine];
    }
    return [`${call}({`, ...options.map((option) => `    ${option},`), '});'];
}

/**
 * Code that sets up and runs a theme like the playground's, ready to paste
 * (given an nPixels and a setPixel for the LEDs).
 */
export function themeCode({
    hexes,
    mode,
    brightness,
    options,
    settings,
}: {
    hexes: string[];
    mode: InterpolationMode;
    brightness: number;
    options: ThemeOptions;
    settings: PlaygroundSettings;
}) {
    const colors = hexes.map((hex) => `'${hex}'`);
    const colorsLine = `    colors: [${colors.join(', ')}],`;

    const lines = [
        "import { Theme } from 'colormotion';",
        '',
        'const theme = new Theme({',
        ...(colorsLine.length <= MAX_LINE_LENGTH
            ? [colorsLine]
            : [
                  '    colors: [',
                  ...colors.map((color) => `        ${color},`),
                  '    ],',
              ]),
        `    mode: '${mode}',`,
        `    maxNumberOfColors: ${MAX_NUMBER_OF_COLORS},`,
    ];
    if (options.deltaEThreshold !== DEFAULT_DELTA_E_THRESHOLD) {
        lines.push(
            `    deltaEThreshold: ${formatNumber(options.deltaEThreshold)},`,
        );
    }
    if (options.brightnessMode !== BrightnessModes.darken) {
        lines.push(`    brightnessMode: '${options.brightnessMode}',`);
    }
    if (options.seed) {
        lines.push(`    random: seededRandom(${quote(options.seed)}),`);
    }
    lines.push('});');
    if (brightness !== 1) {
        lines.push(`theme.brightness = ${formatNumber(brightness)};`);
    }

    lines.push(
        '',
        `// ${FRAME_RATE} times a second (nPixels and setPixel are your LEDs')`,
        'function draw() {',
        '    for (let i = 0; i < nPixels; i++) {',
        `        setPixel(i, theme.getColor(i * ${settings.pixelSpacing}).rgb());`,
        '    }',
    );
    if (settings.paused) {
        lines.push(
            '    // Holds the wheel; transitions still advance',
            '    theme.tick(0);',
        );
    } else {
        if (settings.wheelDrift) {
            lines.push(
                `    // The playground lets this drift between ${formatNumber(
                    settings.wheelSpeed * WHEEL_DRIFT.min,
                )} and ${formatNumber(settings.wheelSpeed * WHEEL_DRIFT.max)}`,
            );
        }
        lines.push(`    theme.tick(${formatNumber(settings.wheelSpeed)});`);
    }
    lines.push('}', '', '// Change the palette, for example:');

    const transition =
        settings.transitionKind === TransitionKinds.speed
            ? `transitionSpeed: ${formatNumber(settings.transitionSpeed)}`
            : settings.transitionSeconds > 0
              ? `transitionDuration: ${formatNumber(settings.transitionSeconds)} * ${FRAME_RATE}`
              : 'transitionDuration: 0';
    lines.push(
        ...callWithOptions('theme.randomTheme', [
            `nColors: ${settings.nColors}`,
            `minBrightness: ${formatNumber(settings.minBrightness)}`,
            transition,
        ]),
    );

    if (options.seed) {
        lines.push('', SEEDED_RANDOM_CODE);
    }

    return lines.join('\n');
}
