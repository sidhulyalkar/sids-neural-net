# FRONTIER · AgentSSL genuine-source pilot

**Status:** Draft PR #178. Source-only staging; no original figure approved or production release authorized.

**Publisher:** [AgentSSL: Can MLE Agents Leverage Unlabeled Data?](https://arxiv.org/abs/2611.17323v1), arXiv:2611.17323v1 (November 12, 2026).
**Version-locked HTML:** https://arxiv.org/html/2611.17323v1

## What has been actually verified

The first successful GitHub-hosted live acquisition retrieved a 2,229,911-byte HTML document, SHA-256:

`e46bc4a222a5638431984772412f7dd96b60acd99977376e0b2890e27a6bffee`

The offline parser found **16 figure elements**. Four qualified for the *candidate* pool with both an original caption and a raster path on the exact paper host; none was automatically rights-approved. The original extraction cap of 40 sections was reached, so a follow-up raises the offline parser's bounded heading allowance to 80. The first report is *truncated at 40 headings*, not evidence that the paper contains only 40.

The initial four source candidate figures were:

| Source | Subject | Rights |
| --- | --- | --- |
| S3.F2 | Original AgentSSL diagram (Figure 2) | Pending |
| S6.F4 | Complementary SSL strategies (Figure 4) | Pending |
| S6.F5 | Cross-dataset generalization (Figure 5) | Pending |
| A3.F9 | Program-selection regret (Figure 9) | Pending |

The paper's arXiv landing/HTML pages display a CC BY 4.0 paper license. However, the raw HTML audit did not find the precise direct license href expected by the probe. **Do not substitute a paper-level license declaration for per-figure rights review**, especially where third-party images or derivative media could be involved.

The [private GitHub Actions audit](https://github.com/sidhulyalkar/sids-neural-net/actions) stores original source heading/figure records, paper SHA-256, a rights-pending review queue, and a source-only manifest. It does **not** upload HTML or original publisher figure bytes.

## What is staged in this PR

`content/frontier/stories/ingest-arxiv-l2kgb2/manifest.json` includes 23 manually selected original publication section titles and their exact verified arXiv fragment IDs from the live source audit. It is clearly identified as a **curated source-navigation subset** rather than a complete paper extraction. Each record is a publisher section heading, not a generated statement of scientific results.

`assets.json` is explicitly empty. `provenance.json` identifies the source SHA, initial coverage, and unresolved rights. The source reader can thus make this genuine paper available at:

`/frontier/story/ingest-arxiv-l2kgb2`

But the figure stage will remain empty until rights and image bytes pass the existing qualification gates. This is intentional, not a missing fallback.

## Original-paper to real-figure qualification

1. **Confirm exact source identity.** The HTML/figure original must remain at arXiv version `2611.17323v1`. Store retrieval date and HTML SHA before review.
2. **Review an actual figure**, starting with the AgentSSL architecture (Figure 2). Check its in-context use, original caption, attribution, and whether the publisher's license applies to the particular visual.
3. **Acquire the image privately**, verifying same-paper HTTPS path, response MIME, full raster structure/dimensions and SHA-256. Do not trust an image extension alone or follow redirects to an unreviewed destination.
4. **Record rights evidence** and exact caption SHA-256 in the existing `--approvals` contract. No blanket approval.
5. **Compile a new immutable bundle** using the offline story builder. Confirm `parseQualifiedStoryManifest` accepts it and only then list an original-figure scene.
6. **Review visual evidence** on desktop, 390px and 320px screens. Verify source links, captions, no title overflow, keyboard switching, broken-image fallback, and no unverified claims.
7. **Publish only the reviewed bundle** into the branch and keep the PR draft. No merge/production release without approval.

The pilot can graduate into real figure-driven explanations, but that requires at least one fully reviewed, content-hashed publisher figure. No data figure, benchmark chart or reconstructed program graph is fabricated in its absence.

## Engineering and QA boundaries

- Normal `/frontier` first paint, source ranking, saved preferences, video activation and `/frontier/advanced` remain untouched.
- The new pilot acquisition makes precisely one pinned, bounded network request; no image fetch or secondary-document crawler is added to cold snapshots.
- The acquisition is allowed in CI, not during a user navigation.
- Python offline unit tests validate URL identity, redirects, HTML/UTF-8, byte budget and license ambiguity.
- The old source HTML limit of 1.4 MB was too small for the real 2.23 MB document; the new bounded offline allowance is 12 MiB. It does not change asset/JavaScript limits.
- The staged story and its absence of licensed media are independently checked by TypeScript unit tests.
- The pilot PR is stacked: #172 (evidence) → #173 (arXiv adapter) → #175 (figure reader) → #177 (source chapters) → #178 (this work).

## Release status

**No merge, no production deploy.** The source-only staging is useful for testing genuine section navigation. It is not evidence that a complete scientific explainer or reusable figure gallery has shipped.
