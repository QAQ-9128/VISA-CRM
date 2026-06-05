/* 布局 A — 概览 Dashboard(经典栅格 · 环形图)
   已按 UX/UI 优化:统一待办、收敛空卡、欠款上移、金额统一、趋势图可读、下签区分 */
const { Icon:IcA, Avatar:AvA, NameCell:NC_A, Pill:PillA, Well:WellA, Donut:DonutA,
  Sidebar:SideA, STAGES:STG_A, REVENUE:REV_A, TODO_CASES:TODO_A, EXPIRY:EXP_A, LODGE:LOD_A, barColor:bcA } = window;

const aud = (n)=> 'AUD ' + Number(n).toLocaleString('en-US', { minimumFractionDigits: (n%1?2:0), maximumFractionDigits:2 });
const A_DEBTS = [
  { name:'吕列隆', amount:190000.09 },
  { name:'周婷', amount:4500 },
  { name:'陈静', amount:2500 },
  { name:'张伟', amount:1200 },
];
const A_CHECK = [
  '2026/6/1 Guoywfan 提名',
  '2026/6/1 祥龙 提名',
  '2026/6/1–6/7 蒋青霞 482+186 提名 · 合同未签',
  '孙佳琪 + 副申 材料复审 · 186DE 提名',
  '邓涛 / 李旻书 de facto',
  'bohan ivy · subs entrant',
];

function LayoutA(){
  return (
    <div className="app">
      <SideA/>
      <div className="main">
        <div className="topbar">
          <div className="greet">
            <h1>你好,Amy<span className="wave">👋</span></h1>
            <p>今天有 6 件待办、0 个临近到期提醒 · 本月已收款 AUD 0</p>
          </div>
          <div className="sp"></div>
          <div className="search"><IcA name="search" size={18}/><input placeholder="搜索客户 / 案件 / 参考号"/></div>
          <button className="iconbtn"><IcA name="bell" size={20}/><span className="dot"></span></button>
          <button className="btn btn-primary"><IcA name="plus" size={18}/>新建客户</button>
        </div>
        <div className="scroll stack" style={{gap:20}}>
          <LayoutABody/>
        </div>
      </div>
    </div>
  );
}

