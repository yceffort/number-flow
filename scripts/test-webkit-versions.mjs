// 구버전 Safari(WebKit) 테스트 러너.
// Playwright는 릴리스마다 특정 WebKit 빌드를 고정 배포하므로,
// 구버전 Playwright를 격리 설치해 해당 시절의 WebKit을 같은 버전의 드라이버로 구동한다.
//
// 사용법:
//   node scripts/test-webkit-versions.mjs             # 기본: Safari 16.4/17.4/18.2 상당 자동 검증
//   node scripts/test-webkit-versions.mjs 17          # Safari 버전 또는 Playwright 버전으로 지정
//   node scripts/test-webkit-versions.mjs --open 17   # 사람이 볼 수 있게 창을 띄워 비교 데모 열기
//   node scripts/test-webkit-versions.mjs --list      # 가능한 버전 목록과 Safari 매칭 출력
//
// 참고: WebKit 16.0(pw≤1.27) 빌드는 현재 macOS에서 행이 걸려 제외.
// 각 버전은 자식 프로세스에서 실행하고 타임아웃 시 강제 종료한다.

import {execFileSync, spawn} from 'node:child_process'
import {existsSync, mkdirSync} from 'node:fs'
import {createRequire} from 'node:module'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'

import {buildDistIfNeeded, serveDist, CACHE} from './snapshot-utils.mjs'

const SELF = fileURLToPath(import.meta.url)
const DEFAULT_TARGETS = ['1.33.0', '1.40.0', '1.49.0']
const PORT = 5298

// Safari 버전 → 그 WebKit을 고정 배포한 Playwright 버전.
// (실제 WebKit 버전은 실행 시 browser.version()으로 다시 출력됨)
const SAFARI_MAP = {
  16: {pw: '1.33.0', webkit: '16.4'},
  16.4: {pw: '1.33.0', webkit: '16.4'},
  17: {pw: '1.40.0', webkit: '17.4'},
  '17.0': {pw: '1.36.0', webkit: '17.0'},
  17.4: {pw: '1.40.0', webkit: '17.4'},
  18: {pw: '1.49.0', webkit: '18.2'},
  '18.0': {pw: '1.48.0', webkit: '18.0'},
  18.2: {pw: '1.49.0', webkit: '18.2'},
}
// Safari 버전(16, 17.4 등)이면 매핑, 아니면 Playwright 버전으로 간주:
const resolveTarget = (v) => SAFARI_MAP[v]?.pw ?? v

function printList() {
  console.log('열 수 있는 Safari(WebKit) 버전 — pnpm open:webkit <버전>:')
  console.log(
    '  16 / 16.4  → WebKit 16.4 (playwright 1.33) — iOS/macOS Safari 16.4 상당',
  )
  console.log('  17.0       → WebKit 17.0 (playwright 1.36)')
  console.log('  17 / 17.4  → WebKit 17.4 (playwright 1.40)')
  console.log('  18.0       → WebKit 18.0 (playwright 1.48)')
  console.log('  18 / 18.2  → WebKit 18.2 (playwright 1.49)')
  console.log('  최신(26.x)  → npx playwright test --headed --project=webkit')
  console.log(
    '  ※ Safari 16.0~16.3(playwright ≤1.31)은 현재 macOS에서 실행이 멈춰 지원 불가',
  )
  console.log('  ※ Playwright 버전을 직접 넘겨도 됨: pnpm open:webkit 1.36.0')
}

