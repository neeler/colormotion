import { ReactNode, useId } from 'react';
import { Switch } from '~/components/catalyst/Switch';

/**
 * A labelled switch, with an optional description under the label.
 */
export function SwitchField({
    label,
    description,
    checked,
    onChange,
}: {
    label: ReactNode;
    description?: ReactNode;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    const id = useId();
    return (
        <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
                <label
                    htmlFor={id}
                    className="text-base/6 font-medium text-white sm:text-sm/6"
                >
                    {label}
                </label>
                {description && (
                    <p className="text-sm/5 text-zinc-500">{description}</p>
                )}
            </div>
            <Switch
                id={id}
                checked={checked}
                onChange={onChange}
                className="mt-0.5"
            />
        </div>
    );
}
