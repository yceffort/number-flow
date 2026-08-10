// 구형 Chromium 스냅샷 다운로드/정적 서버 공용 유틸.
import {execFileSync, spawnSync} from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs'
import {createServer} from 'node:http'
import {join, extname, normalize} from 'node:path'

export const ROOT = new URL('..', import.meta.url).pathname
export const DIST = join(ROOT, 'demo/dist')
export const CACHE = join(ROOT, '.browsers')
const SNAPSHOT_BASE =
  'https://commondatastorage.googleapis.com/chromium-browser-snapshots'

export const arm = process.arch === 'arm64'
export const hasRosetta =
  arm && spawnSync('/usr/bin/arch', ['-x86_64', '/usr/bin/true']).status === 0

// milestone → chromium main branch position (chromiumdash가 안 줄 때의 폴백):
const FALLBACK_POSITIONS = {
  80: 722274,
  83: 756066,
  85: 782793,
  87: 812852,
  90: 857950,
  100: 972766,
  110: 1084008,
  114: 1135570,
}

export async function branchPosition(milestone) {
  try {
    const res = await fetch(
      'https://chromiumdash.appspot.com/fetch_milestones?only_branched=true',
    )
    const data = await res.json()
    const m = data.find((d) => d.milestone === milestone)
    if (m?.chromium_main_branch_position) return m.chromium_main_branch_position
  } catch {}
  if (FALLBACK_POSITIONS[milestone]) return FALLBACK_POSITIONS[milestone]
  throw new Error(`M${milestone}의 branch position을 알 수 없습니다`)
}

export async function findSnapshot(platform, pos) {
  // 스냅샷은 리비전이 듬성듬성 존재하므로 버킷 리스팅으로 pos 이후 첫 항목을 찾는다:
  const res = await fetch(
    `${SNAPSHOT_BASE}/?prefix=${platform}/&delimiter=/&marker=${platform}/${pos}`,
  )
  const xml = await res.text()
  const revs = [...xml.matchAll(new RegExp(`<Prefix>${platform}/(\\d+)/`, 'g'))]
    .map((m) => Number(m[1]))
    .filter((r) => r >= pos)
    .sort((a, b) => a - b)
  for (const r of revs.slice(0, 20)) {
    const url = `${SNAPSHOT_BASE}/${platform}/${r}/chrome-mac.zip`
    const head = await fetch(url, {method: 'HEAD'})
    if (head.ok) return {url, pos: r}
  }
  return null
}

export async function ensureChromium(milestone) {
  const dir = join(CACHE, `chromium-m${milestone}`)
  const bin = join(dir, 'chrome-mac/Chromium.app/Contents/MacOS/Chromium')
  if (existsSync(bin)) return {bin, cached: true}

  const pos = await branchPosition(milestone)
  // ARM 스냅샷은 M92 부근부터만 존재하므로, 요청 위치에 가장 가까운 것을 고른다
  // (구형 마일스톤은 x64 스냅샷 + Rosetta로 실행):
  const platforms = arm ? ['Mac_Arm', ...(hasRosetta ? ['Mac'] : [])] : ['Mac']
  let snapshot = null
  let usedPlatform = null
  for (const platform of platforms) {
    const found = await findSnapshot(platform, pos)
    if (found && (!snapshot || found.pos - pos < snapshot.pos - pos)) {
      snapshot = found
      usedPlatform = platform
    }
  }
  if (!snapshot) {
    return {
      error:
        `M${milestone} (r${pos}~): 사용 가능한 스냅샷 없음` +
        (arm && !hasRosetta
          ? ' (ARM 스냅샷 부재, Rosetta 미설치로 x64 불가)'
          : ''),
    }
  }

  console.log(
    `  다운로드: M${milestone} → ${usedPlatform} r${snapshot.pos} ...`,
  )
  mkdirSync(dir, {recursive: true})
  const zip = join(dir, 'chrome-mac.zip')
  const buf = Buffer.from(await (await fetch(snapshot.url)).arrayBuffer())
  writeFileSync(zip, buf)
  execFileSync('unzip', ['-oq', zip, '-d', dir])
  rmSync(zip)
  if (!existsSync(bin))
    return {error: `M${milestone}: 압축 해제 후 바이너리 없음`}
  return {bin, platform: usedPlatform}
}

export function chromiumVersion(bin) {
  try {
    return execFileSync(bin, ['--version'], {encoding: 'utf8'}).trim()
  } catch {
    return '(버전 확인 실패)'
  }
}

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
}

export function buildDistIfNeeded() {
  if (!existsSync(join(DIST, 'selftest.html'))) {
    console.log('demo/dist 빌드 중...')
    execFileSync('pnpm', ['--filter', 'demo', 'build'], {
      cwd: ROOT,
      stdio: 'inherit',
    })
  }
}

export function serveDist(port) {
  const server = createServer((req, res) => {
    let path = normalize(
      decodeURIComponent(new URL(req.url, 'http://x').pathname),
    )
    // selftest의 load-지연용 요청: 절대 응답하지 않는다 (페이지가 스스로 abort):
    if (path === '/hold') return
    if (path === '/') path = '/index.html'
    const file = join(DIST, path)
    if (!file.startsWith(DIST) || !existsSync(file)) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
    })
    res.end(readFileSync(file))
  })
  return new Promise((resolve) => server.listen(port, () => resolve(server)))
}
