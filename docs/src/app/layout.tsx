import type { Metadata } from 'next';
import GithubCorner from '~/components/icons/GitHubCorner';
import './globals.css';

export const metadata: Metadata = {
    title: 'colormotion api docs',
    description: 'Documentation for the colormotion library',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className="bg-black p-2 font-sans text-neutral-50 antialiased">
                <GithubCorner />
                <main className="mx-auto max-w-5xl">{children}</main>
            </body>
        </html>
    );
}
