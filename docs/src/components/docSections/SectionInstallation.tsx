import SyntaxHighlighter from 'react-syntax-highlighter';
import { hybrid } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { Heading2 } from '~/components/catalyst/Heading2';
import { Code, Text } from '~/components/catalyst/Text';

export function SectionInstallation() {
    return (
        <>
            <Heading2 id="installation">Installation</Heading2>
            <Text>
                Install the <Code>colormotion</Code> npm module using your
                favorite package manager:
            </Text>
            <SyntaxHighlighter language="bash" style={hybrid}>
                {`npm install colormotion
# pnpm install colormotion
# yarn add colormotion`}
            </SyntaxHighlighter>
        </>
    );
}
