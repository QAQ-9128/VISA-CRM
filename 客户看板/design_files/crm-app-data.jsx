/* 签证 CRM 产品原型 — 互联 mock 数据(虚构但贴近澳洲移民业务) */

/* 阶段:键 → 标签 + Pill 色调(对齐 domain.ts) */
const STAGE = {
  todo:{l:'待办',t:'slate'}, drafted:{l:'已草拟',t:'amber'}, nomination_lodged:{l:'提名递交',t:'blue'},
  nomination_approved:{l:'提名获批',t:'cyan'}, visa_lodged:{l:'签证递交',t:'indigo'}, docs_requested:{l:'要求补件',t:'amber'},
  docs_completed:{l:'补件完毕',t:'teal'}, granted:{l:'下签',t:'emerald'}, refused:{l:'拒签',t:'rose'},
  appeal:{l:'上诉/复议',t:'violet'}, withdrawn:{l:'主动撤签',t:'slate'},
};
const STAGE_ORDER = ['todo','drafted','nomination_lodged','nomination_approved','visa_lodged','docs_requested','docs_completed','granted'];

/* 客户家庭分组 */
const FAMILIES = [
  { primary:{ name:'张伟', source:'green', star:true, debt:'owe',
      cases:[{visa:'482 雇主担保',pos:'厨师',emp:'金煌餐饮集团',stage:'nomination_lodged'}] },
    subs:[
      { name:'李娜', rel:'配偶', source:'green', linked:false, cases:[{visa:'482 Subsequent',stage:'todo'}] },
      { name:'张小宝', rel:'子女', source:'green', linked:false, cases:[{visa:'482 Subsequent',stage:'todo'}] },
    ] },
  { primary:{ name:'王强', source:'red', star:false, debt:'paid',
      cases:[{visa:'186 永居',pos:'IT 经理',emp:'澳信科技',stage:'visa_lodged'}] }, subs:[] },
  { primary:{ name:'陈静', source:'yellow', star:true, debt:'owe',
      cases:[{visa:'500 学生签',stage:'docs_requested'}] },
    subs:[ { name:'Sarah Chen', rel:'配偶', source:'yellow', linked:true, cases:[{visa:'485 毕业生工签',stage:'granted'}] } ] },
  { primary:{ name:'刘洋', source:'green', star:false, debt:'none',
      cases:[{visa:'189 独立技术',stage:'granted'}] }, subs:[] },
  { primary:{ name:'周婷', source:'red', star:false, debt:'owe',
      cases:[{visa:'482 提名',pos:'市场专员',emp:'悉尼贸易',stage:'nomination_approved'}] }, subs:[] },
  { primary:{ name:'孙佳琪', source:'green', star:false, debt:'none',
      cases:[{visa:'186 Direct Entry',pos:'会计',emp:'诚信会计师事务所',stage:'docs_completed'}] }, subs:[] },
];

/* 案件列表 */
const CASES = [
  { name:'张伟', visa:'482 雇主担保', stream:'Core Skills', emp:'金煌餐饮集团', stage:'nomination_lodged', updated:'2025-05-28' },
  { name:'王强', visa:'186 永居', stream:'Direct Entry', emp:'澳信科技', stage:'visa_lodged', updated:'2025-05-26' },
  { name:'陈静', visa:'500 学生签', stream:'', emp:'—', stage:'docs_requested', updated:'2025-05-25', urgent:true },
  { name:'周婷', visa:'482 提名', stream:'Core Skills', emp:'悉尼贸易', stage:'nomination_approved', updated:'2025-05-22' },
  { name:'孙佳琪', visa:'186 永居', stream:'Direct Entry', emp:'诚信会计', stage:'docs_completed', updated:'2025-05-20' },
  { name:'刘洋', visa:'189 独立技术', stream:'', emp:'—', stage:'granted', updated:'2025-05-12' },
  { name:'Sarah Chen', visa:'485 毕业生工签', stream:'', emp:'—', stage:'granted', updated:'2025-04-30' },
  { name:'李娜', visa:'482 Subsequent', stream:'', emp:'—', stage:'todo', updated:'2025-05-28' },
];

