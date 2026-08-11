// 브라우저 안에서 스스로 검증하고 결과를 보고하는 페이지.
// 구형 Chrome에서는 CDP 클라이언트 호환이 안 되므로
// `--headless --dump-dom`으로 이 페이지를 돌려 결과만 수확한다.
// ?impl=original 이면 원본 number-flow로 같은 검증을 돌려 동작 비교가 가능하다.
import type NumberFlow from '@yceffort/number-flow'

type Result = {name: string; pass: boolean; detail?: unknown}

const params = new URLSearchParams(location.search)
const impl = params.get('impl') ?? 'ours'
const forced = params.get('engine')

// 두 구현 모두 <number-flow>를 정의하므로 하나만 동적 import (run()에서 초기화):
let supportsNativeAnimations: boolean

// ?hold=1이면 완료 전까지 load 이벤트를 지연시킨다. 구형 headless의
// --dump-dom은 load 시점에 덤프하므로, 응답이 안 오는 이미지 요청으로
// load를 붙잡았다가 결과를 다 쓴 뒤 abort해서 덤프를 트리거한다:
let releaseHold: (() => void) | null = null
if (params.get('hold')) {
  const img = new Image()
  img.src = `/hold?t=${Date.now()}`
  document.body.appendChild(img)
  releaseHold = () => {
    img.src = ''
    img.remove()
  }
}

