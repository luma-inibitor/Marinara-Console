<!-- vale Microsoft.Headings = NO -->
# Vale over code comments

<!-- vale Microsoft.Headings = YES -->

Research note behind the `[formats]` block in `.vale.ini` and the shim in
`scripts/prosecheck.ts`. The CI job pins Vale 3.18.0. Every claim here runs on
that build, and reads that tag's source.

The question it answers: Vale reads code comments, so why does a `scope:
sentence` rule that works on `README.md` report nothing at all on `Button.tsx`?

## The finding

**Vale's code path never runs its language pipeline.** That's the whole of it.

`lintFile` dispatches on a file's *format*, and `code` goes to `lintCode`, which
extracts comments with tree-sitter and hands each one to `lintLines`. `lintLines`
makes a single block, scoped `text.comment.line.ts`, and passes it straight to
`lintBlock`.

Markup and text formats go elsewhere, to `lintProse`. That's the only caller of
`NLP.Compute`, and `NLP.Compute` is what segments a block into sentences, splits
it into paragraphs, and tags it for part of speech. A comment never reaches it.

Four things follow, and the docs record none of them:

| Rule | On `.md` | On `.ts` |
| --- | --- | --- |
| `existence`, `scope: text` | fires | fires |
| `existence`, `scope: sentence` | fires | **silent** |
| `occurrence`, `scope: sentence` | fires | **silent** |
| `sequence` (any scope) | fires | **silent** |

`sequence` is the one that surprises, because it names no scope. It fails for
the other half of the same reason: its tokens match on part-of-speech tags, the
tagger runs inside `NLP.Compute`, and an untagged block satisfies no `tag:` arm.
So `Luma.EmDashClause` and `Luma.PerfectTense` were dead on every `.ts` file in
this repo, and stayed dead from the day someone wrote them.

None of the four errors. A sentence-scoped rule in a code file draws no
rejection and no warning. It simply never matches. `Code/Aphorism.yml` carries
the scar, because it anchors its patterns by hand where `scope: sentence` did
nothing.

## The fix is a configuration line

Vale already does the thing you would otherwise build. `FormatFromExt` has a
case for it:

```go
if format, found := mapping[base]; found {
    if kind == "code" && getFormat("."+format) == "markup" {
        // NOTE: This is a special case of embedded markup within code.
        return "." + format, "fragment"
    }
```

Map a code extension onto a markup one and the file takes a third path,
`lintFragments`. Tree-sitter pulls the comments out exactly as before. Each one
then goes through `lintMarkdown`, which means `lintProse`, which means
`NLP.Compute`. `adjustAlerts` then walks each finding back to a line and column
in the source. `commentPadding` subtracts the comment's indentation, plus the
width of a `//` or a JSDoc ` *`.

That's the whole of it:

```ini
[formats]
ts = md
tsx = md
js = md
```

All four rule kinds fire, at the right coordinates. Measured over `src/` and
`scripts/`, the `Luma` rhetoric rules went from **7 alerts to 163**. 156 of
those were out of reach before.

Nothing here needs a scratch Markdown file and a report mapped back by hand.
That design is right, and Vale already ships it.

### Section globs still work

The mapping changes the *format*, not the path. `[*.{ts,tsx,js}]` still claims a
`.ts` file and `[*.md]` still doesn't, so which styles run on a comment stays a
separate decision from how Vale parses the comment. Verified with a rule in each
section.

### What the Markdown parsing costs

A comment is Markdown now, so Markdown's skips apply to it. Measured by counting
every word Vale lints in each mode across `src/`: **26,132 of 26,622**, or 98.2%.

Of the 491 words that drop out, **476 sit inside a code span**. That's the
mapping paying for itself rather than costing anything — `.vale.ini` used to
carry a note about 487 quoted symbols reported as prose, and this is that note's
fix. The rest is 6 words beside an angle-bracket construct (`<mark>`,
`Map<facetId, Set<value>>`) that Markdown reads as raw HTML, and 9 in list
markers and a bracketed regex.

The matching risk is a comment that indents a block four spaces, which Markdown
reads as a code block and skips whole. No comment in this corpus does.

## Where the mapping stops: `.mjs`

Vale picks a tree-sitter grammar by extension. That table lists `js` and `jsx`,
but no `mjs` or `cjs`. `FormatByExtension` omits them as well, so the format
resolves to `unknown`. An unknown format falls through `lintFile`'s dispatch to the same
`lintLines` a plain text file gets — **the whole file, code included, linted as
prose.**

On `scripts/`, with the prose styles on, that's **2,031 alerts, 974 of them
`Vale.Spelling`** on ordinary identifiers. This repo's `.vale.ini` used to
explain its code exemptions by citing "1,373 identifiers as misspellings," and
that number was this artefact, not a fact about comment linting.

It's quiet about it, too, in the way that matters: Vale lints a string literal
that reads like a sentence as one. `scripts/copycatalog.mjs:103` earned a
`Luma.Adverbs` alert for the word *genuinely* inside a template literal.

Two dead ends, both worth recording:

- **`[formats] mjs = js`** resolves the format to `code`, but `lintCode` looks
  the grammar up by the file's *real* extension, which is still `.mjs`. It falls
  back to `lintCodeOld`, whose table now holds only Clojure and PowerShell, and
  returns **zero alerts** without saying so. The file looks linted and isn't.
- **`vale --ext=.js file.mjs`** reaches `lintFragments`, which has no
  `lintCodeOld` fallback, and errors with `unsupported extension: '.mjs'`.

So `.vale.ini` turns `.mjs` and `.cjs` off outright — no linting beats
whole-file linting — and `scripts/prosecheck.ts` reaches them by symlinking each
one to a `.js` name in a mirror of the directory tree. Both names point at one
file, so nothing needs remapping beyond the name itself. That recovers **284
alerts** across `scripts/`.

`npm run prose` still can't see them. It's `vale .`, and Vale's own file walk
offers nowhere to put the shim.

## Two smaller notes

The mapping barely moves `Vale.Spelling` on comments: 122 alerts before and 121
after, on `src/`. Identifiers in these comments already live in code spans, and
Vale skipped those in code mode too. The gain measured earlier is the
sentence rules, not the spelling.

Whether to run the prose styles over comments is a separate question from this
change. `Microsoft` alone puts **1,355** alerts on `src/` under the mapping, and
269 of those come from `Microsoft.Semicolon` and `Microsoft.SentenceLength` —
two rules that couldn't fire before, arriving as a backlog on day one.
