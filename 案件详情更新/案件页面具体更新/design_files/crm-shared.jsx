/* 签证 CRM 仪表盘 — 共享:图标、头像、图表、Pill、侧栏、数据 */

/* ── 线性图标(24×24,stroke 1.9,圆角端点)──────────────────────────── */
const ic = { viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:1.9, strokeLinecap:'round', strokeLinejoin:'round' };
const GLYPH = {
  home:(<g><path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9.5h12V10"/><path d="M10 19.5V14h4v5.5"/></g>),
  users:(<g><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6"/><path d="M17.6 14.5A5.5 5.5 0 0 1 20.5 20"/></g>),
  briefcase:(<g><rect x="3" y="7.5" width="18" height="12.5" rx="2.5"/><path d="M8 7.5V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1.5"/><path d="M3 12.5h18"/></g>),
  wallet:(<g><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1.3" fill="currentColor" stroke="none"/></g>),
  building:(<g><rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h6"/></g>),
  userplus:(<g><circle cx="10" cy="8" r="3.4"/><path d="M3.5 20a6.5 6.5 0 0 1 13 0"/><path d="M19 8v6M16 11h6"/></g>),
  archive:(<g><rect x="3.5" y="4.5" width="17" height="4" rx="1.4"/><path d="M5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5"/><path d="M10 13h4"/></g>),
  shield:(<g><path d="M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z"/><path d="m9.5 12 1.8 1.8L15 10.5"/></g>),
  bell:(<g><path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6"/><path d="M10.5 20a2 2 0 0 0 3 0"/></g>),
  search:(<g><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></g>),
  plus:(<g><path d="M12 5v14M5 12h14"/></g>),
  chevron:(<g><path d="m9 6 6 6-6 6"/></g>),
  calendar:(<g><rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/></g>),
  clock:(<g><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></g>),
  trendUp:(<g><path d="m4 15 5-5 3 3 7-7"/><path d="M16 6h5v5"/></g>),
  trendDown:(<g><path d="m4 9 5 5 3-3 7 7"/><path d="M16 18h5v-5"/></g>),
  check:(<g><path d="m5 12.5 4.5 4.5L19 7"/></g>),
  x:(<g><path d="M6 6l12 12M18 6 6 18"/></g>),
  alert:(<g><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5M12 16v0"/></g>),
  banknote:(<g><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.7"/><path d="M6 9.5v0M18 14.5v0"/></g>),
  clipboard:(<g><rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6H9z"/><path d="m9 13 2 2 4-4"/></g>),
  passport:(<g><rect x="5" y="3" width="14" height="18" rx="2.5"/><circle cx="12" cy="10" r="2.7"/><path d="M9.5 16h5"/></g>),
  doc:(<g><path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/><path d="M13.5 3.5V8H18M9 13h6M9 16.5h4"/></g>),
  star:(<g><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.6 1-5.8-4.3-4.1 5.9-.9Z"/></g>),
  dots:(<g><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/></g>),
  arrowUR:(<g><path d="M7 17 17 7M8 7h9v9"/></g>),
  filter:(<g><path d="M4 6h16M7 12h10M10 18h4"/></g>),
};
function Icon({ name, size=22, ...p }){ return <svg {...ic} width={size} height={size} {...p}>{GLYPH[name]}</svg>; }

/* ── 渐变头像 ───────────────────────────────────────────────────────── */
const GRADS = [
  'linear-gradient(135deg,#5b7cfa,#8b6cf0)',
  'linear-gradient(135deg,#2f8fff,#38c6ff)',
  'linear-gradient(135deg,#ff7a59,#ff5e84)',
  'linear-gradient(135deg,#12b886,#5fd0a0)',
  'linear-gradient(135deg,#f5a623,#ffce4f)',
  'linear-gradient(135deg,#a55eea,#ec5bb0)',
  'linear-gradient(135deg,#0ea5e9,#22d3ee)',
  'linear-gradient(135deg,#f43f5e,#fb7185)',
];
const hashIdx = (s,n)=>{ let h=0; for(const ch of s) h=(h*31+ch.charCodeAt(0))>>>0; return h%n; };
function Avatar({ name, size=40 }){
  const g = GRADS[hashIdx(name, GRADS.length)];
  return <span className="av" style={{ width:size, height:size, background:g, fontSize:size*0.4 }}>{name.trim()[0]||'?'}</span>;
}
function NameCell({ name, sub, size=40 }){
  return (
    <div className="namecell">
      <Avatar name={name} size={size}/>
      <div style={{minWidth:0}}>
        <div className="nm">{name}</div>
        {sub && <div className="ns">{sub}</div>}
      </div>
    </div>
  );
}

/* ── Pill ───────────────────────────────────────────────────────────── */
const TONE = {
  slate:['#eef1f6','#64748b'], blue:['#e6f0ff','#2563eb'], indigo:['var(--indigo-50)','var(--indigo)'],
  cyan:['#e3f7fb','#0891b2'], teal:['var(--teal-50)','var(--teal)'], emerald:['var(--emerald-50)','#0f9d6e'],
  amber:['var(--amber-50)','#c87f06'], rose:['var(--rose-50)','#e11d48'], violet:['var(--violet-50)','#7c4ddb'],
  sky:['var(--sky-50)','#0284c7'],
};
function Pill({ tone='slate', dot=true, children }){
  const [bg,fg]=TONE[tone]||TONE.slate;
  return <span className="pill" style={{background:bg,color:fg}}>{dot&&<span className="pd"/>}{children}</span>;
}
const WELL = {
  brand:['var(--brand-50)','var(--brand)'], emerald:['var(--emerald-50)','#0f9d6e'],
  rose:['var(--rose-50)','#e11d48'], amber:['var(--amber-50)','#d97706'],
  sky:['var(--sky-50)','#0284c7'], violet:['var(--violet-50)','#7c4ddb'], indigo:['var(--indigo-50)','var(--indigo)'],
};
function Well({ name, tone='brand', size=50 }){
  const [bg,fg]=WELL[tone]||WELL.brand;
  return <span className="well" style={{background:bg,color:fg,width:size,height:size}}><Icon name={name}/></span>;
}

/* ── 环形图 ─────────────────────────────────────────────────────────── */
function Donut({ data, size=190, thickness=26, center, centerSub }){
  const r=(size-thickness)/2, c=2*Math.PI*r;
  const sum=data.reduce((a,d)=>a+d.value,0); let off=0;
  return (
    <svg width={size} height={size} style={{flex:'none',transform:'rotate(-90deg)'}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--line-2)" strokeWidth={thickness}/>
      {data.map((d,i)=>{ const len=(d.value/sum)*c; const el=(
        <circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={d.color} strokeWidth={thickness}
          strokeDasharray={`${len} ${c-len}`} strokeDashoffset={-off} strokeLinecap="round"/>); off+=len; return el; })}
      <text x={size/2} y={size/2-3} textAnchor="middle" transform={`rotate(90 ${size/2} ${size/2})`}
        style={{fontSize:34,fontWeight:700,fill:'var(--ink)',fontVariantNumeric:'tabular-nums'}}>{center??sum}</text>
      <text x={size/2} y={size/2+19} textAnchor="middle" transform={`rotate(90 ${size/2} ${size/2})`}
        style={{fontSize:12,fill:'var(--faint)'}}>{centerSub||'进行中案件'}</text>
    </svg>
  );
}

/* ── 半环仪表 ───────────────────────────────────────────────────────── */
function Gauge({ value, max=100, size=200, label, sub, color='var(--brand)' }){
  const stroke=20, r=(size-stroke)/2, cx=size/2, cy=size/2;
  const semi=Math.PI*r; const pct=Math.min(1,value/max);
  return (
    <svg width={size} height={size/2+18} viewBox={`0 0 ${size} ${size/2+18}`}>
      <path d={`M ${stroke/2} ${cy} A ${r} ${r} 0 0 1 ${size-stroke/2} ${cy}`} fill="none" stroke="var(--line-2)" strokeWidth={stroke} strokeLinecap="round"/>
      <path d={`M ${stroke/2} ${cy} A ${r} ${r} 0 0 1 ${size-stroke/2} ${cy}`} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={`${semi*pct} ${semi}`}/>
      <text x={cx} y={cy-6} textAnchor="middle" style={{fontSize:34,fontWeight:700,fill:'var(--ink)',fontVariantNumeric:'tabular-nums'}}>{label}</text>
      <text x={cx} y={cy+12} textAnchor="middle" style={{fontSize:12,fill:'var(--faint)'}}>{sub}</text>
    </svg>
  );
}

/* ── 条形图(月度) ─────────────────────────────────────────────────── */
function BarChart({ data, height=180, accent='var(--brand)', muted='var(--brand-100)' }){
  const max=Math.max(...data.map(d=>d.value));
  return (
    <div style={{display:'flex',alignItems:'flex-end',gap:14,height,padding:'4px 2px'}}>
      {data.map((d,i)=>(
        <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:9,height:'100%',justifyContent:'flex-end'}}>
          <div style={{fontSize:11,fontWeight:700,color:d.hi?'var(--brand)':'var(--faint)',fontVariantNumeric:'tabular-nums'}}>{d.label2||''}</div>
          <div style={{width:'100%',maxWidth:30,height:`${(d.value/max)*100}%`,borderRadius:9,
            background:d.hi?accent:muted,boxShadow:d.hi?'var(--sh-brand)':'none',transition:'height .3s'}}/>
          <div style={{fontSize:11.5,color:'var(--faint)'}}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ── 迷你折线(sparkline) ─────────────────────────────────────────── */
function Spark({ pts, color='var(--brand)', w=140, h=34, fill=true }){
  const max=Math.max(...pts), min=Math.min(...pts), rng=(max-min)||1;
  const step=w/(pts.length-1);
  const xy=pts.map((p,i)=>[i*step, h-((p-min)/rng)*(h-6)-3]);
  const line=xy.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area=`${line} L${w} ${h} L0 ${h} Z`;
  const id='sg'+Math.random().toString(36).slice(2,7);
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={color} stopOpacity="0.22"/><stop offset="1" stopColor={color} stopOpacity="0"/>
      </linearGradient></defs>
      {fill&&<path d={area} fill={`url(#${id})`}/>}
      <path d={line} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/* ── 侧栏 ───────────────────────────────────────────────────────────── */
const NAV = [
  { ic:'home', label:'概览', on:true },
  { ic:'users', label:'客户' },
  { ic:'briefcase', label:'案件', badge:'7' },
  { ic:'wallet', label:'财务' },
  { ic:'building', label:'雇主' },
  { ic:'userplus', label:'介绍人' },
  { ic:'archive', label:'档案库' },
];
function Sidebar({ slim=false }){
  return (
    <aside className={`side ${slim?'side-slim':''}`}>
      <div className="side-brand">
        <span className="side-logo"><Icon name="shield" size={21}/></span>
        {!slim && <div><div className="bt">签证 CRM</div><div className="bs">移民事务工作台</div></div>}
      </div>
      <nav className="nav">
        {!slim && <div className="nav-lbl">主菜单</div>}
        {NAV.map((n,i)=>(
          <div key={i} className={`nav-item ${n.on?'on':''}`} title={n.label}>
            <Icon name={n.ic} size={21}/>
            {!slim && <span>{n.label}</span>}
            {!slim && n.badge && <span className="badge">{n.badge}</span>}
          </div>
        ))}
      </nav>
      {!slim && (
        <div className="side-foot">
          <Avatar name="Amy" size={36}/>
          <div style={{minWidth:0}}><div className="nm">Amy Chen</div><div className="rl">注册移民代理</div></div>
        </div>
      )}
    </aside>
  );
}

/* ── 数据 ───────────────────────────────────────────────────────────── */
const STAGES = [
  { name:'待办', value:6, color:'#94a3b8' },
  { name:'提名递交', value:8, color:'#3b82f6' },
  { name:'提名获批', value:5, color:'#0891b2' },
  { name:'签证递交', value:9, color:'#6366f1' },
  { name:'要求补件', value:3, color:'#f59e0b' },
  { name:'下签', value:7, color:'#10b981' },
];
const REVENUE = [
  { label:'1月', value:31 }, { label:'2月', value:28 }, { label:'3月', value:42 },
  { label:'4月', value:39 }, { label:'5月', value:48, hi:true, label2:'$48.6k' }, { label:'6月', value:22 },
];
const TODO_CASES = [
  { name:'张伟', visa:'482 雇主担保', stage:'提名递交', tone:'blue', due:'今天' },
  { name:'李娜', visa:'485 毕业生工签', stage:'待办', tone:'slate', due:'明天' },
  { name:'陈静', visa:'500 学生签', stage:'要求补件', tone:'amber', due:'逾期 2 天' },
  { name:'王强', visa:'186 永居', stage:'签证递交', tone:'indigo', due:'3 天后' },
  { name:'邓韬', visa:'482 Subsequent', stage:'待办', tone:'slate', due:'5 天后' },
  { name:'孙佳琪', visa:'186 Direct Entry', stage:'提名获批', tone:'cyan', due:'本周' },
];
const EXPIRY = [
  { name:'陈静', kind:'体检有效期', days:6, tone:'rose', ic:'clock' },
  { name:'王强', kind:'护照到期', days:18, tone:'amber', ic:'passport' },
  { name:'周婷', kind:'无犯罪证明', days:27, tone:'amber', ic:'doc' },
  { name:'刘洋', kind:'186 TRT 可办', days:null, tone:'indigo', ic:'shield' },
];
const LODGE = [
  { name:'周婷', visa:'482 提名', date:'2025-02-10', tone:'amber', status:'处理中', elapsed:111, total:120 },
  { name:'王强', visa:'186 签证', date:'2025-04-02', tone:'blue', status:'处理中', elapsed:60, total:150 },
  { name:'张伟', visa:'482 提名', date:'2025-05-18', tone:'blue', status:'处理中', elapsed:14, total:120 },
  { name:'陈静', visa:'500 签证', date:'2025-03-15', tone:'rose', status:'已超期', elapsed:78, total:60 },
  { name:'刘洋', visa:'189 签证', date:'2024-11-20', tone:'emerald', status:'已下签', elapsed:100, total:100 },
];
const barColor=(l)=> l.status==='已超期'?'#f43f5e':l.status==='已下签'?'#10b981':(l.elapsed/l.total>0.8?'#f59e0b':'#3b6bff');
const PAYMENTS = [
  { date:'06-01', name:'张伟', fee:'律师费', dir:'客户付款', dirTone:'emerald', method:'转账', amount:3000 },
  { date:'05-30', name:'王强', fee:'文案费', dir:'客户付款', dirTone:'emerald', method:'微信', amount:1200 },
  { date:'05-28', name:'王强', fee:'主代理费', dir:'付主代理', dirTone:'amber', method:'转账', amount:-5000 },
  { date:'05-25', name:'陈静', fee:'服务费', dir:'客户付款', dirTone:'emerald', method:'支付宝', amount:2500 },
  { date:'05-20', name:'刘洋', fee:'律师费', dir:'客户付款', dirTone:'emerald', method:'现金', amount:4000 },
];
/* 审批/补件队列(类 HRM 请假审批)*/
const APPROVALS = [
  { name:'陈静', kind:'补充体检报告', visa:'500', urg:'rose', when:'剩 6 天' },
  { name:'王强', kind:'护照续期确认', visa:'186', urg:'amber', when:'剩 18 天' },
  { name:'周婷', kind:'无犯罪证明上传', visa:'482', urg:'amber', when:'剩 27 天' },
];
/* 分组人员(类 HRM 出勤分组)*/
const GROUPS = [
  { title:'进行中', color:'#3b6bff', count:9, people:['张伟','王强','邓韬','孙佳琪'] },
  { title:'已超期', color:'#f43f5e', count:1, people:['陈静'] },
  { title:'已下签', color:'#10b981', count:7, people:['刘洋','周婷','李娜'] },
];
function MoneyAmt({ amount, signed=false }){
  const cls=!signed?'neu':amount>=0?'in':'out';
  const sign=signed?(amount>=0?'+':'−'):'';
  return <span className={`money ${cls}`}>{sign}${Math.abs(amount).toLocaleString('en-US')}</span>;
}

Object.assign(window, {
  Icon, Avatar, NameCell, Pill, Well, Donut, Gauge, BarChart, Spark, Sidebar, MoneyAmt,
  STAGES, REVENUE, TODO_CASES, EXPIRY, LODGE, barColor, PAYMENTS, APPROVALS, GROUPS, GRADS, hashIdx,
});
