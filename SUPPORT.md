# Support

Thanks for using **KawnGraph** (كون قراف) — _one project universe, every coding agent._
This page explains where to get help and how to ask so we can help you fast.

## Try these first

Most questions are already answered in the docs. Start here before opening anything:

| If you want to… | Read |
| --- | --- |
| Get up and running | [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) |
| Fix an error or unexpected behavior | [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) |
| Understand how it works / common questions | [docs/FAQ.md](docs/FAQ.md) |
| Connect Claude Code / Codex / Cursor | [docs/AGENT_INTEGRATION.md](docs/AGENT_INTEGRATION.md) |
| Privacy, telemetry, and data handling | [docs/PRIVACY.md](docs/PRIVACY.md) |
| Read the benchmark methodology & results | [docs/BENCHMARKS.md](docs/BENCHMARKS.md) |

A quick local sanity check often surfaces the problem on its own:

```bash
pnpm kawn check     # alias of doctor/status: verifies setup & graph health
pnpm kawn update    # rebuild a stale or missing graph in .kawn/
```

> Note: the CLI is run from source today (`pnpm install && pnpm build`, then `pnpm kawn <cmd>`).
> The `kawngraph` npm package is not published yet, so `npx kawngraph …` will work only **after npm publication**.

## Where to get help

### Bugs and reproducible problems — GitHub Issues

If something is broken — a crash, a wrong result, a scanner that misses or mis-claims a
node, an MCP/Studio failure — open a bug report:

- **[Open a bug report](.github/ISSUE_TEMPLATE/bug_report.yml)**

A good report includes: what you ran, what you expected, what happened, your OS and Node
version, and (if possible) a minimal repro. The bug form prompts you for these.

Have an idea or a feature request instead? Use the
**[feature request form](.github/ISSUE_TEMPLATE/feature_request.yml)**.

### Questions, ideas, and discussion — GitHub Discussions

For open-ended questions, usage help, design ideas, or "is this the right approach?"
conversations, use **GitHub Discussions** (the _Discussions_ tab on the repository), if it
is enabled. Discussions keep Issues focused on actionable, reproducible work.

If Discussions is not available on the repo, open a question as a GitHub Issue and we will
route it from there.

## Please do NOT use Issues for security

**Never report a security vulnerability in a public Issue or Discussion.** Disclosing a
flaw publicly puts every user at risk before a fix exists.

Instead, follow the private disclosure process in **[SECURITY.md](SECURITY.md)**.

## Before you post

A little prep makes your report far easier to resolve:

- **Search first** — your question may already be answered in an existing Issue/Discussion
  or in the [docs](docs/).
- **Use the right channel** — bugs → Issues, questions/ideas → Discussions, vulnerabilities
  → [SECURITY.md](SECURITY.md).
- **Include versions** — your OS, Node version (KawnGraph requires Node ≥ 18), and the exact
  command you ran.
- **Show, don't tell** — paste the command, the full output/error, and a minimal repro where
  you can.

## Contributing

Want to help, add a scanner, or improve a translation? See
**[CONTRIBUTING.md](CONTRIBUTING.md)**. By participating you agree to our
**[Code of Conduct](CODE_OF_CONDUCT.md)**.

## Maintainer

KawnGraph is created & maintained by **[Abdulrahman Alnashri](https://www.linkedin.com/in/abdulrahman-alnashri-ai/)** (LinkedIn). For project questions please use GitHub Issues/Discussions above; for vulnerabilities use [SECURITY.md](SECURITY.md).

## Sponsor the project

If KawnGraph saves you time, you can support its development through **[GitHub
Sponsors](https://github.com/sponsors/xd7fx)**. Sponsorship is optional and never
changes what the tool does — KawnGraph stays local-first, free, and MIT-licensed.

> GitHub shows a **"Sponsor this project"** button on the repository **root** page
> when GitHub Sponsors is active for the maintainer and `.github/FUNDING.yml` is
> present. It does **not** appear on individual file/blob pages (e.g. a
> `README.ar.md` view) — that is normal GitHub behavior, not a misconfiguration.

---

For everything else, start at the **[README](README.md)**.
