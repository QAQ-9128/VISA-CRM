import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import {
  useCreateTask,
  useDeleteTask,
  useTasksByCase,
  useTasksByCustomer,
  useUpdateTask,
} from '../../hooks/queries/useTasks'
import { isTaskOverdue } from '../../lib/tasks'
import type { Task } from '../../types/models'

function TaskRow({ task }: { task: Task }) {
  const update = useUpdateTask()
  const del = useDeleteTask()
  const overdue = isTaskOverdue(task.due_date, task.is_done)

  return (
    <li className="flex items-center gap-2 border-b border-slate-100 py-2.5 last:border-0">
      <input
        type="checkbox"
        checked={task.is_done}
        disabled={update.isPending}
        onChange={(e) =>
          update.mutate({
            id: task.id,
            patch: { is_done: e.target.checked, done_at: e.target.checked ? new Date().toISOString() : null },
          })
        }
        className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
      />
      <span className={`min-w-0 flex-1 truncate text-sm ${task.is_done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
        {task.title}
      </span>
      {task.due_date && (
        <span className={`text-xs ${overdue ? 'font-medium text-rose-600' : 'text-slate-500'}`}>
          {task.due_date}
          {overdue ? ' · 逾期' : ''}
        </span>
      )}
      <button
        type="button"
        className="text-xs text-slate-400 hover:text-rose-600"
        onClick={() => {
          if (window.confirm('删除该待办？')) del.mutate(task.id)
        }}
      >
        删除
      </button>
    </li>
  )
}

/** 待办列表 + 添加。可挂客户或案件（在案件详情会同时带上 customer_id）。 */
export function TasksSection({ customerId, caseId }: { customerId?: string; caseId?: string }) {
  const byCase = useTasksByCase(caseId)
  const byCustomer = useTasksByCustomer(caseId ? undefined : customerId)
  const query = caseId ? byCase : byCustomer
  const create = useCreateTask()

  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')

  function handleAdd(e: FormEvent) {
    e.preventDefault()
    create.mutate(
      {
        title: title.trim(),
        due_date: dueDate || null,
        customer_id: customerId ?? null,
        case_id: caseId ?? null,
      },
      {
        onSuccess: () => {
          setTitle('')
          setDueDate('')
        },
      },
    )
  }

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-slate-900">待办</h2>

      <form onSubmit={handleAdd} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextField label="新待办" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如 催客户补交银行流水" />
        </div>
        <div className="sm:w-44">
          <TextField label="截止日期" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <Button type="submit" disabled={create.isPending || title.trim() === ''}>
          添加
        </Button>
      </form>

      {query.isPending ? (
        <p className="text-sm text-slate-400">加载待办…</p>
      ) : query.data && query.data.length > 0 ? (
        <ul className="rounded-xl border border-slate-200 bg-white px-3">
          {query.data.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">暂无待办</p>
      )}
    </section>
  )
}
