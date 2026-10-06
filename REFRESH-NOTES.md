# Editorial refresh

The update builds on the existing magazine rather than replacing its content or platform. The cover uses a larger NaMe wordmark, compact navigational typography, a warm paper background, restrained red details, and a dark community invitation with a static orbital motif. Shared pages retain their existing structure with more consistent controls and reading typography.

## Behavior changes

The blocking homepage loader is removed. Public data loading no longer waits for account verification, and independent homepage feeds run concurrently. Images below the lead story load lazily; search input is debounced. Scrolling stays native. Scroll-linked reading progress uses a passive listener and at most one update per animation frame.

The all-stories archive supports text search with a shareable query string. Search covers loaded story titles, metadata, and content types. Existing Latest/Mixed/Saved controls remain. Explicit loading adds twelve items at a time and moves keyboard focus to the newly added content. Saving is still browser-local.

Reading focus mode hides related stories and comments while retaining the article and an obvious toggle to exit. Reading time is an estimate based on words and CJK characters. Keyboard users can open community images, close mobile navigation with Escape, and move through modal dialogs without entering the background content.

Admin content filters persist after a refresh, distinguish no matches from an empty catalog, and display a result count. The upload success message no longer disappears during form reset. Preview images are built with DOM APIs and HTTP(S) URL validation. Upload and edit forms warn before leaving with changes. This is **not autosave**; file selections and unfinished work are not persisted across reloads. Clicking the explicit Clear form control still clears the form immediately.

## Verification

- Frontend DOM regression suite exercises the changed behaviors using fixture data.
- Existing pure server tests for post images and exclusive metadata pass.
- Modified JavaScript passes syntax checks; both new stylesheets parse successfully.
- Root page IDs and local script/stylesheet paths are checked by the frontend suite.
- Browser visual testing was blocked by the app browser's policy-verification failure. Desktop/mobile rendering, actual scroll feel, and assistive-technology behavior remain unverified in a real browser. No screenshot or performance score is claimed.
- No production publication, account mutation, live upload, or database migration was performed.

## Existing limits and follow-up checks

- The Supabase catalog currently caps public post queries at 200 items. Archive search searches that loaded set, not an unlimited server-side index.
- Membership, uploads, and moderation continue to need the existing backend configuration. The frontend tests do not validate live authentication, storage policies, or delivery services.
- This is not a complete security or WCAG conformance audit. The contact form's pre-existing handler only shows a local confirmation; real message delivery remains a separate integration.
- Before deployment, check homepage, archive, article, community, login, and admin on a narrow phone viewport and at 200% zoom. Verify a complete real upload in an appropriate test environment, reduced-motion behavior, keyboard focus, and your selected language.
