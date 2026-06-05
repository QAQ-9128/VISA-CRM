/* 布局 A — 经典栅格 · 环形图主导 */
const { Icon:IcA, Avatar:AvA, NameCell:NC_A, Pill:PillA, Well:WellA, Donut:DonutA, BarChart:BarA,
  Sidebar:SideA, MoneyAmt:MoneyA, STAGES:STG_A, TODO_CASES:TODO_A, EXPIRY:EXP_A, LODGE:LOD_A, barColor:bcA } = window;

function LayoutA(){
  return (
    <div className="app">
      <SideA/>
      <div className="main">
        <div className="topbar">
          <div className="greet">
            <h1>早上好,Amy<span className="wave">👋</span></h1>
            <p>今天有 3 件待办、2 个临近到期提醒 · 本月已收款 $48,600</p>
          </div>
          <div className="sp"></div>
          <div className="search"><IcA name="search" size={18}/><input placeholder="搜索客户 / 案件 / 参考号"/></div>
          <button className="iconbtn"><IcA name="bell" size={20}/><span className="dot"></span></button>
          <button className="btn btn-primary"><IcA name="plus" size={18}/>新建客户</button>
        </div>

        <div className="scroll stack" style={{gap:20}}>
          {/* 概览统计卡 */}
          <div className="grid g4">
            <StatA icon="briefcase" tone="brand" val="38" lbl="进行中案件" dir="up" t="2.5%"/>
            <StatA icon="clipboard" tone="sky" val="12" lbl="待办事项" dir="up" t="3 件"/>
            <StatA icon="banknote" tone="emerald" val="$48.6k" lbl="本月收款 (AUD)" dir="up" t="8.2%"/>
            <StatA icon="alert" tone="rose" val="$21.4k" lbl="未付总额 (AUD)" dir="down" t="3.1%"/>
          </div>

          {/* 环形图 + 近期待办 */}
          <div className="grid" style={{gridTemplateColumns:'1.05fr 1fr'}}>
            <div className="card">
              <div className="card-hd">
                <div><h3>案件阶段分布</h3><div className="hsub">共 38 个进行中案件</div></div>
                <span className="link">全部案件<IcA name="chevron" size={14}/></span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:30,flexWrap:'wrap'}}>
                <DonutA data={STG_A}/>
                <div className="legend" style={{flex:1,minWidth:160}}>
                  {STG_A.map((d,i)=>(
                    <div className="lr" key={i}>
                      <span className="ld" style={{background:d.color}}/>
                      <span className="ln">{d.name}</span>
                      <span className="lv">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-hd">
                <div style={{display:'flex',alignItems:'center',gap:9}}><h3>待办案件</h3><span className="chip">7</span></div>
                <span className="link">全部<IcA name="chevron" size={14}/></span>
              </div>
              <div className="stack">
                {TODO_A.slice(0,5).map((c,i)=>(
                  <div className="row" key={i}>
                    <NC_A name={c.name} sub={c.visa} size={42}/>
                    <div className="grow"></div>
                    <PillA tone={c.tone}>{c.stage}</PillA>
                    <span style={{fontSize:12,color:c.due.includes('逾期')?'var(--rose)':'var(--faint)',width:54,textAlign:'right'}}>{c.due}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 即将到期 + 月度收款 */}
          <div className="grid" style={{gridTemplateColumns:'1fr 1.1fr'}}>
            <div className="card">
              <div className="card-hd"><div><h3>即将到期提醒</h3><div className="hsub">签证 / 文件 / TRT</div></div></div>
              <div className="stack">
                {EXP_A.map((e,i)=>(
                  <div className="row" key={i}>
                    <WellA name={e.ic} tone={e.tone==='rose'?'rose':e.tone==='indigo'?'indigo':'amber'} size={42}/>
                    <div className="grow"><div className="nm" style={{fontSize:14,fontWeight:600,color:'var(--ink)'}}>{e.name}</div>
                      <div className="ns" style={{fontSize:12,color:'var(--faint)'}}>{e.kind}</div></div>
                    {e.days!=null ? <PillA tone={e.tone} dot={false}>{e.days} 天</PillA> : <PillA tone="indigo" dot={false}>可办理</PillA>}
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-hd">
                <div><h3>月度收款趋势</h3><div className="hsub">近 6 个月 (AUD)</div></div>
                <span className="trend up"><IcA name="trendUp" size={13}/>8.2%</span>
              </div>
              <BarA data={window.REVENUE} height={188}/>
            </div>
          </div>

          {/* 递交进度表 */}
          <div className="card card-pad0">
            <div style={{padding:'22px 22px 14px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div><h3 style={{margin:0,fontSize:16,fontWeight:700,color:'var(--ink)'}}>递交进度</h3>
                <div className="hsub" style={{marginTop:3}}>按递交时间排序</div></div>
              <span className="link">打开案件表<IcA name="chevron" size={14}/></span>
            </div>
            <div style={{overflowX:'auto'}}>
              <table className="tbl">
                <thead><tr><th>客户</th><th>签证类型</th><th>递交日期</th><th>状态</th><th style={{width:'26%'}}>处理进度</th><th className="num">至今</th></tr></thead>
                <tbody>
                  {LOD_A.map((l,i)=>{ const pct=Math.min(100,Math.round(l.elapsed/l.total*100)); const rem=l.total-l.elapsed; return (
                    <tr key={i}>
                      <td><NC_A name={l.name} size={34}/></td>
                      <td style={{color:'var(--muted)'}}>{l.visa}</td>
                      <td className="tnum" style={{color:'var(--faint)'}}>{l.date}</td>
                      <td><PillA tone={l.tone}>{l.status}</PillA></td>
                      <td><div style={{display:'flex',alignItems:'center',gap:10}}>
                        <span className="bar"><span style={{width:pct+'%',background:bcA(l)}}/></span>
                        <span className="tnum" style={{fontSize:12,color:l.status==='已超期'?'var(--rose)':'var(--faint)',whiteSpace:'nowrap'}}>
                          {l.status==='已下签'?'已完成':l.status==='已超期'?`超 ${l.elapsed-l.total} 天`:`剩 ${rem} 天`}</span>
                      </div></td>
                      <td className="num tnum" style={{color:'var(--muted)'}}>{l.elapsed} 天</td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatA({ icon, tone, val, lbl, dir, t }){
  return (
    <div className="card stat">
      <div className="stat-top">
        <WellA name={icon} tone={tone}/>
        <span className={`trend ${dir}`}>{dir==='up'?<IcA name="trendUp" size={13}/>:<IcA name="trendDown" size={13}/>}{t}</span>
      </div>
      <div className="stat-val tnum">{val}</div>
      <div className="stat-lbl">{lbl}</div>
    </div>
  );
}
window.LayoutA = LayoutA;
