import * as Headless from '@headlessui/react';
import { PropsWithChildren } from 'react';
import { NavbarItem } from '~/components/catalyst/Navbar';
import { CloseMenuIcon } from '~/components/icons/CloseMenuIcon';

export function MobileSidebar({
    open,
    close,
    children,
}: PropsWithChildren<{ open: boolean; close: () => void }>) {
    return (
        <Headless.Dialog open={open} onClose={close} className="sm:hidden">
            <Headless.DialogBackdrop
                transition
                className="fixed inset-0 bg-black/30 transition data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
            />
            <Headless.DialogPanel
                transition
                className="fixed inset-y-0 w-full max-w-80 p-2 transition duration-300 ease-in-out data-closed:-translate-x-full"
            >
                <div className="flex h-full flex-col rounded-lg bg-zinc-900 ring-1 shadow-xs ring-white/10">
                    <div className="-mb-3 px-4 pt-3">
                        <Headless.CloseButton
                            as={NavbarItem}
                            aria-label="Close navigation"
                        >
                            <CloseMenuIcon />
                        </Headless.CloseButton>
                    </div>
                    {children}
                </div>
            </Headless.DialogPanel>
        </Headless.Dialog>
    );
}
