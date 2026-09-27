import { Color } from 'chroma-js';
import { describe, expect, test } from 'vitest';
import { ColorPalette, Theme } from '../src';

/*
 * The colors a seeded random draws from every random entry point, pinned as 4.0.0 draws them: every channel
 * at full precision, not only the hex. They are part of the 4.0 contract, so a change that alters them
 * changes seeded palettes (see ColorPalette.rotate.test.ts).
 */

const N_STEPS = 16;
const GOLD = ['#e8b450', '#f4dca8', '#7a1a2b', '#b8862f', '#2b1a12'];

/**
 * Small seeded PRNG (mulberry32) for reproducible palettes in tests.
 */
function seededRandom(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function makePalette(seed: number, deltaEThreshold?: number) {
    return new ColorPalette({
        colors: GOLD,
        mode: 'oklch',
        nSteps: N_STEPS,
        deltaEThreshold,
        random: seededRandom(seed),
    });
}

function makeTheme(seed: number) {
    return new Theme({
        colors: GOLD,
        mode: 'oklch',
        nSteps: N_STEPS,
        random: seededRandom(seed),
    });
}

/** A palette's colors, without the closing repeat of the first. */
const colorsOf = (palette: Readonly<ColorPalette>) =>
    palette.colors.slice(0, palette.nColors);

/** Each entry point, with the colors it gives. */
const CASES: Record<string, () => Color[]> = {
    'ColorPalette.random': () =>
        colorsOf(
            ColorPalette.random({
                mode: 'oklch',
                nSteps: N_STEPS,
                random: seededRandom(1),
            }),
        ),
    'ColorPalette.random with nColors and minBrightness': () =>
        colorsOf(
            ColorPalette.random({
                nColors: 8,
                minBrightness: 0.537,
                mode: 'oklch',
                nSteps: N_STEPS,
                random: seededRandom(2),
            }),
        ),
    'ColorPalette.random with an unmet deltaEThreshold': () =>
        colorsOf(
            ColorPalette.random({
                nColors: 4,
                deltaEThreshold: 90,
                mode: 'rgb',
                nSteps: N_STEPS,
                random: seededRandom(3),
            }),
        ),
    randomize: () => colorsOf(makePalette(4).randomize()),
    'randomize with nColors and minBrightness': () =>
        colorsOf(makePalette(5).randomize({ nColors: 3, minBrightness: 0.5 })),
    randomizeFrom: () =>
        colorsOf(makePalette(6).randomizeFrom('#17a398', { nColors: 6 })),
    'randomizeFrom lifting the seed to minBrightness': () =>
        colorsOf(
            makePalette(7).randomizeFrom('#2b1a12', { minBrightness: 0.6 }),
        ),
    pushRandom: () => {
        const palette = new ColorPalette({
            colors: GOLD.slice(0, 2),
            mode: 'oklch',
            nSteps: N_STEPS,
            random: seededRandom(8),
        });
        return colorsOf(
            palette
                .pushRandom()
                .pushRandom({ minBrightness: 0.4 })
                .pushRandom(),
        );
    },
    rotateRandomOn: () => {
        let palette = makePalette(9);
        for (let i = 0; i < 7; i++) {
            palette = palette.rotateRandomOn(
                i % 2 ? { minBrightness: 0.537 } : undefined,
            );
        }
        return colorsOf(palette);
    },
    'rotateRandomOn with an unmet deltaEThreshold': () => {
        let palette = makePalette(10, 70);
        for (let i = 0; i < 3; i++) {
            palette = palette.rotateRandomOn();
        }
        return colorsOf(palette);
    },
    'new Theme': () =>
        colorsOf(
            new Theme({ nSteps: N_STEPS, random: seededRandom(11) })
                .activePalette,
        ),
    'new Theme with nColors and minBrightness': () =>
        colorsOf(
            new Theme({
                nColors: 4,
                minBrightness: 0.3,
                mode: 'oklch',
                nSteps: N_STEPS,
                random: seededRandom(12),
            }).activePalette,
        ),
    'Theme.random': () =>
        colorsOf(
            Theme.random({
                nColors: 3,
                nSteps: N_STEPS,
                random: seededRandom(13),
            }).activePalette,
        ),
    'Theme#randomFrom': () => {
        const theme = makeTheme(14);
        theme.randomFrom('#6b2fa0', { nColors: 6, minBrightness: 0.5 });
        return colorsOf(theme.activePalette);
    },
    'Theme#randomTheme': () => {
        const theme = makeTheme(15);
        theme.randomTheme({ minBrightness: 0.5, transitionDuration: 0 });
        return colorsOf(theme.activePalette);
    },
    'Theme#pushRandomColor': () => {
        const theme = new Theme({
            colors: GOLD.slice(0, 3),
            mode: 'oklch',
            nSteps: N_STEPS,
            random: seededRandom(16),
        });
        theme.pushRandomColor({ minBrightness: 0.2 });
        theme.pushRandomColor();
        return colorsOf(theme.activePalette);
    },
    'Theme#rotateRandomColor': () => {
        const theme = makeTheme(17);
        theme.rotateRandomColor();
        theme.rotateRandomColor({ minBrightness: 0.537 });
        theme.rotateRandomColor({ transitionDuration: 0 });
        return colorsOf(theme.activePalette);
    },
};

const EXPECTED: Record<string, { hexes: string[]; rgb: number[][] }> = {
    'ColorPalette.random': {
        hexes: ['#a04d4c', '#fab4c1', '#6f5a9c', '#82fedc', '#1b231e'],
        rgb: [
            [159.90385484998114, 76.94743765355285, 75.56303993117274],
            [250.1679967052769, 179.84489650318474, 193.18748189800812],
            [111.32275642643962, 89.73295511555251, 156.27390945330262],
            [129.6841035411952, 253.6798511480447, 220.4027109896178],
            [26.658771380767742, 35.42806376586668, 30.363521974822433],
        ],
    },
    'ColorPalette.random with nColors and minBrightness': {
        hexes: [
            '#a3e0a0',
            '#c84aa9',
            '#2bc441',
            '#8e7896',
            '#fc4c15',
            '#908a75',
            '#8a4b62',
            '#d4a3a6',
        ],
        rgb: [
            [163.0157535027663, 223.62433774357314, 159.82519632621754],
            [200.44867566537113, 73.99896770134266, 168.61778378082028],
            [42.78088733252039, 195.87323379467824, 64.744730042176],
            [141.76534259489588, 120.08610636419336, 150.39815545869527],
            [251.6485417514853, 75.51039810448535, 21.340353387370502],
            [144.27664638576215, 137.85627563243867, 116.58510719226071],
            [137.7739183861809, 75.48986005125253, 97.87381743381454],
            [211.86520992211996, 162.54312468198145, 165.97286411838675],
        ],
    },
    'ColorPalette.random with an unmet deltaEThreshold': {
        hexes: ['#b87764', '#2be00e', '#9024a6', '#54dc20'],
        rgb: [
            [183.6578298616223, 119.3100147221474, 99.87456176493708],
            [42.97801583980262, 223.7253634503577, 14.134563891263609],
            [144.49635948371005, 35.50453214403746, 165.89228690369055],
            [84.30354669485585, 219.81541363173164, 32.360290687318134],
        ],
    },
    randomize: {
        hexes: ['#b7ecb7', '#11150a', '#976fb0', '#61be92', '#bc0450'],
        rgb: [
            [183.40844932518385, 235.52723026368767, 183.31840352297084],
            [16.58236549920017, 20.86946007795632, 10.25740527901543],
            [150.72378418241968, 111.12946929832874, 176.15793973091058],
            [96.58683876334864, 189.55326980212703, 145.90330842761233],
            [187.6579370268155, 3.8394214945369853, 80.2454955826399],
        ],
    },
    'randomize with nColors and minBrightness': {
        hexes: ['#c6a8d7', '#cf9354', '#15dba9'],
        rgb: [
            [198.23370928498107, 168.09917345067325, 215.44630114221945],
            [206.9552998332074, 147.0058656347303, 84.40362708324867],
            [20.698435350520928, 219.3130363250384, 169.38634566644316],
        ],
    },
    randomizeFrom: {
        hexes: [
            '#17a398',
            '#862e2d',
            '#303334',
            '#687cc8',
            '#546801',
            '#65f10d',
        ],
        rgb: [
            [23, 163, 152],
            [134.0653858508449, 46.407218263432206, 45.15705334170501],
            [47.90350596843634, 50.62957948484304, 51.551488739205524],
            [103.78007574382838, 124.20886503699222, 199.97969698975794],
            [83.69233305208019, 103.6965476651676, 1.2568219162692502],
            [101.01142900101082, 241.00821397500113, 13.284670363525972],
        ],
    },
    'randomizeFrom lifting the seed to minBrightness': {
        hexes: ['#995d40', '#85d5e0', '#98c95a', '#b9e2e7', '#71bf59'],
        rgb: [
            [153, 92.51162790697674, 64.04651162790697],
            [133.34203703561224, 212.59710093212823, 224.3009279826656],
            [151.77758977856982, 200.55572851700708, 89.5831089099213],
            [185.4108477875894, 225.9103672490798, 230.93716842960566],
            [113.1518437679352, 190.53177652833983, 88.64690475051412],
        ],
    },
    pushRandom: {
        hexes: ['#e8b450', '#f4dca8', '#1c1f28', '#73a1d0', '#a3d167'],
        rgb: [
            [232, 180, 80],
            [244, 220, 168],
            [27.872200720847115, 30.854144353903067, 39.855268310057],
            [114.78984995640508, 160.69340024442982, 208.4810059403535],
            [162.9956748450376, 208.78368598991074, 103.01018229705414],
        ],
    },
    rotateRandomOn: {
        hexes: ['#ced9ce', '#c5df6a', '#5443a1', '#aa798c', '#89125b'],
        rgb: [
            [206.46659967167938, 216.89830262403936, 206.4808139479207],
            [196.73427094199707, 223.45953024923801, 105.84021585307816],
            [84.35442197310752, 66.54366133653522, 161.23408266110346],
            [170.3981371457898, 121.49004079114441, 139.7376345268642],
            [136.5642904106062, 18.35985928237225, 91.09932796612122],
        ],
    },
    'rotateRandomOn with an unmet deltaEThreshold': {
        hexes: ['#b180fd', '#e7dd02', '#5616cd', '#b8862f', '#2b1a12'],
        rgb: [
            [177.06276231649449, 128.4761065814196, 252.81645227456465],
            [231.47808358306065, 220.52124917155425, 1.5563638270730795],
            [86.44310913852777, 22.30201125726383, 205.49922155798413],
            [184, 134, 47],
            [43, 26, 18],
        ],
    },
    'new Theme': {
        hexes: ['#337482', '#96468e', '#081214', '#127367', '#24226b'],
        rgb: [
            [51.122774136019984, 116.20046044371836, 130.45469740522094],
            [150.49019717378542, 69.52311554897317, 142.01616810631296],
            [8.004790540461276, 18.136716871405564, 20.40667115477845],
            [17.968966742821763, 114.83284712070599, 103.2338642832063],
            [35.656977470796384, 34.10631903985562, 107.09381646593101],
        ],
    },
    'new Theme with nColors and minBrightness': {
        hexes: ['#805736', '#f5f4f1', '#596bc9', '#d0320f'],
        rgb: [
            [127.93493806826883, 87.40962605541307, 53.71206795686359],
            [244.53283860033844, 244.2537877731252, 241.18572003959454],
            [89.36611584379865, 107.0983269038812, 200.73667705769185],
            [207.95973002712708, 50.207858060706315, 14.958227415167014],
        ],
    },
    'Theme.random': {
        hexes: ['#869088', '#0c0c0c', '#3541de'],
        rgb: [
            [134.21809098091546, 144.41227558767423, 135.8563267227155],
            [12.282547254581004, 12.217704359180729, 12.199348649592322],
            [53.425998754604315, 64.65299641002598, 222.00252972193994],
        ],
    },
    'Theme#randomFrom': {
        hexes: [
            '#6b2fa0',
            '#5ab98f',
            '#d51b0e',
            '#e0efe3',
            '#e0bebc',
            '#0caa63',
        ],
        rgb: [
            [107, 47, 160],
            [90.33195414747456, 184.61466328706592, 142.64546593290297],
            [213.20625071588438, 26.62653474319792, 13.817763502578748],
            [224.20624931424115, 239.16742949921172, 226.70854562303435],
            [224.31916002184153, 190.16721140864888, 187.82611990815656],
            [11.61138697155924, 170.44482828641776, 99.39059341524927],
        ],
    },
    'Theme#randomTheme': {
        hexes: ['#5e9e79', '#eaf7e7', '#79b083', '#6e6482', '#a26308'],
        rgb: [
            [94.25362125307225, 157.82460327493027, 121.25528809914543],
            [233.77455516182496, 247.28280042065307, 231.07010368615335],
            [121.14578674552384, 175.93926128698513, 130.80483819212733],
            [110.14913345280077, 99.94798276858339, 130.23982136975974],
            [162.35024230903946, 99.22857768117026, 8.09754428975768],
        ],
    },
    'Theme#pushRandomColor': {
        hexes: ['#e8b450', '#f4dca8', '#7a1a2b', '#b4a22d', '#616361'],
        rgb: [
            [232, 180, 80],
            [244, 220, 168],
            [122, 26, 43],
            [179.8046222794801, 161.66864259518425, 44.53080813738361],
            [97.06057268769565, 99.00971166207455, 97.13485095690861],
        ],
    },
    'Theme#rotateRandomColor': {
        hexes: ['#354348', '#cb97da', '#353c16', '#b8862f', '#2b1a12'],
        rgb: [
            [53.4694234898101, 66.79284012996001, 71.94095697021112],
            [202.98754375351714, 151.25424458966384, 217.61809675145312],
            [52.913128589746364, 60.171891659265384, 22.226951779363464],
            [184, 134, 47],
            [43, 26, 18],
        ],
    },
};

describe('every random entry point draws the colors it drew in 4.0', () => {
    for (const [name, draw] of Object.entries(CASES)) {
        test(name, () => {
            const colors = draw();
            expect(EXPECTED[name]).toBeDefined();
            expect(colors.map((color) => color.hex())).toEqual(
                EXPECTED[name]!.hexes,
            );
            expect(colors.map((color) => color.rgb(false))).toEqual(
                EXPECTED[name]!.rgb,
            );
        });
    }
});
