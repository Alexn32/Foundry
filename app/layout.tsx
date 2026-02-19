export const metadata = {
  title: 'Foundry - AI Co-Founder',
  description: 'Your AI co-founder that builds, runs, and grows your business',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
