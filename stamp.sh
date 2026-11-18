#!/bin/zsh
# Stamps a fresh version on every script and stylesheet link so browsers load the newest site after each publish.
cd "${0:A:h}"
V=$(date +%Y%m%d%H%M%S)
sed -i '' -E "s/\?v=[0-9a-z]+\"/?v=$V\"/g" index.html views/views.css
echo "version $V"