function ensurePlaywright(version) {
  const dir = join(CACHE, `pw-${version}`)
  const pkg = join(dir, 'node_modules/playwright')
  if (!existsSync(pkg)) {
    console.log(`  playwright@${version} 설치 중...`)
    mkdirSync(dir, {recursive: true})
    execFileSync(
      'npm',
      ['install', '--prefix', dir, '--no-save', `playwright@${version}`],
      {
        stdio: ['ignore', 'ignore', 'inherit'],
      },
    )
  }
  // 해당 버전이 고정한 WebKit 빌드 다운로드 (공유 캐시라 중복 다운로드 없음):
  execFileSync('node', [join(pkg, 'cli.js'), 'install', 'webkit'], {
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  const require = createRequire(join(dir, 'node_modules/'))
  return require('playwright')
}

// --- 자식 모드: 한 버전을 headless로 검증 ---
// 이 호스트에서 그 시절 WebKit 을 못 띄우는 경우의 종료 코드 (검증 실패와 구분):
const EXIT_SKIP = 2

// WebKit 17.4~18.x 네이티브 경로의 엔진 버그로 실패하는 항목들.
// 원본 number-flow 도 동일하게 실패하며 WebKit 26 에서 해소되었다 (README의
// "Known issues" 참고). 여기 등록된 항목만 실패하면 잡을 통과시켜서, 진짜 회귀와
// 이미 아는 결함을 구분한다. 해소된 항목은 실행 시 경고로 알려준다.
const affectedNative = (wk, engine) => {
  const v = parseFloat(wk)
  return engine === 'auto' && v >= 17 && v < 26
}
const KNOWN_FAILURES = [
  // 폭이 변할 때 .number 의 scaleX 트윈이 통째로 빠진다:
  {name: 'scenario1 number scales mid-flight', applies: affectedNative},
  // 새로 등장하는 문자의 페이드인이 빠진다. 같은 WebKit 버전이라도 macOS 빌드에서만
  // 재현되고 CI 가 도는 Linux 빌드에서는 통과하므로, 통과했다고 해서 해소된 것은
  // 아니다 — 해소 경고 대상에서 제외한다:
  {
    name: 'scenario1 new chars fade in mid-flight',
    applies: affectedNative,
    buildDependent: true,
  },
]
const isKnownFailure = (name, wk, engine) =>
  KNOWN_FAILURES.some((k) => k.name === name && k.applies(wk, engine))

async function runOne(version, port) {
  const pw = ensurePlaywright(version)
  let browser
  try {
    browser = await pw.webkit.launch()
  } catch (e) {
    // 구버전 WebKit 은 요즘 배포판에 없는 라이브러리를 요구한다
    // (Ubuntu 24.04 에는 libsoup-2.4 / libvpx7 / libpcre3 가 없음).
    // 검증 실패가 아니라 "여기선 못 돌린다"이므로 실패로 세지 않는다:
    console.log(
      `  [playwright@${version}] SKIP — WebKit 실행 불가: ${String(e).replace(/\s+/g, ' ').slice(0, 160)}`,
    )
    process.exit(EXIT_SKIP)
  }
  const wkVersion = browser.version()
  let failed = 0
  for (const engine of ['auto', 'raf']) {
    let page
    try {
      page = await browser.newPage()
      await page.goto(
        `http://localhost:${port}/selftest.html${engine === 'raf' ? '?engine=raf' : ''}`,
        {timeout: 20_000},
      )
      await page.waitForFunction(() => window.__nfResults, null, {
        timeout: 30_000,
      })
      const res = await page.evaluate(() => window.__nfResults)
      const all = res.results.filter((r) => !r.pass)
      const known = all.filter((f) => isKnownFailure(f.name, wkVersion, engine))
      const fails = all.filter((f) => !known.includes(f))
      const ok = !res.fatal && fails.length === 0
      console.log(
        `  [WebKit ${wkVersion}/${engine}] ${ok ? 'PASS' : 'FAIL'} — 감지된 경로: ${res.env.supportsNativeAnimations ? '네이티브 WAAPI' : 'rAF 폴백'}, 검증 ${res.results.length}건 중 실패 ${fails.length}건${known.length ? ` (+ 알려진 이슈 ${known.length}건)` : ''}`,
      )
      if (res.fatal) console.log(`    fatal: ${res.fatal}`)
      fails.forEach((f) =>
        console.log(`    ✗ ${f.name} (${JSON.stringify(f.detail)})`),
      )
      known.forEach((f) => console.log(`    ~ (알려진 이슈) ${f.name}`))
      // 알려진 이슈로 등록해뒀는데 통과한다면 목록을 줄일 때가 된 것:
      KNOWN_FAILURES.forEach(({name, applies, buildDependent}) => {
        if (
          !buildDependent &&
          applies(wkVersion, engine) &&
          res.results.some((r) => r.name === name && r.pass)
        )
          console.log(
            `    ! 알려진 이슈가 해소됨 — 목록에서 제거하세요: ${name}`,
          )
      })
      if (!ok) failed++
    } catch (e) {
      failed++
      console.log(
        `  [WebKit ${wkVersion}/${engine}] 실행 실패: ${String(e).slice(0, 200)}`,
      )
    } finally {
      await page?.close().catch(() => {})
    }
  }
  await browser.close().catch(() => {})
  process.exit(failed ? 1 : 0)
}

// --- 사람이 보는 모드: 창을 띄워 비교 데모를 연다 ---
async function open(version) {
  buildDistIfNeeded()
  const pw = ensurePlaywright(version)
  const server = await serveDist(PORT)
  const browser = await pw.webkit.launch({headless: false})
  console.log(
    `WebKit ${browser.version()} 창을 엽니다 → http://localhost:${PORT}/`,
  )
  console.log('(창을 닫으면 종료됩니다)')
  const page = await browser.newPage()
  await page.goto(`http://localhost:${PORT}/`)
  browser.on('disconnected', () => {
    server.close()
    process.exit(0)
  })
}

// --- main ---
const argv = process.argv.slice(2)
if (argv[0] === '--one') {
  await runOne(argv[1], Number(argv[2]))
} else if (argv[0] === '--open') {
  if (!argv[1]) printList()
  await open(resolveTarget(argv[1] ?? '16'))
} else if (argv[0] === '--list') {
  printList()
  process.exit(0)
} else {
  const targets = argv.length ? argv.map(resolveTarget) : DEFAULT_TARGETS
  buildDistIfNeeded()
  const server = await serveDist(PORT)
  console.log(`정적 서버: http://localhost:${PORT}`)

  let failed = 0
  let skipped = 0
  for (const version of targets) {
    console.log(`\n=== playwright@${version} (WebKit) ===`)
    // 구형 WebKit 빌드가 행이 걸려도 전체가 멈추지 않도록 자식 프로세스 + 타임아웃:
    const code = await new Promise((resolve) => {
      const child = spawn('node', [SELF, '--one', version, String(PORT)], {
        stdio: 'inherit',
      })
      let timedOut = false
      const killer = setTimeout(() => {
        console.log(
          '  SKIP: 5분 타임아웃 — 이 WebKit 빌드는 현재 macOS와 비호환일 수 있음',
        )
        timedOut = true
        child.kill('SIGKILL')
      }, 300_000)
      child.on('close', (c) => {
        clearTimeout(killer)
        resolve(timedOut ? EXIT_SKIP : (c ?? 1))
      })
    })
    if (code === EXIT_SKIP) skipped++
    else if (code !== 0) failed++
  }
  server.close()
  if (skipped)
    console.log(
      `\n${skipped}개 버전은 이 호스트에서 실행할 수 없어 건너뛰었습니다.`,
    )
  process.exit(failed ? 1 : 0)
}