/* 案件详情:张伟 482 */
const DETAIL = {
  name:'张伟', visa:'482', stream:'Core Skills', visaLabel:'482 (Core Skills) 雇主担保', country:'澳大利亚',
  customer:'张伟', employer:'金煌餐饮集团', position:'厨师', currentStage:'nomination_lodged',
  timeline:[
    { stage:'todo', date:'2025-01-10', note:'建档,收集材料清单' },
    { stage:'drafted', date:'2025-02-02', note:'提名文件草拟完成' },
    { stage:'nomination_lodged', date:'2025-05-18', note:'提名已递交移民局', cur:true },
  ],
  lodgements:[
    { type:'提名', date:'2025-05-18', outcome:'pending', outcomeT:'amber', elapsed:14, total:120 },
    { type:'签证', date:null, outcome:null, elapsed:0, total:0 },
  ],
  pay:{ billed:8000, received:6800, owe:1200, toCompanyBilled:5000, toCompanyPaid:5000,
    txns:[
      { date:'2025-06-01', dir:'客户付款', dirT:'emerald', fee:'律师费', method:'转账', amount:3000 },
      { date:'2025-05-20', dir:'客户付款', dirT:'emerald', fee:'文案费', method:'微信', amount:1800 },
      { date:'2025-05-18', dir:'付主代理', dirT:'amber', fee:'主代理费', method:'转账', amount:-5000 },
      { date:'2025-03-04', dir:'客户付款', dirT:'emerald', fee:'服务费', method:'支付宝', amount:2000 },
    ] },
  docs:[
    { type:'护照', name:'张伟护照', expiry:'2027-08', status:'ok' },
    { type:'体检', name:'BUPA 体检报告', expiry:'2025-06 到期', status:'warn' },
    { type:'英语成绩', name:'PTE 65', expiry:'2026-03', status:'ok' },
    { type:'雇佣证明', name:'雇佣合同 + 工资单', expiry:'', status:'ok' },
  ],
  records:[
    { type:'task', done:false, text:'催客户补交最新体检报告', due:'今天' },
    { type:'follow_up', emoji:'📞', text:'电话沟通:已通知客户提名进度,客户知悉', date:'2025-05-28' },
    { type:'task', done:true, text:'递交提名申请', due:'已完成' },
    { type:'follow_up', emoji:'💬', text:'微信:发送材料清单给客户', date:'2025-01-12' },
  ],
};

/* 财务 */
const FIN = {
  receivables:[
    { name:'张伟', visa:'482', billed:8000, received:6800, owe:1200, color:'owe' },
    { name:'陈静', visa:'500', billed:5000, received:2500, owe:2500, color:'owe' },
    { name:'王强', visa:'186', billed:12000, received:12000, owe:0, color:'paid' },
    { name:'周婷', visa:'482', billed:6000, received:1500, owe:4500, color:'owe' },
    { name:'孙佳琪', visa:'186', billed:9000, received:9000, owe:0, color:'paid' },
  ],
  totals:{ income:48600, expense:14000, net:34600 },
  receipts:[
    { date:'06-01', name:'张伟', fee:'律师费', method:'转账', amount:3000 },
    { date:'05-30', name:'王强', fee:'文案费', method:'微信', amount:1200 },
    { date:'05-25', name:'陈静', fee:'服务费', method:'支付宝', amount:2500 },
    { date:'05-20', name:'张伟', fee:'文案费', method:'微信', amount:1800 },
    { date:'05-12', name:'刘洋', fee:'律师费', method:'现金', amount:4000 },
  ],
  payouts:[
    { date:'05-28', label:'付主代理 · 王强（案件）', method:'转账', amount:5000, dir:'company' },
    { date:'05-18', label:'付主代理 · 张伟（案件）', method:'转账', amount:5000, dir:'company' },
    { date:'05-15', label:'付介绍人 · 林老师佣金', method:'微信', amount:2000, dir:'referrer' },
    { date:'05-08', label:'付介绍人 · 陈姐佣金', method:'转账', amount:2000, dir:'referrer' },
  ],
};

Object.assign(window, { STAGE, STAGE_ORDER, FAMILIES, CASES, DETAIL, FIN });
