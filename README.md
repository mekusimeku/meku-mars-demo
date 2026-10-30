# MEKU MARS Genesis — public browser demo

This GitHub Pages site is a **browser-only, synthetic research simulation**. No Python server, account, database, private key, wallet, paid API, or live equipment is used. `engine.mjs` runs the interactive scenarios. `data/python-benchmark.json` contains 60 precomputed paired results from the separate Genesis Python core: ten fixed seeds, three knowledge scenarios, and two delivery delays. The published data includes both helpful and harmful cooperation cases.

Run locally with any static server, for example `python3 -m http.server 8000` from this folder, then open `http://127.0.0.1:8000/`.

Test with `node --test tests/*.test.mjs`. This is not live Mars telemetry, safety certification, or a deployment of the private Python core. Refreshing resets the interactive session. Browser sender labels are teaching examples, not Ed25519 identities. The core's protected keys and databases are never copied here.

The website's custom domain is `mars.meku.farm`. `CNAME` and `.nojekyll` are checked in for GitHub Pages. No DNS changes are performed by this repository.

Copyright 2026 MEKU SI. Source released under the MIT License in `LICENSE`.
