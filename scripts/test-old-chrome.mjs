// 구형 Chrome/Chromium에서 selftest 페이지를 돌리는 러너.
// CDP 클라이언트(Playwright/Puppeteer)는 구버전과 프로토콜이 안 맞으므로,
// headless + --dump-dom 으로 페이지가 스스로 낸 결과를 수확한다.
// 페이지는 load 이벤트를 지연(?hold=1)했다가 검증 완료 시 풀어 덤프를 트리거한다.
//
// 사용법: node scripts/test-old-chrome.mjs [milestone ...]   (기본: 80 87 100 114)
// 참고: arm64 맥에서 ARM 네이티브 스냅샷은 M92 부근부터 존재. 그 이전은
// x64 스냅샷 + Rosetta가 필요하다 (softwareupdate --install-rosetta).

import {spawn} from 'node:child_process'
import {rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {
  buildDistIfNeeded,
  ensureChromium,
  chromiumVersion,
  serveDist,
} from './snapshot-utils.mjs'

const milestones = process.argv.slice(2).length
  ? process.argv.slice(2).map(Number)
  : [80, 87, 100, 114]

// 주의: 같은 프로세스가 정적 서버를 돌리고 있으므로 spawnSync를 쓰면
// 이벤트 루프가 막혀 Chromium의 요청을 응답하지 못한다. 반드시 비동기 spawn:
function runSelftest(bin, url, label) {
  return new Promise((resolve) => {
    const profile = join(
      tmpdir(),
      `nf-old-chrome-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    )
    const args = [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--hide-scrollbars',
      `--user-data-dir=${profile}`,
      '--dump-dom',
      url,
    ]
    const child = spawn(bin, args)
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    const killer = setTimeout(() => child.kill('SIGKILL'), 120_000)
    child.on('close', (code) => {
      clearTimeout(killer)
      rmSync(profile, {recursive: true, force: true})
      const match = stdout.match(/NFRESULT_START\s*([\s\S]*?)\s*NFRESULT_END/)
      if (!match) {
        resolve({
          label,
          ok: false,
          error: `결과 마커 없음 (exit=${code})`,
          stderr: stderr.slice(-400),
        })
        return
      }
      try {
        resolve({label, ok: true, ...JSON.parse(match[1])})
      } catch (e) {
        resolve({label, ok: false, error: `JSON 파싱 실패: ${e}`})
      }
    })
  })
}

// --- main ---
buildDistIfNeeded()
const PORT = 5299
const server = await serveDist(PORT)
console.log(`정적 서버: http://localhost:${PORT} (arch=${process.arch})`)

let failed = 0
for (const ms of milestones) {
  console.log(`\n=== Chrome M${ms} ===`)
  const browser = await ensureChromium(ms)
  if (browser.error) {
    console.log(`  SKIP: ${browser.error}`)
    continue
  }
  console.log(`  바이너리: ${chromiumVersion(browser.bin)}`)
  for (const engine of ['auto']) {
    const url = `http://localhost:${PORT}/selftest.html?hold=1${engine === 'raf' ? '&engine=raf' : ''}`
    const res = await runSelftest(browser.bin, url, `M${ms}/${engine}`)
    if (!res.ok) {
      failed++
      console.log(
        `  [${res.label}] 실행 실패: ${res.error}\n  stderr: ${res.stderr ?? ''}`,
      )
      continue
    }
    const fails = res.results.filter((r) => !r.pass)
    const native = res.env?.supportsNativeAnimations
    console.log(
      `  [${res.label}] ${res.pass ? 'PASS' : 'FAIL'} — 감지된 경로: ${native ? '네이티브 WAAPI' : 'rAF 폴백'}, 검증 ${res.results.length}건 중 실패 ${fails.length}건`,
    )
    if (res.fatal) console.log(`    fatal: ${res.fatal}`)
    fails.forEach((f) =>
      console.log(`    ✗ ${f.name} (${JSON.stringify(f.detail)})`),
    )
    if (!res.pass) failed++
  }
}

server.close()
process.exit(failed ? 1 : 0)
