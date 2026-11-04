#!/bin/sh
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$HERE/EarsCapture.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
cp "$HERE/Info.plist" "$APP/Contents/Info.plist"
clang -fobjc-arc -O2 -framework Foundation -framework ScreenCaptureKit -framework AVFoundation -framework CoreMedia "$HERE/main.m" -o "$APP/Contents/MacOS/ears-capture"
echo "$APP/Contents/MacOS/ears-capture"
