import type { Metadata } from 'next';
import GithubCorner from '~/components/icons/GitHubCorner';
import './globals.css';

export const metadata: Metadata = {
    title: 'colormotion api docs',
    description: 'Documentation for the colormotion package',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className="antialiased bg-black text-neutral-50 font-sans">
                <GithubCorner />
                <main className="max-w-5xl mx-auto">{children}</main>
            </body>
        </html>
    );
}
