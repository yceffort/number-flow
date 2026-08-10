'use client'

export default function GlobalError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <html lang="ko">
      <body>
        <h2>오류가 발생했습니다</h2>
        <button onClick={() => reset()}>다시 시도</button>
      </body>
    </html>
  )
}