function LayoutABody(){
  const inProgress = STG_A.filter(s=>s.name!=='下签').reduce((a,s)=>a+s.value,0);
  const totalOwed = A_DEBTS.reduce((a,d)=>a+d.amount,0);
  return (
    <React.Fragment>
      {/* 概览统计卡(金额统一 AUD + 千分位)*/}
      <div className="grid g4">
        <StatA icon="briefcase" tone="brand" val="23" lbl="进行中案件" dir="up" t="2 件"/>
        <StatA icon="clipboard" tone="sky" val="6" lbl="待办事项" dir="flat" t="本周"/>
        <StatA icon="banknote" tone="emerald" val="AUD 0" lbl="本月收款" dir="flat" t="—"/>
        <StatA icon="alert" tone="rose" val="AUD 190,000" lbl="客户欠款总额" dir="down" t="1 户"/>
      </div>

      {/* 阶段分布(在办 vs 下签区分)+ 待办案件 */}
      <div className="grid" style={{gridTemplateColumns:'1.05fr 1fr'}}>
        <div className="card">
          <div className="card-hd">
            <div><h3>案件阶段分布</h3><div className="hsub">在办 {inProgress} · 已下签 {STG_A.find(s=>s.name==='下签')?.value||0}</div></div>
            <span className="link">全部案件<IcA name="chevron" size={14}/></span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:30,flexWrap:'wrap'}}>
            <DonutA data={STG_A} center={inProgress} centerSub="在办案件"/>
            <div className="legend" style={{flex:1,minWidth:170}}>
              {STG_A.map((d,i)=>(
                <div className="lr" key={i}>
                  <span className="ld" style={{background:d.color}}/>
                  <span className="ln">{d.name}{d.name==='下签' && <span style={{color:'var(--faint)',fontWeight:500}}> · 已完成</span>}</span>
                  <span className="lv">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-hd"><div style={{display:'flex',alignItems:'center',gap:9}}><h3>待办阶段案件</h3><span className="chip">6</span></div>
            <span className="link">全部<IcA name="chevron" size={14}/></span></div>
          <div className="stack">
            {TODO_A.slice(0,5).map((c,i)=>(
              <div className="row" key={i}>
                <NC_A name={c.name} sub={c.visa} size={42}/>
                <div className="grow"></div>
                <PillA tone={c.tone}>{c.stage}</PillA>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 即将到期 + 月度趋势(可读性增强)*/}
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
          <BarA2 data={REV_A}/>
        </div>
      </div>

      {/* 待办清单(合并 我的待办 + 清单)+ 欠款总览(按客户,上移)*/}
      <div className="grid g2">
        <Checklist/>
        <div className="card">
          <div className="card-hd">
            <div><h3>欠款总览</h3><div className="hsub">按客户</div></div>
            <span style={{fontSize:13,color:'var(--rose)',fontWeight:700}}>共欠你 {aud(totalOwed)}</span>
          </div>
          <div className="stack">
            {A_DEBTS.map((d,i)=>(
              <div className="row" key={i} style={{cursor:'pointer'}}>
                <AvA name={d.name} size={38}/>
                <div className="grow"><div className="nm" style={{fontSize:14,fontWeight:600,color:'var(--ink)'}}>{d.name}</div></div>
                <span style={{fontSize:14,fontWeight:700,color:'var(--rose)',fontVariantNumeric:'tabular-nums'}}>{aud(d.amount)}</span>
              </div>
            ))}
          </div>
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
    </React.Fragment>
  );
}

/* 月度趋势 — 每根柱标值 + 当前月高亮(可读性增强)*/
function BarA2({ data }){
  const max=Math.max(...data.map(d=>d.value),1);
  return (
    <div style={{display:'flex',alignItems:'flex-end',gap:14,height:196,padding:'18px 2px 0'}}>
      {data.map((d,i)=>(
        <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:9,height:'100%',justifyContent:'flex-end'}}>
          <div style={{fontSize:11.5,fontWeight:700,color:d.hi?'var(--brand)':'var(--muted)',fontVariantNumeric:'tabular-nums'}}>${d.value}k</div>
          <div style={{width:'100%',maxWidth:34,height:`${Math.max(4,(d.value/max)*100)}%`,borderRadius:9,
            background:d.hi?'var(--brand)':'#9db8ff',boxShadow:d.hi?'var(--sh-brand)':'none',transition:'height .3s'}}/>
          <div style={{fontSize:11.5,color:'var(--faint)'}}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

/* 待办清单(合并 我的待办 + 手写清单;可勾选 / 回车添加)*/
function Checklist(){
  const [items,setItems] = React.useState(A_CHECK.map(t=>({t,done:false})));
  const [val,setVal] = React.useState('');
  const add = ()=>{ const v=val.trim(); if(!v) return; setItems(x=>[{t:v,done:false},...x]); setVal(''); };
  return (
    <div className="card">
      <div className="card-hd"><div style={{display:'flex',alignItems:'center',gap:9}}><h3>待办清单</h3><span className="chip">{items.filter(i=>!i.done).length}</span></div></div>
      <div style={{display:'flex',gap:10,marginBottom:6}}>
        <div className="search" style={{flex:1,height:42,boxShadow:'none',border:'1px solid var(--line-2)'}}>
          <input placeholder="写一句待办,回车添加…" value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')add();}}/>
        </div>
        <button className="btn btn-primary" style={{height:42}} onClick={add}>添加</button>
      </div>
      <div className="stack">
        {items.map((it,i)=>(
          <div className="rec" key={i} style={{padding:'11px 0',alignItems:'center'}}>
            <span className={`check ${it.done?'on':''}`} style={{cursor:'pointer'}} onClick={()=>setItems(x=>x.map((y,j)=>j===i?{...y,done:!y.done}:y))}>{it.done&&<IcA name="check" size={13}/>}</span>
            <div style={{flex:1,minWidth:0,fontSize:14,color:it.done?'var(--faint)':'var(--ink)',textDecoration:it.done?'line-through':'none'}}>{it.t}</div>
            <IcA name="x" size={15} stroke="var(--slate-300)" style={{cursor:'pointer'}} onClick={()=>setItems(x=>x.filter((_,j)=>j!==i))}/>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatA({ icon, tone, val, lbl, dir, t }){
  return (
    <div className="card stat">
      <div className="stat-top">
        <WellA name={icon} tone={tone}/>
        <span className={`trend ${dir}`}>{dir==='up'?<IcA name="trendUp" size={13}/>:dir==='down'?<IcA name="trendDown" size={13}/>:null}{t}</span>
      </div>
      <div className="stat-val tnum">{val}</div>
      <div className="stat-lbl">{lbl}</div>
    </div>
  );
}
window.LayoutA = LayoutA;
window.LayoutABody = LayoutABody;
