---
name: design-preference-ledger
description: Use whenever a user or author states a preference between design or engineering options - "use X instead of Y", "always do X", "never do Z", "actually, let's do it this way", or corrects an approach you proposed. Records the preference to a repo-local ledger with a restatement counter, so a choice repeated twice outranks one stated once and a choice repeated three times becomes a hard constraint. Use before proposing an approach, to check what has already been decided.
---

# Design preference ledger

People repeat themselves when an agent keeps not listening. This skill makes
repetition mechanical: every restatement raises the rank of a preference, until
it stops being a suggestion and becomes a constraint.

The ledger lives at `docs/frontend-preferences.md`. It is a file in the repo, so
it survives across sessions, works for any agent, and shows up in code review.

## Read before you propose

Before proposing an approach, read the ledger. Hard rules are constraints.
Contradicting a strong preference without acknowledging it is how you get told a
third time.

## Recognizing a preference

Record when someone expresses a durable choice between options:

- "Use X instead of Y"
- "Always ..." / "Never ..." / "Don't ever ..."
- "Actually, let's do it this way"
- "I prefer ..." / "I like ... better"
- A correction to something you proposed, where they chose the alternative
- A choice made when you offered options

Do **not** record:

- One-off instructions scoped to the current task — "make this button blue" is a
  task, "we always use the primary token for buttons" is a preference
- Facts about the codebase — those belong in documentation
- Your own suggestions. An agent's proposal is not an author's preference, and
  the two must never end up in the same list

## Ranks

| Times stated | Rank | Behavior |
| --- | --- | --- |
| 1 | Preference | Follow it. You may propose an alternative, with reasoning. |
| 2 | Strong preference | Follow it. Do not re-propose the rejected option. |
| 3 or more | Hard rule | A constraint. Violating it is a defect, not a disagreement. |

## Recording

**Check for an existing entry first.** This is the whole mechanism. A preference
restated in different words is the *same* preference — increment its count, do
not append a near-duplicate. Match on meaning, not on wording.

When you increment past a threshold, say so in the conversation: *"That is the
third time — recording it as a hard rule."* The point is that the person can see
they were heard, and stop having to repeat it.

Entry format:

```markdown
### Short statement of the preference

- **Rejected:** what was chosen against
- **Stated:** N times · first YYYY-MM-DD · last YYYY-MM-DD
- **Note:** the reasoning, if given
```

Keep the file grouped by rank, hard rules first. When a preference is promoted,
move it into the higher section.

## Retiring an entry

Preferences change. When someone contradicts a recorded one, do not silently
flip it — say what is on record and ask whether it is being reversed. If it is,
strike the entry with the date and reason rather than deleting it. A ledger you
can rewrite invisibly is not worth trusting.

## Agent memory

If you have your own persistent memory, mirror entries into it so they apply
outside this repo. The file remains the source of truth: it is the copy a human
can read, review, and correct.

## Keep it separate

Proposals you made that the author has not ruled on go in a clearly separate
section at the bottom, never mixed into the ranked list. An agent's idea must not
be able to become an author's preference by sitting quietly in the same file.
