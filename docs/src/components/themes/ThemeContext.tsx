import { Theme } from 'colormotion';
import {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';

interface ThemeContextData {
    theme: Theme;
}

const ThemeContext = createContext<ThemeContextData>({
    theme: new Theme(),
});

export function useTheme() {
    return useContext(ThemeContext);
}

export function ThemeProvider({
    userId,
    children,
}: {
    userId: string;
    children: ReactNode;
}) {
    const [theme] = useState(new Theme());

    useEffect(() => {
        theme.randomTheme({
            co,
        });
    });

    const context = useMemo<ThemeContextData>(
        () => ({
            theme,
        }),
        [theme],
    );

    return (
        <ThemeContext.Provider value={context}>
            {children}
        </ThemeContext.Provider>
    );
}
