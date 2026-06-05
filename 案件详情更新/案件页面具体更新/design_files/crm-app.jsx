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
/* ════════════════ 案件详情(5 tab)════════════════ */
const CD_NOM = [
  { date:'2026/06/15', via:'ImmiAccount', no:'NOM-2026-0082', status:'已递交', tone:'emerald', note:'已提交至DHA' },
  { date:'2026/06/10', via:'ImmiAccount', no:'NOM-2026-0082', status:'已草拟', tone:'teal', note:'客户确认前' },
  { date:'2026/06/02', via:'手动/离线准备', no:'—', status:'草稿', tone:'slate', note:'资料准备中' },
];
const CD_REVIEW = [
  { t:'确认提名回执', s:'已完成', tone:'emerald', done:true },
  { t:'准备签证材料', s:'进行中', tone:'blue', done:false },
  { t:'等待DHA反馈', s:'待开始', tone:'slate', done:false },
  { t:'签证结果', s:'待开始', tone:'slate', done:false },
];
const CD_TL = [
  { date:'2026/06/02', stage:'待办', tone:'slate', t:'资料准备', d:'开始准备提名及签证相关材料' },
  { date:'2026/06/10', stage:'已草拟', tone:'teal', t:'提名草拟完成', d:'提名申请草拟完成,等待客户确认' },
  { date:'2026/06/15', stage:'提名递交', tone:'blue', t:'提名已递交至DHA', d:'通过 ImmiAccount 递交,账号/编号:NOM-2026-0082' },
];
const CD_PAYITEMS = [
  { name:'意向金', billed:5000, received:5000, owe:0, status:'已结清', tone:'emerald' },
  { name:'提名递交', billed:8000, received:8000, owe:0, status:'已结清', tone:'emerald' },
  { name:'签证递交', billed:20000, received:15000, owe:5000, status:'分期中', tone:'blue', inst:[
    { no:'第1期', tag:'已到期', billed:7000, received:7000, owe:0, st:'已收', tone:'emerald', due:'2026/03/01' },
    { no:'第2期', tag:'已到期', billed:8000, received:8000, owe:0, st:'已收', tone:'emerald', due:'2026/05/01' },
    { no:'第3期', tag:'未到期', billed:5000, received:0, owe:5000, st:'待收', tone:'amber', due:'2026/07/01' },
  ] },
  { name:'下签尾款', billed:55000, received:0, owe:55000, status:'未开始', tone:'slate' },
];
const CD_RECENT_PAY = [
  { date:'2026/05/15', amt:8000, via:'银行转账', item:'签证递交(第2期)', by:'张雅雯' },
  { date:'2026/03/02', amt:7000, via:'银行转账', item:'签证递交(第1期)', by:'张雅雯' },
  { date:'2026/01/15', amt:8000, via:'信用卡', item:'提名递交', by:'李俊杰' },
];
const CD_FILES = [
  { name:'护照扫描件.pdf', cat:'身份材料', cTone:'blue', date:'2026/06/03', by:'李律师', status:'已归档', sTone:'emerald' },
  { name:'雇主担保信.docx', cat:'雇主材料', cTone:'violet', date:'2026/06/08', by:'李律师', status:'待审核', sTone:'amber' },
  { name:'提名回执.pdf', cat:'提名材料', cTone:'teal', date:'2026/06/15', by:'系统上传', status:'已归档', sTone:'emerald' },
  { name:'补件通知.pdf', cat:'签证材料', cTone:'cyan', date:'2026/06/18', by:'李律师', status:'待处理', sTone:'rose' },
];
const CD_CATS = [['全部',18],['身份材料',4],['雇主材料',5],['提名材料',3],['签证材料',4],['财务文件',2]];
const CD_MISSING = [
  { name:'无犯罪证明', d:'由申请人所在国开具的无犯罪记录证明' },
  { name:'体检回执', d:'指定体检机构出具的体检回执' },
  { name:'银行流水', d:'近 6 个月个人或公司银行流水' },
];
const CD_RECORDS = [
  { date:'2026/06/18', time:'10:25', tag:'客户沟通', tone:'blue', emoji:'💬', t:'客户确认将在下周补充体检回执', by:'李律师' },
  { date:'2026/06/15', time:'16:40', tag:'进展', tone:'emerald', emoji:'📈', t:'提名已提交至DHA,系统已登记回执', by:'李律师' },
  { date:'2026/06/10', time:'14:15', tag:'财务', tone:'violet', emoji:'💲', t:'收到签证递交第2期付款 AUD 5,000', by:'李律师' },
  { date:'2026/06/02', time:'09:30', tag:'进展', tone:'emerald', emoji:'📈', t:'创建案件并进入待办阶段', by:'李律师' },
];
const CD_FOLLOW = [
  { emoji:'💬', tone:'blue', t:'跟进体检回执', d:'客户预计下周补充体检回执', date:'2026/06/25' },
  { emoji:'📄', tone:'emerald', t:'上传最新个人陈述', d:'等待客户提供更新的个人陈述', date:'2026/06/28' },
  { emoji:'💲', tone:'violet', t:'签证递交第3期付款跟进', d:'计划递交前收取第3期付款', date:'2026/07/05' },
];

