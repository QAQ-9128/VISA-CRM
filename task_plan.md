# 案件类型「职业评估」专属改造（feat/occupational-assessment）

## 已确认决策
- 初始阶段：沿用 DB 默认 `todo`（零额外迁移；StageControl 现有「未列出当前阶段补到列首」逻辑显示，首推进入 7 个 OA 阶段）。
- OA「切换到」下拉：用现有 FancySelect（彩色圆点 + 打勾）；签证类保持原生 Select 不动。
- 阶段名：纯英文（按 §4 + 可交互 HTML）。
- §7 里程碑卡：OA 显「技术评估递交 / 评估结果」，从阶段史派生日期（Skill Assessment Submitted / Positive|Negative Outcome）。

## 🔒 不变量
账目算法零改（computeAccounting/getCaseTotals）；案件即组（OA 单人，仅前端隐藏账号/组，底层结构/归账不动）；本地日期禁未来；颜色走 lib/statusColor 单一来源；additive migration、不动 RLS；只改职业评估，签证类零回归。

## OA 7 阶段（stage key → 英文 label → 状态类别色）
- oa_chn_verification → CHN Qualifications Verification Submitted → waiting 蓝
- oa_skill_submitted → Skill Assessment Submitted → waiting 蓝
- oa_rfe → Request further evidence → action 黄
- oa_responded → Responded → inProgress 灰
- oa_approved → Approved → done 绿
- oa_positive → Positive Outcome → done 绿
- oa_negative → Negative Outcome → terminated 红

## 步骤
- [ ] 1 types/domain：OCCUPATIONAL_STAGES + OccupationalStage + 扩 CaseStage + CASE_STAGE_LABELS(7 英文)
- [ ] 2 statusColor：STAGE_CATEGORY 加 7 OA（映射现有 6 类，无新色）+ test
- [ ] 3 lib/caseStages：stagesForCategory(category) 纯函数 + test
- [ ] 4 lib/occupationalMilestones：selectOccupationalMilestones(history) + test
- [ ] 5 migration 0043：扩 3 处 CHECK 加 7 值（additive，沿用 0033 列表）
- [ ] 6 StageControl：按 caseCategory 选阶段集合；OA 用 FancySelect（dot+check），签证原生 Select 不动
- [ ] 7 StageProgressCard：传 caseRow.case_category
- [ ] 8 CaseForm：isOccupational 隐藏 ImmiAccountSelect + 组块；提交 applicantIds=[]
- [ ] 9 RelatedCasesCard：OA 里程碑卡（技术评估递交/评估结果）
- [ ] 10 单测：表单条件渲染 / OA 下拉集合=7 / 流转写入(from→to/日期/备注·禁未来) / 账目未改
- [ ] 11 build+lint+test:run 全绿
- [ ] 12 截图 + 回报 + memory
