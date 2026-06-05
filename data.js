/* 签证 CRM 仪表盘 · 共享 mock 数据 */
window.CRM = {
  user: { name: 'Amy', sub: '今天有 3 件待办 · 2 个临近到期提醒 · 本月已收款 $48,600' },

  // 概览统计(数字 + 升降趋势)
  stats: [
    { icon:'briefcase', label:'进行中案件', value:'38',      trend:'2.5%', dir:'up' },
    { icon:'check',     label:'待办事项',   value:'12',      trend:'3 件', dir:'flat' },
    { icon:'wallet',    label:'本月收款 (AUD)', value:'$48,600', trend:'8.2%', dir:'up' },
    { icon:'alert',     label:'未付总额 (AUD)', value:'$21,400', trend:'3.1%', dir:'down' },
  ],

  // 案件阶段分布(环形 / 条形 / 占比)
  stages: [
    { key:'todo',  label:'待办',     value:6, cls:'st-todo',  color:'#94a3b8' },
    { key:'nom',   label:'提名递交', value:8, cls:'st-nom',   color:'#4361ee' },
    { key:'nomok', label:'提名获批', value:5, cls:'st-nomok', color:'#06b6d4' },
    { key:'visa',  label:'签证递交', value:9, cls:'st-visa',  color:'#7c5cfc' },
    { key:'docs',  label:'要求补件', value:3, cls:'st-docs',  color:'#f59e0b' },
    { key:'grant', label:'下签',     value:7, cls:'st-grant', color:'#16a34a' },
  ],
  stageTotal: 38,

  // 性别/来源占比(给环形图右卡用,对应参考图 Total Employees)
  split: { total:38, parts:[
    { label:'客户付款', value:24, color:'#4361ee' },
    { label:'付主代理', value:14, color:'#16181f' },
  ]},

  // 待审批事项(对应参考图 Leave Request:可通过/驳回)
  approvals: [
    { h:0, nm:'张伟', ini:'张', id:'EMP·00001', type:'补件提交', tag:'482 提名',  date:'2025-06-08', note:'客户已上传补充材料' },
    { h:1, nm:'李娜', ini:'李', id:'EMP·00007', type:'付款登记', tag:'文案费',    date:'2025-06-07', note:'$1,200 客户付款待确认' },
    { h:2, nm:'王强', ini:'王', id:'EMP·00003', type:'阶段推进', tag:'186 永居',  date:'2025-06-06', note:'签证递交 → 待下签' },
  ],

  // 三栏人员/案件列表
  recent: { title:'近期案件', date:'06 月 01 日', rows:[
    { h:0, nm:'张伟', ini:'张', meta:'482 雇主担保', badge:'提名递交', cls:'st-nom' },
    { h:2, nm:'李娜', ini:'李', meta:'485 毕业生工签', badge:'待办', cls:'st-todo' },
    { h:4, nm:'王强', ini:'王', meta:'186 永居', badge:'签证递交', cls:'st-visa' },
    { h:5, nm:'刘洋', ini:'刘', meta:'189 独立技术', badge:'下签', cls:'st-grant' },
  ]},
  expiry: { title:'即将到期', date:'06 月 01 日', rows:[
    { h:1, nm:'陈静', ini:'陈', meta:'体检有效期', day:'6 天',  dcls:'warn' },
    { h:0, nm:'王强', ini:'王', meta:'护照到期',   day:'18 天', dcls:'soft' },
    { h:6, nm:'周婷', ini:'周', meta:'无犯罪证明', day:'27 天', dcls:'soft' },
    { h:4, nm:'刘洋', ini:'刘', meta:'186 TRT 可办', day:'可办', dcls:'ok' },
  ]},
  overdue: { title:'逾期未付', date:'06 月 01 日', rows:[
    { h:1, nm:'陈静', ini:'陈', meta:'500 学生签', day:'超 18 天', dcls:'warn' },
    { h:3, nm:'赵敏', ini:'赵', meta:'分期 2 / 3', day:'超 5 天',  dcls:'warn' },
    { h:7, nm:'孙浩', ini:'孙', meta:'律师费',     day:'超 2 天',  dcls:'warn' },
  ]},
};
