import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Celebrate, Counts, Daily, Online, Quote, Settings, WorldRow } from '../types'

const DEFAULT_PHRASES = [
  'とりあえず',
  'いい感じに',
  '良き感じに',
  'よしなに',
  'ちょっと',
  'なんか',
  'たぶん',
  '一応',
  'ざっくり',
  'さくっと',
  '適当に',
  'いったん',
]

// 言い換えヒント: 口癖を含む言い方 → 伝わりやすい言い方
const HINTS: Record<string, { before: string; after: string }> = {
  とりあえず: { before: 'とりあえず動かして', after: 'まずログインだけ動かして。細部は後で' },
  いい感じに: { before: 'いい感じにして', after: '読みやすさ優先で、既存の書き方に合わせて' },
  良き感じに: { before: '良き感じにして', after: '余白を広めに、色数は3色までで' },
  よしなに: { before: 'よしなにお願い', after: '命名は任せる。ただし公開APIは変えないで' },
  ちょっと: { before: 'ちょっと直して', after: '1箇所だけ。関数名の誤字を直して' },
  なんか: { before: 'なんか遅い', after: '一覧を開くと3秒かかる。ネットワークは正常' },
  たぶん: { before: 'たぶん原因はここ', after: 'ログでここまで確認済み。ここから先は未確認' },
  一応: { before: '一応テストも', after: '壊れやすい分岐なので、境界値のテストも' },
  ざっくり: { before: 'ざっくり説明して', after: '3項目で、各1文ずつ説明して' },
  さくっと: { before: 'さくっと直して', after: 'このファイルだけ。テストは触らないで' },
  適当に: { before: '適当に名前をつけて', after: '既存の命名規則（camelCase）に合わせて' },
  いったん: { before: 'いったん保留', after: '今日は保留。明日の朝に再開する' },
}

const hintText = (phrase: string) => {
  const h = HINTS[phrase]

  return h === undefined ? null : `「${h.before}」→「${h.after}」`
}

// 口癖ごとのキャラクター
const CHARACTERS: Record<string, string> = {
  いい感じに: '🪄 ふんわり魔法使い',
  良き感じに: '🧚 良き感じの妖精',
  とりあえず: '🏃 見切り発車の妖精',
  よしなに: '🎎 おまかせ侍',
  ちょっと: '🤏 ちょっぴり小人',
  なんか: '🌫️ もやもや霧',
  たぶん: '🔮 たぶん占い師',
  一応: '🛡️ 念のため番人',
  ざっくり: '🗺️ ざっくり探検家',
  さくっと: '⚡ さくさく忍者',
  適当に: '🎲 てきとう賭博師',
  いったん: '⏸️ 一旦停止の番人',
}
const characterOf = (phrase: string) => CHARACTERS[phrase] ?? '👾 名もなき口癖'

// 捕まえたときの掛け声（毎回ランダム）
const CATCH_CALLS = ['🎣 釣れた！', '🚨 いい感じセンサー反応！', '🎯 命中！', '📡 口癖レーダーに反応！', '✨ キャッチ！']

type BadgeContext = { counts: Counts; today: number }
const BADGES: readonly { id: string; label: string; test: (c: BadgeContext) => boolean }[] = [
  { id: 'first', label: '🥚 はじめての口癖', test: c => total(c.counts) >= 1 },
  { id: 'ten-a-day', label: '🔥 一日十連発', test: c => c.today >= 10 },
  { id: 'collector', label: '📚 口癖コレクター（5種類）', test: c => Object.keys(c.counts).length >= 5 },
  { id: 'devoted', label: '💘 一途な口癖（同じ語20回）', test: c => Math.max(0, ...Object.values(c.counts)) >= 20 },
  { id: 'hundred', label: '💯 通算100回', test: c => total(c.counts) >= 100 },
]

