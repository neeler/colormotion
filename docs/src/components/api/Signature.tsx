import { TypeScriptCode } from '~/components/api/TypeScriptCode';
import { MemberKey, api } from '~/components/api/api';

/** The class a member belongs to (`new Theme`, `Theme#update`, `Theme.random`); undefined for a function. */
function classOf(key: MemberKey) {
    const match = /^(?:new (\w+)|(\w+)[#.])/.exec(key);
    return match?.[1] ?? match?.[2];
}

/**
 * The signature of a class member or function, generated from the library source. The member's own
 * class isn't linked: its section is the one being read.
 */
export function Signature({ of }: { of: MemberKey }) {
    return <TypeScriptCode code={api.members[of].code} self={classOf(of)} />;
}
