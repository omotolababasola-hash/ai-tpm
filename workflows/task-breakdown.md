# Workflow: Task Breakdown into Parallel Workstreams

## Purpose
Take a complicated task plus a number of available workers, decompose the task
into the smallest independent units of work ("workstreams") that can run in
parallel, estimate an ETA, and write a structured deliverable to `output/`.
This workflow stops at the breakdown — it does not create the Asana project
or timeline. That's a separate, later workflow that will consume this file's
output.

## Trigger
User gives a task description and a number of available workers (e.g. "Here's
the task, I have 4 workers").

## Steps

### 1. Ask clarifying questions before doing anything else
Do not start researching or decomposing until you understand the scope. At minimum, confirm:
- **Project name** — a short name/slug used to create the project's output folder (see Step 5). Must be unique among folders already in `~/.ai-tpm/`.
- **Task scope and definition of done** — what does "complete" mean for the overall task?
- **Number of workers** and whether they're interchangeable or have different skills/specialties.
- **Hard constraints** — deadline, budget, required tools/systems, anything that can't change.
- **Known dependencies or sequencing** the user already knows about (e.g. "design must finish before build starts").
- **What's out of scope** — anything adjacent that should explicitly NOT be included.

Only proceed once these are answered or the user says to use your judgment.

### 2. Research the task
If the task touches unfamiliar domain, tools, or systems, research before decomposing.
- Cite every source used (title + URL) — these go in the `task.sources` array of the output.
- If researching a codebase instead of the open web, cite file paths instead of URLs.

### 3. Decompose into workstreams
Break the task into the **smallest independent units of work** — finer-grained
than "balanced chunks per worker." Workers pick up new workstreams as they
finish, rather than being locked into one large pre-assigned chunk.

For each workstream, capture:
- `id` (WS-1, WS-2, ...)
- `title` and `description` specific enough that a worker could pick it up cold
- `definition_of_done`
- `depends_on` — list of other workstream IDs that must complete first (empty if none)
- `estimated_hours`
- `skills_required`
- `risk_notes` if the estimate or scope is uncertain

Bias toward independence: if two pieces of work don't strictly need to be
sequential, they are two workstreams, not one.

### 4. Compute the schedule and ETA
Use list scheduling (longest-processing-time-first), respecting `depends_on`, across `num_workers`:
1. Topologically order workstreams by dependency.
2. At each step, from workstreams whose dependencies are satisfied, assign the
   longest remaining one to whichever worker frees up soonest.
3. Track each worker's cumulative hours and assigned workstream IDs.
4. The makespan (wall-clock hours) is the max across all workers.
5. Convert wall-clock hours to business days (8h/day) and project an
   `estimated_completion_date` from today, skipping weekends.
6. Record the `critical_path` — the dependency chain that determines the makespan.

### 5. Write the output
AI-TPM itself must never accumulate project-specific files — all deliverables
live outside this repo, under a per-project folder in `~/.ai-tpm/`.
- If `~/.ai-tpm/` doesn't exist, create it.
- Create `~/.ai-tpm/<project-name>/` using the project name from Step 1 (slugified).
- Save two files there:
  - `~/.ai-tpm/<project-name>/<slug>-workstreams.json` — structured data
    following the schema in
    [resources/workstream-schema.json](../resources/workstream-schema.json),
    ready to feed the future Asana workflow.
  - `~/.ai-tpm/<project-name>/<slug>-summary.md` — human-readable summary:
    task recap, workstream list with dependencies, per-worker assignment
    table, ETA, and cited sources.

### 6. Report back
Give the user a short summary: number of workstreams, ETA (date + business
days), and the critical path. Point to the two output files rather than
pasting the full breakdown into chat.

## Notes
- If a workstream would need a skill none of the workers have, flag it in
  `risk_notes` rather than silently assigning it.
- If dependencies make it impossible to use all workers efficiently (e.g. a
  long linear chain with few branches), say so explicitly — more workers
  won't shorten the ETA past the critical path.
