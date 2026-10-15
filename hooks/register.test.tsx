import { expect, mock, test } from 'claude-code/testing'

const PANE = { component: 'Pane', props: {}, requestId: 'iikanji' } as const
const BAND = { component: 'AbovePrompt', props: { hasSurvey: false } } as const
const NOW = Date.parse('2026-10-15T12:00:00Z')
const open = () => ({ value: { isPlaced: true } }) as never

test('口癖を数えて、ランキングに反映する', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: NOW })
  on('prompt.submit', ($$, e) => ({ text: e.text }) as never)
  on('ui.open', open)

  await $.prompt.submit({ text: 'とりあえず動かして、いい感じにして。とりあえず頼む' })

  const pane = await $.ui.mount({ plugin: 'iikanji-counter', surface: 'terminal', ...PANE } as never)
  expect(await pane.find({ type: 'Text', text: /いい感じランキング/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /「とりあえず」 2 回/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /「いい感じに」 1 回/ })).toBeDefined()
  await pane.unmount()
})

test('初回はお祝いバナーを出し、OK で通常の帯に戻る', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: NOW })
  on('prompt.submit', ($$, e) => ({ text: e.text }) as never)
  on('ui.open', open)

  await $.prompt.submit({ text: 'とりあえず' })

  const ui = await $.ui.mount({ plugin: 'iikanji-counter', surface: 'terminal', ...BAND } as never)
  expect(await ui.find({ type: 'Button', key: 'ok' })).toBeDefined()
  await ui.press({ key: 'ok' })
  expect(await ui.find({ type: 'Text', text: /いい感じカウンター/ })).toBeDefined()
  await ui.unmount()
})

test('追加の口癖と既定の口癖を拾う', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: NOW })
  on('prompt.submit', ($$, e) => ({ text: e.text }) as never)
  on('ui.open', open)

  const ran = await $.command.run({ command: 'iikanji', args: 'add ガッと' } as never)
  expect(JSON.stringify(ran)).toContain('追加しました')
  await $.prompt.submit({ text: 'なんかガッとやって。たぶんいける' })

  const pane = await $.ui.mount({ plugin: 'iikanji-counter', surface: 'terminal', ...PANE } as never)
  expect(await pane.find({ type: 'Text', text: /「なんか」 1 回/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /「ガッと」 1 回/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /「たぶん」 1 回/ })).toBeDefined()
  await pane.unmount()
})

test('口癖がなければ帯を出さない', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: NOW })
  on('prompt.submit', ($$, e) => ({ text: e.text }) as never)
  on('ui.render', ($$, e) => {
    const { Text } = $$.ui.resolve(e)
    return <Text>base</Text>
  })

  await $.prompt.submit({ text: 'テストを実行して' })

  const ui = await $.ui.mount({ plugin: 'iikanji-counter', surface: 'terminal', ...BAND } as never)
  expect(await ui.find({ type: 'Text', text: /いい感じカウンター/ })).toBeUndefined()
  await ui.unmount()
})

test('コードブロックとインラインコード内の語は数えない', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: NOW })
  on('prompt.submit', ($$, e) => ({ text: e.text }) as never)
  on('ui.render', ($$, e) => {
    const { Text } = $$.ui.resolve(e)
    return <Text>base</Text>
  })

  await $.prompt.submit({ text: '```\nとりあえず\n```\nと `いったん` を実行' })

  const ui = await $.ui.mount({ plugin: 'iikanji-counter', surface: 'terminal', ...BAND } as never)
  expect(await ui.find({ type: 'Text', text: /いい感じカウンター/ })).toBeUndefined()
  await ui.unmount()
})

test('言い換えヒント・実績・直近7日がパネルとバナーに出る', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: NOW })
  on('prompt.submit', ($$, e) => ({ text: e.text }) as never)
  on('ui.open', open)

  await $.prompt.submit({ text: 'いい感じにして' })

  const ui = await $.ui.mount({ plugin: 'iikanji-counter', surface: 'terminal', ...BAND } as never)
  expect(await ui.find({ type: 'Text', text: /読みやすさ優先で/ })).toBeDefined()
  await ui.unmount()

  const pane = await $.ui.mount({ plugin: 'iikanji-counter', surface: 'terminal', ...PANE } as never)
  expect(await pane.find({ type: 'Text', text: /直近7日 1 回/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /実績 1\/5/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /はじめての口癖/ })).toBeDefined()
  await pane.unmount()
})

