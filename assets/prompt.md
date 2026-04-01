Create a detailed, comprehensive implementation plan for the issues below. Ask any clarifying questions that would materially affect implementation, and for each question include your suggested implementation approach. Include the pre-implementation and post-implementation checks exactly as listed below.

## Pre Implementation Checks

- git checkout main && git pull
- create new branch

## Post Implementation Checks

- bun run check, if this fails, fix the issues and re-run. if passed, continue to next step.
- bun run typecheck if this fails, fix the issues and re-run. if passed, continue to next step.
- do a v8r check on the files changed (if they are yml), if this fails, fix the issues and re-run. if passed, continue to next step.
- Create changeset with changes in reference to the main branch.
- commit push
