import { NavbarItem } from '~/components/catalyst/Navbar';
import { OpenMenuIcon } from '~/components/icons/OpenMenuIcon';
import { useSidebar } from '~/components/sideMenu/SidebarContext';

export function OpenSidebarButton() {
    const { setOpen } = useSidebar();
    return (
        <NavbarItem onClick={() => setOpen(true)} aria-label="Open navigation">
            <OpenMenuIcon />
        </NavbarItem>
    );
}
