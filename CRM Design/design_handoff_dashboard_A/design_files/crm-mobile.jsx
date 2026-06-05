/* 移动端 — 三种方向的手机版 */
const { Icon:IcM, Avatar:AvM, Pill:PillM, Well:WellM, Donut:DonutM, Gauge:GaugeM,
  STAGES:STG_M, TODO_CASES:TODO_M, APPROVALS:APR_M, EXPIRY:EXP_M } = window;

function StatusBar(){
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 22px 4px',fontSize:13,fontWeight:700,color:'var(--ink)'}}>
      <span>9:41</span>
      <span style={{display:'flex',gap:5,alignItems:'center'}}>
        <IcM name="bell" size={14}/><span style={{fontWeight:600}}>5G</span>
        <span style={{width:22,height:11,border:'1.5px solid var(--ink)',borderRadius:3,display:'inline-block',position:'relative'}}>
          <span style={{position:'absolute',inset:1.5,right:6,background:'var(--ink)',borderRadius:1}}></span></span>
      </span>
    </div>
  );
}
function MHeader({ title, sub }){
  return (
    <div className="m-top" style={{justifyContent:'space-between'}}>
      <div><div style={{fontSize:20,fontWeight:700,color:'var(--ink)',letterSpacing:'-.01em'}}>{title}</div>
        <div style={{fontSize:12.5,color:'var(--muted)',marginTop:2}}>{sub}</div></div>
      <div style={{display:'flex',gap:10,alignItems:'center'}}>
        <button className="iconbtn" style={{width:42,height:42}}><IcM name="bell" size={19}/><span className="dot"></span></button>
        <AvM name="Amy" size={42}/>
      </div>
    </div>
  );
}
function TabBar({ active=0 }){
  const items=[['home','概览'],['users','客户'],['plus',''],['wallet','财务'],['archive','档案']];
  return (
    <div className="tabbar">
      {items.map((t,i)=> t[0]==='plus'
        ? <div className="tab" key={i}><span className="fab"><IcM name="plus" size={24}/></span></div>
        : <div className={`tab ${i===active?'on':''}`} key={i}><IcM name={t[0]} size={22}/><span>{t[1]}</span></div>)}
    </div>
  );
}

/* A — 环形 + 统计 + 待办 */
function MobileA(){
  return (
    <div className="m-shell">
      <StatusBar/>
      <MHeader title="早上好,Amy 👋" sub="今天 3 件待办 · 2 个到期提醒"/>
      <div className="m-scroll">
        <div className="grid g2" style={{gap:12}}>
          <MStat icon="briefcase" tone="brand" val="38" lbl="进行中案件" dir="up" t="2.5%"/>
          <MStat icon="banknote" tone="emerald" val="$48.6k" lbl="本月收款" dir="up" t="8.2%"/>
          <MStat icon="clipboard" tone="sky" val="12" lbl="待办事项" dir="up" t="3 件"/>
          <MStat icon="alert" tone="rose" val="$21.4k" lbl="未付总额" dir="down" t="3.1%"/>
        </div>
        <div className="card">
          <div className="card-hd"><h3 style={{fontSize:15}}>案件阶段分布</h3></div>
          <div style={{display:'flex',justifyContent:'center'}}><DonutM data={STG_M} size={172} thickness={24}/></div>
          <div className="legend" style={{marginTop:18,gap:10}}>
            {STG_M.map((d,i)=>(<div className="lr" key={i}><span className="ld" style={{background:d.color}}/>
              <span className="ln" style={{fontSize:12.5}}>{d.name}</span><span className="lv">{d.value}</span></div>))}
          </div>
        </div>
        <div className="card">
          <div className="card-hd"><div style={{display:'flex',alignItems:'center',gap:8}}><h3 style={{fontSize:15}}>待办案件</h3><span className="chip">7</span></div>
            <span className="link" style={{fontSize:12}}>全部</span></div>
          <div className="stack">
            {TODO_M.slice(0,4).map((c,i)=>(
              <div className="row" key={i} style={{padding:'10px 0'}}>
                <AvM name={c.name} size={38}/>
                <div className="grow"><div className="nm" style={{fontSize:13.5}}>{c.name}</div><div className="ns">{c.visa}</div></div>
                <PillM tone={c.tone} dot={false}>{c.stage}</PillM>
              </div>
            ))}
          </div>
        </div>
      </div>
      <TabBar active={0}/>
    </div>
  );
}

