import dynamic from 'next/dynamic';

export const SketchWrapper = dynamic(
    () => import('./BaseSketchWrapper').then((mod) => mod.BaseSketchWrapper),
    {
        ssr: false,
    },
);
