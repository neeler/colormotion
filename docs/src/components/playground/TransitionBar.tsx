import clsx from 'clsx';
import { useTransitionProgress } from '~/hooks/useTransitionProgress';

/**
 * A thin progress bar that shows while the theme is transitioning.
 */
export function TransitionBar({ className }: { className?: string }) {
    const { isTransitioning, progress } = useTransitionProgress();
    return (
        <div
            aria-hidden="true"
            className={clsx(
                className,
                'pointer-events-none h-1 bg-white/10 transition-opacity duration-700',
                isTransitioning ? 'opacity-100' : 'opacity-0',
            )}
        >
            <div
                className="h-full bg-white/80"
                style={{ width: `${(isTransitioning ? progress : 1) * 100}%` }}
            />
        </div>
    );
}
