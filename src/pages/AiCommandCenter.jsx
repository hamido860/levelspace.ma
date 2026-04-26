import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Bot, CheckCircle2, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Layout } from "../components/Layout";
import { SEO } from "../components/SEO";
import { IssueCard } from "../components/ai/IssueCard";
import { ExecuteTaskModal } from "../components/ai/ExecuteTaskModal";
import { TaskStatusBoard } from "../components/ai/TaskStatusBoard";
import { TaskLogViewer } from "../components/ai/TaskLogViewer";
import { ApprovalPanel } from "../components/ai/ApprovalPanel";
import {
  approveTask,
  createTask,
  getIssues,
  getTaskApproval,
  getTaskById,
  getTaskLogs,
  getTasks,
  rejectTask,
  runAudit,
  runTask,
} from "../services/aiCommandCenterService";

const metricCardClass = "rounded-[28px] border border-surface-mid bg-paper p-5 shadow-sm shadow-ink/5";

const summarizeLogs = (task, logs) => {
  if (!task) return "";
  return logs[logs.length - 1]?.message || task.instructions || "Waiting for the next agent handoff.";
};

export const AiCommandCenter = () => {
  const [issues, setIssues] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedTaskLogs, setSelectedTaskLogs] = useState([]);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadBoard = async ({ keepSelection = true } = {}) => {
    setLoading(true);
    try {
      const [issuesData, tasksData] = await Promise.all([getIssues(), getTasks()]);
      const enrichedTasks = await Promise.all(
        tasksData.map(async (task) => {
          const logs = selectedTask?.id === task.id ? selectedTaskLogs : [];
          return {
            ...task,
            latestLogMessage: logs.length > 0 ? logs[logs.length - 1].message : task.instructions,
          };
        }),
      );

      setIssues(issuesData);
      setTasks(enrichedTasks);

      if (keepSelection && selectedTask?.id) {
        const refreshedTask = enrichedTasks.find((task) => task.id === selectedTask.id);
        if (refreshedTask) {
          await hydrateTaskSelection(refreshedTask.id, refreshedTask);
        }
      }
    } catch (error) {
      toast.error("Unable to load AI Command Center.", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const hydrateTaskSelection = async (taskId, fallbackTask = null) => {
    try {
      const [task, logs, approval] = await Promise.all([
        fallbackTask ? Promise.resolve(fallbackTask) : getTaskById(taskId),
        getTaskLogs(taskId),
        getTaskApproval(taskId),
      ]);

      setSelectedTask(task);
      setSelectedTaskLogs(logs);
      setSelectedApproval(approval);
    } catch (error) {
      toast.error("Unable to load task details.", {
        description: error.message,
      });
    }
  };

  useEffect(() => {
    loadBoard({ keepSelection: false });
    const interval = window.setInterval(() => loadBoard(), 8000);
    return () => window.clearInterval(interval);
  }, []);

  const latestTaskByIssue = issues.reduce((accumulator, issue) => {
    const relatedTasks = tasks
      .filter((task) => task.issue_id === issue.id)
      .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime());
    accumulator[issue.id] = relatedTasks[0] || null;
    return accumulator;
  }, {});

  const handleOpenExecute = (issue) => {
    setSelectedIssue(issue);
    setModalOpen(true);
  };

  const handleViewLogs = async (issue) => {
    const latestTask = latestTaskByIssue[issue.id];
    if (!latestTask) {
      toast.info("No task logs yet for this issue.");
      return;
    }
    await hydrateTaskSelection(latestTask.id, latestTask);
  };

  const handleCreateTask = async (payload) => {
    setBusy(true);
    try {
      const result = await createTask(payload);
      toast.success("Task created.", {
        description: "Planner prepared the execution sequence and, when needed, opened an approval gate.",
      });
      setModalOpen(false);
      await loadBoard({ keepSelection: false });
      await hydrateTaskSelection(result.task.id);
    } catch (error) {
      toast.error("Unable to create task.", {
        description: error.message,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRunAudit = async (payload) => {
    setBusy(true);
    try {
      const result = await createTask({
        ...payload,
        task_name: payload.task_name || `Audit: ${selectedIssue.title}`,
        task_type: "audit",
        safety_level: "read_only",
        execution_mode: "dry_run",
        requires_approval: false,
      });
      await runAudit(result.task.id);
      toast.success("Audit completed.", {
        description: "Read-only diagnostics and RAG checks were written to the task log.",
      });
      setModalOpen(false);
      await loadBoard({ keepSelection: false });
      await hydrateTaskSelection(result.task.id);
    } catch (error) {
      toast.error("Unable to run audit.", {
        description: error.message,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSelectTask = async (task) => {
    await hydrateTaskSelection(task.id, task);
  };

  const handleRunTask = async (task) => {
    setBusy(true);
    try {
      await runTask(task.id);
      toast.success("Task execution finished.", {
        description: "Validator and Reporter updated the final result.",
      });
      await loadBoard();
      await hydrateTaskSelection(task.id);
    } catch (error) {
      toast.error("Task execution blocked.", {
        description: error.message,
      });
      await loadBoard();
      await hydrateTaskSelection(task.id);
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedTask) return;
    setBusy(true);
    try {
      await approveTask(selectedTask.id);
      toast.success("Approval granted.");
      await loadBoard();
      await hydrateTaskSelection(selectedTask.id);
    } catch (error) {
      toast.error("Unable to approve task.", { description: error.message });
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!selectedTask) return;
    setBusy(true);
    try {
      await rejectTask(selectedTask.id);
      toast.success("Task rejected and blocked.");
      await loadBoard();
      await hydrateTaskSelection(selectedTask.id);
    } catch (error) {
      toast.error("Unable to reject task.", { description: error.message });
    } finally {
      setBusy(false);
    }
  };

  const openIssueCount = issues.filter((issue) => issue.status === "open").length;
  const criticalIssueCount = issues.filter((issue) => issue.severity === "critical").length;
  const waitingApprovalCount = tasks.filter((task) => task.status === "waiting_approval").length;
  const completedTaskCount = tasks.filter((task) => task.status === "completed").length;

  return (
    <Layout fullWidth>
      <SEO
        title="AI Task Command Center"
        description="Human-controlled AI operations dashboard for issue remediation, audits, approvals, execution, and validation."
      />

      <div className="space-y-8 p-4 md:p-6">
        <section className="overflow-hidden rounded-[36px] bg-[radial-gradient(circle_at_top_left,_rgba(18,70,255,0.16),_transparent_45%),linear-gradient(135deg,#091226_0%,#101827_35%,#172033_100%)] p-6 text-white shadow-2xl shadow-slate-900/10">
          <div className="grid gap-8 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white/80">
                <Sparkles className="h-4 w-4" />
                AI Task Command Center
              </div>

              <div className="space-y-3">
                <h1 className="max-w-3xl text-3xl font-bold md:text-5xl">
                  Turn AI issue analysis into controlled execution with approvals, validation, and a permanent log trail.
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-white/72 md:text-base">
                  This is the operations layer for your education SaaS. The analyzer finds broken mappings, failed jobs,
                  RAG gaps, curriculum holes, and relation mismatches. The command center converts each issue into a guarded AI crew workflow with human sign-off before any write happens.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => loadBoard()}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh board
                </button>
                <Link
                  to="/admin"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white/90 transition-colors hover:bg-white/10"
                >
                  Back to Admin
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[28px] border border-white/10 bg-white/8 p-5 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-300" />
                  <p className="text-sm font-semibold text-white/90">Open issues</p>
                </div>
                <p className="mt-4 text-4xl font-bold">{openIssueCount}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-white/45">{criticalIssueCount} critical</p>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/8 p-5 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-emerald-300" />
                  <p className="text-sm font-semibold text-white/90">Waiting approval</p>
                </div>
                <p className="mt-4 text-4xl font-bold">{waitingApprovalCount}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-white/45">No destructive action passes without review</p>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/8 p-5 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <Bot className="h-5 w-5 text-sky-300" />
                  <p className="text-sm font-semibold text-white/90">AI crew tasks</p>
                </div>
                <p className="mt-4 text-4xl font-bold">{tasks.length}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-white/45">Planner → Auditor → Worker → Validator</p>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/8 p-5 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                  <p className="text-sm font-semibold text-white/90">Completed tasks</p>
                </div>
                <p className="mt-4 text-4xl font-bold">{completedTaskCount}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-white/45">Every task ends with validation and report</p>
              </div>
            </div>
          </div>
        </section>

        <section className={metricCardClass}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-muted">Issue Dashboard</p>
              <h2 className="mt-2 text-2xl font-bold text-ink">Detected AI issues ready for controlled execution</h2>
            </div>
            <div className="rounded-full bg-surface-low px-3 py-1 text-xs font-semibold text-ink-secondary">
              {issues.length} issue{issues.length === 1 ? "" : "s"}
            </div>
          </div>

          {loading && issues.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-surface-mid p-8 text-sm text-ink-muted">
              Loading issue cards and execution tasks…
            </div>
          ) : issues.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-surface-mid p-8 text-sm text-ink-muted">
              No AI issues have been recorded yet. Once the analyzer flags lesson generation, RAG, or profile-state problems, they will appear here as executable issue cards.
            </div>
          ) : (
            <div className="grid gap-5 2xl:grid-cols-2">
              {issues.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  latestTask={latestTaskByIssue[issue.id]}
                  onExecute={handleOpenExecute}
                  onViewLogs={handleViewLogs}
                />
              ))}
            </div>
          )}
        </section>

        <section className={metricCardClass}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-muted">Task Status Board</p>
              <h2 className="mt-2 text-2xl font-bold text-ink">AI crew execution pipeline</h2>
            </div>
            <div className="text-sm text-ink-muted">
              Visible states include pending, auditing, approval waits, validation, failures, and blocks.
            </div>
          </div>

          <TaskStatusBoard
            tasks={tasks}
            selectedTaskId={selectedTask?.id}
            onSelectTask={handleSelectTask}
            onRunTask={handleRunTask}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <TaskLogViewer task={selectedTask} logs={selectedTaskLogs} />
          <div className="space-y-6">
            <ApprovalPanel
              task={selectedTask}
              approval={selectedApproval}
              busy={busy}
              onApprove={handleApprove}
              onReject={handleReject}
            />

            <div className="rounded-[28px] border border-surface-mid bg-paper p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-muted">Final Report Rules</p>
              <div className="mt-4 rounded-3xl bg-surface-low/70 p-4 text-sm text-ink-secondary">
                <p className="font-semibold text-ink">Every completed task should leave behind:</p>
                <ul className="mt-3 space-y-2">
                  <li>Task status and root cause summary</li>
                  <li>Actions taken and records affected</li>
                  <li>Jobs retried, completed, and still failed</li>
                  <li>Blocked reasons when execution cannot continue</li>
                  <li>Validator result and recommended next action</li>
                </ul>
              </div>
              {selectedTask && (
                <p className="mt-4 text-xs text-ink-muted">
                  Latest summary: {summarizeLogs(selectedTask, selectedTaskLogs)}
                </p>
              )}
            </div>
          </div>
        </section>
      </div>

      <ExecuteTaskModal
        issue={selectedIssue}
        open={modalOpen}
        busy={busy}
        onClose={() => setModalOpen(false)}
        onCreateTask={handleCreateTask}
        onRunAudit={handleRunAudit}
      />
    </Layout>
  );
};
