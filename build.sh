#!/usr/bin/env bash
set -e

# Find the tg hack root directory
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -d "$DIR/alp_extracted" ]; then
  ROOT_DIR="$DIR"
elif [ -d "$DIR/../alp_extracted" ]; then
  ROOT_DIR="$(cd "$DIR/.." && pwd)"
else
  ROOT_DIR="/home/rahul/Desktop/tg hack"
fi

SOURCE_DIR="$ROOT_DIR/alp_extracted"
OUTPUT_ALP="$ROOT_DIR/app.alp"

echo "============================================="
echo "   Building AndroLua+ Package (app.alp)      "
echo "============================================="

if [ ! -d "$SOURCE_DIR" ]; then
  echo "Error: Directory $SOURCE_DIR not found!"
  exit 1
fi

echo "[1/3] Validating Lua & ALY syntax..."
if command -v luac >/dev/null 2>&1; then
  luac -p "$SOURCE_DIR/init.lua" "$SOURCE_DIR/main.lua"
  luac -p <(echo "return " && cat "$SOURCE_DIR/layout.aly")
  luac -p <(echo "return " && cat "$SOURCE_DIR/floating.aly")
  luac -p <(echo "return " && cat "$SOURCE_DIR/login_layout.aly")
  echo "      ✓ All Lua and ALY files passed syntax check."
else
  echo "      (luac not found, skipping syntax check)"
fi

echo "[2/3] Packing project files into app.alp..."
rm -f "$OUTPUT_ALP"
cd "$SOURCE_DIR"
zip -9 -q -r "$OUTPUT_ALP" . -x "*.sh" -x ".*"

echo "[3/3] Build complete!"
ls -lh "$OUTPUT_ALP"
echo ""
echo "Output: $OUTPUT_ALP"
echo "You can import this .alp file into AndroLua+ on Android to build/install the APK."
echo "============================================="
