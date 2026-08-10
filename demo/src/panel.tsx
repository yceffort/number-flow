import * as React from 'react'
import {createRoot} from 'react-dom/client'

const params = new URLSearchParams(location.search)
const impl = params.get('impl') ?? 'ours'
const engine = params.get('engine') ?? 'auto'

async function boot() {
  // 한 페이지에 두 구현의 커스텀 엘리먼트가 같이 등록되지 않도록 동적 import:
  let NumberFlow: React.ComponentType<any>
  if (impl === 'original') {
    NumberFlow = (await import('@number-flow/react')).default
  } else {
    const mod = await import('@yceffort/number-flow-react')
    if (engine === 'raf') mod.setEngineMode('raf')
    NumberFlow = mod.default
  }

  function App() {
    const [value, setValue] = React.useState(12345.6)
    React.useEffect(() => {
      const onMessage = (e: MessageEvent) => {
        if (e.data?.type === 'value') setValue(e.data.value)
      }
      window.addEventListener('message', onMessage)
      parent.postMessage({type: 'ready'}, '*')
      return () => window.removeEventListener('message', onMessage)
    }, [])

    return (
      <NumberFlow
        value={value}
        locales="ko-KR"
        format={{maximumFractionDigits: 1}}
        suffix="원"
        style={{fontSize: '2.6rem', fontWeight: 600}}
      />
    )
  }

  createRoot(document.getElementById('root')!).render(<App />)
}

void boot()
