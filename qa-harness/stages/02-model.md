# Stage 2: model

Read qa-harness/RULES.md first if you have not already this session.

Input: the ticket ID.

Read qa-artifacts/<ticket>/exploration.md or use imported observations that
meet the [investigation contract](../CONTRACT.md). Cite their source and
location in the model. Write no test code and no risks.

Build a model of the flow from the observations only.

Write to qa-artifacts/<ticket>/flow-model.md:

```markdown
# Flow model: <flow name>
Source: <exploration.md or imported observation source(s), with locators>
Modelled: <ISO date>

## States
| State | How the user knows they are in it | Entered from |

## Transitions
| From | Action | To | Observed? |

## Inputs and outputs
| Input | Where it goes | Visible result | Persisted result |

## Dependencies
- <external systems, prior state, or data this flow relies on>

## Unobserved transitions
- <every transition that plausibly exists but was not walked>
```

Rules:
- Mark a transition "Observed: yes" only if the cited source actually
  recorded it. Everything else is "no", including transitions that obviously
  must exist.
- The Unobserved transitions list is the most useful output of this stage. Do
  not leave it empty to make the model look complete.
- Under Persisted result, preserve any uncertainty recorded by the cited
  source. For imported evidence without a persistence observation, write
  "unknown — not established by supplied observations." Do not guess.
- Do not propose risks. That is the next stage.
