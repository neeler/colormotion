import { SideMenu } from '~/app/SideMenu';
import { PageTitle } from '~/components/layout/PageTitle';

export default function Home() {
    return (
        <div className="grid grid-cols-10">
            <SideMenu className="col-span-3"></SideMenu>
            <div className="col-span-7">
                <PageTitle>colormotion</PageTitle>
            </div>
        </div>
    );
}
