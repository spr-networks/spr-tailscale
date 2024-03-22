#!/bin/bash

echo "+ running custom bundler... neep webpack therapy"

npx craco build

OUTFILE=build/index.html

#FUCKWEBPACK2.3
cat build/index.html | sed 's/<\/head><body>.*//g'|sed 's/.*<head><script>/<script>/g' > build/script.html
echo '<!doctype html><html lang="en"><head></head>' > $OUTFILE
echo '<body><noscript>You need to enable JavaScript to run this app.</noscript><div id="root"></div></body>' >> $OUTFILE
cat build/script.html >> $OUTFILE
echo '<html>' >> $OUTFILE

rm -f build/script.html
