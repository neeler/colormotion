import clsx from 'clsx';
import { ReactNode, useId } from 'react';

/**
 * A labelled control: the label and its current value on one line, the
 * control, then an optional description. Given a function, children receives
 * the id to give the control, so the label names it; a control that is not a
 * form element (such as a Segmented, which takes its own label) is passed as
 * is.
 */
export function Field({
    label,
    value,
    description,
    children,
    className,
}: {
    label: ReactNode;
    value?: ReactNode;
    description?: ReactNode;
    children: ReactNode | ((id: string) => ReactNode);
    className?: string;
}) {
    const id = useId();
    const labelsControl = typeof children === 'function';
    const Label = labelsControl ? 'label' : 'span';
    return (
        <div className={clsx(className, 'min-w-0 space-y-1')}>
            <div className="flex items-baseline justify-between gap-3">
                <Label
                    htmlFor={labelsControl ? id : undefined}
                    className="text-base/6 font-medium text-white sm:text-sm/6"
                >
                    {label}
                </Label>
                {value !== undefined && (
                    <span className="truncate text-sm/6 text-zinc-400 tabular-nums">
                        {value}
                    </span>
                )}
            </div>
            {labelsControl ? children(id) : children}
            {description && (
                <p className="text-sm/5 text-zinc-500">{description}</p>
            )}
        </div>
    );
}
