import { useState, useMemo, useCallback, useEffect } from 'react'

/* ═══ Pokemon Type Matchup Matrix ═══
   TYPES[i] attacking TYPES[j] → EFFECTIVENESS[i][j]
   0 = 無効, 0.5 = いまひとつ, 1 = 通常, 2 = 効果ばつぐん
*/
const TYPES = [
  { id:'ノーマル', color:'#a8a878', emoji:'⚪' },
  { id:'ほのお',   color:'#f08030', emoji:'🔥' },
  { id:'みず',     color:'#6890f0', emoji:'💧' },
  { id:'でんき',   color:'#f8d030', emoji:'⚡' },
  { id:'くさ',     color:'#78c850', emoji:'🌱' },
  { id:'こおり',   color:'#98d8d8', emoji:'❄️' },
  { id:'かくとう', color:'#c03028', emoji:'👊' },
  { id:'どく',     color:'#a040a0', emoji:'☠️' },
  { id:'じめん',   color:'#e0c068', emoji:'🌍' },
  { id:'ひこう',   color:'#a890f0', emoji:'🕊️' },
  { id:'エスパー', color:'#f85888', emoji:'🔮' },
  { id:'むし',     color:'#a8b820', emoji:'🐛' },
  { id:'いわ',     color:'#b8a038', emoji:'🪨' },
  { id:'ゴースト', color:'#705898', emoji:'👻' },
  { id:'ドラゴン', color:'#7038f8', emoji:'🐉' },
  { id:'あく',     color:'#705848', emoji:'🌑' },
  { id:'はがね',   color:'#b8b8d0', emoji:'⚙️' },
  { id:'フェアリー', color:'#ee99ac', emoji:'🧚' },
]
const N = TYPES.length

// 18x18 matrix. Rows = 攻撃タイプ, Cols = 防御タイプ
// Order matches TYPES array above
const EFF = [
  //ﾉ ほ み で く こ か ど じ ひ ｴ む い ゴ ド あ は フ
  [1,1,1,1,1,1,1,1,1,1,1,1,.5,0,1,1,.5,1],          // ノーマル
  [1,.5,.5,1,2,2,1,1,1,1,1,2,.5,1,.5,1,2,1],         // ほのお
  [1,2,.5,1,.5,1,1,1,2,1,1,1,2,1,.5,1,1,1],          // みず
  [1,1,2,.5,.5,1,1,1,0,2,1,1,1,1,.5,1,1,1],          // でんき
  [1,.5,2,1,.5,1,1,.5,2,.5,1,.5,2,1,.5,1,.5,1],      // くさ
  [1,.5,.5,1,2,.5,1,1,2,2,1,1,1,1,2,1,.5,1],         // こおり
  [2,1,1,1,1,2,1,.5,1,.5,.5,.5,2,0,1,2,2,.5],        // かくとう
  [1,1,1,1,2,1,1,.5,.5,1,1,1,.5,.5,1,1,0,2],         // どく
  [1,2,1,2,.5,1,1,2,1,0,1,.5,2,1,1,1,2,1],           // じめん
  [1,1,1,.5,2,1,2,1,1,1,1,2,.5,1,1,1,.5,1],          // ひこう
  [1,1,1,1,1,1,2,2,1,1,.5,1,1,1,1,0,.5,1],           // エスパー
  [1,.5,1,1,2,1,.5,.5,1,.5,2,1,1,.5,1,2,.5,.5],      // むし
  [1,2,1,1,1,2,.5,1,.5,2,1,2,1,1,1,1,.5,1],          // いわ
  [0,1,1,1,1,1,1,1,1,1,2,1,1,2,1,.5,1,1],            // ゴースト
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1,.5,0],            // ドラゴン
  [1,1,1,1,1,1,.5,1,1,1,2,1,1,2,1,.5,1,.5],          // あく
  [1,.5,.5,.5,1,2,1,1,1,1,1,1,2,1,1,1,.5,2],         // はがね
  [1,.5,1,1,1,1,2,.5,1,1,1,1,1,1,2,2,.5,1],          // フェアリー
]