/* B — 渐变 hero + 条形 + 审批 */
function MobileB(){
  const max=Math.max(...window.REVENUE.map(d=>d.value));
  return (
    <div className="m-shell">
      <StatusBar/>
      <MHeader title="财务概览" sub="本月业绩 · 6 月 1 日"/>
      <div className="m-scroll">
        <div className="card" style={{background:'linear-gradient(135deg,#3b6bff,#5a55f0)',color:'#fff',boxShadow:'var(--sh-brand)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div><div style={{fontSize:12.5,fontWeight:600,opacity:.85}}>本月收款 (AUD)</div>
              <div style={{fontSize:34,fontWeight:700,marginTop:6,fontVariantNumeric:'tabular-nums'}}>$48,600</div>
              <span style={{display:'inline-flex',alignItems:'center',gap:3,background:'rgba(255,255,255,.2)',padding:'3px 9px',borderRadius:999,fontWeight:700,fontSize:12,marginTop:8}}><IcM name="trendUp" size={12}/>8.2%</span></div>
            <span className="well" style={{background:'rgba(255,255,255,.18)',color:'#fff',width:44,height:44}}><IcM name="wallet"/></span>
          </div>
          <div style={{display:'flex',alignItems:'flex-end',gap:8,height:80,marginTop:18}}>
            {window.REVENUE.map((d,i)=>(<div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:6,height:'100%',justifyContent:'flex-end'}}>
              <div style={{width:'100%',maxWidth:20,height:`${(d.value/max)*100}%`,borderRadius:6,background:d.hi?'#fff':'rgba(255,255,255,.32)'}}/>
              <div style={{fontSize:10,color:'rgba(255,255,255,.8)'}}>{d.label}</div></div>))}
          </div>
        </div>
        <div className="grid g2" style={{gap:12}}>
          <MStat icon="briefcase" tone="indigo" val="38" lbl="进行中" dir="up" t="+5"/>
          <MStat icon="alert" tone="rose" val="$21.4k" lbl="未付" dir="down" t="3.1%"/>
        </div>
        <div className="card">
          <div className="card-hd"><div style={{display:'flex',alignItems:'center',gap:8}}><h3 style={{fontSize:15}}>补件队列</h3>
            <span className="chip" style={{background:'var(--rose-50)',color:'var(--rose)'}}>3 紧急</span></div></div>
          <div className="stack">
            {APR_M.map((a,i)=>(
              <div className="row" key={i} style={{padding:'11px 0'}}>
                <AvM name={a.name} size={38}/>
                <div className="grow"><div className="nm" style={{fontSize:13.5}}>{a.name}</div><div className="ns">{a.kind} · {a.visa}</div></div>
                <div className="appr"><button className="mini ok"><IcM name="check" size={16}/></button><button className="mini no"><IcM name="x" size={14}/></button></div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <TabBar active={3}/>
    </div>
  );
}

/* C — 数字优先 + 仪表 + 分段 */
function MobileC(){
  const sum=STG_M.reduce((a,d)=>a+d.value,0);
  return (
    <div className="m-shell">
      <StatusBar/>
      <MHeader title="工作台" sub="6 月 1 日 · 周日"/>
      <div className="m-scroll">
        <div className="grid g2" style={{gap:12}}>
          <MNum val="38" lbl="进行中案件" accent="var(--brand)" dir="up" t="2.5%"/>
          <MNum val="12" lbl="待办事项" accent="var(--sky)" dir="up" t="3 件"/>
          <MNum val="$48.6k" lbl="本月收款" accent="var(--emerald)" dir="up" t="8.2%"/>
          <MNum val="6" lbl="临近到期" accent="var(--amber)" dir="flat" t="本周"/>
        </div>
        <div className="card" style={{alignItems:'center',display:'flex',flexDirection:'column'}}>
          <div className="card-hd" style={{width:'100%'}}><div><h3 style={{fontSize:15}}>本月目标完成度</h3><div className="hsub">目标 $64,000</div></div></div>
          <GaugeM value={76} label="76%" sub="$48.6k / $64k" size={200}/>
        </div>
        <div className="card">
          <div className="card-hd"><h3 style={{fontSize:15}}>案件阶段分布</h3></div>
          <div className="seg">{STG_M.map((d,i)=>(<span key={i} style={{flex:d.value,background:d.color}}/>))}</div>
          <div className="legend" style={{marginTop:16,gap:11}}>
            {STG_M.map((d,i)=>(<div className="lr" key={i}><span className="ld" style={{background:d.color}}/>
              <span className="ln" style={{fontSize:12.5}}>{d.name}</span><span className="lp">{Math.round(d.value/sum*100)}%</span>
              <span className="lv" style={{marginLeft:10}}>{d.value}</span></div>))}
          </div>
        </div>
      </div>
      <TabBar active={0}/>
    </div>
  );
}

function MStat({ icon, tone, val, lbl, dir, t }){
  return (
    <div className="card" style={{padding:15}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <WellM name={icon} tone={tone} size={40}/>
        <span className={`trend ${dir}`} style={{fontSize:11}}>{dir==='up'?<IcM name="trendUp" size={11}/>:dir==='down'?<IcM name="trendDown" size={11}/>:null}{t}</span>
      </div>
      <div style={{fontSize:23,fontWeight:700,color:'var(--ink)',marginTop:12,fontVariantNumeric:'tabular-nums',letterSpacing:'-.02em'}}>{val}</div>
      <div style={{fontSize:12,color:'var(--muted)',marginTop:2}}>{lbl}</div>
    </div>
  );
}
function MNum({ val, lbl, accent, dir, t }){
  return (
    <div className="card" style={{padding:15,position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',left:0,top:15,bottom:15,width:4,borderRadius:99,background:accent}}></div>
      <div style={{paddingLeft:8}}>
        <div style={{fontSize:26,fontWeight:700,color:'var(--ink)',lineHeight:1,fontVariantNumeric:'tabular-nums',letterSpacing:'-.02em'}}>{val}</div>
        <div style={{display:'flex',alignItems:'center',gap:6,marginTop:10}}>
          <span style={{fontSize:11.5,color:'var(--muted)'}}>{lbl}</span>
          <span className={`trend ${dir}`} style={{marginLeft:'auto',fontSize:10,padding:'2px 6px'}}>{t}</span>
        </div>
      </div>
    </div>
  );
}
Object.assign(window,{ MobileA, MobileB, MobileC });
