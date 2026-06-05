/* 签证 CRM 产品原型 — 外壳、路由与页面 */
const { Icon, Avatar, NameCell, Pill, Well, Donut, BarChart, Spark, MoneyAmt,
  STAGE, STAGE_ORDER, FAMILIES, CASES, DETAIL, FIN, LayoutABody } = window;

/* ── 阶段徽标 ───────────────────────────────────────────────────────── */
function StageBadge({ stage }){
  const s = STAGE[stage] || { l:stage, t:'slate' };
  return <Pill tone={s.t} dot={false}>{s.l}</Pill>;
}
const money = (n)=> (n<0?'−':'')+'$'+Math.abs(n).toLocaleString('en-US');

/* ── 导航 ───────────────────────────────────────────────────────────── */
const ROUTES = [
  { ic:'home', label:'概览', hash:'#/' },
  { ic:'users', label:'客户', hash:'#/customers' },
  { ic:'briefcase', label:'案件', hash:'#/cases', badge:'7' },
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
  return (
    <AppShell active="#/customers" title="客户" sub="按家庭分组 · 主申与副申连成一组" actionLabel="新建客户" topSearch={false} width="route-sm">
      <div className="searchbar" style={{marginBottom:18}}><Icon name="search" size={19}/><input placeholder="搜索姓名 / 电话 / 邮箱"/></div>
      <div className="stack" style={{gap:14}}>
        {FAMILIES.map((g,i)=>(
          <div className="fam" key={i}>
            <CustomerRow c={g.primary}/>
            {g.subs.map((s,j)=><CustomerRow key={j} c={s} sub/>)}
          </div>
        ))}
      </div>
    </AppShell>
  );
}

/* ════════════════ 案件列表 ════════════════ */
function CasesPage(){
  return (
    <AppShell active="#/cases" title="案件" sub="全部进行中案件 · 共 38 件" actionLabel="新建案件" width="route-md">
      <div style={{display:'flex',gap:12,marginBottom:18,alignItems:'center'}}>
        <div className="searchbar" style={{flex:1}}><Icon name="search" size={19}/><input placeholder="搜索客户 / 签证类别 / 雇主"/></div>
        <button className="btn btn-ghost"><Icon name="filter" size={18}/>筛选</button>
      </div>
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
  if(hash.startsWith('#/customers')) return <CustomersPage/>;
  if(hash.startsWith('#/cases/detail')) return <CaseDetailPage/>;
  if(hash.startsWith('#/cases')) return <CasesPage/>;
  if(hash.startsWith('#/finance')) return <FinancePage/>;
  if(hash.startsWith('#/employers')) return <PlaceholderPage active="#/employers" title="雇主"/>;
  if(hash.startsWith('#/referrers')) return <PlaceholderPage active="#/referrers" title="介绍人"/>;
  if(hash.startsWith('#/archive')) return <PlaceholderPage active="#/archive" title="档案库"/>;
  return <DashboardPage/>;
}
window.CRMRouter = Router;