// 世界ランキング API（Cloudflare Workers）。IIKANJI_API_URL 環境変数で上書きできる。空だと参加できない
const API_URL = 'https://iikanji.kazuumi.page'
const SYNC_INTERVAL_MS = 30_000
const NAME_MAX = 16
const ADJECTIVES = ['ふわふわ', 'のんびり', 'きらきら', 'ゆるゆる', 'こっそり', 'ほくほく', 'もちもち', 'ぽかぽか']
const ANIMALS = ['たぬき', 'ことり', 'くじら', 'ねこ', 'うさぎ', 'ぺんぎん', 'かめ', 'ふくろう']

const STORE = {
  counts: 'counts',
  custom: 'custom',
  daily: 'daily',
  badges: 'badges',
  account: 'account',
  settings: 'settings',
} as const
const PANE = 'iikanji'
const SETTINGS_PANE = 'iikanji-settings'
const STEP = 5
const TOP = 6
const KEEP_DAYS = 60
const RAINBOW = ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta'] as const
const BAR_WIDTH = 24
const SPARK = '▁▂▃▄▅▆▇█'
const DAY_MS = 86_400_000

const counts = atom({ plugin: 'iikanji-counter', key: 'counts' } as const, {} as Counts)
const custom = atom({ plugin: 'iikanji-counter', key: 'custom' } as const, [] as string[])
const daily = atom({ plugin: 'iikanji-counter', key: 'daily' } as const, {} as Daily)
const badges = atom({ plugin: 'iikanji-counter', key: 'badges' } as const, [] as string[])
const online = atom(
  { plugin: 'iikanji-counter', key: 'online' } as const,
  { isJoined: false, name: '', rank: null, players: null } as Online,
)
const world = atom({ plugin: 'iikanji-counter', key: 'world' } as const, null as WorldRow[] | null)
const settings = atom({ plugin: 'iikanji-counter', key: 'settings' } as const, {
  celebrate: 'all',
  quote: true,
  hint: true,
  band: true,
  autoOpen: true,
  sync: true,
  secDaily: true,
  secBadges: true,
  secWorld: true,
} as Settings)
const celebration = atom({ plugin: 'iikanji-counter', key: 'celebration' } as const, null as string | null)
const quote = atom({ plugin: 'iikanji-counter', key: 'quote' } as const, null as Quote | null)
const hint = atom({ plugin: 'iikanji-counter', key: 'hint' } as const, null as string | null)

const DEFAULT_SETTINGS: Settings = {
  celebrate: 'all',
  quote: true,
  hint: true,
  band: true,
  autoOpen: true,
  sync: true,
  secDaily: true,
  secBadges: true,
  secWorld: true,
}

const CELEBRATE_LABEL: Record<Celebrate, string> = { all: '毎回', milestone: '節目と実績だけ', off: 'なし' }
const CELEBRATE_NEXT: Record<Celebrate, Celebrate> = { all: 'milestone', milestone: 'off', off: 'all' }

// 設定の一覧。alias は /iikanji settings <alias> <値> で使う名前
const SETTING_DEFS = [
  { key: 'celebrate', alias: 'celebrate', label: 'お祝いバナー' },
  { key: 'quote', alias: 'quote', label: '引用とキャラ（バナー内）' },
  { key: 'hint', alias: 'hint', label: '言い換えヒント（バナー内）' },
  { key: 'band', alias: 'band', label: '通常の小さな帯（プロンプト上）' },
  { key: 'autoOpen', alias: 'auto-open', label: '最初の口癖でパネルを自動で開く' },
  { key: 'sync', alias: 'sync', label: '世界ランキングへの自動送信（参加中のみ）' },
  { key: 'secDaily', alias: 'daily', label: 'パネル: 直近7日' },
  { key: 'secBadges', alias: 'badges', label: 'パネル: 実績' },
  { key: 'secWorld', alias: 'world', label: 'パネル: 世界ランキング' },
] as const

const settingValueText = (s: Settings, key: (typeof SETTING_DEFS)[number]['key']) =>
  key === 'celebrate' ? CELEBRATE_LABEL[s.celebrate] : s[key] ? 'オン' : 'オフ'

const settingsText = (s: Settings) =>
  SETTING_DEFS.map(d => `・${d.label}（${d.alias}）: ${settingValueText(s, d.key)}`).join('\n')