const fakeApi = (calls: { path: string; body: Record<string, unknown> }[]) => (_$: unknown, e: { url: string; init?: { body?: string } }) => {
  const path = new URL(e.url).pathname
  const body = e.init?.body ? (JSON.parse(e.init.body) as Record<string, unknown>) : {}
  calls.push({ path, body })
  const text =
    path === '/v1/ranking'
      ? JSON.stringify({ players: [{ rank: 1, name: 'ふわふわたぬき1234', total: 9, topPhrase: 'とりあえず', topCount: 5 }], count: 1 })
      : JSON.stringify({ ok: true, rank: 1, players: 1 })

  return { value: { status: 200, ok: true, headers: {}, text } } as never
}

test('join でランダム名が作られ、集計だけが送られる。rename と leave も動く', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: NOW })
  mock.env(on, { IIKANJI_API_URL: 'https://ranking.test' })
  const calls: { path: string; body: Record<string, unknown> }[] = []
  on('http.fetch', fakeApi(calls) as never)
  on('prompt.submit', ($$, e) => ({ text: e.text }) as never)
  on('ui.open', open)

  await $.prompt.submit({ text: 'とりあえず お願い' })
  expect(calls.length).toBe(0)

  const joined = JSON.stringify(await $.command.run({ command: 'iikanji', args: 'join' } as never))
  expect(joined).toContain('参加しました')
  const submit = calls.find(c => c.path === '/v1/submit')
  expect(typeof submit?.body.name).toBe('string')
  expect(String(submit?.body.name).length > 0).toBe(true)
  expect(JSON.stringify(submit?.body)).not.toContain('お願い')
  expect((submit?.body.stats as { total: number }).total).toBe(1)

  const renamed = JSON.stringify(await $.command.run({ command: 'iikanji', args: 'rename すきな名前' } as never))
  expect(renamed).toContain('すきな名前')
  expect(calls.filter(c => c.path === '/v1/submit').at(-1)?.body.name).toBe('すきな名前')

  const left = JSON.stringify(await $.command.run({ command: 'iikanji', args: 'leave' } as never))
  expect(left).toContain('退会')
  expect(calls.some(c => c.path === '/v1/leave')).toBe(true)
})

test('API の URL が未設定なら join は参加せず案内する', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: NOW })
  mock.env(on, { IIKANJI_API_URL: '' })
  const calls: unknown[] = []
  on('http.fetch', ((_$: unknown, e: unknown) => (calls.push(e), { value: { status: 200, ok: true, headers: {}, text: '{}' } })) as never)

  const text = JSON.stringify(await $.command.run({ command: 'iikanji', args: 'join' } as never))
  expect(text).toContain('準備中')
  expect(calls.length).toBe(0)
})

test('メールのような名前は join で拒否される', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: NOW })
  mock.env(on, { IIKANJI_API_URL: 'https://ranking.test' })
  on('http.fetch', (() => ({ value: { status: 400, ok: false, headers: {}, text: '{"error":"name_rejected"}' } })) as never)
  on('ui.open', open)

  const text = JSON.stringify(await $.command.run({ command: 'iikanji', args: 'join taro@example.com' } as never))
  expect(text).toContain('使えません')
})

test('口癖が出た箇所を前後の文脈つきで引用する', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: NOW })
  on('prompt.submit', ($$, e) => ({ text: e.text }) as never)
  on('ui.open', open)

  await $.prompt.submit({ text: 'この関数の見た目をいい感じにしてください。テストも追加して' })

  const ui = await $.ui.mount({ plugin: 'iikanji-counter', surface: 'terminal', ...BAND } as never)
  expect(await ui.find({ type: 'Text', text: /この関数の見た目を/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'いい感じに' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /してください。テスト/ })).toBeDefined()
  await ui.press({ key: 'ok' })
  expect(await ui.find({ type: 'Text', text: /この関数の見た目を/ })).toBeUndefined()
  await ui.unmount()
})

const SETTINGS = { component: 'Pane', props: {}, requestId: 'iikanji-settings' } as const

