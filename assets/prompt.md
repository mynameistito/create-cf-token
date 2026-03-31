Hey, please come up with a detailed comprehensive implementation plan to implement these changes on
 these issues.

x
Ask me questions relating how to implement these Issues, give me your suggested implementation for
each question.

The process we'll do is you'll go out your implementation plan should includ pre / post
implementation checks below;

Pre Implementation Checks:
- git checkout main && git pull
- create new branch


Post Implementation Checks:
- bun run check, if this fails, fix the issues and re-run. if passed, continue to next step.
- bun run typecheck if this fails, fix the issues and re-run. if passed, continue to next step.
- do a v8r check on the files changed (if they are yml), if this fails, fix the issues and re-run. if passed, continue
to next step.
- Create changeset with changes in reference to the main branch.
- commit push
