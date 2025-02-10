import { Theme, ThemeUpdateEvent } from 'colormotion';

export const theme = new Theme({
    maxNumberOfColors: 7,
});

/**
 * Logs theme update events to the console for visibility.
 * Could be helpful for folks reading the docs.
 */
const eventsToConsole = (event: ThemeUpdateEvent) => {
    console.log('Theme has updated:', event);
};

theme.subscribe(eventsToConsole);
