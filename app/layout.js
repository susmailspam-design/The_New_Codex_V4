export const metadata = {
  title: 'The Codex',
  description: 'My App',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