/* ═══ Color Coding ═══ */
const CELL_COLOR = {
  0:   { bg:'#1a1a1a', fg:'#5a6378', label:'0',    tag:'無効' },
  0.5: { bg:'#3b2940', fg:'#c897d0', label:'½',    tag:'いまひとつ' },
  1:   { bg:'#111827', fg:'#5a6378', label:'',     tag:'通常' },
  2:   { bg:'#1f4037', fg:'#06d6a0', label:'×2',   tag:'ばつぐん' },
}

/* ═══ VR CSV Standard v0.1 ═══ */
function csvStringify(rows) {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const esc = v => {
    const s = v == null ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  return [cols.map(esc).join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n')
}
function downloadFile(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const LS_SWAP = 'hyakumasu.v01.swap'

/* ═══ Main ═══ */
export default function Hyakumasu() {
  const [swap, setSwap] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_SWAP) || 'false') } catch { return false }
  }) // false: 行=攻撃 / true: 行=防御
  const [search, setSearch] = useState('')
  const [hoverCell, setHoverCell] = useState(null) // {r, c}
  const [filter, setFilter] = useState('all') // all | weakness | resist | immune | super

  useEffect(() => { try { localStorage.setItem(LS_SWAP, JSON.stringify(swap)) } catch {} }, [swap])

  const rowAxis = swap ? '防御' : '攻撃'
  const colAxis = swap ? '攻撃' : '防御'

  // Matrix accessor with swap support
  const getEff = useCallback((rowIdx, colIdx) => {
    if (swap) return EFF[colIdx][rowIdx]  // when swapped, row=defense, col=attack → lookup attack-first EFF[attack][defense]
    return EFF[rowIdx][colIdx]
  }, [swap])

  // Search: highlight matching row/col indices
  const matchedRow = useMemo(() => {
    if (!search.trim()) return null
    const q = search.trim().toLowerCase()
    return new Set(TYPES.map((t,i) => t.id.toLowerCase().includes(q) ? i : -1).filter(i => i >= 0))
  }, [search])

  // Row/column totals (sum of effectiveness, weakness count, resist count)
  const rowStats = useMemo(() => {
    return TYPES.map((_, r) => {
      let x2=0, x05=0, x0=0
      for (let c = 0; c < N; c++) {
        const e = getEff(r, c)
        if (e === 2) x2++
        else if (e === 0.5) x05++
        else if (e === 0) x0++
      }
      return { x2, x05, x0 }
    })
  }, [getEff])

  const colStats = useMemo(() => {
    return TYPES.map((_, c) => {
      let x2=0, x05=0, x0=0
      for (let r = 0; r < N; r++) {
        const e = getEff(r, c)
        if (e === 2) x2++
        else if (e === 0.5) x05++
        else if (e === 0) x0++
      }
      return { x2, x05, x0 }
    })
  }, [getEff])

  /* Export CSV */
  const handleExport = useCallback(() => {
    // Long format: row,col,effectiveness
    const rows = []
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const e = getEff(r, c)
        rows.push({
          attacker: swap ? TYPES[c].id : TYPES[r].id,
          defender: swap ? TYPES[r].id : TYPES[c].id,
          effectiveness: e,
        })
      }
    }
    const csv = csvStringify(rows)
    const ts = new Date().toISOString().slice(0, 10)
    downloadFile(csv, `hyakumasu-type-matchup-${ts}.csv`)
  }, [getEff, swap])

  const shouldDim = (r, c) => {
    if (matchedRow && !matchedRow.has(r) && !matchedRow.has(c)) return true
    const e = getEff(r, c)
    if (filter === 'weakness' && e !== 2) return true
    if (filter === 'resist' && e !== 0.5) return true
    if (filter === 'immune' && e !== 0) return true
    if (filter === 'super' && !(e === 2 || e === 0 || e === 0.5)) return true
    return false
  }

  return (
    <div style={{minHeight:'100vh',background:'#0b0f1a',color:'#e4e8f0',display:'flex',flexDirection:'column'}}>
      {/* Header */}
      <header style={{
        padding:'10px 16px',borderBottom:'1px solid #1e2640',
        display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',
        position:'sticky',top:0,background:'#0b0f1a',zIndex:10,
      }}>
        <div style={{fontSize:18,fontWeight:700}}>🔢 百ますグリッド</div>

        <button onClick={() => setSwap(!swap)} style={{
          padding:'4px 12px',fontSize:11,fontWeight:600,borderRadius:10,cursor:'pointer',
          border:'none',background:'#1e2640',color:'#c4c9d4',
        }} title="行列入れ替え">🔄 {rowAxis}×{colAxis}</button>

        <div style={{display:'flex',gap:4}}>
          {[
            {id:'all', label:'全部'},
            {id:'super', label:'◇相性'},
            {id:'weakness', label:'×2'},
            {id:'resist', label:'½'},
            {id:'immune', label:'0'},
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              padding:'3px 9px',fontSize:10,borderRadius:8,cursor:'pointer',
              border:'none',
              background: filter===f.id ? '#ffd166' : '#111827',
              color: filter===f.id ? '#0b0f1a' : '#8892b0',
              fontWeight: filter===f.id ? 700 : 500,
            }}>{f.label}</button>
          ))}
        </div>

        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 タイプ名"
          style={{
            padding:'5px 10px',fontSize:12,minWidth:120,
            background:'#111827',border:`1px solid ${search?'#ffd166':'#1e2640'}`,
            borderRadius:8,color:'#e4e8f0',outline:'none',
          }}/>

        <div style={{marginLeft:'auto',display:'flex',gap:6,alignItems:'center'}}>
          <button onClick={handleExport} style={{
            padding:'4px 10px',fontSize:11,fontWeight:600,borderRadius:8,cursor:'pointer',
            border:'1px solid #1e2640',background:'#111827',color:'#c4c9d4',
          }}>📤 CSV</button>
          <a href="https://osakenpiro.github.io/wakkazukan/" target="_blank" rel="noreferrer"
            style={{color:'#8892b0',fontSize:11,textDecoration:'none'}}>🪐 わっか</a>
          <a href="https://osakenpiro.github.io/banet-map/" target="_blank" rel="noreferrer"
            style={{color:'#8892b0',fontSize:11,textDecoration:'none'}}>🌀 バネット</a>
          <a href="https://osakenpiro.github.io/tana-zukan/" target="_blank" rel="noreferrer"
            style={{color:'#8892b0',fontSize:11,textDecoration:'none'}}>📚 たな</a>
          <span style={{fontSize:10,padding:'3px 8px',background:'#ffd166',color:'#0b0f1a',borderRadius:10,fontWeight:700}}>v0.1</span>
        </div>
      </header>

      {/* Grid */}
      <div style={{flex:1,overflow:'auto',padding:8}}>
        <table style={{borderCollapse:'separate',borderSpacing:1,margin:'0 auto'}}>
          <thead>
            <tr>
              <th style={{
                padding:6,fontSize:9,color:'#5a6378',textAlign:'center',
                background:'#0d1320',borderRadius:4,
              }}>
                <div style={{fontWeight:700,color:'#8892b0'}}>↓{rowAxis}</div>
                <div style={{fontSize:8}}>→{colAxis}</div>
              </th>
              {TYPES.map((t, c) => {
                const hi = matchedRow?.has(c) || hoverCell?.c === c
                return (
                  <th key={t.id} style={{
                    padding:'4px 2px',fontSize:9,fontWeight:700,
                    background: hi ? t.color+'55' : '#111827',
                    borderRadius:4,
                    color:t.color,textAlign:'center',minWidth:40,
                    writingMode:'vertical-lr',textOrientation:'mixed',
                    height:80,
                    transition:'background .12s',
                  }} title={`防御: ${t.id} (×2被弾: ${colStats[c].x2}, ½: ${colStats[c].x05}, 0: ${colStats[c].x0})`}>
                    <span style={{fontSize:11}}>{t.emoji}</span>
                    <span style={{marginLeft:2}}>{t.id}</span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {TYPES.map((rowT, r) => {
              const rowHi = matchedRow?.has(r) || hoverCell?.r === r
              return (
                <tr key={rowT.id}>
                  <th style={{
                    padding:'4px 6px',fontSize:10,fontWeight:700,
                    background: rowHi ? rowT.color+'55' : '#111827',
                    borderRadius:4,color:rowT.color,textAlign:'right',
                    minWidth:76,whiteSpace:'nowrap',
                    transition:'background .12s',
                  }} title={`攻撃: ${rowT.id} (×2与: ${rowStats[r].x2}, ½: ${rowStats[r].x05}, 0: ${rowStats[r].x0})`}>
                    <span style={{marginRight:3}}>{rowT.emoji}</span>
                    {rowT.id}
                  </th>
                  {TYPES.map((colT, c) => {
                    const e = getEff(r, c)
                    const style = CELL_COLOR[e]
                    const dim = shouldDim(r, c)
                    const hovered = hoverCell?.r === r && hoverCell?.c === c
                    return (
                      <td key={colT.id}
                        onMouseEnter={() => setHoverCell({r, c})}
                        onMouseLeave={() => setHoverCell(null)}
                        style={{
                          padding:0,width:40,height:32,minWidth:40,
                          background: hovered ? '#ffd16644' : style.bg,
                          color:style.fg,textAlign:'center',
                          fontSize:11,fontWeight:700,borderRadius:3,
                          opacity: dim ? 0.12 : 1,
                          transition:'opacity .15s, background .1s',
                          cursor:'crosshair',
                        }}
                        title={`${swap ? colT.id : rowT.id} → ${swap ? rowT.id : colT.id}: ${e===0?'無効':e===0.5?'½':e===1?'通常':e===2?'×2':'?'}`}>
                        {style.label}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Info bar */}
        {hoverCell && (
          <div style={{
            marginTop:12,padding:'8px 14px',background:'#111827',borderRadius:10,
            fontSize:12,color:'#c4c9d4',maxWidth:600,marginLeft:'auto',marginRight:'auto',
            border:`1px solid ${TYPES[hoverCell.r].color}66`,
          }}>
            <span style={{color:TYPES[hoverCell.r].color,fontWeight:700}}>
              {TYPES[hoverCell.r].emoji} {TYPES[hoverCell.r].id}
            </span>
            <span style={{margin:'0 8px',color:'#5a6378'}}>{swap ? '←' : '→'}</span>
            <span style={{color:TYPES[hoverCell.c].color,fontWeight:700}}>
              {TYPES[hoverCell.c].emoji} {TYPES[hoverCell.c].id}
            </span>
            <span style={{marginLeft:12,fontWeight:700,color:CELL_COLOR[getEff(hoverCell.r, hoverCell.c)].fg}}>
              {getEff(hoverCell.r, hoverCell.c) === 0 ? '無効 (×0)' :
               getEff(hoverCell.r, hoverCell.c) === 0.5 ? 'いまひとつ (×½)' :
               getEff(hoverCell.r, hoverCell.c) === 1 ? '通常 (×1)' : 'ばつぐん (×2)'}
            </span>
          </div>
        )}
      </div>

      <footer style={{
        padding:'8px 16px',borderTop:'1px solid #1e2640',display:'flex',
        alignItems:'center',gap:14,fontSize:10,color:'#5a6378',flexWrap:'wrap',
      }}>
        <span>行×列=全18×18ペア</span>
        <span>🔄 で攻守入れ替え</span>
        <span>フィルタで注目</span>
        <span style={{color:'#ffd166'}}>VR 仕分け柱 L1</span>
        <a href="https://github.com/osakenpiro/hyakumasu" target="_blank" rel="noreferrer"
          style={{marginLeft:'auto',color:'#5a6378',textDecoration:'none'}}>GitHub</a>
      </footer>
    </div>
  )
}
