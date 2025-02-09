import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

export interface SidebarContextData {
    open: boolean;
    setOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextData>({
    open: false,
    setOpen: () => {},
});

export function useSidebar() {
    return useContext(SidebarContext);
}

export function SidebarProvider({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);

    const context = useMemo<SidebarContextData>(
        () => ({
            open,
            setOpen,
        }),
        [open],
    );

    return (
        <SidebarContext.Provider value={context}>
            {children}
        </SidebarContext.Provider>
    );
}
