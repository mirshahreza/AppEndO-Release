// Reserved system function — never executed.
// jobServerFunctionExecutor.ts intercepts functionId "workflow-engine.scheduled-start"
// natively and calls startWorkflowInstance() in-process instead of running this sandbox.
// This placeholder exists only so the record satisfies SchedulerService.evaluateDueTasks's
// "does the function exist" check (see scheduleBindingAdapter.ts).
module.exports = function handler(req, res) {
  res.status(500).json({ error: "This reserved function must never run through the sandbox." });
};