test('設定コマンドで切り替えると、バナー・引用・帯に反映される', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: NOW })
  on('ui.render', ($$, e) => {
    const { Text } = $$.ui.resolve(e)
    return <Text>base</Text>
  })
  on('prompt.submit', ($$, e) => ({ text: e.text }) as never)
  on('ui.open', open)

  const shown = JSON.stringify(await $.command.run({ command: 'iikanji', args: 'settings' } as never))
  expect(shown).toContain('お祝いバナー')

  await $.command.run({ command: 'iikanji', args: 'settings quote off' } as never)
  await $.command.run({ command: 'iikanji', args: 'settings hint off' } as never)
  await $.prompt.submit({ text: 'いい感じにして' })

  const ui = await $.ui.mount({ plugin: 'iikanji-counter', surface: 'terminal', ...BAND } as never)
  expect(await ui.find({ type: 'Button', key: 'ok' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /読みやすさ優先で/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /して」/ })).toBeUndefined()
  await ui.unmount()

  await $.command.run({ command: 'iikanji', args: 'settings celebrate off' } as never)
  await $.command.run({ command: 'iikanji', args: 'settings band off' } as never)
  await $.prompt.submit({ text: 'ちょっと' })
  const quiet = await $.ui.mount({ plugin: 'iikanji-counter', surface: 'terminal', ...BAND } as never)
  expect(await quiet.find({ type: 'Button', key: 'ok' })).toBeUndefined()
  expect(await quiet.find({ type: 'Text', text: /いい感じカウンター/ })).toBeUndefined()
  await quiet.unmount()
})

test('設定パネルのボタンで切り替わり、初期値に戻せる。不正な指定は案内する', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: NOW })
  on('ui.open', open)

  const ui = await $.ui.mount({ plugin: 'iikanji-counter', surface: 'terminal', ...SETTINGS } as never)
  expect((await ui.find({ key: 'toggle-quote' }))?.text).toContain('オン')
  await ui.press({ key: 'toggle-quote' })
  expect((await ui.find({ key: 'toggle-quote' }))?.text).toContain('オフ')
  await ui.press({ key: 'toggle-celebrate' })
  expect((await ui.find({ key: 'toggle-celebrate' }))?.text).toContain('節目')
  await ui.press({ key: 'reset' })
  expect((await ui.find({ key: 'toggle-quote' }))?.text).toContain('オン')
  await ui.unmount()

  expect(JSON.stringify(await $.command.run({ command: 'iikanji', args: 'settings foo on' } as never))).toContain('ありません')
  expect(JSON.stringify(await $.command.run({ command: 'iikanji', args: 'settings quote maybe' } as never))).toContain('on か off')
})

test('パネルの各セクションを設定でオフにできる', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: NOW })
  on('prompt.submit', ($$, e) => ({ text: e.text }) as never)
  on('ui.open', open)
  await $.prompt.submit({ text: 'とりあえず' })
  await $.command.run({ command: 'iikanji', args: 'settings daily off' } as never)
  await $.command.run({ command: 'iikanji', args: 'settings badges off' } as never)

  const pane = await $.ui.mount({ plugin: 'iikanji-counter', surface: 'terminal', ...PANE } as never)
  expect(await pane.find({ type: 'Text', text: /直近7日/ })).toBeUndefined()
  expect(await pane.find({ type: 'Text', text: /実績/ })).toBeUndefined()
  expect(await pane.find({ type: 'Text', text: /世界ランキング/ })).toBeDefined()
  expect(await pane.find({ type: 'Button', key: 'settings' })).toBeDefined()
  await pane.unmount()
})

test('世界ランキングのサンプル参加者はパネルで見分けられる', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: NOW })
  mock.env(on, { IIKANJI_API_URL: 'https://ranking.test' })
  const players = [
    { rank: 1, name: '見本たぬき', total: 20, topPhrase: 'とりあえず', topCount: 9, isSample: true },
    { rank: 2, name: '本物ねこ', total: 10, topPhrase: null, topCount: 0, isSample: false },
  ]
  on('http.fetch', (() => ({ value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ players, count: 2 }) } })) as never)
  on('ui.open', open)

  await $.command.run({ command: 'iikanji', args: 'world' } as never)

  const pane = await $.ui.mount({ plugin: 'iikanji-counter', surface: 'terminal', ...PANE } as never)
  expect(await pane.find({ type: 'Text', text: /見本たぬき（サンプル）/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /本物ねこ（サンプル）/ })).toBeUndefined()
  expect(await pane.find({ type: 'Text', text: /見本の架空の参加者/ })).toBeDefined()
  await pane.unmount()
})

