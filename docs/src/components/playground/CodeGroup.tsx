import { ReactNode, useEffect, useState } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { hybrid } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { Button } from '~/components/catalyst/Button';
import { Input } from '~/components/catalyst/Input';
import { ControlGroup } from '~/components/playground/ControlGroup';
import { Field } from '~/components/playground/Field';
import { resetPlayground, shareUrl } from '~/components/playground/share';
import { themeCode } from '~/components/playground/themeCode';
import { usePlaygroundSettings } from '~/hooks/usePlaygroundSettings';
import { useThemeOptions } from '~/hooks/useThemeOptions';
import { useThemeStatus } from '~/hooks/useThemeStatus';

export function CodeGroup() {
    return (
        <ControlGroup title="Code and link" summary="new Theme({ … })">
            <CodeAndLink />
        </ControlGroup>
    );
}

function CodeAndLink() {
    const status = useThemeStatus();
    const options = useThemeOptions();
    const settings = usePlaygroundSettings();

    if (!status) {
        return null;
    }

    const code = themeCode({
        hexes: status.palette.hexes.slice(0, status.palette.nColors),
        mode: status.mode,
        brightness: status.brightness,
        options,
        settings,
    });
    // mounted only once the group is opened, so there is always a window
    const link = shareUrl();

    return (
        <div className="space-y-4">
            <SyntaxHighlighter
                language="typescript"
                style={hybrid}
                customStyle={{ margin: 0, borderRadius: '0.5rem' }}
            >
                {code}
            </SyntaxHighlighter>
            <Field
                label="Link"
                description="This palette, mode and every setting changed here, in the link's hash."
            >
                {(id) => (
                    <Input
                        id={id}
                        readOnly
                        value={link}
                        onFocus={(event) => event.target.select()}
                        className="font-mono"
                    />
                )}
            </Field>
            <div className="flex flex-wrap gap-2">
                <CopyButton text={code}>Copy code</CopyButton>
                <CopyButton text={link}>Copy link</CopyButton>
                <Button
                    color="dark"
                    className="ml-auto"
                    title="Every setting back to its default, with a new random theme"
                    onClick={resetPlayground}
                >
                    Reset
                </Button>
            </div>
        </div>
    );
}

function CopyButton({ text, children }: { text: string; children: ReactNode }) {
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!copied) return;
        const timeout = setTimeout(() => setCopied(false), 1500);
        return () => clearTimeout(timeout);
    }, [copied]);

    return (
        <Button
            color="dark"
            onClick={() => {
                navigator.clipboard?.writeText(text).then(
                    () => setCopied(true),
                    () => {},
                );
            }}
        >
            {copied ? 'Copied' : children}
        </Button>
    );
}
