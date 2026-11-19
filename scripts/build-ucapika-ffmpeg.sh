#!/usr/bin/env bash
set -euo pipefail

# The upstream npm cache can contain FFmpeg builds configured with --enable-nonfree.
# Build the redistributable converter from the unmodified FFmpeg release.
version=7.1.4
root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
source_dir="$root/resources/bin/ffmpeg-source"
module_dir="$root/node_modules/ffmpeg-static"
archive="ffmpeg-$version.tar.gz"
opus_archive=opus-1.6.1.tar.gz
lame_archive=lame-3.100.tar.gz
jobs="${UCAPIKA_BUILD_JOBS:-4}"

verify_archive() {
  if command -v sha256sum >/dev/null; then
    printf '%s  %s\n' "$2" "$1" | sha256sum -c -
  else
    printf '%s  %s\n' "$2" "$1" | shasum -a 256 -c -
  fi
}

fetch_archive() {
  local file="$1" digest="$2" url="$3"
  if ! [[ -f "$source_dir/$file" ]] || ! verify_archive "$source_dir/$file" "$digest"; then
    curl --fail --show-error --silent --location --retry 3 "$url" -o "$work/$file"
    verify_archive "$work/$file" "$digest"
    mv "$work/$file" "$source_dir/$file"
  fi
  tar -xzf "$source_dir/$file" -C "$work"
}

mkdir -p "$source_dir" "$module_dir"
fetch_archive "$archive" e045ac47d8eec15397ad22e0a8712e8537fb3d601956217ccc74f5ba60e17654 \
  "https://codeload.github.com/FFmpeg/FFmpeg/tar.gz/refs/tags/n$version"
fetch_archive "$opus_archive" 6ffcb593207be92584df15b32466ed64bbec99109f007c82205f0194572411a1 \
  "https://downloads.xiph.org/releases/opus/$opus_archive"
fetch_archive "$lame_archive" ddfe36cab873794038ae2c1210557ad34857a4b6bdc515785d1da9e175b1da1e \
  https://deb.debian.org/debian/pool/main/l/lame/lame_3.100.orig.tar.gz

codecs="$work/codecs"
(
  cd "$work/opus-1.6.1"
  ./configure --prefix="$codecs" --disable-extra-programs --disable-doc --enable-shared --disable-static
  make -j"$jobs"
  make install
  cp COPYING "$source_dir/Opus-COPYING"
)
(
  cd "$work/lame-3.100"
  ./configure --prefix="$codecs" --disable-frontend --enable-shared --disable-static
  make -j"$jobs"
  make install
  cp COPYING "$source_dir/LAME-COPYING"
)
export PKG_CONFIG_PATH="$codecs/lib/pkgconfig"
cd "$work/FFmpeg-n$version"

platform_flags=()
case "$(uname -s)" in
  Darwin) platform_flags+=(--install-name-dir=@loader_path) ;;
  MINGW*|MSYS*) platform_flags+=(--disable-pthreads --extra-ldflags=-static-libgcc) ;;
esac

./configure --prefix="$work/install" --disable-autodetect --disable-doc \
  --disable-ffplay --disable-ffprobe --disable-debug --disable-network --disable-x86asm \
  --enable-shared --disable-static --disable-encoders \
  --enable-libmp3lame --enable-libopus \
  --enable-encoder=aac,ac3,flac,libmp3lame,libopus,mp2,mpeg4,pcm_f32le,pcm_s16be,pcm_s16le,wavpack,wmav2 \
  --extra-cflags="-I$codecs/include" --extra-ldflags="-L$codecs/lib" \
  "${platform_flags[@]}"
make -j"$jobs"
make install

cp COPYING.LGPLv2.1 "$source_dir/"
cp "$root/scripts/build-ucapika-ffmpeg.sh" "$source_dir/"
if [[ -f "$work/install/bin/ffmpeg.exe" ]]; then
  cp "$work/install/bin/ffmpeg.exe" "$work/install/bin/"*.dll "$codecs/bin/"*.dll "$module_dir/"
  "$module_dir/ffmpeg.exe" -version
else
  cp "$work/install/bin/ffmpeg" "$module_dir/"
  cp -PL "$work/install/lib/"*.dylib "$codecs/lib/"*.dylib "$module_dir/"
  for binary in "$module_dir/ffmpeg" "$module_dir/"*.dylib; do
    while IFS= read -r library; do
      install_name_tool -change "$library" "@loader_path/${library##*/}" "$binary"
    done < <(otool -L "$binary" | awk -v prefix="$codecs/lib/" 'index($1, prefix) == 1 {print $1}')
    if [[ "$binary" == "$module_dir/"libmp3lame*.dylib || "$binary" == "$module_dir/"libopus*.dylib ]]; then
      install_name_tool -id "@loader_path/${binary##*/}" "$binary"
    fi
    codesign --force --sign - "$binary"
  done
  "$module_dir/ffmpeg" -version
fi