function CDStat({ icon, bg, fg, label, value, vColor, sub }){
  return (
    <div className="card" style={{padding:'18px 20px'}}>
      <div style={{display:'flex',alignItems:'center',gap:13}}>
        <span style={{width:48,height:48,borderRadius:14,background:bg,color:fg,display:'flex',alignItems:'center',justifyContent:'center',flex:'none'}}><Icon name={icon} size={22}/></span>
        <div style={{minWidth:0}}>
          <div style={{fontSize:13,color:'var(--muted)'}}>{label}</div>
          <div style={{fontSize:20,fontWeight:700,color:vColor||'var(--ink)',marginTop:3,whiteSpace:'nowrap',fontVariantNumeric:'tabular-nums'}}>{value}</div>
          {sub && <div style={{fontSize:11.5,color:'var(--faint)',marginTop:2}}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}
function CDCardHd({ icon, bg, fg, title, action }){
  return <div className="card-hd"><div style={{display:'flex',alignItems:'center',gap:8}}><span className="well" style={{width:32,height:32,borderRadius:9,background:bg,color:fg}}><Icon name={icon} size={17}/></span><h3>{title}</h3></div>{action}</div>;
}

/* ── 递交 tab ── */
function CDSubmission({ d }){
  return (
    <React.Fragment>
      <div className="grid g3" style={{marginBottom:20}}>
        <div className="card" style={{padding:'20px'}}>
          <div style={{display:'flex',justifyContent:'space-between'}}><span className="well" style={{width:42,height:42,borderRadius:12,background:'var(--brand-50)',color:'var(--brand)'}}><Icon name="doc" size={20}/></span><Icon name="chevron" size={16} stroke="var(--slate-300)"/></div>
          <div style={{fontSize:15,fontWeight:700,color:'var(--ink)',marginTop:14}}>提名状态</div>
          <div style={{fontSize:12,color:'var(--faint)',marginTop:6}}>当前状态</div>
          <div style={{fontSize:18,fontWeight:700,color:'#0f9d6e',marginTop:3}}>● 已递交</div>
          <div style={{fontSize:12,color:'var(--faint)',marginTop:8}}>最后更新:2026/06/15</div>
        </div>
        <div className="card" style={{padding:'20px'}}>
          <div style={{display:'flex',justifyContent:'space-between'}}><span className="well" style={{width:42,height:42,borderRadius:12,background:'var(--violet-50)',color:'#7c4ddb'}}><Icon name="users" size={20}/></span><Icon name="chevron" size={16} stroke="var(--slate-300)"/></div>
          <div style={{fontSize:15,fontWeight:700,color:'var(--ink)',marginTop:14}}>签证状态</div>
          <div style={{fontSize:12,color:'var(--faint)',marginTop:6}}>当前状态</div>
          <div style={{fontSize:18,fontWeight:700,color:'#d97706',marginTop:3}}>● 待递交</div>
          <div style={{fontSize:12,color:'var(--faint)',marginTop:8}}>最后更新:—</div>
        </div>
        <div className="card" style={{padding:'20px'}}>
          <div style={{display:'flex',justifyContent:'space-between'}}><span className="well" style={{width:42,height:42,borderRadius:12,background:'var(--brand-50)',color:'var(--brand)'}}><Icon name="clock" size={20}/></span><Icon name="chevron" size={16} stroke="var(--slate-300)"/></div>
          <div style={{fontSize:15,fontWeight:700,color:'var(--ink)',marginTop:14}}>DHA 处理时间</div>
          <div style={{fontSize:12,color:'var(--faint)',marginTop:6}}>预计处理时间</div>
          <div style={{fontSize:18,fontWeight:700,color:'var(--brand)',marginTop:3}}>预计 4–6 月</div>
          <div style={{fontSize:12.5,color:'var(--brand)',marginTop:8,cursor:'pointer'}}>查看 DHA 官网处理时间 ↗</div>
        </div>
      </div>

      <div className="grid" style={{gridTemplateColumns:'1.15fr 1.15fr 1fr',gap:20,marginBottom:20}}>
        <div className="card card-pad0">
          <CDCardHd icon="doc" bg="var(--brand-50)" fg="var(--brand)" title="提名递交记录" action={<button className="btn btn-ghost" style={{height:32,padding:'0 12px',fontSize:13,marginRight:18}}><Icon name="plus" size={14}/>添加提名递交</button>}/>
          <table className="tbl" style={{fontSize:13}}><thead><tr><th>递交日期</th><th>方式</th><th>编号</th><th>状态</th><th style={{textAlign:'right'}}>操作</th></tr></thead>
            <tbody>{CD_NOM.map((r,i)=>(<tr key={i}><td className="tnum" style={{color:'var(--faint)'}}>{r.date}</td><td style={{color:'var(--muted)'}}>{r.via}</td><td className="tnum" style={{color:'var(--muted)'}}>{r.no}</td><td><Pill tone={r.tone} dot={false}>{r.status}</Pill></td><td style={{textAlign:'right'}}><span className="link">查看</span></td></tr>))}</tbody></table>
          <div style={{padding:'12px 18px 16px'}}><span className="link">查看全部提名递交记录<Icon name="chevron" size={13}/></span></div>
        </div>
        <div className="card">
          <CDCardHd icon="users" bg="var(--violet-50)" fg="#7c4ddb" title="签证递交记录" action={<button className="btn btn-ghost" style={{height:32,padding:'0 12px',fontSize:13}}><Icon name="plus" size={14}/>添加签证递交</button>}/>
          <div style={{textAlign:'center',padding:'24px 10px'}}>
            <div style={{fontSize:34}}>🗂️</div>
            <div style={{fontSize:14,fontWeight:600,color:'var(--ink)',marginTop:8}}>签证尚未递交</div>
            <div className="hsub" style={{margin:'4px 0 14px'}}>请先完成材料准备</div>
            <button className="btn btn-primary" style={{height:38}}><Icon name="plus" size={15}/>添加签证递交</button>
          </div>
        </div>
        <div className="card">
          <CDCardHd icon="shield" bg="var(--brand-50)" fg="var(--brand)" title="审理跟进"/>
          <div className="stack">
            {CD_REVIEW.map((r,i)=>(
              <div className="row" key={i} style={{padding:'11px 0'}}>
                <span className={`check ${r.done?'on':''}`} style={{flex:'none'}}>{r.done&&<Icon name="check" size={13}/>}</span>
                <div className="grow" style={{fontSize:14,fontWeight:600,color:r.done?'var(--ink)':'var(--body)'}}>{r.t}</div>
                <Pill tone={r.tone} dot={false}>{r.s}</Pill>
                <Icon name="chevron" size={14} stroke="var(--slate-300)"/>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid" style={{gridTemplateColumns:'2fr 1fr',gap:20}}>
        <div className="card">
          <CDCardHd icon="clock" bg="var(--brand-50)" fg="var(--brand)" title="递交时间线"/>
          <div className="timeline" style={{marginTop:4}}>
            {[...CD_TL].reverse().map((t,i)=>(
              <div className="tl-row" key={i}>
                <div className="tl-rail"></div><span className="tl-dot done"></span>
                <div className="tl-body" style={{flex:1,display:'flex',gap:14,alignItems:'flex-start',flexWrap:'wrap'}}>
                  <span className="tnum" style={{fontSize:12.5,color:'var(--faint)',width:80}}>{t.date}</span>
                  <Pill tone={t.tone} dot={false}>{t.stage}</Pill>
                  <div style={{flex:1,minWidth:160}}><div style={{fontSize:14,fontWeight:600,color:'var(--ink)'}}>{t.t}</div><div style={{fontSize:12,color:'var(--faint)'}}>{t.d}</div></div>
                  <span style={{fontSize:11.5,color:'var(--faint)'}}>系统记录</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{marginTop:8}}><span className="link">查看完整时间线<Icon name="chevron" size={13}/></span></div>
        </div>
        <div className="card">
          <CDCardHd icon="bell" bg="var(--amber-50)" fg="#d97706" title="提醒"/>
          <ul style={{margin:0,paddingLeft:18,fontSize:13.5,color:'var(--body)',lineHeight:1.7}}>
            <li>建议在递交后 7–10 个工作日内确认DHA已受理。</li>
            <li>如DHA有补件要求,请在 28 天内回复以避免延误。</li>
          </ul>
          <div style={{marginTop:14}}><span className="link">查看全部提醒<Icon name="chevron" size={13}/></span></div>
        </div>
      </div>
    </React.Fragment>
  );
}

/* ── 付款 tab ── */
function CDPayRow({ r }){
  const [open,setOpen] = React.useState(false);
  const has = r.inst && r.inst.length;
  return (
    <React.Fragment>
      <tr style={open?{background:'var(--surface-2)'}:null}>
        <td><div style={{display:'flex',alignItems:'center',gap:7}}>{has&&<Icon name="chevron" size={13} style={{transform:open?'rotate(90deg)':'none',cursor:'pointer',color:'var(--brand)'}} onClick={()=>setOpen(o=>!o)}/>}<span style={{fontSize:14,fontWeight:600,color:'var(--ink)'}}>{r.name}</span></div></td>
        <td className="num tnum">{money(r.billed)}</td>
        <td className="num tnum" style={{color:'var(--emerald)'}}>{money(r.received)}</td>
        <td className="num tnum" style={{color:r.owe>0?'var(--rose)':'var(--faint)'}}>{r.owe>0?money(r.owe):0}</td>
        <td><Pill tone={r.tone} dot={false}>{r.status}</Pill></td>
        <td style={{textAlign:'right'}}><Icon name="chevron" size={15} style={{transform:open?'rotate(-90deg)':(has?'rotate(90deg)':'none'),cursor:'pointer',color:'var(--slate-300)'}} onClick={()=>has&&setOpen(o=>!o)}/></td>
      </tr>
      {open && has && r.inst.map((n,j)=>(
        <tr key={j} style={{background:'var(--surface-2)'}}>
          <td style={{paddingLeft:32}}><span style={{fontSize:13,fontWeight:600,color:'var(--body)'}}>{n.no}</span> <span className="phase-tag static" style={{color:n.tag==='未到期'?'var(--muted)':'#7c4ddb',background:n.tag==='未到期'?'var(--surface)':'var(--violet-50)'}}>{n.tag}</span></td>
          <td className="num tnum">{money(n.billed)}</td>
          <td className="num tnum" style={{color:n.received>0?'var(--emerald)':'var(--faint)'}}>{money(n.received)}</td>
          <td className="num tnum" style={{color:n.owe>0?'var(--rose)':'var(--faint)'}}>{n.owe>0?money(n.owe):0}</td>
          <td><Pill tone={n.tone} dot={false}>{n.st}</Pill></td>
          <td style={{textAlign:'right'}} className="tnum"><span style={{fontSize:12,color:'var(--faint)'}}>{n.due}</span></td>
        </tr>
      ))}
    </React.Fragment>
  );
}
function CDPayment({ d }){
  const tB=CD_PAYITEMS.reduce((a,x)=>a+x.billed,0), tR=CD_PAYITEMS.reduce((a,x)=>a+x.received,0), tO=CD_PAYITEMS.reduce((a,x)=>a+x.owe,0);
  return (
    <React.Fragment>
      <div className="grid g4" style={{marginBottom:20}}>
        <CDStat icon="wallet" bg="var(--brand-50)" fg="var(--brand)" label="总应收" value={money(tB)} vColor="var(--brand)"/>
        <CDStat icon="banknote" bg="var(--emerald-50)" fg="#0f9d6e" label="已收" value={money(tR)} vColor="var(--emerald)"/>
        <CDStat icon="alert" bg="var(--rose-50)" fg="#e11d48" label="未收" value={money(tO)} vColor="var(--rose)"/>
        <CDStat icon="calendar" bg="var(--violet-50)" fg="#7c4ddb" label="付款计划" value="3 / 5" vColor="#7c4ddb" sub="期已完成"/>
      </div>
      <div className="grid" style={{gridTemplateColumns:'1.6fr 1fr',gap:20}}>
        <div className="stack" style={{gap:20}}>
          <div className="card card-pad0">
            <div style={{padding:'20px 22px 6px'}}><h3 style={{margin:0,fontSize:16,fontWeight:700,color:'var(--ink)'}}>收费项目与付款计划</h3></div>
            <table className="tbl"><thead><tr><th>项目</th><th className="num">应收</th><th className="num">已收</th><th className="num">未收</th><th>状态</th><th style={{textAlign:'right'}}>操作</th></tr></thead>
              <tbody>
                {CD_PAYITEMS.map((r,i)=><CDPayRow key={i} r={r}/>)}
                <tr style={{borderTop:'2px solid var(--line-2)'}}><td style={{fontWeight:700,color:'var(--ink)'}}>合计</td><td className="num tnum" style={{fontWeight:700}}>{money(tB)}</td><td className="num tnum" style={{fontWeight:700,color:'var(--emerald)'}}>{money(tR)}</td><td className="num tnum" style={{fontWeight:700,color:'var(--rose)'}}>{money(tO)}</td><td></td><td></td></tr>
              </tbody>
            </table>
            <div style={{padding:'12px 22px 18px'}}><button className="btn btn-ghost" style={{height:36,fontSize:13}}><Icon name="arrowUR" size={14}/>导出付款计划</button></div>
          </div>
          <div className="grid g2" style={{gap:20}}>
            <div className="card"><h3 style={{margin:'0 0 10px',fontSize:14.5}}>付款说明 / 特殊安排</h3><div style={{fontSize:13,color:'var(--muted)',lineHeight:1.7}}>本案采用分期付款方案。签证递交阶段分 3 期收取,尾款在获批后 10 个工作日内付清。如需调整付款计划,请提前与我们联系。</div></div>
            <div className="card"><CDCardHd icon="calendar" bg="var(--brand-50)" fg="var(--brand)" title="创建付款计划"/><div style={{fontSize:13,color:'var(--muted)',lineHeight:1.6}}>设置项目、分期与到期日,生成付款计划表供客户确认。</div><button className="btn btn-ghost" style={{marginTop:12,height:36,fontSize:13}}>前往创建<Icon name="chevron" size={13}/></button></div>
          </div>
        </div>
        <div className="stack" style={{gap:20}}>
          <div className="card">
            <h3 style={{margin:'0 0 16px',fontSize:16}}>记一笔收款</h3>
            <div className="form" style={{gap:14}}>
              <div className="field"><label className="flabel">对应款项 <span className="req">*</span></label><select className="fselect"><option>请选择款项</option><option>签证递交</option></select></div>
              <div className="field"><label className="flabel">对应分期</label><select className="fselect"><option>请选择分期(可选)</option></select></div>
              <div className="field"><label className="flabel">收款金额 <span className="req">*</span></label><input className="finput" placeholder="AUD 请输入金额"/></div>
              <div className="field"><label className="flabel">收款方式 <span className="req">*</span></label><select className="fselect"><option>请选择收款方式</option><option>银行转账</option><option>信用卡</option></select></div>
              <div className="field"><label className="flabel">收款日期 <span className="req">*</span></label><input className="finput" type="date"/></div>
              <button className="btn btn-primary" style={{width:'100%'}}>确认收款</button>
            </div>
          </div>
          <div className="card card-pad0">
            <div style={{padding:'20px 22px 6px',display:'flex',justifyContent:'space-between',alignItems:'center'}}><h3 style={{margin:0,fontSize:16}}>最近收款记录</h3><span className="link" style={{paddingRight:0}}>查看全部记录</span></div>
            <table className="tbl" style={{fontSize:13}}><thead><tr><th>日期</th><th className="num">金额</th><th>方式</th><th>款项</th></tr></thead>
              <tbody>{CD_RECENT_PAY.map((p,i)=>(<tr key={i}><td className="tnum" style={{color:'var(--faint)'}}>{p.date}</td><td className="num tnum" style={{color:'var(--emerald)',fontWeight:600}}>{money(p.amt)}</td><td style={{color:'var(--muted)'}}>{p.via}</td><td style={{color:'var(--muted)'}}>{p.item}</td></tr>))}</tbody></table>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

/* ── 文件 tab ── */
function CDDocs({ d }){
  return (
    <React.Fragment>
      <div className="grid" style={{gridTemplateColumns:'1.7fr 1fr 1fr 1fr',gap:20,marginBottom:20}}>
        <div className="card">
          <h3 style={{margin:'0 0 12px',fontSize:15}}>上传 / 登记文件</h3>
          <div className="dropz" style={{padding:'24px'}}><Icon name="archive" size={28} stroke="var(--brand)"/><div style={{fontSize:14,fontWeight:600,color:'var(--body)',marginTop:8}}>拖拽文件到此处,或点击下方按钮选择文件</div><div className="hsub" style={{marginTop:4}}>支持 PDF、JPG、PNG、DOC、XLS、ZIP(单个最大 50MB)</div><button className="btn btn-primary" style={{height:38,marginTop:14}}><Icon name="archive" size={15}/>选择文件上传</button></div>
        </div>
        <CDStat icon="archive" bg="var(--brand-50)" fg="var(--brand)" label="文件总数" value="18" sub="所有已上传文件"/>
        <CDStat icon="alert" bg="var(--amber-50)" fg="#d97706" label="待补充" value="3" sub="需要补充的文件"/>
        <CDStat icon="calendar" bg="var(--emerald-50)" fg="#0f9d6e" label="最近上传" value="06/18" sub="补件通知.pdf · 李律师"/>
      </div>
      <div className="card" style={{marginBottom:20,padding:'14px 18px'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <span style={{fontSize:13.5,fontWeight:600,color:'var(--muted)'}}>文件分类</span>
          {CD_CATS.map(([c,n],i)=>(<span key={i} className={`chip`} style={i===0?{background:'var(--brand)',color:'#fff'}:{background:'var(--surface-2)',color:'var(--muted)'}}>{c} {n}</span>))}
        </div>
      </div>
      <div className="grid" style={{gridTemplateColumns:'2fr 1fr',gap:20}}>
        <div className="card card-pad0">
          <div style={{padding:'18px 22px 12px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
            <h3 style={{margin:0,fontSize:16}}>文件列表</h3>
            <div style={{display:'flex',gap:8}}><div className="search" style={{height:38,width:170,boxShadow:'none',border:'1px solid var(--line-2)'}}><Icon name="search" size={16}/><input placeholder="搜索文件名"/></div><div className="fsel" style={{height:38}}>全部状态<Icon name="chevron" size={13} style={{transform:'rotate(90deg)'}}/></div></div>
          </div>
          <table className="tbl" style={{fontSize:13}}><thead><tr><th>文件名</th><th>分类</th><th>上传日期</th><th>上传人</th><th>状态</th><th style={{textAlign:'right'}}>操作</th></tr></thead>
            <tbody>{CD_FILES.map((f,i)=>(
              <tr key={i}><td><div style={{display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:16}}>📄</span><span style={{fontSize:13.5,fontWeight:600,color:'var(--ink)'}}>{f.name}</span></div></td>
                <td><Pill tone={f.cTone} dot={false}>{f.cat}</Pill></td><td className="tnum" style={{color:'var(--faint)'}}>{f.date}</td><td style={{color:'var(--muted)'}}>{f.by}</td>
                <td><Pill tone={f.sTone} dot={false}>{f.status}</Pill></td>
                <td style={{textAlign:'right',color:'var(--slate-400)'}}>⬇ 👁 ⋮</td></tr>
            ))}</tbody></table>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 22px 16px'}}><span style={{fontSize:13,color:'var(--muted)'}}>共 18 条</span><div className="fpage"><span className="pg on">1</span><span className="pg">2</span></div><div className="fsel" style={{height:32,fontSize:13}}>10 条/页</div></div>
        </div>
        <div className="card">
          <div className="card-hd"><h3>缺失文件提醒</h3><span className="chip" style={{background:'var(--rose-50)',color:'var(--rose)'}}>3</span></div>
          <div className="stack">
            {CD_MISSING.map((m,i)=>(
              <div className="row" key={i} style={{padding:'12px 0'}}>
                <span style={{fontSize:18}}>📄</span>
                <div className="grow"><div style={{fontSize:14,fontWeight:600,color:'var(--ink)'}}>{m.name}</div><div style={{fontSize:12,color:'var(--faint)'}}>{m.d}</div></div>
                <Pill tone="rose" dot={false}>必需</Pill><Icon name="chevron" size={14} stroke="var(--slate-300)"/>
              </div>
            ))}
          </div>
          <div style={{marginTop:10}}><span className="link">查看全部缺失文件<Icon name="chevron" size={13}/></span></div>
        </div>
      </div>
    </React.Fragment>
  );
}

/* ── 记录 tab ── */
function CDRecords({ d }){
  return (
    <div className="grid" style={{gridTemplateColumns:'2fr 1fr',gap:20}}>
      <div className="stack" style={{gap:20}}>
        <div className="card">
          <h3 style={{margin:'0 0 16px',fontSize:16}}>快速添加记录</h3>
          <div style={{display:'flex',gap:14,flexWrap:'wrap'}}>
            <div className="field" style={{width:180}}><label className="flabel">标记</label><select className="fselect"><option>进展</option><option>客户沟通</option><option>财务</option><option>风险</option></select></div>
            <div className="field" style={{flex:1,minWidth:220}}><label className="flabel">内容</label><textarea className="ftext" style={{minHeight:72}} placeholder="请输入记录内容…"></textarea></div>
          </div>
          <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:14,marginTop:14,flexWrap:'wrap'}}>
            <div className="field" style={{width:200}}><label className="flabel">记录日期</label><input className="finput" type="date"/></div>
            <button className="btn btn-primary">保存记录</button>
          </div>
        </div>
        <div className="card">
          <div className="card-hd"><h3>记录时间线</h3><div className="fsel" style={{height:32,fontSize:13}}>最新在前<Icon name="chevron" size={13} style={{transform:'rotate(90deg)'}}/></div></div>
          <div className="tabs" style={{marginBottom:16}}>{['全部','进展','客户沟通','财务','风险'].map((t,i)=><button key={i} className={`t ${i===0?'on':''}`}>{t}</button>)}</div>
          <div className="timeline" style={{marginTop:4}}>
            {CD_RECORDS.map((r,i)=>(
              <div className="tl-row" key={i}>
                <div className="tl-rail"></div><span className="tl-dot done"></span>
                <div className="tl-body" style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                    <span className="rmk" style={{width:30,height:30,fontSize:14}}>{r.emoji}</span>
                    <Pill tone={r.tone} dot={false}>{r.tag}</Pill>
                    <span style={{flex:1,minWidth:160,fontSize:14,fontWeight:500,color:'var(--ink)'}}>{r.t}</span>
                    <span style={{fontSize:12,color:'var(--faint)'}}>{r.by}</span>
                  </div>
                  <div style={{fontSize:11.5,color:'var(--faint)',marginTop:4,marginLeft:40}}>{r.date} {r.time}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{textAlign:'center',marginTop:6}}><span className="link">加载更多<Icon name="chevron" size={13} style={{transform:'rotate(90deg)'}}/></span></div>
        </div>
      </div>
      <div className="stack" style={{gap:20}}>
        <div className="card">
          <h3 style={{margin:'0 0 14px',fontSize:16}}>记录统计</h3>
          <div className="stack">
            <div className="row" style={{padding:'10px 0'}}><span className="well" style={{width:34,height:34,borderRadius:10,background:'var(--brand-50)',color:'var(--brand)'}}><Icon name="doc" size={17}/></span><div className="grow" style={{fontSize:14,color:'var(--body)'}}>总记录</div><span style={{fontSize:20,fontWeight:700,color:'var(--ink)'}}>24</span></div>
            <div className="row" style={{padding:'10px 0'}}><span className="well" style={{width:34,height:34,borderRadius:10,background:'var(--emerald-50)',color:'#0f9d6e'}}><Icon name="trendUp" size={17}/></span><div className="grow" style={{fontSize:14,color:'var(--body)'}}>本周新增</div><span style={{fontSize:20,fontWeight:700,color:'var(--ink)'}}>5</span></div>
            <div className="row" style={{padding:'10px 0'}}><span className="well" style={{width:34,height:34,borderRadius:10,background:'var(--amber-50)',color:'#d97706'}}><Icon name="clock" size={17}/></span><div className="grow" style={{fontSize:14,color:'var(--body)'}}>待跟进</div><span style={{fontSize:20,fontWeight:700,color:'var(--ink)'}}>2</span></div>
          </div>
        </div>
        <div className="card">
          <h3 style={{margin:'0 0 12px',fontSize:16}}>待跟进事项</h3>
          <div className="stack" style={{gap:10}}>
            {CD_FOLLOW.map((f,i)=>(
              <div key={i} style={{display:'flex',gap:11,padding:'12px',borderRadius:12,background:'var(--surface-2)',cursor:'pointer'}}>
                <span className="rmk" style={{width:32,height:32}}>{f.emoji}</span>
                <div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:600,color:'var(--ink)'}}>{f.t}</div><div style={{fontSize:12,color:'var(--faint)',marginTop:2}}>{f.d}</div><div style={{fontSize:11.5,color:'var(--brand)',marginTop:6}}>📅 {f.date}</div></div>
                <Icon name="chevron" size={14} stroke="var(--slate-300)"/>
              </div>
            ))}
          </div>
          <div style={{textAlign:'center',marginTop:12}}><span className="link">查看全部待跟进 (2)<Icon name="chevron" size={13}/></span></div>
        </div>
      </div>
    </div>
  );
}

function CaseDetailPage(){
  const d = DETAIL;
  const [tab,setTab] = React.useState('概览');
  const TABS = ['概览','递交','付款','文件','记录'];
  return (
    <AppShell active="#/cases" title="案件详情" topSearch={false} width="route-wide">
      <div className="back" onClick={()=>go('#/cases')}><Icon name="chevron" size={15} style={{transform:'rotate(180deg)'}}/>返回客户</div>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16,flexWrap:'wrap',marginBottom:8}}>
        <div>
          <h1 style={{margin:0,fontSize:24,fontWeight:700,color:'var(--ink)',letterSpacing:'-.02em'}}>{d.visaLabel} 签证</h1>
          <div style={{display:'flex',alignItems:'center',gap:12,marginTop:8,fontSize:13.5,color:'var(--muted)',flexWrap:'wrap'}}>
            <span>客户:<span style={{color:'var(--brand)',fontWeight:600,cursor:'pointer'}} onClick={()=>go('#/customers')}>{d.customer}</span> · {d.country}</span>
            <span style={{display:'inline-flex',alignItems:'center',gap:6}}>当前阶段:<StageBadge stage={d.currentStage}/></span>
          </div>
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <button className="btn btn-primary"><Icon name="trendUp" size={16}/>更新阶段</button>
          <button className="btn btn-ghost"><Icon name="plus" size={16}/>新增记录</button>
          <button className="btn btn-ghost">更多<Icon name="chevron" size={14} style={{transform:'rotate(90deg)'}}/></button>
        </div>
      </div>
      <div className="utabs">{TABS.map((t,i)=><div key={i} className={`utab ${tab===t?'on':''}`} onClick={()=>setTab(t)}>{t}</div>)}</div>

      {tab==='概览' && <CDOverview d={d}/>}
      {tab==='递交' && <CDSubmission d={d}/>}
      {tab==='付款' && <CDPayment d={d}/>}
      {tab==='文件' && <CDDocs d={d}/>}
      {tab==='记录' && <CDRecords d={d}/>}

      <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:14,paddingTop:18,fontSize:13.5,color:'var(--muted)'}}>
        更多操作:<span className="link" style={{color:'var(--muted)'}}>归档案件</span><span className="link" style={{color:'var(--rose)'}}>彻底删除</span>
      </div>
    </AppShell>
  );
}
function CDOverview({ d }){
  const NODES = [{k:'todo',l:'待办'},{k:'nomination_lodged',l:'提名递交'},{k:'visa_lodged',l:'签证递交'},{k:'granted',l:'完成'}];
  const ci = Math.max(0, NODES.findIndex(n=>n.k===d.currentStage));
  const wellSm = (ic,bg,fg)=>(<span className="well" style={{width:34,height:34,borderRadius:10,background:bg,color:fg}}><Icon name={ic} size={18}/></span>);
  return (
    <React.Fragment>
      <div className="grid g4" style={{marginBottom:20}}>
        <SumCard icon="clipboard" tone="brand" label="当前阶段" value={STAGE[d.currentStage].l}/>
        <SumCard icon="users" tone="violet" label="提名递交" value={d.lodgements[0] && d.lodgements[0].date ? d.lodgements[0].date : '暂无'}/>
        <SumCard icon="doc" tone="emerald" label="签证递交" value={d.lodgements[1] && d.lodgements[1].date ? d.lodgements[1].date : '暂无'}/>
        <div className="card" style={{padding:'18px 20px'}}><div style={{fontSize:13.5,fontWeight:700,color:'var(--ink)',marginBottom:12}}>付款概览</div><div style={{display:'flex',gap:12}}><MiniPay label="应收" val={money(d.pay.billed)} c="var(--ink)"/><MiniPay label="已付" val={money(d.pay.received)} c="var(--emerald)"/><MiniPay label="未付" val={money(d.pay.owe)} c="var(--rose)"/></div></div>
      </div>
      <div className="grid" style={{gridTemplateColumns:'1fr 1.3fr',gap:20,marginBottom:20}}>
        <div className="card">
          <div className="card-hd"><div style={{display:'flex',alignItems:'center',gap:8}}>{wellSm('shield','var(--brand-50)','var(--brand)')}<h3>阶段管理</h3></div></div>
          <label className="flabel" style={{display:'block',marginBottom:8}}>切换到</label>
          <select className="fselect" defaultValue={STAGE[d.currentStage].l}>{STAGE_ORDER.map((s,i)=><option key={i}>{STAGE[s].l}</option>)}</select>
          <label className="flabel" style={{display:'block',margin:'16px 0 8px'}}>实际发生日期(默认今天,可补录过去)</label>
          <input className="finput" type="date"/>
          <button className="btn btn-primary" style={{width:'100%',marginTop:16}}>更新阶段</button>
        </div>
        <div className="card">
          <div className="card-hd"><div style={{display:'flex',alignItems:'center',gap:8}}>{wellSm('clock','var(--brand-50)','var(--brand)')}<h3>阶段时间线</h3></div></div>
          <div className="hstep">{NODES.map((n,i)=>(<React.Fragment key={i}><div className="hnode"><span className={`hdot ${i<ci?'on':i===ci?'cur':''}`}></span><span className={`hnl ${i<=ci?'on':''}`}>{n.l}</span></div>{i<NODES.length-1 && <div className={`hseg ${i<ci?'on':''}`}></div>}</React.Fragment>))}</div>
          <div className="stack" style={{marginTop:20}}>{[...d.timeline].reverse().map((t,i)=>(<div className="row" key={i} style={{padding:'10px 0'}}><span className="hdot on" style={{boxShadow:'none',flex:'none'}}></span><div className="grow"><div style={{fontSize:14,fontWeight:600,color:'var(--ink)'}}>{STAGE[t.stage].l}</div><div style={{fontSize:12,color:'var(--faint)'}}>{t.date} · {t.note}</div></div></div>))}</div>
        </div>
      </div>
      <div className="card" style={{textAlign:'center',padding:'18px'}}><span className="link" onClick={()=>{}}>更多概览内容可在 递交 / 付款 / 文件 / 记录 各 tab 查看</span></div>
    </React.Fragment>
  );
}
function SumCard({ icon, tone, label, value }){
  return <div className="card" style={{display:'flex',alignItems:'center',gap:14,padding:'18px 20px'}}><Well name={icon} tone={tone} size={48}/><div style={{minWidth:0}}><div style={{fontSize:13,color:'var(--muted)'}}>{label}</div><div style={{fontSize:17,fontWeight:700,color:'var(--ink)',marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{value}</div></div></div>;
}
function MiniPay({ label, val, c }){
  return <div style={{flex:1,minWidth:0}}><div style={{fontSize:11.5,color:'var(--muted)'}}>{label}</div><div style={{fontSize:14.5,fontWeight:700,color:c,marginTop:3,fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap'}}>{val}</div></div>;
}

/* ════════════════ 财务 ════════════════ */
function RecMenu(){
  const [open,setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(()=>{ const h=(e)=>{ if(ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener('click',h); return ()=>document.removeEventListener('click',h); },[]);
  const items=['记应收','记收款','创建付款计划','付主代理','付介绍人'];
  return (
    <span ref={ref} style={{position:'relative',display:'inline-block'}}>
      <button className="link" style={{border:0,background:'transparent',cursor:'pointer',fontFamily:'inherit'}} onClick={()=>setOpen(o=>!o)}>记账<Icon name="chevron" size={13} style={{transform:'rotate(90deg)'}}/></button>
      {open && (
        <div style={{position:'absolute',right:0,top:'calc(100% + 6px)',background:'#fff',border:'1px solid var(--line-2)',borderRadius:12,
          boxShadow:'var(--sh-lg)',padding:6,minWidth:128,zIndex:30}}>
          {items.map((it,i)=>(
            <div key={i} onClick={()=>setOpen(false)} style={{padding:'8px 11px',borderRadius:8,fontSize:13.5,fontWeight:500,color:'var(--body)',cursor:'pointer',whiteSpace:'nowrap'}}
              onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>{it}</div>
          ))}
        </div>
      )}
    </span>
  );
}
function StatusCell({ r }){
  if(!r.billed && !r.received) return <Pill tone="slate" dot={false}>未设应收</Pill>;
  if(r.owe>0) return <Pill tone="rose" dot={false}>欠 {money(r.owe)}</Pill>;
  return <Pill tone="emerald" dot={false}>已结清</Pill>;
}
function PayCell({ received, billed }){
  return <span style={{fontVariantNumeric:'tabular-nums',fontSize:13.5}}><b style={{color:'var(--emerald)'}}>{money(received)}</b> <span style={{color:'var(--faint)'}}>/ {money(billed)}</span></span>;
}
function StageRow({ s }){
  const [open,setOpen] = React.useState(false);
  const hasInst = s.inst && s.inst.length;
  return (
    <React.Fragment>
      <tr>
        <td>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:14,fontWeight:600,color:'var(--ink)'}}>{s.name}</span>
            {s.periods>1 && <span className={`phase-tag ${hasInst?'':'static'}`} onClick={hasInst?(()=>setOpen(o=>!o)):undefined}>分 {s.periods} 期{hasInst && <Icon name="chevron" size={11} style={{transform:open?'rotate(-90deg)':'rotate(90deg)'}}/>}</span>}
          </div>
          <div style={{fontSize:11.5,color:'var(--faint)',marginTop:2}}>每期 AUD {s.per.toLocaleString('en-US')} · 共 {s.periods} 期</div>
        </td>
        <td className="num"><PayCell received={s.received} billed={s.billed}/></td>
        <td>{s.owe>0?<Pill tone="rose" dot={false}>欠 {money(s.owe)}</Pill>:<Pill tone="emerald" dot={false}>已结清</Pill>}</td>
        <td style={{textAlign:'right',whiteSpace:'nowrap'}}>{hasInst && <span className="link" style={{marginRight:10}} onClick={()=>setOpen(o=>!o)}>{open?'收起':'分期'}</span>}<span className="link">记账</span><Icon name="dots" size={16} style={{verticalAlign:'middle',color:'var(--faint)',marginLeft:8,cursor:'pointer'}}/></td>
      </tr>
      {open && hasInst && s.inst.map((n,j)=>{
        const tone=n.status==='overdue'?'rose':n.status==='pending'?'amber':'emerald';
        const lbl=n.status==='overdue'?'逆期未付':n.status==='pending'?'待付':'已付';
        return (
          <tr key={j} style={{background:'var(--surface-2)'}}>
            <td style={{paddingLeft:34}}><span style={{fontSize:13,fontWeight:600,color:'var(--body)'}}>{n.no}</span><span style={{fontSize:11.5,color:n.status==='overdue'?'var(--rose)':'var(--faint)',marginLeft:10}}>到期 {n.due}</span></td>
            <td className="num tnum" style={{fontWeight:600,color:'var(--ink)'}}>{money(n.amount)}</td>
            <td><Pill tone={tone} dot={false}>{lbl}</Pill></td>
            <td style={{textAlign:'right'}}>{n.status==='paid'?<span style={{fontSize:12.5,color:'var(--faint)'}}>✓</span>:<span className="link">记收款</span>}</td>
          </tr>
        );
      })}
    </React.Fragment>
  );
}
function StagePanel({ r }){
  const [on,setOn] = React.useState(true);
  const sb=r.stages.reduce((s,x)=>s+x.billed,0), sr=r.stages.reduce((s,x)=>s+x.received,0), so=r.stages.reduce((s,x)=>s+x.owe,0);
  return (
    <div style={{padding:'18px 22px 20px 64px'}}>
      <label className="fcheck" style={{marginBottom:2}}><span className={`fbox ${on?'on':''}`} onClick={()=>setOn(!on)}>{on&&<Icon name="check" size={13}/>}</span>分阶段收费</label>
      <div className="hsub" style={{margin:'0 0 14px 30px',maxWidth:580}}>按阶段/里程碑收费(阶段名 · 应收金额 · 期数 · 总计),如 意向金 5000×1、递交签证 80000×1。</div>
      <div style={{background:'var(--surface)',border:'1px solid var(--line-2)',borderRadius:14,overflow:'hidden'}}>
        <table className="tbl">
          <thead><tr><th>阶段名</th><th className="num">已付 / 应收</th><th>未付 / 状态</th><th style={{textAlign:'right'}}>操作</th></tr></thead>
          <tbody>
            {r.stages.map((s,i)=><StageRow key={i} s={s}/>)}
            <tr style={{borderTop:'2px solid var(--line-2)'}}>
              <td style={{fontWeight:700,color:'var(--ink)'}}>合计</td>
              <td className="num"><PayCell received={sr} billed={sb}/></td>
              <td>{so>0?<Pill tone="rose" dot={false}>欠 {money(so)}</Pill>:<Pill tone="emerald" dot={false}>已结清</Pill>}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
      <button className="btn btn-ghost" style={{marginTop:14}}><Icon name="plus" size={15}/>新增阶段</button>
    </div>
  );
}
function RecRow({ r }){
  const [open,setOpen] = React.useState(!!r.defaultOpen);
  const hasStages = r.stages && r.stages.length;
  const pct = r.billed? Math.min(100,Math.round(r.received/r.billed*100)) : 0;
  const stoneMap = {'待收':'amber','逾期':'rose','已结清':'emerald','未设应收':'slate'};
  return (
    <React.Fragment>
      <tr style={open?{background:'var(--surface-2)'}:null}>
        <td><div style={{display:'flex',alignItems:'center',gap:11}}><Avatar name={r.name} size={34}/><span style={{fontSize:14,fontWeight:600,color:'var(--ink)'}}>{r.name}</span>{r.merged&&<span className="mtag">合并</span>}</div></td>
        <td style={{color:'var(--muted)',fontWeight:600}}>{r.visa}</td>
        <td style={{minWidth:180}}>
          <PayCell received={r.received} billed={r.billed}/>
          {r.billed>0 && <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6}}>
            <span className="bar" style={{maxWidth:150}}><span style={{width:pct+'%',background:'var(--emerald)'}}/></span>
            <span style={{fontSize:12,fontWeight:700,color:pct>=100?'var(--emerald)':'var(--muted)'}}>{pct}%</span></div>}
        </td>
        <td>{r.total>0 ? <div style={{display:'flex',alignItems:'center',gap:9}}><span className="dots">{Array.from({length:r.total}).map((_,k)=><i key={k} className={k<r.paid?'on':''}/>)}</span><span style={{fontSize:12.5,color:'var(--muted)',fontWeight:600}}>{r.paid}/{r.total}期</span></div> : <span className="none">未设置</span>}</td>
        <td>{r.next ? <div><div style={{fontSize:13.5,fontWeight:600,color:'var(--ink)'}}>{r.next.label}</div><div style={{fontSize:12,color:r.next.overdue?'var(--rose)':'var(--faint)',marginTop:1}}>{r.next.overdue||r.next.due}</div></div> : <span className="none">—</span>}</td>
        <td><Pill tone={stoneMap[r.status]||'slate'} dot={false}>{r.status}</Pill></td>
        <td style={{textAlign:'right'}}><span className="link" onClick={()=> hasStages? setOpen(o=>!o) : (r.status!=='未设应收' && go('#/cases/detail'))}>{hasStages&&open?'收起':r.op}</span></td>
      </tr>
      {open && hasStages && <tr><td colSpan={7} style={{padding:0,borderTop:0,background:'var(--surface-2)'}}><StagePanel r={r}/></td></tr>}
    </React.Fragment>
  );
}
function FStat({ icon, bg, label, val }){
  return <div className="fstat"><span className="fic" style={{background:bg}}><Icon name={icon} size={24}/></span><div><div className="fl">{label}</div><div className="fv">{val}</div></div></div>;
}
function FinancePage(){
  const f = FIN;
  const [showAll,setShowAll] = React.useState(false);
  const [allMonths,setAllMonths] = React.useState(false);
  const sum = (a,k)=>a.reduce((s,x)=>s+(x[k]||0),0);
  const tBilled=sum(f.receivables,'billed'), tRecv=sum(f.receivables,'received'), tOwe=sum(f.receivables,'owe');
  const oweCustomers = f.receivables.filter(x=>x.owe>0).length;
  const recTotal = f.receipts.reduce((s,x)=>s+x.amount,0);
  const compTotal = f.payouts.filter(p=>p.dir==='company').reduce((s,x)=>s+x.amount,0);
  const refTotal = f.payouts.filter(p=>p.dir==='referrer').reduce((s,x)=>s+x.amount,0);
  const hidden = f.totalRows - f.receivables.length;
  return (
    <AppShell active="#/finance" title="财务" sub="应收快照 + 月度收付明细" width="route-md">
      {/* 近期案件应收(图一式:统计卡 + 工具条 + 富表 + 分页)*/}
      <div style={{marginBottom:18}}>
        <h3 style={{margin:0,fontSize:20,fontWeight:700,color:'var(--ink)',letterSpacing:'-.01em'}}>近期案件应收</h3>
        <div className="hsub" style={{marginTop:4}}>支持分期收款管理 · 快速查看总进度、分期进度与下一期安排</div>
      </div>
      <div className="grid g4" style={{marginBottom:18}}>
        <FStat icon="banknote" bg="#3b6bff" label="总应收" val={money(tBilled)}/>
        <FStat icon="wallet" bg="#10b981" label="已收款" val={money(tRecv)}/>
        <FStat icon="clock" bg="#f59e0b" label="待收款" val={money(tOwe)}/>
        <FStat icon="users" bg="#8b5cf6" label="欠款客户" val={String(oweCustomers)}/>
      </div>
      <div className="card" style={{marginBottom:18,padding:'14px 16px'}}>
        <div className="fbar">
          <div className="searchbar" style={{flex:1,minWidth:200,height:44,boxShadow:'none'}}><Icon name="search" size={18}/><input placeholder="搜索客户 / 案件号"/></div>
          <div className="fsel"><Icon name="calendar" size={16}/>本月(2026年06月)<Icon name="chevron" size={14} style={{transform:'rotate(90deg)'}}/></div>
          <div className="fsel">全部状态<Icon name="chevron" size={14} style={{transform:'rotate(90deg)'}}/></div>
          <div style={{flex:1}}></div>
          <button className="btn btn-ghost" style={{height:44}}><Icon name="arrowUR" size={16}/>导出</button>
        </div>
      </div>
      <Card pad={false}>
        <div style={{overflowX:'auto'}}>
          <table className="tbl">
            <thead><tr><th>客户</th><th>案件</th><th>总进度</th><th>分期进度</th><th>下一期</th><th>状态</th><th style={{textAlign:'right'}}>操作</th></tr></thead>
            <tbody>
              {f.receivables.map((r,i)=><RecRow key={i} r={r}/>)}
              <tr style={{borderTop:'2px solid var(--line-2)'}}>
                <td style={{fontWeight:700,color:'var(--ink)'}}>合计</td>
                <td></td>
                <td><PayCell received={tRecv} billed={tBilled}/></td>
                <td></td>
                <td></td>
                <td>{tOwe>0?<Pill tone="rose" dot={false}>欠 {money(tOwe)}</Pill>:<Pill tone="emerald" dot={false}>已结清</Pill>}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{padding:'14px 22px 18px'}}>
          <span className="link" onClick={()=>setShowAll(v=>!v)}>{showAll?'收起':`查看全部应收(共 ${f.totalRows} 行,还有 ${hidden} 行)`}</span>
        </div>
      </Card>

      {/* 月度账目 */}
      <Card pad={false}>
        <div style={{padding:'22px 22px 0',display:'flex',alignItems:'center',justifyContent:'space-between',gap:14,flexWrap:'wrap'}}>
          <h3 style={{margin:0,fontSize:16,fontWeight:700,color:'var(--ink)'}}>月度账目</h3>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <button className="iconbtn" style={{width:38,height:38}} title="上月"><Icon name="chevron" size={17} style={{transform:'rotate(180deg)'}}/></button>
            <div style={{display:'inline-flex',alignItems:'center',gap:8,height:40,padding:'0 14px',border:'1px solid var(--line-2)',borderRadius:12,background:'var(--surface)',fontSize:14,fontWeight:600,color:allMonths?'var(--faint)':'var(--ink)'}}>
              <Icon name="calendar" size={16}/>2026年06月</div>
            <button className="iconbtn" style={{width:38,height:38}} title="下月"><Icon name="chevron" size={17}/></button>
            <button className={`btn ${allMonths?'btn-primary':'btn-ghost'}`} style={{height:40,padding:'0 16px'}} onClick={()=>setAllMonths(a=>!a)}>全部</button>
          </div>
        </div>
        <div style={{padding:'18px 22px 22px'}}>
          <div className="totbar" style={{marginBottom:22}}>
            <div className="tot"><div className="tl">{allMonths?'总收款':'本月总收款'}</div><div className="tv" style={{color:'var(--emerald)'}}>{money(f.totals.income)}</div></div>
            <div className="tot"><div className="tl">{allMonths?'总支出':'本月总支出'}</div><div className="tv" style={{color:'var(--amber)'}}>{money(f.totals.expense)}</div></div>
            <div className="tot"><div className="tl">净额</div><div className="tv" style={{color:f.totals.net>=0?'var(--ink)':'var(--rose)'}}>{money(f.totals.net)}</div></div>
          </div>

          <div className="grid g2" style={{gap:26}}>
            {/* 收款明细 */}
            <div>
              <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:10}}>
                <span style={{fontSize:13.5,fontWeight:700,color:'var(--body)'}}>收款明细(客户付款)</span>
                <span style={{fontSize:12.5,color:'var(--faint)'}}>已收合计 <b style={{color:'var(--emerald)'}}>{money(recTotal)}</b></span>
              </div>
              {f.receipts.length===0 ? <div className="empty" style={{padding:'24px 0'}}>暂无收款记录</div> :
                f.receipts.map((p,i)=>(
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
            {/* 支出 */}
            <div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,gap:10,flexWrap:'wrap'}}>
                <span style={{fontSize:13.5,fontWeight:700,color:'var(--body)'}}>支出 / 付款(付主代理 · 付介绍人)</span>
                <button className="btn btn-ghost" style={{height:34,padding:'0 12px',fontSize:13}}><Icon name="plus" size={15}/>加支出</button>
              </div>
              <div style={{display:'flex',gap:14,marginBottom:8,fontSize:12.5,color:'var(--faint)'}}>
                <span>付主代理合计 <b style={{color:'var(--amber)'}}>{money(compTotal)}</b></span>
                <span>付介绍人合计 <b style={{color:'#7c4ddb'}}>{money(refTotal)}</b></span>
              </div>
              {f.payouts.length===0 ? <div className="empty" style={{padding:'24px 0'}}>暂无支出记录</div> :
                f.payouts.map((p,i)=>(
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
        </div>
      </Card>
    </AppShell>
  );
}
function KpiMini({ label, val, tone }){
  const c = tone==='emerald'?'var(--emerald)':tone==='rose'?'var(--rose)':'var(--ink)';
  return (
    <div style={{flex:1,minWidth:120,background:'var(--surface-2)',borderRadius:14,padding:'12px 16px'}}>
      <div style={{fontSize:12,color:'var(--muted)'}}>{label}</div>
      <div style={{fontSize:19,fontWeight:700,color:c,marginTop:4,fontVariantNumeric:'tabular-nums'}}>{val}</div>
    </div>
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
