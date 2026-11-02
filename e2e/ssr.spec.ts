import {test, expect, type Page} from '@playwright/test'

const SSR_URL = 'http://localhost:5202/'

// shadow DOM에는 0~9 전체 숫자 strip이 있으므로, 화면에 보이는(non-inert)
// 것만 골라 현재 표시값을 재구성한다:
const renderedText = (page: Page) =>
  page.evaluate(() => {
    const root = document.querySelector(
      'number-flow-yceffort-react',
    )!.shadowRoot!
    let out = ''
    root
      .querySelectorAll('.digit:not([inert]), .symbol:not([inert])')
      .forEach((el) => {
        if (el.classList.contains('digit'))
          out += el.querySelector('.digit__num:not([inert])')?.textContent ?? ''
        else
          el.querySelectorAll('.symbol__value:not([inert])').forEach(
            (v) => (out += v.textContent),
          )
      })
    return out
  })

// JS 없이 받은 서버 HTML 자체에 SSR 마크업이 들어있어야 한다:
test('server HTML contains declarative shadow DOM markup', async ({
  request,
}) => {
  const res = await request.get(SSR_URL)
  const html = await res.text()
  expect(html).toContain('<template shadowroot')
  expect(html).toContain('12,345.6원')
})

test('hydrates without errors and animates after upgrade', async ({page}) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(String(err)))

  await page.goto(SSR_URL)
  const flow = page.locator('number-flow-yceffort-react')
  await expect(flow).toBeVisible()

  // 커스텀 엘리먼트가 업그레이드되어 런타임 shadow DOM으로 교체되었는지:
  await page.waitForFunction(() => {
    const el = document.querySelector('number-flow-yceffort-react')
    return !!el?.shadowRoot?.querySelector('.number')
  })

  // 값 변경 시 애니메이션이 실제로 시작되는지:
  const animated = page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const el = document.querySelector('number-flow-yceffort-react')!
        const timer = setTimeout(() => resolve(false), 5000)
        el.addEventListener(
          'animationsstart',
          () => {
            clearTimeout(timer)
            resolve(true)
          },
          {once: true},
        )
      }),
  )
  await page.getByRole('button', {name: 'bump'}).click()
  expect(await animated).toBe(true)

  expect(await renderedText(page)).toBe('123,456.7원')

  // 히드레이션 불일치를 포함한 콘솔 오류가 없어야 한다:
  const relevant = consoleErrors.filter((e) => !e.includes('favicon'))
  expect(relevant).toEqual([])
})

// 나가는 중인 숫자를 animated=false 와 같은 렌더에서 되살리면, 이전 exit 의
// animationsfinish 가 되살아난 숫자를 지우면 안 된다 (#28):
test('keeps digits restored in the render that turns animation off', async ({
  page,
}) => {
  await page.goto(SSR_URL)
  await page.waitForFunction(() => {
    const el = document.querySelector('number-flow-yceffort-react')
    return !!el?.shadowRoot?.querySelector('.number')
  })

  // 페이지가 값을 2 로 줄이고, 300ms 뒤 animated=false 와 함께 원래 값으로 되돌린다:
  await page.getByRole('button', {name: 'restore'}).click()
  await expect.poll(() => renderedText(page)).toBe('2원')
  await expect.poll(() => renderedText(page)).toBe('12,345.6원')
  // 원래 exit 이 끝났을 시점(900ms) 이후에도 그대로여야 한다:
  await page.waitForTimeout(1200)
  expect(await renderedText(page)).toBe('12,345.6원')
})
