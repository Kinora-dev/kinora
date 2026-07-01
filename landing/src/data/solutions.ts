export type ShotKey = 'overview' | 'test-history' | 'tests' | 'trace-viewer' | 'compare'

export interface SolPoint {
  title: string
  body: string
}

export interface SolFaq {
  q: string
  a: string
}

export interface Solution {
  slug: string
  eyebrow: string
  h1: string
  title: string
  description: string
  tldr: string
  intro: string
  shot: ShotKey
  shotAlt: string
  points: SolPoint[]
  faqs: SolFaq[]
}

export const SOLUTIONS: Solution[] = [
  {
    slug: 'playwright-report-with-history',
    eyebrow: 'Test history',
    h1: 'A Playwright report with history',
    title: 'Playwright report with history across runs | kinora',
    description:
      'Playwright\'s HTML report shows one run. kinora keeps every run: pass-rate trends, run-over-run comparison, and flaky detection across projects, with the trace viewer embedded.',
    tldr:
      'Playwright\'s HTML report shows one run on one machine. kinora keeps every run, so you get a Playwright report with full history: pass-rate trends, run-over-run comparison, and flaky detection across projects.',
    intro:
      'The built-in HTML report is per-run and disposable, so there is no way to see whether a test has been degrading for weeks or how a project trends release over release. kinora ingests every run from CI and stores it, turning a pile of one-off reports into a persistent history you can search, compare, and trend, without giving up the Playwright trace viewer.',
    shot: 'test-history',
    shotAlt: 'kinora showing a single test\'s pass/fail history across many runs over time',
    points: [
      {
        title: 'Every run, kept',
        body: 'Push each CI run to kinora and it stores the result: forever when you self-host, or for your plan\'s retention window on cloud. No more reports overwritten on the next build.',
      },
      {
        title: 'Trends at a glance',
        body: 'Pass rate over time, per project and per test, so a slow decline is visible long before it becomes a fire drill.',
      },
      {
        title: 'Run-over-run compare',
        body: 'Diff any two runs to see exactly which tests changed status, newly failed, or recovered.',
      },
      {
        title: 'Same trace, still inline',
        body: 'Open the full Playwright trace for any historical failure, embedded directly in the dashboard.',
      },
    ],
    faqs: [
      {
        q: 'How do I add history to my Playwright report?',
        a: 'Playwright\'s built-in HTML report is per-run. Send your results to kinora with @kinora/reporter or the kinora CLI, and it builds a persistent history across every run automatically.',
      },
      {
        q: 'Does it keep traces for old runs?',
        a: 'Yes, subject to your retention window. When you self-host, traces are kept for as long as you keep them on your own storage.',
      },
      {
        q: 'Is a Playwright report with history free?',
        a: 'Self-hosting kinora is free forever, and the cloud has a free tier. Both give you cross-run history out of the box.',
      },
    ],
  },
  {
    slug: 'playwright-flaky-test-dashboard',
    eyebrow: 'Flaky tests',
    h1: 'A flaky test dashboard for Playwright',
    title: 'Playwright flaky test dashboard | kinora',
    description:
      'kinora watches every Playwright run and surfaces the tests that pass and fail without code changes, so you can find, rank, and fix flaky tests instead of hitting retry.',
    tldr:
      'kinora is a flaky test dashboard for Playwright: it watches every run and surfaces the tests that pass and fail without code changes, so you can find, rank, and fix them instead of hitting retry.',
    intro:
      'Flaky tests hide in per-run retries: the report goes green, the flake is invisible, and trust in the suite erodes. kinora compares each test\'s outcome across your entire run history, so tests that flip between pass and fail are surfaced and ranked, with the full timeline and the trace one click away.',
    shot: 'tests',
    shotAlt: 'kinora test list highlighting flaky tests ranked by how often they change status',
    points: [
      {
        title: 'Flakiness ranked',
        body: 'Tests that flip between pass and fail across runs are surfaced and ranked, not buried inside a single run\'s retries.',
      },
      {
        title: 'History behind every flake',
        body: 'See the full pass/fail timeline for a test to judge how bad a flake really is before you spend time on it.',
      },
      {
        title: 'Straight to the trace',
        body: 'One click from a flaky failure to its full Playwright trace, embedded inline.',
      },
      {
        title: 'Alerts on regressions',
        body: 'Get notified in Slack, email, or webhook the moment a stable test starts failing.',
      },
    ],
    faqs: [
      {
        q: 'How does kinora detect flaky tests?',
        a: 'It compares each test\'s outcome across your run history. Tests that change status without a code change are flagged as flaky and ranked by how often they flip.',
      },
      {
        q: 'Can I get alerted about new flaky tests?',
        a: 'Yes. Per-project alerts fire on new failures and regressions, delivered via Slack, email, or webhook.',
      },
      {
        q: 'Do I need to change my tests to use it?',
        a: 'No. Send results with @kinora/reporter or the CLI and flaky detection is automatic; there are no test-code changes.',
      },
    ],
  },
  {
    slug: 'playwright-trace-viewer-online',
    eyebrow: 'Trace viewer',
    h1: 'The Playwright trace viewer, online',
    title: 'Playwright trace viewer online, in the browser | kinora',
    description:
      'kinora embeds the full Playwright trace viewer in the browser, so any failure opens inline, live or from run history. No downloading trace.zip, no local show-trace.',
    tldr:
      'kinora embeds the full Playwright trace viewer in the browser, so any failure, live or from run history, opens inline. No downloading trace.zip, no local playwright show-trace.',
    intro:
      'Debugging a CI failure usually means downloading a trace.zip and running the trace viewer locally. kinora hosts the trace and embeds the real Playwright trace viewer in the dashboard, so a red test is one click from its full timeline, DOM snapshots, network, and console, right in the browser.',
    shot: 'trace-viewer',
    shotAlt: 'the Playwright trace viewer embedded in kinora, showing timeline, snapshot, and network panels',
    points: [
      {
        title: 'The real trace viewer',
        body: 'The same Playwright trace viewer you know, timeline, DOM snapshots, network, and console, running inside the dashboard.',
      },
      {
        title: 'No download step',
        body: 'Click a failure and the trace opens inline. No fetching trace.zip and running show-trace on your machine.',
      },
      {
        title: 'Works on history',
        body: 'Open the trace for any past run, not just the latest, because kinora keeps them.',
      },
      {
        title: 'Desktop app too',
        body: 'Prefer local? The kinora desktop app is a standalone Playwright trace viewer that needs no account.',
      },
    ],
    faqs: [
      {
        q: 'Can I view a Playwright trace online without downloading it?',
        a: 'Yes. kinora hosts the trace and embeds the Playwright trace viewer in the browser, so it opens inline on any failure with no download step.',
      },
      {
        q: 'Is it the real Playwright trace viewer?',
        a: 'Yes. The trace viewer is vendored from Playwright, so the timeline, snapshots, network, and console tabs behave exactly as you expect.',
      },
      {
        q: 'Can I open a local trace without an account?',
        a: 'Yes, with the kinora desktop app, a standalone local Playwright trace viewer that needs no account.',
      },
    ],
  },
]
