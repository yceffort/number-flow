import {test, expect} from '@playwright/test'

type NfResults = {
  pass: boolean
  fatal: string | null
  env: {forced: string | null; supportsNativeAnimations: boolean; ua: string}
  results: Array<{name: string; pass: boolean; detail?: unknown}>
}

// 각 엔진(브라우저)에서 자동 감지 경로와 rAF 강제 경로를 모두 검증:
for (const engine of ['auto', 'raf'] as const) {
  test(`selftest (engine=${engine})`, async ({page}) => {
    await page.goto(`/selftest.html${engine === 'raf' ? '?engine=raf' : ''}`)
    await page.waitForFunction(() => (window as any).__nfResults, undefined, {
      timeout: 30_000,
    })
    const res = (await page.evaluate(
      () => (window as any).__nfResults,
    )) as NfResults

    expect(res.fatal).toBeNull()
    expect(res.results.filter((r) => !r.pass)).toEqual([])

    if (engine === 'raf') {
      // 강제 폴백에서도 전 시나리오가 통과해야 한다 (위에서 이미 검증됨).
    } else {
      // 최신 3대 엔진은 모두 네이티브 경로를 선택해야 한다:
      expect(res.env.supportsNativeAnimations).toBe(true)
    }
  })
}