async function setSettings($: EngineInterface, patch: Partial<Settings> | null) {
  const next = await update($, settings, current => (patch === null ? { ...DEFAULT_SETTINGS } : { ...current, ...patch }))
  await $.store.set(STORE.settings, next)

  return next
}

const total = (c: Counts) => Object.values(c).reduce((a, b) => a + b, 0)
const ranked = (c: Counts) => Object.entries(c).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
const tracked = (extra: readonly string[]) => [...new Set([...DEFAULT_PHRASES, ...extra])]
const countIn = (text: string, phrase: string) => text.split(phrase).length - 1

// コードブロックとインラインコードは口癖として数えない
const stripCode = (text: string) => text.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ')

// どこで口癖が出たかを、前後の文脈つきで切り出す（画面に出すだけ。保存も送信もしない）
const QUOTE_BEFORE = 12
const QUOTE_AFTER = 10
const quoteOf = (body: string, phrase: string): Quote | null => {
  const flat = body.replace(/\s+/g, ' ')
  const at = flat.indexOf(phrase)
  if (at < 0) return null
  const from = Math.max(0, at - QUOTE_BEFORE)
  const to = Math.min(flat.length, at + phrase.length + QUOTE_AFTER)

  return {
    before: `${from > 0 ? '…' : ''}${flat.slice(from, at)}`,
    phrase,
    after: `${flat.slice(at + phrase.length, to)}${to < flat.length ? '…' : ''}`,
    who: `${characterOf(phrase)}が現れた！`,
  }
}

const dayKey = (ms: number) => {
  const d = new Date(ms)

  return new Date(ms - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}
const dayIndex = (key: string) => Math.floor(Date.parse(`${key}T00:00:00Z`) / DAY_MS)

const dayTotals = (log: Daily, todayKey: string, days: number, offset = 0) => {
  const end = dayIndex(todayKey) - offset
  const out: number[] = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const key = new Date((end - i) * DAY_MS).toISOString().slice(0, 10)
    out.push(total(log[key] ?? {}))
  }

  return out
}

const RANKS = [
  { at: 50, label: '👑 口癖マスター' },
  { at: 20, label: '🔥 口癖の達人' },
  { at: 10, label: '⭐ 口癖の常連' },
  { at: 5, label: '🌱 口癖の芽' },
]
const nextRankOf = (n: number) => [...RANKS].reverse().find(r => r.at > n) ?? null

const rankOf = (n: number) =>
  n >= 50 ? '👑 口癖マスター' : n >= 20 ? '🔥 口癖の達人' : n >= 10 ? '⭐ 口癖の常連' : n >= STEP ? '🌱 口癖の芽' : '🥚 口癖のたまご'

type Account = { id: string; secret: string; name: string }

const randomToken = (length: number) => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(length)
  globalThis.crypto.getRandomValues(bytes)

  return [...bytes].map(b => chars[b % chars.length]).join('')
}
const pickOne = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)] as T
const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)] as T
const randomName = () => `${pick(ADJECTIVES)}${pick(ANIMALS)}${Math.floor(1000 + Math.random() * 9000)}`
const cleanName = (raw: string) => raw.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, NAME_MAX)

// 送るのは名前・回数・語の種類数・一番多い既定語だけ。文章や追加語は送らない
const statsOf = (c: Counts) => {
  const top = ranked(Object.fromEntries(Object.entries(c).filter(([p]) => DEFAULT_PHRASES.includes(p))))[0]

  return { total: total(c), distinct: Object.keys(c).filter(p => DEFAULT_PHRASES.includes(p)).length, topPhrase: top?.[0] ?? null, topCount: top?.[1] ?? 0 }
}

const baseUrl = async ($: EngineInterface) => ((await $.env.get('IIKANJI_API_URL')) ?? API_URL).replace(/\/$/, '')

