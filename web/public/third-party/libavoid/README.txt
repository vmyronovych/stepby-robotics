This application uses libavoid-js 0.4.5 / libavoid (LGPL-2.1-or-later).
Copyright: libavoid authors Michael Wybrow and contributors; JavaScript bindings Vladyslav Hnatiuk and contributors.
No modifications to the library. Library WASM is served separately as libavoid.wasm,
loaded through AvoidLib.load; it is not inlined into the application.
Corresponding source archives are provided here:
- libavoid-js-0.4.5.tar.gz: Aksem/libavoid-js commit 28a6fe20c2f1f809afdbeca8d789e65357614c4f
- adaptagrams-1.0.4.tar.gz: Aksem/adaptagrams v1.0.4, selected by tools/generate.py
License: COPYING.LESSER.txt; see the source tree for copyright notices.
Build: use tools/generate.py and README.md in the wrapper archive (Emscripten 3.1.36,
Docker, Python, and webidl-embindgen as documented there), then npm run build.
To use an interface-compatible modified library, replace the separately served
libavoid.wasm with the rebuilt binary. To replace the bindings too, replace
web/node_modules/libavoid-js and run npm run build:site in web/.
Upstream: https://github.com/Aksem/libavoid-js
Native routing: https://www.adaptagrams.org/documentation/libavoid.html
Research: M. Wybrow, K. Marriott, P. J. Stuckey, Orthogonal connector routing,
Graph Drawing 2009, LNCS 5849, pp. 219-231, Springer, 2010.
