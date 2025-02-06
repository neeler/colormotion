'use client';

import { SideMenu } from '~/app/SideMenu';
import { PageTitle } from '~/components/layout/PageTitle';
import { SketchWrapper } from '~/components/sketches/SketchWrapper';
import { testSketch } from '~/components/sketches/testSketch';

export default function Home() {
    return (
        <div className="grid grid-cols-10">
            <SideMenu className="col-span-3"></SideMenu>
            <div className="col-span-7">
                <PageTitle>colormotion</PageTitle>
                <div className="space-y-5">
                    <SketchWrapper sketch={testSketch} />
                </div>
            </div>
        </div>
    );
}
