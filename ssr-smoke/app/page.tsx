'use client'
import NumberFlow from '@yceffort/number-flow-react'
import {useState} from 'react'

export default function Page() {
  const [value, setValue] = useState(12345.6)
  return (
    <main>
      <h1>SSR smoke</h1>
      <NumberFlow
        value={value}
        locales="en-US"
        format={{maximumFractionDigits: 1}}
        suffix="원"
        style={{fontSize: '3rem', fontWeight: 600}}
      />
      <button onClick={() => setValue((v) => v + 111111.1)}>bump</button>
    </main>
  )
}
