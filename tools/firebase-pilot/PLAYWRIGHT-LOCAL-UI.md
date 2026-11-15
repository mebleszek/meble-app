# Playwright UI — localOnly DEMO

Run on Linux or WSL with Node.js 22+, Chromium and the existing browser supervisor dependencies (Python 3 and dbus-run-session). From tools/firebase-pilot, install the locked dependencies with npm ci and set CHROMIUM_PATH if Chromium is outside the system locations.

```sh
node --test playwright-local-ui.test.mjs
```

The two cases use separate temporary Chromium profiles and a loopback server. The signed DEMO configuration uses the existing synthetic Auth fixture and the real application, Service Worker and IndexedDB. There is no Firebase backend in this localOnly suite. The tests drive visible controls, check the IndexedDB application image and outbox, then restart Chromium with the same temporary profile and verify the persisted records again.

On failure, the runner prints the temporary directory and retains failure.png and failure.zip, plus before-restart.zip if it reached the restart. Open the trace locally with node node_modules/playwright-core/cli.js show-trace followed by the trace path. Successful runs remove their temporary profiles and traces.
