import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type TaskStatus = 'pending' | 'completed'

type Task = {
  id: string
  title: string
  description?: string
  scheduledDate: string
  scheduledTime?: string
  status: TaskStatus
  createdAt: string
  updatedAt: string
}

type TaskForm = {
  title: string
  scheduledTime: string
  description: string
}

const today = new Date()
const dateKey = (date: Date) => date.toISOString().slice(0, 10)
const todayKey = dateKey(today)
const storageKey = 'task-manager.tasks'

const initialTasks: Task[] = [
  { id: 'sample-1', title: 'Review the week ahead', scheduledDate: todayKey, scheduledTime: '08:30', status: 'completed', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'sample-2', title: 'Focus block: product planning', description: 'Shape the next small, useful release.', scheduledDate: todayKey, scheduledTime: '10:00', status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'sample-3', title: 'Walk and reset', scheduledDate: todayKey, scheduledTime: '13:00', status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'sample-4', title: 'Capture loose ends', scheduledDate: todayKey, status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
]

const formatDate = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', options).format(new Date(`${date}T12:00:00`))

const shiftDate = (date: string, days: number) => {
  const next = new Date(`${date}T12:00:00`)
  next.setDate(next.getDate() + days)
  return dateKey(next)
}

function App() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem(storageKey)
    return saved ? JSON.parse(saved) as Task[] : initialTasks
  })
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [form, setForm] = useState<TaskForm>({ title: '', scheduledTime: '', description: '' })

  useEffect(() => localStorage.setItem(storageKey, JSON.stringify(tasks)), [tasks])

  const dayTasks = useMemo(() => tasks
    .filter((task) => task.scheduledDate === selectedDate)
    .sort((a, b) => (a.scheduledTime || '99:99').localeCompare(b.scheduledTime || '99:99')), [tasks, selectedDate])
  const scheduledTasks = dayTasks.filter((task) => task.scheduledTime)
  const unscheduledTasks = dayTasks.filter((task) => !task.scheduledTime)
  const completedCount = dayTasks.filter((task) => task.status === 'completed').length
  const progress = dayTasks.length ? Math.round((completedCount / dayTasks.length) * 100) : 0
  const calendarDates = Array.from({ length: 7 }, (_, index) => shiftDate(selectedDate, index - 3))

  const openCreate = () => {
    setEditingTask(null)
    setForm({ title: '', scheduledTime: '', description: '' })
    setFormOpen(true)
  }

  const openEdit = (task: Task) => {
    setEditingTask(task)
    setForm({ title: task.title, scheduledTime: task.scheduledTime || '', description: task.description || '' })
    setFormOpen(true)
  }

  const saveTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.title.trim()) return
    const now = new Date().toISOString()
    if (editingTask) {
      setTasks((current) => current.map((task) => task.id === editingTask.id
        ? { ...task, ...form, title: form.title.trim(), scheduledDate: selectedDate, scheduledTime: form.scheduledTime || undefined, description: form.description.trim() || undefined, updatedAt: now }
        : task))
    } else {
      setTasks((current) => [...current, { id: crypto.randomUUID(), ...form, title: form.title.trim(), scheduledDate: selectedDate, scheduledTime: form.scheduledTime || undefined, description: form.description.trim() || undefined, status: 'pending', createdAt: now, updatedAt: now }])
    }
    setFormOpen(false)
  }

  const toggleTask = (id: string) => setTasks((current) => current.map((task) => task.id === id ? { ...task, status: task.status === 'completed' ? 'pending' : 'completed', updatedAt: new Date().toISOString() } : task))
  const deleteTask = (task: Task) => {
    if (window.confirm(`Delete “${task.title}”?`)) setTasks((current) => current.filter((item) => item.id !== task.id))
  }

  return (
    <main className="app-shell">
      <header className="topbar"><div className="brand-mark">tm</div><span className="brand-name">Task Manager</span><span className="eyebrow">Daily planning</span><button className="today-button" type="button" onClick={() => setSelectedDate(todayKey)}>Today</button></header>
      <nav className="date-strip" aria-label="Choose a date">
        <button className="icon-button" type="button" aria-label="Previous day" onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}>‹</button>
        {calendarDates.map((date) => <button className={`date-chip ${date === selectedDate ? 'selected' : ''} ${date === todayKey ? 'today' : ''}`} type="button" key={date} onClick={() => setSelectedDate(date)}><span>{formatDate(date, { weekday: 'short' })}</span><strong>{formatDate(date, { day: 'numeric' })}</strong>{tasks.some((task) => task.scheduledDate === date) && <i />}</button>)}
        <button className="icon-button" type="button" aria-label="Next day" onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}>›</button>
      </nav>

      <section className="content-grid">
        <div className="day-column">
          <div className="day-heading"><div><p className="section-kicker">Your schedule</p><h1>{formatDate(selectedDate, { weekday: 'long' })}</h1><p className="date-label">{formatDate(selectedDate, { month: 'long', day: 'numeric', year: 'numeric' })}</p></div><button className="primary-button" type="button" onClick={openCreate}><span>+</span> Add task</button></div>
          <div className="progress-panel"><div><p className="section-kicker">Daily progress</p><strong>{completedCount} <small>of {dayTasks.length} tasks complete</small></strong></div><div className="progress-value">{progress}%</div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div></div>
          {dayTasks.length === 0 ? <div className="empty-state"><span className="empty-icon">✦</span><h2>A clear day</h2><p>No tasks scheduled for this day.<br />Add something small to get started.</p><button className="text-button" type="button" onClick={openCreate}>Add your first task <span>→</span></button></div> : <div className="timeline">
            {scheduledTasks.map((task) => <TaskRow key={task.id} task={task} onToggle={toggleTask} onEdit={openEdit} onDelete={deleteTask} />)}
            {unscheduledTasks.length > 0 && <div className="unscheduled"><div className="unscheduled-heading"><span />Unscheduled</div>{unscheduledTasks.map((task) => <TaskRow key={task.id} task={task} onToggle={toggleTask} onEdit={openEdit} onDelete={deleteTask} />)}</div>}
          </div>}
        </div>
        <aside className="side-panel"><div className="quote-mark">“</div><p className="side-copy">Make space for the work that matters.</p><div className="side-rule" /><p className="side-note">A focused day is built one task at a time.</p><div className="mini-stats"><div><strong>{dayTasks.length}</strong><span>Total tasks</span></div><div><strong>{dayTasks.length - completedCount}</strong><span>To go</span></div></div></aside>
      </section>
      {formOpen && <div className="modal-backdrop" role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="task-form-title"><div className="modal-heading"><div><p className="section-kicker">{editingTask ? 'Edit task' : 'New task'}</p><h2 id="task-form-title">{editingTask ? 'Refine the plan' : 'What needs your attention?'}</h2></div><button className="close-button" type="button" aria-label="Close" onClick={() => setFormOpen(false)}>×</button></div><form onSubmit={saveTask}><label>Task title<input autoFocus value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Finish the proposal" required /></label><label>Time <span>(optional)</span><input type="time" value={form.scheduledTime} onChange={(event) => setForm({ ...form, scheduledTime: event.target.value })} /></label><label>Notes <span>(optional)</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Add a little context" rows={3} /></label><div className="form-actions"><button className="secondary-button" type="button" onClick={() => setFormOpen(false)}>Cancel</button><button className="primary-button" type="submit">{editingTask ? 'Save changes' : 'Create task'}</button></div></form></div></div>}
    </main>
  )
}

function TaskRow({ task, onToggle, onEdit, onDelete }: { task: Task; onToggle: (id: string) => void; onEdit: (task: Task) => void; onDelete: (task: Task) => void }) {
  return <article className={`task-row ${task.status}`}><div className="time-column">{task.scheduledTime ? formatDateTime(task.scheduledTime) : '—'}</div><button className="status-button" type="button" aria-label={`Mark ${task.title} ${task.status === 'completed' ? 'pending' : 'complete'}`} onClick={() => onToggle(task.id)}>{task.status === 'completed' ? '✓' : ''}</button><div className="task-body"><h3>{task.title}</h3>{task.description && <p>{task.description}</p>}<span className="status-label">{task.status === 'completed' ? 'Completed' : 'Pending'}</span></div><div className="task-actions"><button type="button" aria-label={`Edit ${task.title}`} onClick={() => onEdit(task)}>Edit</button><button type="button" aria-label={`Delete ${task.title}`} onClick={() => onDelete(task)}>Delete</button></div></article>
}

function formatDateTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  const suffix = hours >= 12 ? 'PM' : 'AM'
  return `${hours % 12 || 12}:${minutes.toString().padStart(2, '0')} ${suffix}`
}

export default App
