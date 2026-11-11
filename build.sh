#!/bin/sh
# Assembles the single self-contained index.html from src/
cd "$(dirname "$0")"
{ cat src/head.html; cat src/body.html; echo '<script>'; cat src/core.js; echo '</script>'; echo '<script>'; cat src/ui.js; echo '</script>'; echo '</body>'; echo '</html>'; } > index.html
echo "built index.html ($(wc -c < index.html) bytes)"