const api = async ($: EngineInterface, path: string, init?: { method?: string; body?: unknown }) => {
  const res = await $.http.fetch(`${await baseUrl($)}${path}`, {
    method: init?.method ?? 'GET',
    headers: { 'content-type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  })
  let data: Record<string, unknown> = {}
  try {
    data = JSON.parse(res.text) as Record<string, unknown>
  } catch {
    // 本文が JSON でなければ空のまま
  }

  return { ok: res.ok, status: res.status, data }
}

const loadAccount = async ($: EngineInterface) => ((await $.store.get(STORE.account)) as Account | undefined) ?? null

const refreshWorld = async ($: EngineInterface) => {
  const { ok, data } = await api($, '/v1/ranking?limit=10')
  if (ok && Array.isArray(data.players)) {
    await update($, world, () => data.players as WorldRow[])
  }
}

// 世界ランキングで一つ上の人を追い越すのに、あと何回か
const chaseText = (rank: number, mine: number, board: WorldRow[] | null) => {
  if (rank <= 1) return '👑 1位をキープ中！'
  const above = board?.find(row => row.rank === rank - 1)
  if (above === undefined) return `現在 ${rank} 位`

  return `🚀 ${rank - 1}位まであと ${Math.max(1, above.total - mine + 1)} 回`
}

const rankLine = (o: Online) => (o.rank === null ? '' : `（世界 ${o.rank} 位 / ${o.players ?? '?'} 人中）`)

let lastSync = 0

// 自分の集計を一回だけ送る。サーバーは5秒に1回までなので、同じ操作の中で二重に送らないこと
async function submitStats($: EngineInterface, account: Account) {
  return api($, '/v1/submit', {
    method: 'POST',
    body: { id: account.id, secret: account.secret, name: account.name, stats: statsOf(await read($, counts)) },
  })
}

// 送った結果（順位・人数）を画面の状態に反映する。429（短時間の連続送信）でも順位は返ってくる
async function applyOnline($: EngineInterface, account: Account, res: { ok: boolean; status: number; data: Record<string, unknown> }) {
  if (!res.ok && res.status !== 429) return
  const { data } = res
  await update($, online, () => ({
    isJoined: true,
    name: account.name,
    rank: typeof data.rank === 'number' ? data.rank : null,
    players: typeof data.players === 'number' ? data.players : null,
  }))
  await refreshWorld($)
}

// 保存してある登録情報から、参加状態を画面に戻す（再読み込み後の取りこぼし対策）
async function restoreOnline($: EngineInterface) {
  const account = await loadAccount($)
  if (account !== null && !(await read($, online)).isJoined) {
    await update($, online, current => ({ ...current, isJoined: true, name: account.name }))
  }
}

// パネルの「更新」: 参加状態を戻し、自分の集計を送って、世界ランキングを取り直す。失敗しても止めない
async function refreshAll($: EngineInterface) {
  await restoreOnline($)
  const account = await loadAccount($)
  if (account !== null && (await baseUrl($)) !== '') {
    await applyOnline($, account, await submitStats($, account)).catch(() => undefined)
  } else if ((await baseUrl($)) !== '') {
    await refreshWorld($).catch(() => undefined)
  }
}

// パネルの「表示リセット」: バナー・引用・ヒント・世界ランキングの表示だけを消す。累計・実績・設定・参加状態は消さない
async function clearDisplay($: EngineInterface) {
  await update($, celebration, () => null)
  await update($, hint, () => null)
  await update($, quote, () => null)
  await update($, world, () => null)
}

// 参加中なら自分の集計を送る。失敗してもいい感じカウンター本体には影響させない
async function sync($: EngineInterface) {
  const account = await loadAccount($)
  if (account === null || (await baseUrl($)) === '') return
  if (!(await read($, settings)).sync) return
  const now = await $.clock.now()
  if (now - lastSync < SYNC_INTERVAL_MS) return
  lastSync = now

  await applyOnline($, account, await submitStats($, account))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // 状態はホストが持ち続ける。ストアが空・別ストアでも、今ある値は上書きしない
    const savedCounts = (await $.store.get(STORE.counts)) as Counts | undefined
    const savedCustom = (await $.store.get(STORE.custom)) as string[] | undefined
    const savedDaily = (await $.store.get(STORE.daily)) as Daily | undefined
    const savedBadges = (await $.store.get(STORE.badges)) as string[] | undefined
    if (savedCounts && Object.keys(await read($, counts)).length === 0) {
      await update($, counts, () => savedCounts)
    }
    if (savedCustom && (await read($, custom)).length === 0) {
      await update($, custom, () => savedCustom)
    }
    if (savedDaily && Object.keys(await read($, daily)).length === 0) {
      await update($, daily, () => savedDaily)
    }
    if (savedBadges && (await read($, badges)).length === 0) {
      await update($, badges, () => savedBadges)
    }
    const savedSettings = (await $.store.get(STORE.settings)) as Partial<Settings> | undefined
    if (savedSettings) {
      await update($, settings, () => ({ ...DEFAULT_SETTINGS, ...savedSettings }))
    }
    const account = await loadAccount($)
    if (account !== null) {
      await update($, online, current => ({ ...current, isJoined: true, name: account.name }))
    }
    await $.command.register({
      name: 'iikanji',
      description: 'いい感じカウンターのパネルを開く（settings / add / remove 語 / join [名前] / rename 名前 / leave / world）',
    })

    return next(e)
  })

  on('command.run', { command: 'iikanji' }, async ($, e) => {
    const [verb, ...rest] = e.args.trim().split(/\s+/)
    const word = rest.join(' ')

    if (verb === 'join' || verb === 'rename') {
      if ((await baseUrl($)) === '') return { text: '世界ランキングはまだ準備中です（API の URL が未設定です）。' }
      const existing = await loadAccount($)
      if (verb === 'rename' && existing === null) return { text: '先に /iikanji join で参加してください。' }
      const name = cleanName(word) || existing?.name || randomName()
      const account: Account = { id: existing?.id ?? randomToken(32), secret: existing?.secret ?? randomToken(40), name }
      const res = await submitStats($, account)
      if (res.status === 400 && res.data.error === 'name_rejected') {
        return { text: 'その名前は使えません。メールアドレス・URL・電話番号のようなものは避けてください。' }
      }
      if (res.status === 403) {
        return { text: 'サーバーの記録とこの端末の登録情報が合いません。一度 /iikanji leave を試すか、別の名前でやり直してください。' }
      }
      if (!res.ok && res.status !== 429) {
        return { text: '世界ランキングに接続できませんでした。ネットワークを確かめて、もう一度試してください。' }
      }
      await $.store.set(STORE.account, account)
      await applyOnline($, account, res)

      const state = await read($, online)

      return {
        text:
          verb === 'join' && existing === null
            ? `世界ランキングに「${name}」として参加しました${rankLine(state)}。送るのは名前・回数・語の種類数・一番多い既定語だけです（文章や追加語は送りません）。名前は全員に公開されます（本名・会社名・連絡先は入れないでください）。/iikanji rename 名前 で変えられ、やめるときは /iikanji leave です。`
            : `表示名を「${name}」にしました${rankLine(state)}。`,
      }
    }

    if (verb === 'settings') {
      const [name, value] = rest
      if (name === 'reset') {
        await setSettings($, null)

        return { text: `設定を初期値に戻しました。\n${settingsText(await read($, settings))}` }
      }
      if (name !== undefined) {
        const def = SETTING_DEFS.find(d => d.alias === name || d.key === name)
        if (def === undefined) return { text: `「${name}」という設定はありません。\n${settingsText(await read($, settings))}` }
        if (def.key === 'celebrate') {
          if (value !== 'all' && value !== 'milestone' && value !== 'off') {
            return { text: 'お祝いバナーは all（毎回）/ milestone（節目と実績だけ）/ off（なし）から選んでください。' }
          }
          await setSettings($, { celebrate: value })
        } else {
          if (value !== 'on' && value !== 'off') return { text: `${def.label}は on か off で指定してください。` }
          await setSettings($, { [def.key]: value === 'on' })
        }

        return { text: `${def.label}を変えました。\n${settingsText(await read($, settings))}` }
      }
      await $.ui.open({ id: SETTINGS_PANE, title: 'いい感じカウンターの設定' })

      return { text: `設定パネルを開きました。\n${settingsText(await read($, settings))}\n（変更: /iikanji settings 名前 on|off、初期値: /iikanji settings reset）` }
    }

    if (verb === 'leave') {
      const account = await loadAccount($)
      if (account === null) return { text: '世界ランキングには参加していません。' }
      const { ok } = await api($, '/v1/leave', { method: 'POST', body: { id: account.id, secret: account.secret } })
      if (!ok) return { text: '退会に失敗しました。ネットワークを確かめて、もう一度試してください。' }
      await $.store.delete(STORE.account)
      await update($, online, () => ({ isJoined: false, name: '', rank: null, players: null }))

      return { text: '世界ランキングから退会し、サーバー上のデータを削除しました。' }
    }

    if (verb === 'world' || verb === 'ranking') {
      await refreshAll($)
      await $.ui.open({ id: PANE, title: 'いい感じカウンター' })

      return { text: '世界ランキングを更新して、パネルを開きました。' }
    }

    if ((verb === 'add' || verb === 'remove') && word !== '') {
      const list = await update($, custom, current =>
        verb === 'add' ? [...new Set([...current, word])] : current.filter(w => w !== word),
      )
      await $.store.set(STORE.custom, list)

      return { text: verb === 'add' ? `「${word}」を口癖に追加しました。` : `「${word}」を口癖から外しました。` }
    }

    await restoreOnline($)
    await $.ui.open({ id: PANE, title: 'いい感じカウンター' })

    return { text: 'いい感じカウンターのパネルを開きました。（追加: /iikanji add 語、削除: /iikanji remove 語）' }
  })

  on('prompt.submit', async ($, e, next) => {
    const body = stripCode(e.text)
    const words = tracked(await read($, custom))
    const hits = words.map(p => [p, countIn(body, p)] as const).filter(([, n]) => n > 0)

    if (hits.length > 0) {
      const before = total(await read($, counts))
      const today = dayKey(await $.clock.now())

      const all = await update($, counts, current => {
        const updated: Counts = { ...current }
        for (const [p, n] of hits) {
          updated[p] = (updated[p] ?? 0) + n
        }

        return updated
      })
      const log = await update($, daily, current => {
        const day: Counts = { ...(current[today] ?? {}) }
        for (const [p, n] of hits) {
          day[p] = (day[p] ?? 0) + n
        }
        const merged: Daily = { ...current, [today]: day }
        const keep = Object.keys(merged).sort().slice(-KEEP_DAYS)

        return Object.fromEntries(keep.map(k => [k, merged[k] ?? {}]))
      })
      await $.store.set(STORE.counts, all)
      await $.store.set(STORE.daily, log)

      const have = await read($, badges)
      const context: BadgeContext = { counts: all, today: total(log[today] ?? {}) }
      const unlocked = BADGES.filter(b => !have.includes(b.id) && b.test(context))
      if (unlocked.length > 0) {
        const ids = await update($, badges, current => [...current, ...unlocked.map(b => b.id)])
        await $.store.set(STORE.badges, ids)
      }

      const cfg = await read($, settings)
      const after = total(all)
      const caught = hits.map(([p, n]) => `「${p}」×${n}`).join(' ')
      const isMilestone = before === 0 || Math.floor(after / STEP) > Math.floor(before / STEP)
      const medal = unlocked.map(b => `🏅実績解除: ${b.label}`).join('\n')
      const isShown = cfg.celebrate === 'all' || (cfg.celebrate === 'milestone' && (isMilestone || unlocked.length > 0))
      const head = isMilestone ? `${pickOne(CATCH_CALLS)} ${caught}\n通算 ${after} 回！ ${rankOf(after)} になりました` : `${pickOne(CATCH_CALLS)} ${caught}`
      await update($, celebration, () => (!isShown ? null : medal === '' ? head : `${head}\n${medal}`))
      const topHit = [...hits].sort((a, b) => b[1] - a[1])[0]
      await update($, hint, () => (topHit ? hintText(topHit[0]) : null))
      await update($, quote, () => (topHit ? quoteOf(body, topHit[0]) : null))

      if (before === 0 && cfg.autoOpen) {
        void $.ui.open({ id: PANE, title: 'いい感じカウンター' })
      }
      void sync($).catch(() => undefined)
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const current = await read($, counts)
    const message = await read($, celebration)
    const tip = await read($, hint)
    const cited = await read($, quote)
    const cfg = await read($, settings)
    const isQuiet = e.props.hasSurvey || Object.keys(current).length === 0 || (message === null && !cfg.band)

    if (isQuiet) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)

    if (message !== null) {
      const lines = message.split('\n').map((line, i) => (i === 0 ? `🎉 ${line} 🎉` : line))
      const close = () =>
        update($, celebration, () => null)
          .then(() => update($, hint, () => null))
          .then(() => update($, quote, () => null))

      return (
        <Box flexDirection="column" borderStyle="double" borderColor="yellow" paddingX={1}>
          {lines.map(line => (
            <Box>
              {[...line].map((ch, i) => (
                <Text bold color={RAINBOW[i % RAINBOW.length]}>
                  {ch}
                </Text>
              ))}
            </Box>
          ))}
          {cfg.quote && cited !== null && <Text bold>{cited.who}</Text>}
          {cfg.quote && cited !== null && (
            <Text>
              📝 <Text dimColor>「{cited.before}</Text>
              <Text bold color="yellow">
                {cited.phrase}
              </Text>
              <Text dimColor>{cited.after}」</Text>
            </Text>
          )}
          {cfg.hint && tip !== null && <Text color="cyan">💡 {tip}</Text>}
          <Box>
            <Button key="ok" label="OK!" onPress={close} />
            <Button key="pane" label="ランキングを見る" onPress={() => $.ui.open({ id: PANE, title: 'いい感じカウンター' })} />
            <Button key="settings" label="⚙ 設定" onPress={() => $.ui.open({ id: SETTINGS_PANE, title: 'いい感じカウンターの設定' })} />
          </Box>
        </Box>
      )
    }

    return (
      <Box>
        <Text dimColor>
          いい感じカウンター: {ranked(current).slice(0, 3).map(([p, n]) => `「${p}」${n}回`).join(' / ')}（通算 {total(current)} 回）{' '}
        </Text>
        <Button key="hide" label="隠す" onPress={() => setSettings($, { band: false })} />
        <Button key="settings" label="⚙ 設定" onPress={() => $.ui.open({ id: SETTINGS_PANE, title: 'いい感じカウンターの設定' })} />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const current = await read($, counts)
    const log = await read($, daily)
    const have = await read($, badges)
    const todayKey = dayKey(await $.clock.now())
    const me = await read($, online)
    const board = await read($, world)
    const cfg = await read($, settings)

    const sum = total(current)
    const list = ranked(current).slice(0, TOP)
    const top = Math.max(1, ...list.map(([, n]) => n))
    const toNext = STEP - (sum % STEP)
    const nextRank = nextRankOf(sum)
    const filled = Math.round(((sum % STEP) / STEP) * BAR_WIDTH)

    const week = dayTotals(log, todayKey, 7)
    const lastWeek = dayTotals(log, todayKey, 7, 7)
    const weekSum = week.reduce((a, b) => a + b, 0)
    const lastSum = lastWeek.reduce((a, b) => a + b, 0)
    const diff = weekSum - lastSum
    const peak = Math.max(1, ...week)
    const spark = week.map(n => (n === 0 ? '　' : (SPARK[Math.min(7, Math.floor((n / peak) * 7))] ?? '▁'))).join(' ')
    const trend = diff === 0 ? '±0' : diff > 0 ? `▲${diff}` : `▼${-diff}`

    return (
      <Box flexDirection="column" paddingX={1}>
        <Box>
          <Text bold color="yellow">
            ✨ いい感じランキング ✨{' '}
          </Text>
          <Button key="settings" label="⚙ 設定" onPress={() => $.ui.open({ id: SETTINGS_PANE, title: 'いい感じカウンターの設定' })} />
          <Button key="refresh" label="🔄 更新" onPress={() => refreshAll($)} />
          <Button key="clear" label="🧹 表示リセット" onPress={() => clearDisplay($)} />
        </Box>
        <Text>{rankOf(sum)}（通算 {sum} 回）</Text>
        <Text> </Text>
        {list.map(([p, n], i) => {
          const len = Math.round((n / top) * BAR_WIDTH)

          return (
            <Box flexDirection="column">
              <Text bold>
                {['🥇', '🥈', '🥉'][i] ?? '  '} 「{p}」 {n} 回
              </Text>
              <Text color={RAINBOW[i % RAINBOW.length]}>
                {'█'.repeat(len)}
                <Text dimColor>{'░'.repeat(BAR_WIDTH - len)}</Text>
              </Text>
            </Box>
          )
        })}
        <Text> </Text>
        <Text dimColor>
          {nextRank === null ? '最高ランクに到達しました 👑' : `次のランク（${nextRank.label}）まで あと ${nextRank.at - sum} 回`}
        </Text>
        <Text dimColor>次のお祝いまであと {toNext} 回</Text>
        <Text color="green">
          {'▰'.repeat(filled)}
          <Text dimColor>{'▱'.repeat(BAR_WIDTH - filled)}</Text>
        </Text>
        {cfg.secDaily && (
          <Box flexDirection="column">
            <Text> </Text>
            <Text bold>📅 直近7日 {weekSum} 回（先週比 {trend}）</Text>
            <Text color="cyan">{spark}</Text>
            <Text dimColor>今日 {week[6] ?? 0} 回</Text>
          </Box>
        )}
        {cfg.secWorld && (
          <Box flexDirection="column">
        <Text> </Text>
        <Text bold>🌍 世界ランキング{me.isJoined ? ` あなた: ${me.name}${rankLine(me)}` : ''}</Text>
        {!me.isJoined && <Text dimColor>/iikanji join で参加（名前はランダムで作られます）</Text>}
        {me.isJoined && board === null && <Text dimColor>/iikanji world で取得</Text>}
        {me.isJoined && me.rank !== null && (
          <Text color="green">{chaseText(me.rank, sum, board)}</Text>
        )}
        {(board ?? []).map(row => (
          <Text bold={row.name === me.name} color={row.name === me.name ? 'yellow' : undefined}>
            {['🥇', '🥈', '🥉'][row.rank - 1] ?? `${row.rank}.`} {row.name}
            {row.isSample ? '（サンプル）' : ''} {row.total} 回{row.topPhrase ? `（${row.topPhrase}）` : ''}
          </Text>
        ))}
        {(board ?? []).some(row => row.isSample) && <Text dimColor>「サンプル」は見本の架空の参加者です</Text>}
          </Box>
        )}
        {cfg.secBadges && (
          <Box flexDirection="column">
        <Text> </Text>
        <Text bold>🏅 実績 {have.length}/{BADGES.length}</Text>
        {BADGES.map(b => (
          <Text dimColor={!have.includes(b.id)}>
            {have.includes(b.id) ? b.label : `🔒 ${b.label.replace(/^\S+\s/, '')}`}
          </Text>
        ))}
          </Box>
        )}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: SETTINGS_PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const cfg = await read($, settings)

    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold color="yellow">
          ⚙ いい感じカウンターの設定
        </Text>
        <Text dimColor>うるさいと感じたものはオフにできます。数えること自体は止まりません。</Text>
        <Text> </Text>
        {SETTING_DEFS.map(d => (
          <Box>
            <Text>{d.label}: </Text>
            <Button
              key={`toggle-${d.alias}`}
              label={settingValueText(cfg, d.key)}
              onPress={() =>
                d.key === 'celebrate'
                  ? setSettings($, { celebrate: CELEBRATE_NEXT[cfg.celebrate] })
                  : setSettings($, { [d.key]: !cfg[d.key] })
              }
            />
          </Box>
        ))}
        <Text> </Text>
        <Button key="reset" label="初期値に戻す" onPress={() => setSettings($, null)} />
        <Text dimColor>コマンド: /iikanji settings 名前 on|off（お祝いは all|milestone|off）</Text>
      </Box>
    )
  })
}
