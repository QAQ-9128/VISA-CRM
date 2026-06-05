/* 签证 CRM 产品原型 — 外壳、路由与页面 */
const { Icon, Avatar, NameCell, Pill, Well, Donut, BarChart, Spark, MoneyAmt,
  STAGE, STAGE_ORDER, FAMILIES, CASES, DETAIL, FIN, LayoutABody } = window;

/* ── 阶段徽标 ───────────────────────────────────────────────────────── */
function StageBadge({ stage }){
  const s = STAGE[stage] || { l:stage, t:'slate' };
  return <Pill tone={s.t} dot={false}>{s.l}</Pill>;
}
const money = (n)=> (n<0?'−':'')+'$'+Math.abs(n).toLocaleString('en-US');

/* ── 递交进度数据 + 表格(保留全列、提名/签证分色)──────────────────── */
const LODGE_ROWS = [
  {name:'钱超萍',id:'83225861',sub:'',visa:'482',stream:'Core Skills',stage:'nomination_approved',nd:'2026-05-20',nm:0.4,nt:'12 天',vd:'',vm:null,vt:''},
  {name:'耿中逸',id:'58677599',sub:'',visa:'186',stream:'TRT 转永居',stage:'visa_lodged',nd:'2026-02-10',nm:3.6,nt:'3 个月 18 天',vd:'2026-04-10',vm:1.7,vt:'1 个月 22 天'},
  {name:'刘婉蓉',id:'86431817',sub:'张佳馨',visa:'482',stream:'Core Skills',stage:'nomination_approved',nd:'2026-03-30',nm:2.1,nt:'2 个月 3 天',vd:'',vm:null,vt:''},
  {name:'李旻书',id:'84003712',sub:'',visa:'482',stream:'Core Skills',stage:'visa_lodged',nd:'2025-10-13',nm:null,nt:'已获批',vd:'2026-02-13',vm:3.6,vt:'3 个月 18 天',note:'下签后 再带副申请',nlev:'warn'},
  {name:'宇伟峰',id:'28281696',sub:'',visa:'186',stream:'Direct Entry',stage:'visa_lodged',nd:'2025-09-20',nm:null,nt:'已获批',vd:'2026-02-06',vm:3.8,vt:'3 个月 25 天'},
  {name:'卓晓娜',id:'74322513',sub:'彭宇馨',visa:'482',stream:'Core Skills',stage:'granted',nd:'2025-08-01',nm:null,nt:'已获批',vd:'2026-01-07',vm:null,vt:'已下签'},
  {name:'朱潜曦',id:'47622513',sub:'',visa:'186',stream:'Direct Entry',stage:'nomination_lodged',nd:'2025-12-10',nm:5.8,nt:'5 个月 23 天',vd:'',vm:null,vt:''},
  {name:'汤馨乐',id:'37924506',sub:'',visa:'407',stream:'培训签',stage:'visa_lodged',nd:'2025-06-01',nm:null,nt:'已获批',vd:'2025-12-01',vm:6.1,vt:'6 个月 2 天'},
  {name:'郭琳娜',id:'31270578',sub:'',visa:'407',stream:'培训签',stage:'visa_lodged',nd:'2025-05-15',nm:null,nt:'已获批',vd:'2025-11-15',vm:6.6,vt:'6 个月 18 天',note:'学历未满足签证要求',nlev:'crit'},
  {name:'黄玉婷',id:'45838097',sub:'',visa:'186',stream:'Direct Entry',stage:'visa_lodged',nd:'2025-05-03',nm:null,nt:'已获批',vd:'2025-11-03',vm:7.0,vt:'7 个月 0 天'},
  {name:'王璞',id:'17346895',sub:'吕列隆',visa:'482',stream:'',stage:'todo',nd:'',nm:null,nt:'',vd:'',vm:null,vt:''},
  {name:'邓韬 (Dylan)',id:'46028806',sub:'',visa:'482',stream:'Subsequent',stage:'todo',nd:'',nm:null,nt:'',vd:'',vm:null,vt:''},
];
const LODGE_REF = 8;
const wcol = (m)=> m<3?'#10b981':m<6?'#f59e0b':'#f43f5e';
function Ago({ m, t }){
  if(!t) return <span className="none">—</span>;
  if(m==null) return <span className="done">✓ {t}</span>;
  const c=wcol(m), pct=Math.min(100,Math.round(m/LODGE_REF*100));
  return <div className="ago"><div className="at" style={{color:c}}>{t}</div><div className="ab"><span style={{width:pct+'%',background:c}}/></div></div>;
}
const Dt = ({d})=> d ? <span className="dt">{d}</span> : <span className="none">—</span>;
const NLEV = { warn:['#c87f06','⚠️'], crit:['#e11d48','‼️'], info:['#6b7589','💬'] };
function Note({ r }){
  if(!r.note) return <span className="none">—</span>;
  const [c,mk] = NLEV[r.nlev] || NLEV.info;
  return <span style={{display:'inline-flex',alignItems:'flex-start',gap:6,fontSize:12.5,fontWeight:600,color:c,whiteSpace:'normal',maxWidth:210,lineHeight:1.35}}><span style={{flex:'none'}}>{mk}</span>{r.note}</span>;
}