test('キャラ・言い換え（前→後）・次のランク・世界の追い上げを出す', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: NOW })
  mock.env(on, { IIKANJI_API_URL: 'https://ranking.test' })
  const players = [
    { rank: 1, name: 'A', total: 30, topPhrase: null, topCount: 0 },
    { rank: 2, name: 'B', total: 9, topPhrase: null, topCount: 0 },
  ]
  on('http.fetch', ((_$: unknown, e: { url: string }) => ({
    value: {
      status: 200,
      ok: true,
      headers: {},
      text: new URL(e.url).pathname === '/v1/ranking' ? JSON.stringify({ players, count: 2 }) : JSON.stringify({ ok: true, rank: 3, players: 3 }),
    },
  })) as never)
  on('prompt.submit', ($$, e) => ({ text: e.text }) as never)
  on('ui.open', open)

  await $.prompt.submit({ text: 'いい感じにして' })
  await $.command.run({ command: 'iikanji', args: 'join ためし' } as never)

  const ui = await $.ui.mount({ plugin: 'iikanji-counter', surface: 'terminal', ...BAND } as never)
  expect(await ui.find({ type: 'Text', text: /ふんわり魔法使いが現れた/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /「いい感じにして」→「読みやすさ優先で/ })).toBeDefined()
  await ui.unmount()

  const pane = await $.ui.mount({ plugin: 'iikanji-counter', surface: 'terminal', ...PANE } as never)
  expect(await pane.find({ type: 'Text', text: /次のランク（🌱 口癖の芽）まで あと 4 回/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /2位まであと 9 回/ })).toBeDefined()
  await pane.unmount()
})

test('join は送信を一回だけにし、サーバーの5秒制限に当たっても参加状態がパネルに出る', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: NOW })
  mock.env(on, { IIKANJI_API_URL: 'https://ranking.test' })
  let submits = 0
  const players = [
    { rank: 1, name: 'A', total: 30, topPhrase: null, topCount: 0 },
    { rank: 2, name: 'ためし', total: 0, topPhrase: null, topCount: 0 },
  ]
  on('http.fetch', ((_$: unknown, e: { url: string }) => {
    const path = new URL(e.url).pathname
    if (path === '/v1/ranking') return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ players, count: 2 }) } } as never
    submits += 1
    // 2回目以降は、サーバーの制限（5秒に1回）で 429 になる
    return submits === 1
      ? ({ value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ ok: true, rank: 2, players: 2 }) } } as never)
      : ({ value: { status: 429, ok: false, headers: {}, text: JSON.stringify({ error: 'too_fast', rank: 2, players: 2 }) } } as never)
  }) as never)
  on('ui.open', open)

  const joined = JSON.stringify(await $.command.run({ command: 'iikanji', args: 'join ためし' } as never))
  expect(submits).toBe(1)
  expect(joined).toContain('世界 2 位')

  const again = JSON.stringify(await $.command.run({ command: 'iikanji', args: 'rename ためし' } as never))
  expect(again).toContain('表示名を')

  const pane = await $.ui.mount({ plugin: 'iikanji-counter', surface: 'terminal', ...PANE } as never)
  expect(await pane.find({ type: 'Text', text: /あなた: ためし（世界 2 位 \/ 2 人中）/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /1位をキープ|1位まであと 31 回/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /join で参加/ })).toBeUndefined()
  await pane.unmount()
})

test('ranking コマンドは world と同じく更新してパネルを開く', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: NOW })
  mock.env(on, { IIKANJI_API_URL: 'https://ranking.test' })
  on('http.fetch', (() => ({ value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ players: [], count: 0 }) } })) as never)
  on('ui.open', open)

  expect(JSON.stringify(await $.command.run({ command: 'iikanji', args: 'ranking' } as never))).toContain('世界ランキングを更新')
})

test('メダルの行はバナーで別の行になる', async ($, on) => {
  mock.store(on)
  mock.clock(on, { now: NOW })
  on('prompt.submit', ($$, e) => ({ text: e.text }) as never)
  on('ui.open', open)

  await $.prompt.submit({ text: 'いい感じにして' })

  const ui = await $.ui.mount({ plugin: 'iikanji-counter', surface: 'terminal', ...BAND } as never)
  const all = await ui.findAll({ type: 'Box' })
  expect(all.length > 2).toBe(true)
  await ui.unmount()
})