const results: Result[] = []
const assert = (name: string, cond: boolean, detail?: unknown) => {
  results.push({name, pass: !!cond, detail})
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

const IDENTITY = /^(none|matrix\(1,\s*0,\s*0,\s*1,\s*0,\s*0\))$/

function report(fatal?: string) {
  const pass = !fatal && results.every((r) => r.pass)
  const payload = {
    pass,
    fatal: fatal ?? null,
    env: {
      forced,
      supportsNativeAnimations,
      ua: navigator.userAgent,
    },
    results,
  }
  ;(window as any).__nfResults = payload
  document.title = pass ? 'NF_PASS' : 'NF_FAIL'
  document.getElementById('out')!.textContent =
    '\nNFRESULT_START\n' + JSON.stringify(payload) + '\nNFRESULT_END\n'
  releaseHold?.()
}

async function run() {
  if (impl === 'original') {
    const mod = await import('number-flow')
    supportsNativeAnimations = mod.canAnimate
  } else {
    const mod = await import('@yceffort/number-flow')
    supportsNativeAnimations = mod.supportsNativeAnimations
    if (forced === 'raf' || forced === 'native') mod.setEngineMode(forced)
  }

  const flow = document.createElement('number-flow') as NumberFlow
  flow.style.fontSize = '2rem'
  flow.locales = 'en-US'
  flow.format = {maximumFractionDigits: 1}
  document.getElementById('stage')!.appendChild(flow)
  flow.update(12345.6)

  const root = flow.shadowRoot!
  const numberEl = root.querySelector('.number') as HTMLElement

  const finished = (timeout = 8000) =>
    new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), timeout)
      flow.addEventListener(
        'animationsfinish',
        () => {
          clearTimeout(timer)
          resolve(true)
        },
        {once: true},
      )
    })

  const currentText = () => {
    let text = ''
    root
      .querySelectorAll('.digit:not([inert]), .symbol:not([inert])')
      .forEach((el) => {
        if (el.classList.contains('digit')) {
          const num = el.querySelector('.digit__num:not([inert])')
          text += num?.textContent ?? ''
        } else {
          el.querySelectorAll('.symbol__value:not([inert])').forEach((v) => {
            text += v.textContent ?? ''
          })
        }
      })
    return text
  }

  const assertClean = (label: string) => {
    const numberT = getComputedStyle(numberEl).transform
    assert(
      `${label}: number transform identity`,
      IDENTITY.test(numberT),
      numberT,
    )
    const badDigits = Array.from(root.querySelectorAll('.digit')).filter(
      (d) => !IDENTITY.test(getComputedStyle(d).transform),
    )
    assert(
      `${label}: digit transforms clean`,
      badDigits.length === 0,
      badDigits.length,
    )
    const badNums = Array.from(
      root.querySelectorAll('.digit__num:not([inert])'),
    ).filter((n) => !IDENTITY.test(getComputedStyle(n).transform))
    assert(
      `${label}: digit num transforms clean`,
      badNums.length === 0,
      badNums.length,
    )
    assert(
      `${label}: no spinning class left`,
      root.querySelectorAll('.is-spinning').length === 0,
    )
    assert(
      `${label}: no leftover exiting chars`,
      root.querySelectorAll('.section > [inert], .symbol > [inert]').length ===
        0,
    )
  }

  // --- 시나리오 1: 자릿수가 늘어나는 큰 변경 (스핀 + 폭 변화) ---
  let started = false
  flow.addEventListener('animationsstart', () => (started = true), {once: true})
  let done = finished()
  flow.update(135801.6)

  // 새로 등장하는 문자는 fade-in 중이어야 한다. 나가는 문자([inert])는 인라인
  // 선언이 따로 있어 원래 동작하므로, 들어오는 쪽만 센다. 450ms 페이드를
  // 고정 시점 한 번으로 샘플링하면 느린 CI에선 이미 끝난 뒤일 수 있으므로,
  // 끝날 때까지 주기적으로 살펴 한 번이라도 관찰되면 통과로 본다:
  let fadingInSeen = 0
  const fadePoll = setInterval(() => {
    const n = Array.from(
      root.querySelectorAll('.animate-presence:not([inert])'),
    ).filter((el) => {
      const o = parseFloat(getComputedStyle(el).opacity)
      return o > 0 && o < 1
    }).length
    if (n > fadingInSeen) fadingInSeen = n
  }, 16)

  await wait(300)
  const midSpinning = root.querySelectorAll('.digit.is-spinning').length
  const midMoving = Array.from(
    root.querySelectorAll('.digit__num:not([inert])'),
  ).filter((n) => !IDENTITY.test(getComputedStyle(n).transform)).length
  const midNumberT = getComputedStyle(numberEl).transform
  // 마스크는 --width가 세팅되는 첫 애니메이션부터 유효해진다 (원본과 동일한 동작):
  const midMask =
    getComputedStyle(numberEl).getPropertyValue('-webkit-mask-image')
  assert(
    'mask renders while animating',
    midMask.includes('gradient'),
    midMask.slice(0, 40),
  )

  let ok = await done
  clearInterval(fadePoll)
  if (!ok) {
    assert('scenario1 animationsfinish fired', false, {
      computedAnimated: flow.computedAnimated,
    })
    return report()
  }
  assert('scenario1 animationsstart fired', started)
  assert('scenario1 digits spin mid-flight', midSpinning > 0, midSpinning)
  assert('scenario1 digit nums move mid-flight', midMoving > 0, midMoving)
  assert(
    'scenario1 number scales mid-flight',
    !IDENTITY.test(midNumberT),
    midNumberT,
  )
  assert(
    'scenario1 new chars fade in mid-flight',
    fadingInSeen > 0,
    fadingInSeen,
  )
  assertClean('scenario1 end')
  assert('scenario1 text', currentText() === '135,801.6', currentText())

  // --- 시나리오 2: 인터럽트 연타 (accumulate 합성) ---
  done = finished()
  flow.update(999999.9)
  await wait(200)
  flow.update(1234.5)
  await wait(200)
  done = finished()
  flow.update(87654.3)
  ok = await done
  if (!ok) {
    assert('scenario2 animationsfinish fired', false)
    return report()
  }
  assertClean('scenario2 end')
  assert('scenario2 text', currentText() === '87,654.3', currentText())

  // --- 시나리오 3: 부호 등장 (opacity 크로스페이드/animate-presence) ---
  done = finished()
  flow.update(-87654.3)
  await wait(200)
  const midSign = root.querySelectorAll('.symbol').length
  ok = await done
  if (!ok) {
    assert('scenario3 animationsfinish fired', false)
    return report()
  }
  assert('scenario3 sign symbol appeared', midSign > 0, midSign)
  assertClean('scenario3 end')
  assert('scenario3 text', currentText() === '-87,654.3', currentText())

  // --- 시나리오 4: 실시간 티커 (애니메이션이 끝나기 전에 계속 값이 바뀌는 스트레스) ---
  // 자릿수 증감·부호 변화를 섞은 결정적 시퀀스를 120ms 간격으로 20회 밀어넣는다:
  let spinningSeen = 0
  for (let i = 0; i < 20; i++) {
    flow.update(i % 3 === 2 ? -(999.9 + i * 11.1) : 100000 + i * 12345.6)
    await wait(120)
    if (root.querySelectorAll('.is-spinning').length > 0) spinningSeen++
  }
  assert(
    'scenario4 keeps animating under live updates',
    spinningSeen > 10,
    spinningSeen,
  )
  done = finished(10000)
  flow.update(4242.4)
  ok = await done
  if (!ok) {
    assert('scenario4 animationsfinish fired', false)
    return report()
  }
  assertClean('scenario4 end')
  assert('scenario4 text', currentText() === '4,242.4', currentText())

  // --- 시나리오 5: 애니메이션이 꺼진 상태의 업데이트 ---
  // 백그라운드 탭(visibilityState)·모션 최소화·animated=false가 모두 타는 경로다.
  // 직전 스핀이 남긴 인라인 --y가 정리되지 않으면 여기서 활성 숫자가 한 칸
  // 밀려나 자릿수가 빈칸으로 보인다:
  flow.animated = false
  flow.update(5678.9)
  await wait(100)
  assertClean('scenario5 (animated=false)')
  assert('scenario5 text', currentText() === '5,678.9', currentText())

  // 다시 켜면 애니메이션이 정상 복귀해야 한다:
  flow.animated = true
  done = finished()
  flow.update(1111.1)
  ok = await done
  if (!ok) {
    assert('scenario5 re-enabled animationsfinish fired', false)
    return report()
  }
  assertClean('scenario5 re-enabled')
  assert(
    'scenario5 re-enabled text',
    currentText() === '1,111.1',
    currentText(),
  )

  report()
}

run().catch((e) => report(String((e && (e as Error).stack) || e)))
