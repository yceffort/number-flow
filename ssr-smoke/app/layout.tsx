export const metadata = {title: '@yceffort/number-flow SSR smoke'}

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
