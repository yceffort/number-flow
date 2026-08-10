import NumberFlow, {
  NumberFlowGroup,
  continuous,
  setEngineMode,
  supportsNativeAnimations,
} from '@yceffort/number-flow-react'
import * as React from 'react'

import type {Meta, StoryObj} from '@storybook/react-vite'

const meta: Meta<typeof NumberFlow> = {
  title: 'NumberFlow',
  component: NumberFlow,
  args: {
    value: 12345.6,
    suffix: '원',
    locales: 'ko-KR',
  },
  argTypes: {
    value: {control: {type: 'number'}},
    prefix: {control: 'text'},
    suffix: {control: 'text'},
    trend: {control: false},
    plugins: {control: false},
  },
  decorators: [
    (Story) => (
      <div style={{fontSize: '3rem', fontWeight: 600}}>
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof NumberFlow>

/** Controls 패널에서 value를 바꿔보세요. */
export const 기본: Story = {}

/** Intl.NumberFormat의 통화 포맷을 그대로 사용합니다. */
export const 통화: Story = {
  args: {
    value: 1523790,
    suffix: undefined,
    format: {style: 'currency', currency: 'KRW'},
  },
}

/** 소수점·백분율 포맷. */
export const 백분율: Story = {
  args: {
    value: -0.1003,
    suffix: undefined,
    format: {style: 'percent', minimumFractionDigits: 2},
  },
}

const randomWalk = (v: number) => v + (Math.random() - 0.48) * 5000

/** 실시간 시세처럼 계속 값이 바뀌는 상황 (연속 인터럽트 합성). */
export const 실시간_티커: Story = {
  render: (args) => {
    const [value, setValue] = React.useState(1523790)
    const [running, setRunning] = React.useState(true)
    React.useEffect(() => {
      if (!running) return
      const id = setInterval(() => setValue(randomWalk), 300)
      return () => clearInterval(id)
    }, [running])
    return (
      <div style={{textAlign: 'center'}}>
        <NumberFlow
          {...args}
          value={Math.round(value)}
          format={{style: 'currency', currency: 'KRW'}}
          suffix={undefined}
        />
        <div style={{marginTop: '1rem'}}>
          <button
            style={{fontSize: '1rem', padding: '0.5rem 1rem'}}
            onClick={() => setRunning(!running)}
          >
            {running ? '정지' : '시작'}
          </button>
        </div>
      </div>
    )
  },
}

/** 애니메이션 도중 값을 연달아 바꿔도 accumulate 합성으로 자연스럽게 이어집니다. */
export const 인터럽트: Story = {
  render: (args) => {
    const [value, setValue] = React.useState(12345.6)
    const burst = () => {
      ;[0, 250, 500].forEach((delay, i) =>
        setTimeout(() => setValue((v) => v + [98765, -1234, 4321][i]!), delay),
      )
    }
    return (
      <div style={{textAlign: 'center'}}>
        <NumberFlow {...args} value={value} />
        <div style={{marginTop: '1rem'}}>
          <button
            style={{fontSize: '1rem', padding: '0.5rem 1rem'}}
            onClick={burst}
          >
            인터럽트 연타
          </button>
        </div>
      </div>
    )
  },
}

/**
 * 구형 브라우저가 타는 rAF 폴백 엔진을 강제로 켠 상태입니다.
 * 네이티브 WAAPI 경로("기본" 스토리)와 육안으로 구분되지 않아야 정상입니다.
 */
export const RAF_폴백_강제: Story = {
  render: (args) => {
    const [value, setValue] = React.useState(12345.6)
    React.useEffect(() => {
      setEngineMode('raf')
      return () => setEngineMode('auto')
    }, [])
    return (
      <div style={{textAlign: 'center'}}>
        <NumberFlow {...args} value={value} />
        <div style={{marginTop: '1rem', fontSize: '0.9rem', color: '#666'}}>
          이 브라우저의 자동 감지 결과:{' '}
          {supportsNativeAnimations ? '네이티브 WAAPI' : 'rAF 폴백'}
        </div>
        <div style={{marginTop: '0.5rem'}}>
          <button
            style={{fontSize: '1rem', padding: '0.5rem 1rem'}}
            onClick={() => setValue((v) => v + 123456)}
          >
            +123,456
          </button>
        </div>
      </div>
    )
  },
}

/** NumberFlowGroup: 여러 인스턴스의 애니메이션 타이밍을 묶어 동기화합니다. */
export const 그룹: Story = {
  render: () => {
    const [value, setValue] = React.useState(1523790)
    return (
      <div style={{textAlign: 'center'}}>
        <NumberFlowGroup>
          <div style={{fontSize: '3rem', fontWeight: 600}}>
            <NumberFlow
              value={value}
              locales="ko-KR"
              format={{style: 'currency', currency: 'KRW'}}
            />
          </div>
          <div style={{fontSize: '1.5rem', color: '#3b82f6'}}>
            <NumberFlow
              value={value / 15237900}
              locales="ko-KR"
              format={{style: 'percent', minimumFractionDigits: 2}}
            />
          </div>
        </NumberFlowGroup>
        <div style={{marginTop: '1rem'}}>
          <button
            style={{fontSize: '1rem', padding: '0.5rem 1rem'}}
            onClick={() => setValue((v) => randomWalk(v) | 0)}
          >
            랜덤 변경
          </button>
        </div>
      </div>
    )
  },
}

/** continuous 플러그인: 중간 숫자들을 거쳐가는 듯한 연속적인 스핀. */
export const Continuous_플러그인: Story = {
  args: {
    value: 100,
    suffix: undefined,
    plugins: [continuous],
  },
  render: (args) => {
    const [value, setValue] = React.useState(100)
    return (
      <div style={{textAlign: 'center'}}>
        <NumberFlow {...args} value={value} />
        <div style={{marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'center'}}>
          <button
            style={{fontSize: '1rem', padding: '0.5rem 1rem'}}
            onClick={() => setValue((v) => v + 1)}
          >
            +1
          </button>
          <button
            style={{fontSize: '1rem', padding: '0.5rem 1rem'}}
            onClick={() => setValue((v) => v + 100)}
          >
            +100
          </button>
        </div>
      </div>
    )
  },
}