function LodgementTable(){
  return (
    <div className="card card-pad0" style={{overflow:'hidden'}}>
      <div className="ltwrap">
        <table className="ltbl">
          <thead>
            <tr>
              <th className="c-id">案件编号</th>
              <th className="c-main">主申请</th>
              <th>副申请</th>
              <th>签证类型</th>
              <th>状态</th>
              <th className="g-split tn">提名递交时间</th>
              <th className="tn">提名距今</th>
              <th className="g-split tv">签证递交时间</th>
              <th className="tv">签证距今</th>
              <th className="g-split">待办</th>
            </tr>
          </thead>
          <tbody>
            {LODGE_ROWS.map((r,i)=>{
              const todo = r.stage==='todo';
              return (
                <tr key={i} className={todo?'todo':''} style={{cursor:'pointer'}} onClick={()=>go('#/cases/detail')}>
                  <td className="c-id"><span className="idlink">{r.id}</span></td>
                  <td className="c-main"><div className="who"><Avatar name={r.name} size={34}/><span className="nm">{r.name}</span></div></td>
                  <td>{r.sub ? <span className="subc"><Avatar name={r.sub} size={28}/>{r.sub}</span> : <span className="none">—</span>}</td>
                  <td className="vt"><b>{r.visa}</b><span>{r.stream||'—'}</span></td>
                  <td><StageBadge stage={r.stage}/></td>
                  <td className="g-split tn">{todo ? <span className="waitchip">待递交</span> : <Dt d={r.nd}/>}</td>
                  <td className="tn">{todo ? null : <Ago m={r.nm} t={r.nt}/>}</td>
                  <td className="g-split tv"><Dt d={r.vd}/></td>
                  <td className="tv"><Ago m={r.vm} t={r.vt}/></td>
                  <td className="g-split" style={{minWidth:160}}><Note r={r}/></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── 导航 ───────────────────────────────────────────────────────────── */
const ROUTES = [
  { ic:'home', label:'概览', hash:'#/' },
  { ic:'clipboard', label:'待办', hash:'#/todos', badge:'7' },
  { ic:'users', label:'客户', hash:'#/customers' },
  { ic:'briefcase', label:'案件', hash:'#/cases' },
  { ic:'wallet', label:'财务', hash:'#/finance' },
  { ic:'building', label:'雇主', hash:'#/employers' },
  { ic:'userplus', label:'介绍人', hash:'#/referrers' },
  { ic:'archive', label:'档案库', hash:'#/archive' },
];
function go(hash){ window.location.hash = hash; }

function AppSidebar({ active }){
  return (
    <aside className="side">
      <div className="side-brand">
        <span className="side-logo"><Icon name="shield" size={21}/></span>
        <div><div className="bt">签证 CRM</div><div className="bs">移民事务工作台</div></div>
      </div>
      <nav className="nav">
        <div className="nav-lbl">主菜单</div>
        {ROUTES.map((n,i)=>(
          <div key={i} className={`nav-item ${active===n.hash?'on':''}`} onClick={()=>go(n.hash)}>
            <Icon name={n.ic} size={21}/><span>{n.label}</span>
            {n.badge && <span className="badge">{n.badge}</span>}
          </div>
        ))}
      </nav>
      <div className="side-foot">
        <Avatar name="Amy" size={36}/>
        <div style={{minWidth:0}}><div className="nm">Amy Chen</div><div className="rl">注册移民代理</div></div>
      </div>
    </aside>
  );
}

/* ── 外壳 ───────────────────────────────────────────────────────────── */
function AppShell({ active, title, sub, actionLabel, onAction, topSearch=true, width='route-md', children }){
  return (
    <div className="app">
      <AppSidebar active={active}/>
      <div className="main">
        <div className="topbar">
          <div className="greet"><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
          <div className="sp"></div>
          {topSearch && <div className="search"><Icon name="search" size={18}/><input placeholder="搜索客户 / 案件 / 参考号"/></div>}
          <button className="iconbtn"><Icon name="bell" size={20}/><span className="dot"></span></button>
          {actionLabel && <button className="btn btn-primary" onClick={onAction}><Icon name="plus" size={18}/>{actionLabel}</button>}
        </div>
        <div className="scroll"><div className={`route ${width}`}>{children}</div></div>
      </div>
    </div>
  );
}

/* ════════════════ 概览 ════════════════ */
function DashboardPage(){
  return (
    <AppShell active="#/" title={<span>早上好,Amy <span style={{marginLeft:2}}>👋</span></span>}
      sub="今天有 3 件待办、2 个临近到期提醒 · 本月已收款 $48,600" actionLabel="新建客户" width="route-wide">
      <div className="stack" style={{gap:20}}><LayoutABody/></div>
    </AppShell>
  );
}

/* ════════════════ 客户列表 ════════════════ */
function CustomerRow({ c, sub }){
  const cls = c.debt==='owe'?'owe':c.debt==='paid'?'paid':'';
  const srcCls = c.source==='red'?'src-black':c.source==='green'?'src-green':'src-yellow';
  return (
    <div className={`crow ${sub?'sub':''}`} onClick={()=>go('#/cases/detail')}>
      {sub && <span className="conn">└─</span>}
      <button className={`star ${c.star?'on':''}`} onClick={(e)=>e.stopPropagation()}><Icon name="star" size={18}/></button>
      <Avatar name={c.name} size={sub?34:40}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <span className={`cname ${cls}`}>{c.name}</span>
          <span className={`src-dot ${srcCls}`}></span>
          {sub && c.rel && <span className="rel">{c.rel}</span>}
          {c.linked && <span className="tag-ind">↗ 独立档案</span>}
        </div>
        {(c.cases||[]).length===0
          ? <div className="caseline faint">暂无案件</div>
          : (c.cases||[]).map((cs,i)=>(
            <div className="caseline" key={i}>
              <span>{cs.visa}</span>
              {cs.pos && <><span className="sep">|</span><span>{cs.pos}</span></>}
              {cs.emp && <><span className="sep">|</span><span>{cs.emp}</span></>}
              <span className="sep">|</span><StageBadge stage={cs.stage}/>
            </div>
          ))}
      </div>
      <Icon name="chevron" size={16} stroke="var(--slate-300)"/>
    </div>
  );
}
function CustomersPage(){
  const [view,setView] = React.useState('board');
  return (
    <AppShell active="#/customers" title="客户" sub="追踪并管理客户关系 · 按案件阶段查看销售渠道" actionLabel="新建客户" onAction={()=>go('#/customers/new')} topSearch={false} width={view==='board'?'route-wide':'route-sm'}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18,flexWrap:'wrap'}}>
        <div className="tabs">
          <button className={`t ${view==='board'?'on':''}`} onClick={()=>setView('board')}>看板</button>
          <button className={`t ${view==='list'?'on':''}`} onClick={()=>setView('list')}>列表</button>
        </div>
        <div className="sp" style={{flex:1}}></div>
        <div className="toolbar-icons">
          <button className="iconbtn" title="筛选"><Icon name="filter" size={19}/></button>
          <button className="iconbtn" title="搜索"><Icon name="search" size={19}/></button>
        </div>
      </div>

      {view==='board' ? <CustomerBoard/> : (
        <div className="stack" style={{gap:14}}>
          {FAMILIES.map((g,i)=>(
            <div className="fam" key={i}>
              <CustomerRow c={g.primary}/>
              {g.subs.map((s,j)=><CustomerRow key={j} c={s} sub/>)}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

const KSTAGES = [
  { key:'待办', color:'#94a3b8', tint:'#f3f5f8' },
  { key:'提名递交', color:'#3b82f6', tint:'#eef4ff' },
  { key:'提名获批', color:'#0891b2', tint:'#e7f6fb' },
  { key:'要求补件', color:'#f59e0b', tint:'#fff7e9' },
  { key:'签证递交', color:'#6366f1', tint:'#eeeffe' },
  { key:'下签', color:'#10b981', tint:'#e9faf2' },
];
const KCARDS = [
  { name:'李娜', visa:'482 Subsequent', emp:'', pos:'配偶副申', stage:'待办', source:'green', owe:0 },
  { name:'测试客户', visa:'482', emp:'', pos:'', stage:'待办', source:'', owe:0 },
  { name:'张伟', visa:'482 Core Skills', emp:'金煌餐饮集团', pos:'厨师', stage:'提名递交', source:'green', owe:1200 },
  { name:'朱潜曦', visa:'186 Direct Entry', emp:'', pos:'', stage:'提名递交', source:'red', owe:0 },
  { name:'周婷', visa:'482 提名', emp:'悉尼贸易', pos:'市场专员', stage:'提名获批', source:'red', owe:4500 },
  { name:'钱超萍', visa:'482 Core Skills', emp:'', pos:'', stage:'提名获批', source:'green', owe:0 },
  { name:'陈静', visa:'500 学生签', emp:'', pos:'', stage:'要求补件', source:'yellow', owe:2500 },
  { name:'王强', visa:'186 永居', emp:'澳信科技', pos:'IT 经理', stage:'签证递交', source:'red', owe:0, paid:true },
  { name:'耿中逸', visa:'186 TRT', emp:'', pos:'', stage:'签证递交', source:'green', owe:0 },
  { name:'郭琳娜', visa:'407 培训签', emp:'', pos:'', stage:'签证递交', source:'green', owe:0 },
  { name:'刘洋', visa:'189 独立技术', emp:'', pos:'', stage:'下签', source:'green', owe:0, paid:true },
  { name:'Sarah Chen', visa:'485 毕业生工签', emp:'', pos:'', stage:'下签', source:'yellow', owe:0 },
  { name:'卓晓娜', visa:'482 Core Skills', emp:'', pos:'', stage:'下签', source:'green', owe:0, paid:true },
];
function KCard({ c }){
  const srcCls = c.source==='red'?'src-black':c.source==='green'?'src-green':c.source==='yellow'?'src-yellow':'';
  const sub = [c.emp,c.pos].filter(Boolean).join(' · ');
  return (
    <div className="kcard" onClick={()=>go('#/cases/detail')}>
      <div className="kh">
        <Avatar name={c.name} size={34}/>
        <span className="kn">{c.name}</span>
        {c.source && <span className={`src-dot ${srcCls}`} style={{marginLeft:'auto'}}></span>}
      </div>
      <div><span className="ktag">{c.visa}</span></div>
      {sub && <div className="ksub">{sub}</div>}
      <div className="kf">
        <span className="ksrc">{c.source==='red'?'公司派的':c.source==='green'?'自己的':c.source==='yellow'?'帮带的':'未分类'}</span>
        {c.owe>0 ? <span className="kowe">欠 ${c.owe.toLocaleString('en-US')}</span> : c.paid ? <span className="kpaid">已结清</span> : null}
      </div>
    </div>
  );
}
function CustomerBoard(){
  return (
    <div className="board">
      {KSTAGES.map((s,i)=>{
        const cards = KCARDS.filter(c=>c.stage===s.key);
        return (
          <div className="col" key={i} style={{background:s.tint}}>
            <div className="col-hd"><span className="cdot" style={{background:s.color}}></span>{s.key}<span className="cct">{cards.length}</span></div>
            {cards.map((c,j)=><KCard key={j} c={c}/>)}
            <div style={{textAlign:'center',color:'var(--faint)',fontSize:12.5,fontWeight:600,padding:'6px 0',cursor:'pointer'}}>+ 添加</div>
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════ 案件列表 ════════════════ */
function CasesPage(){
  const [view, setView] = React.useState('list');
  return (
    <AppShell active="#/cases" title="案件" sub="全部进行中案件 · 共 38 件" actionLabel="新建案件" width={view==='lodge'?'route-wide':'route-md'}>
      <div style={{display:'flex',gap:12,marginBottom:18,alignItems:'center',flexWrap:'wrap'}}>
        <div className="tabs">
          <button className={`t ${view==='list'?'on':''}`} onClick={()=>setView('list')}>案件列表</button>
          <button className={`t ${view==='lodge'?'on':''}`} onClick={()=>setView('lodge')}>递交进度</button>
        </div>
        <div className="searchbar" style={{flex:1,minWidth:220}}><Icon name="search" size={19}/><input placeholder="搜索客户 / 签证类别 / 雇主"/></div>
        <button className="btn btn-ghost"><Icon name="filter" size={18}/>筛选</button>
      </div>
      {view==='lodge' ? <LodgementTable/> : (
      <div className="card card-pad0">
        <div style={{overflowX:'auto'}}>
          <table className="tbl">
            <thead><tr><th>客户</th><th>签证类别</th><th>担保雇主</th><th>当前阶段</th><th>最近更新</th><th></th></tr></thead>
            <tbody>
              {CASES.map((c,i)=>(
                <tr key={i} style={{cursor:'pointer'}} onClick={()=>go('#/cases/detail')}>
                  <td><NameCell name={c.name} sub={c.stream||undefined} size={36}/></td>
                  <td style={{color:'var(--body)',fontWeight:600}}>{c.visa}</td>
                  <td style={{color:'var(--muted)'}}>{c.emp}</td>
                  <td>{c.urgent && <span style={{marginRight:6}} title="紧急">🔴</span>}<StageBadge stage={c.stage}/></td>
                  <td className="tnum" style={{color:'var(--faint)'}}>{c.updated}</td>
                  <td className="num"><Icon name="chevron" size={16} stroke="var(--slate-300)"/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </AppShell>
  );
}

/* ════════════════ 案件详情 ════════════════ */
function Card({ title, sub, action, children, pad=true }){
  return (
    <div className={`card ${pad?'':'card-pad0'}`} style={pad?null:{padding:0}}>
      {title && <div className="card-hd" style={pad?null:{padding:'22px 22px 0'}}>
        <div><h3>{title}</h3>{sub && <div className="hsub">{sub}</div>}</div>
        {action}
      </div>}
      {children}
    </div>
  );
}
function CaseDetailPage(){
  const d = DETAIL;
  const curIdx = STAGE_ORDER.indexOf(d.currentStage);
  return (
    <AppShell active="#/cases" title={<span>{d.visaLabel} 签证</span>}
      sub={<span>客户:{d.customer} · {d.employer} · {d.position} · {d.country}</span>}
      actionLabel="编辑案件" width="route-md">
      <div className="back" onClick={()=>go('#/cases')}><Icon name="chevron" size={15} style={{transform:'rotate(180deg)'}}/>返回案件列表</div>

      {/* TRT 提醒(此案未下签,展示一个进度提示替代)*/}
      <div className="banner banner-warn" style={{marginBottom:20}}>
        <span className="bic"><Icon name="clock" size={18}/></span>
        <span>提名已于 2025-05-18 递交,正在等待移民局审批。当前处理约 14 / 120 天,可在「递交进度」查看详情。</span>
      </div>

      <div className="grid g2" style={{gap:20,alignItems:'stretch'}}>
        {/* 阶段控制 */}
        <Card title="案件阶段" sub="点击推进到下一阶段">
          <div className="stagebig"><StageBadge stage={d.currentStage}/><span className="sv">{STAGE[d.currentStage].l}</span></div>
          <div className="stepper">
            {STAGE_ORDER.map((s,i)=>(<span key={i} className={`step ${i<curIdx?'done':i===curIdx?'cur':''}`}/>))}
          </div>
          <div className="step-labels"><span>待办</span><span>提名</span><span>签证</span><span>下签</span></div>
          <div style={{display:'flex',gap:10,marginTop:18}}>
            <button className="btn btn-primary" style={{flex:1}}>推进到「提名获批」<Icon name="chevron" size={15}/></button>
            <button className="btn btn-ghost">回退</button>
          </div>
        </Card>

        {/* 阶段时间线 */}
        <Card title="阶段时间线">
          <div className="timeline" style={{marginTop:4}}>
            {[...d.timeline].reverse().map((t,i,arr)=>{
              const isCur = t.cur;
              return (
                <div className="tl-row" key={i}>
                  <div className="tl-rail"></div>
                  <span className={`tl-dot ${isCur?'cur':'done'}`}></span>
                  <div className="tl-body">
                    <div className="tn">{STAGE[t.stage].l}</div>
                    <div className="td">{t.date} · {t.note}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* 递交进度 */}
      <Card title="递交进度" sub="提名 / 签证" >
        <div className="grid g2" style={{gap:14}}>
          {d.lodgements.map((l,i)=>{
            const pct = l.total? Math.min(100,Math.round(l.elapsed/l.total*100)):0;
            return (
              <div className="lodge" key={i}>
                <div className="lodge-top">
                  <span style={{fontSize:15,fontWeight:700,color:'var(--ink)'}}>{l.type}递交</span>
                  {l.date ? <Pill tone={l.outcomeT} dot={false}>审批中</Pill> : <Pill tone="slate" dot={false}>未开始</Pill>}
                </div>
                {l.date ? (<>
                  <div style={{fontSize:12.5,color:'var(--faint)'}}>递交日期 {l.date}</div>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginTop:6}}>
                    <span className="bar"><span style={{width:pct+'%',background:'var(--brand)'}}/></span>
                    <span className="tnum" style={{fontSize:12,color:'var(--faint)',whiteSpace:'nowrap'}}>{l.elapsed}/{l.total} 天</span>
                  </div>
                </>) : <div style={{fontSize:12.5,color:'var(--faint)'}}>提名获批后开始</div>}
              </div>
            );
          })}
        </div>
      </Card>

      {/* 双流账目 */}
      <Card title="账目" sub="双流:向客户收款 / 付主代理"
        action={<span className="link" onClick={()=>go('#/finance')}>财务页<Icon name="chevron" size={14}/></span>}>
        <div className="flow" style={{marginBottom:16}}>
          <div className="flowcard flow-in">
            <div className="fl">客户应收 / 已收</div>
            <div className="fv">{money(d.pay.received)} <span style={{fontSize:15,color:'var(--faint)',fontWeight:600}}>/ {money(d.pay.billed)}</span></div>
            <div className="fmeta">还欠 <b style={{color:'var(--rose)'}}>{money(d.pay.owe)}</b></div>
          </div>
          <div className="flowcard flow-out">
            <div className="fl">应付主代理 / 已付</div>
            <div className="fv">{money(d.pay.toCompanyPaid)} <span style={{fontSize:15,color:'var(--faint)',fontWeight:600}}>/ {money(d.pay.toCompanyBilled)}</span></div>
            <div className="fmeta">已结清</div>
          </div>
        </div>
        <div>
          {d.pay.txns.map((p,i)=>(
            <div className="txn" key={i}>
              <Well name={p.amount>=0?'banknote':'wallet'} tone={p.amount>=0?'emerald':'amber'} size={40}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:600,color:'var(--ink)'}}>{p.fee}</div>
                <div style={{fontSize:12,color:'var(--faint)'}}>{p.date} · {p.method}</div>
              </div>
              <Pill tone={p.dirT} dot={false}>{p.dir}</Pill>
              <MoneyAmt amount={p.amount} signed/>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid g2" style={{gap:20}}>
        {/* 文档 */}
        <Card title="文档" sub="到期监控" action={<span className="link">上传<Icon name="plus" size={14}/></span>}>
          {d.docs.map((doc,i)=>(
            <div className="doc" key={i}>
              <Well name="doc" tone={doc.status==='warn'?'rose':'indigo'} size={40}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:600,color:'var(--ink)'}}>{doc.name}</div>
                <div style={{fontSize:12,color:'var(--faint)'}}>{doc.type}</div>
              </div>
              {doc.expiry && <Pill tone={doc.status==='warn'?'rose':'slate'} dot={false}>{doc.expiry}</Pill>}
            </div>
          ))}
        </Card>

        {/* 记录 */}
        <Card title="待办 / 跟进" action={<span className="link">添加<Icon name="plus" size={14}/></span>}>
          {d.records.map((r,i)=>(
            <div className="rec" key={i}>
              {r.type==='task'
                ? <span className={`check ${r.done?'on':''}`}>{r.done && <Icon name="check" size={13}/>}</span>
                : <span className="rmk">{r.emoji}</span>}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:r.type==='task'?600:500,color:r.done?'var(--faint)':'var(--ink)',textDecoration:r.done?'line-through':'none'}}>{r.text}</div>
                <div style={{fontSize:12,color:'var(--faint)'}}>{r.type==='task'?('待办 · '+r.due):('跟进 · '+r.date)}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>

      <div style={{display:'flex',gap:12,paddingTop:4}}>
        <button className="btn btn-ghost">归档案件</button>
        <button className="btn btn-ghost" style={{color:'var(--rose)'}}>彻底删除</button>
      </div>
    </AppShell>
  );
}

/* ════════════════ 财务 ════════════════ */
function FinancePage(){
  const f = FIN;
  return (
    <AppShell active="#/finance" title="财务" sub="应收快照 + 月度收付明细" width="route-md">
      {/* 近期案件应收 */}
      <Card title="近期案件应收" sub="当下应收状态,与月份筛选无关" pad={false}>
        <div style={{overflowX:'auto'}}>
          <table className="tbl">
            <thead><tr><th>客户</th><th>签证</th><th className="num">应收</th><th className="num">已收</th><th className="num">欠款</th><th>状态</th></tr></thead>
            <tbody>
              {f.receivables.map((r,i)=>(
                <tr key={i}>
                  <td><NameCell name={r.name} size={34}/></td>
                  <td style={{color:'var(--muted)'}}>{r.visa}</td>
                  <td className="num tnum" style={{color:'var(--body)'}}>{money(r.billed)}</td>
                  <td className="num tnum" style={{color:'var(--emerald)'}}>{money(r.received)}</td>
                  <td className="num tnum" style={{color:r.owe>0?'var(--rose)':'var(--faint)',fontWeight:r.owe>0?700:400}}>{r.owe>0?money(r.owe):'—'}</td>
                  <td>{r.owe>0?<Pill tone="rose" dot={false}>欠款</Pill>:<Pill tone="emerald" dot={false}>已结清</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 月度账目 */}
      <Card title="月度账目" sub="2025 年 5 月"
        action={<div className="tabs"><button className="t on">本月</button><button className="t">上月</button><button className="t">全部</button></div>}>
        <div className="totbar" style={{marginBottom:20}}>
          <div className="tot"><div className="tl">本月总收款</div><div className="tv" style={{color:'var(--emerald)'}}>{money(f.totals.income)}</div></div>
          <div className="tot"><div className="tl">本月总支出</div><div className="tv" style={{color:'var(--amber)'}}>{money(f.totals.expense)}</div></div>
          <div className="tot"><div className="tl">净额</div><div className="tv" style={{color:'var(--ink)'}}>{money(f.totals.net)}</div></div>
        </div>

        <div className="grid g2" style={{gap:24}}>
          <div>
            <div style={{fontSize:13.5,fontWeight:700,color:'var(--body)',marginBottom:6}}>收款明细(客户付款)</div>
            {f.receipts.map((p,i)=>(
              <div className="txn" key={i}>
                <Avatar name={p.name} size={36}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13.5,fontWeight:600,color:'var(--ink)'}}>{p.name} · {p.fee}</div>
                  <div style={{fontSize:12,color:'var(--faint)'}}>{p.date} · {p.method}</div>
                </div>
                <MoneyAmt amount={p.amount} signed/>
              </div>
            ))}
          </div>
          <div>
            <div style={{fontSize:13.5,fontWeight:700,color:'var(--body)',marginBottom:6}}>支出(付主代理 · 付介绍人)</div>
            {f.payouts.map((p,i)=>(
              <div className="txn" key={i}>
                <Well name="wallet" tone={p.dir==='referrer'?'violet':'amber'} size={36}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13.5,fontWeight:600,color:'var(--ink)'}}>{p.label}</div>
                  <div style={{fontSize:12,color:'var(--faint)'}}>{p.date} · {p.method}</div>
                </div>
                <MoneyAmt amount={-p.amount} signed/>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </AppShell>
  );
}

/* ════════════════ 待办事项 ════════════════ */
const TASK_GROUPS = [
  { bucket:'逾期', color:'#f43f5e', items:[
    { text:'催陈静补交最新体检报告', who:'陈静', visa:'500', due:'逾期 2 天', urg:'rose' },
  ]},
  { bucket:'今天', color:'#f59e0b', items:[
    { text:'递交张伟提名补充材料', who:'张伟', visa:'482', due:'今天', urg:'amber' },
    { text:'回复王强签证进度邮件', who:'王强', visa:'186', due:'今天', urg:'amber' },
  ]},
  { bucket:'本周', color:'#3b6bff', items:[
    { text:'预约刘洋下签后回访', who:'刘洋', visa:'189', due:'周四', urg:'slate' },
    { text:'整理周婷提名文件', who:'周婷', visa:'482', due:'周五', urg:'slate' },
    { text:'确认孙佳琪补件清单', who:'孙佳琪', visa:'186', due:'周五', urg:'slate' },
  ]},
];
const TASKS_DONE = [
  { text:'递交张伟提名申请', who:'张伟', visa:'482' },
  { text:'收取陈静首期服务费', who:'陈静', visa:'500' },
];
const FOLLOWS = [
  { emoji:'📞', text:'电话沟通:已告知张伟提名进度,客户知悉', who:'张伟', visa:'482', date:'2025-05-28' },
  { emoji:'💬', text:'微信:发送材料清单给陈静', who:'陈静', visa:'500', date:'2025-05-26' },
  { emoji:'✉️', text:'邮件:向王强确认护照续期事宜', who:'王强', visa:'186', date:'2025-05-22' },
  { emoji:'⚠️', text:'刘洋体检即将到期,需提前提醒续做', who:'刘洋', visa:'189', date:'2025-05-20' },
  { emoji:'ℹ️', text:'周婷提名已获批,准备进入签证递交', who:'周婷', visa:'482', date:'2025-05-18' },
];

function LinkChip({ who, visa }){
  return (
    <span onClick={(e)=>{e.stopPropagation();go('#/cases/detail');}}
      style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12,fontWeight:600,color:'var(--muted)',
        background:'var(--surface-2)',border:'1px solid var(--line-2)',borderRadius:999,padding:'2px 9px 2px 3px',cursor:'pointer'}}>
      <Avatar name={who} size={18}/>{who} · {visa}
    </span>
  );
}
function TaskRow({ t }){
  const [done,setDone] = React.useState(false);
  return (
    <div className="rec" style={{padding:'13px 0'}}>
      <span className={`check ${done?'on':''}`} style={{cursor:'pointer'}} onClick={()=>setDone(!done)}>{done && <Icon name="check" size={13}/>}</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,fontWeight:600,color:done?'var(--faint)':'var(--ink)',textDecoration:done?'line-through':'none'}}>{t.text}</div>
        <div style={{marginTop:6}}><LinkChip who={t.who} visa={t.visa}/></div>
      </div>
      {!done && <Pill tone={t.urg} dot={false}>{t.due}</Pill>}
    </div>
  );
}
function TodosPage(){
  const [tab,setTab] = React.useState('task');
  const total = TASK_GROUPS.reduce((a,g)=>a+g.items.length,0);
  return (
    <AppShell active="#/todos" title="待办事项" sub={`跨案件的任务与跟进 · ${total} 项待办`} actionLabel="新建待办" width="route-sm">
      <div className="tabs" style={{marginBottom:18}}>
        <button className={`t ${tab==='task'?'on':''}`} onClick={()=>setTab('task')}>待办任务</button>
        <button className={`t ${tab==='follow'?'on':''}`} onClick={()=>setTab('follow')}>跟进记录</button>
      </div>

      {tab==='task' ? (
        <div className="stack" style={{gap:16}}>
          {TASK_GROUPS.map((g,i)=>(
            <div className="card" key={i}>
              <div className="grp" style={{marginBottom:6}}><span className="gc" style={{background:g.color}}/>{g.bucket}
                <span style={{marginLeft:8,color:'var(--faint)',fontWeight:600}}>{g.items.length}</span></div>
              {g.items.map((t,j)=><TaskRow key={j} t={t}/>)}
            </div>
          ))}
          <div className="card">
            <div className="grp" style={{marginBottom:6}}><span className="gc" style={{background:'var(--emerald)'}}/>已完成
              <span style={{marginLeft:8,color:'var(--faint)',fontWeight:600}}>{TASKS_DONE.length}</span></div>
            {TASKS_DONE.map((t,j)=>(
              <div className="rec" key={j} style={{padding:'13px 0'}}>
                <span className="check on"><Icon name="check" size={13}/></span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:500,color:'var(--faint)',textDecoration:'line-through'}}>{t.text}</div>
                  <div style={{marginTop:6}}><LinkChip who={t.who} visa={t.visa}/></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-hd"><div><h3>跟进记录</h3><div className="hsub">电话 / 微信 / 邮件 / 会议</div></div></div>
          {FOLLOWS.map((f,i)=>(
            <div className="rec" key={i} style={{padding:'14px 0'}}>
              <span className="rmk">{f.emoji}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:500,color:'var(--ink)'}}>{f.text}</div>
                <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6}}>
                  <LinkChip who={f.who} visa={f.visa}/>
                  <span style={{fontSize:12,color:'var(--faint)'}}>{f.date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

/* ════════════════ 新建客户(表单)════════════════ */
function Check({ checked, onChange, children }){
  return (
    <span className="fcheck" onClick={()=>onChange(!checked)}>
      <span className={`fbox ${checked?'on':''}`}>{checked && <Icon name="check" size={13}/>}</span>{children}
    </span>
  );
}
function CustomerFormPage(){
  const [name,setName] = React.useState('');
  const [star,setStar] = React.useState(false);
  const [source,setSource] = React.useState('');
  return (
    <AppShell active="#/customers" title="新建客户" topSearch={false} width="route-sm">
      <div className="back" onClick={()=>go('#/customers')}><Icon name="chevron" size={15} style={{transform:'rotate(180deg)'}}/>客户列表</div>
      <div className="card" style={{maxWidth:660,padding:'28px 30px'}}>
        <div className="form">
          <div className="field">
            <label className="flabel">姓名<span className="req">*</span></label>
            <input className="finput" placeholder="客户姓名" value={name} onChange={e=>setName(e.target.value)}/>
          </div>

          <div className="frow" style={{alignItems:'flex-end',gap:20}}>
            <div className="field" style={{flex:1}}>
              <label className="flabel">客户来源</label>
              <select className="fselect" value={source} onChange={e=>setSource(e.target.value)}>
                <option value="">未分类</option>
                <option value="red">⚫ 黑色(公司派的)</option>
                <option value="green">🟢 绿色(自己的)</option>
                <option value="yellow">🟡 黄色(帮别人擦屁股的)</option>
              </select>
            </div>
            <div style={{paddingBottom:14}}><Check checked={star} onChange={setStar}>标注为优先客户(星标)</Check></div>
          </div>

          <div className="field">
            <label className="flabel">担保雇主</label>
            <div className="frow">
              <select className="fselect"><option>无 / 未指定</option><option>金煌餐饮集团</option><option>澳信科技</option><option>悉尼贸易</option></select>
              <button className="btn btn-ghost" style={{flex:'none'}}><Icon name="plus" size={16}/>新建</button>
            </div>
          </div>

          <div className="field">
            <label className="flabel">担保职位</label>
            <input className="finput" placeholder="如:Senior Cook、Marketing Manager"/>
          </div>

          <div className="field">
            <label className="flabel">介绍人</label>
            <div className="frow">
              <select className="fselect"><option>无 / 未指定</option><option>林老师</option><option>陈姐</option></select>
              <button className="btn btn-ghost" style={{flex:'none'}}><Icon name="plus" size={16}/>新建</button>
            </div>
          </div>

          <fieldset className="fset" style={{margin:0,border:'1px solid var(--line-2)'}}>
            <div className="legend">家庭组 / 主副申请人</div>
            <div className="field">
              <label className="fhint" style={{fontWeight:600,color:'var(--muted)',fontSize:12.5}}>作为副申请人挂靠到(留空 = 本人是主申请人)</label>
              <select className="fselect" style={{marginTop:8}}><option>— 本人是主申请人 —</option><option>张伟 · 482 雇主担保</option><option>王强 · 186 永居</option></select>
            </div>
          </fieldset>

          <div className="fgrid2">
            <div className="field">
              <label className="flabel">生日</label>
              <input className="finput" type="date"/>
            </div>
            <div className="field">
              <label className="flabel">性别</label>
              <select className="fselect"><option>未填</option><option>男</option><option>女</option><option>其他</option></select>
            </div>
          </div>

          <div className="field">
            <label className="flabel">备注</label>
            <textarea className="ftext" placeholder="补充信息、沟通要点、特殊情况…"></textarea>
          </div>

          <div className="fform-foot">
            <button className="btn btn-primary" disabled={!name.trim()}>保存</button>
            <button className="btn btn-ghost" onClick={()=>go('#/customers')}>取消</button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

/* ════════════════ 占位页 ════════════════ */
function PlaceholderPage({ active, title }){
  return (
    <AppShell active={active} title={title} sub="本页正在按统一设计系统重做中" width="route-md">
      <div className="card" style={{padding:'60px 22px'}}>
        <div className="empty">
          <div style={{fontSize:40,marginBottom:12}}>🚧</div>
          <div style={{fontSize:16,fontWeight:700,color:'var(--ink)',marginBottom:6}}>{title} · 即将上线</div>
          <div>这一页会沿用与「概览 / 客户 / 案件 / 财务」相同的设计系统。<br/>告诉我优先做哪个,我就接着上。</div>
        </div>
      </div>
    </AppShell>
  );
}

/* ── 路由 ───────────────────────────────────────────────────────────── */
function Router(){
  const [hash, setHash] = React.useState(window.location.hash || '#/');
  React.useEffect(()=>{
    const on=()=>{ setHash(window.location.hash || '#/'); document.querySelector('.scroll')?.scrollTo(0,0); };
    window.addEventListener('hashchange', on); return ()=>window.removeEventListener('hashchange', on);
  },[]);
  if(hash.startsWith('#/customers/new')) return <CustomerFormPage/>;
  if(hash.startsWith('#/customers')) return <CustomersPage/>;
  if(hash.startsWith('#/todos')) return <TodosPage/>;
  if(hash.startsWith('#/cases/detail')) return <CaseDetailPage/>;
  if(hash.startsWith('#/cases')) return <CasesPage/>;
  if(hash.startsWith('#/finance')) return <FinancePage/>;
  if(hash.startsWith('#/employers')) return <PlaceholderPage active="#/employers" title="雇主"/>;
  if(hash.startsWith('#/referrers')) return <PlaceholderPage active="#/referrers" title="介绍人"/>;
  if(hash.startsWith('#/archive')) return <PlaceholderPage active="#/archive" title="档案库"/>;
  return <DashboardPage/>;
}
window.CRMRouter = Router;
window.CustomerFormPage = CustomerFormPage;
