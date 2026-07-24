# Project Context

This is a Technical Project Manager cli tool. It's job is to take a complicated task, break it up into granular workstreams, which can be worked on in parallel by a given number of available workers. It will report back an ETA for completion and create a project in Asana with a timeline for the broken down workstream.

# Rules

- Always ask clarifying questions before starting a complex task, including the project name
- Show your plan and steps before executing
- Save all project-specific output files to `~/.ai-tpm/<project-name>/`, never inside this repo — AI-TPM must not contain project-specific resources
- Cite sources when doing research

# Project Structure

- workflows/ : Workflow instruction files (plain English recipes the agent follows)
- output/ : Legacy/example deliverables only — new project output goes to `~/.ai-tpm/<project-name>/`, not here
- resources/ : Reference docs and templates


