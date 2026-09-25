import { DocText } from '~/components/api/DocText';
import { TypeScriptCode } from '~/components/api/TypeScriptCode';
import { TYPE_SECTIONS, api, typeAnchor } from '~/components/api/api';
import { Heading2 } from '~/components/catalyst/Heading2';
import { Heading3 } from '~/components/catalyst/Heading3';
import { Code, Text } from '~/components/catalyst/Text';

export function SectionTypes() {
    return (
        <>
            <Heading2 id="types">Types</Heading2>
            <Text>
                The types of colormotion&apos;s API, generated from the source
                with their documentation. Every type is exported from{' '}
                <Code>colormotion</Code>.
            </Text>
            {TYPE_SECTIONS.map((name) => {
                const { code, doc, fields } = api.types[name];
                return (
                    <div key={name} className="space-y-4">
                        <Heading3 id={typeAnchor(name)}>{name}</Heading3>
                        {doc && <DocText text={doc} />}
                        <TypeScriptCode code={code} self={name} />
                        {fields.length > 0 && (
                            <dl className="space-y-4">
                                {fields.map((field) => (
                                    <div key={field.name} className="space-y-2">
                                        <dt>
                                            <Code>{field.name}</Code>
                                        </dt>
                                        <dd className="space-y-2">
                                            <DocText text={field.doc} />
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        )}
                    </div>
                );
            })}
        </>
    );
}
