'use client'
import NumberFlow from '@yceffort/number-flow-react'
import {useState} from 'react'

export default function Page() {
  const [value, setValue] = useState(12345.6)
  const [animated, setAnimated] = useState(true)
  return (
    <main>
      <h1>SSR smoke</h1>
      <NumberFlow
        value={value}
        animated={animated}
        locales="en-US"
        format={{maximumFractionDigits: 1}}
        suffix="원"
        style={{fontSize: '3rem', fontWeight: 600}}
      />
      <button onClick={() => setValue((v) => v + 111111.1)}>bump</button>
      {/* Shrinks the value, then restores it with animation off while the
          dropped digits are still exiting (yceffort/number-flow#28): */}
      <button
        onClick={() => {
          setValue(2)
          setTimeout(() => {
            setAnimated(false)
            setValue(12345.6)
          }, 300)
        }}
      >
        restore
      </button>
    </main>
  )
}
