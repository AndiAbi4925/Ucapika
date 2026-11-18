#!/usr/bin/env bash
set -euo pipefail

# The upstream npm cache can contain FFmpeg builds configured with --enable-nonfree.
# Build the redistributable converter from the unmodified FFmpeg release.
version=7.1.4
sha256=e045ac47d8eec15397ad22e0a8712e8537fb3d601956217ccc74f5ba60e17654
root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
source_dir="$root/resources/bin/ffmpeg-source"
module_dir="$root/node_modules/ffmpeg-static"
archive="ffmpeg-$version.tar.gz"

verify_archive() {
  if command -v sha256sum >/dev/null; then
    printf '%s  %s\n' "$sha256" "$1" | sha256sum -c -
  else
    printf '%s  %s\n' "$sha256" "$1" | shasum -a 256 -c -
  fi
}

mkdir -p "$source_dir" "$module_dir"
if ! [[ -f "$source_dir/$archive" ]] || ! verify_archive "$source_dir/$archive"; then
  curl --fail --show-error --silent --location --retry 3 \
    "https://codeload.github.com/FFmpeg/FFmpeg/tar.gz/refs/tags/n$version" -o "$work/$archive"
  verify_archive "$work/$archive"
  mv "$work/$archive" "$source_dir/$archive"
fi
tar -xzf "$source_dir/$archive" -C "$work"
cd "$work/FFmpeg-n$version"

platform_flags=()
case "$(uname -s)" in
  Darwin) platform_flags+=(--install-name-dir=@loader_path) ;;
  MINGW*|MSYS*) platform_flags+=(--disable-pthreads --extra-ldflags=-static-libgcc) ;;
esac

./configure --prefix="$work/install" --disable-autodetect --disable-doc \
  --disable-ffplay --disable-ffprobe --disable-debug --disable-network --disable-x86asm \
  --disable-everything --enable-shared --disable-static \
  --enable-protocol=file,pipe \
  --enable-demuxer=aac,aiff,flac,matroska,mov,mp3,ogg,wav \
  --enable-muxer=adts,flac,matroska,mov,mp4,ogg,wav,webm,null \
  --enable-parser=aac,flac,mpegaudio,opus,vorbis \
  --enable-decoder=aac,alac,flac,mp3,opus,vorbis,pcm_f32le,pcm_s16be,pcm_s16le,pcm_s24be,pcm_s24le,pcm_s32le,pcm_u8 \
  --enable-encoder=aac,flac,opus,vorbis,pcm_f32le,pcm_s16le \
  --enable-filter=aresample,concat,highpass,lowpass,volume,asetpts,atrim \
  "${platform_flags[@]}"
make -j"${UCAPIKA_BUILD_JOBS:-4}"
make install

cp COPYING.LGPLv2.1 "$source_dir/"
cp "$root/scripts/build-ucapika-ffmpeg.sh" "$source_dir/"
if [[ -f "$work/install/bin/ffmpeg.exe" ]]; then
  cp "$work/install/bin/ffmpeg.exe" "$work/install/bin/"*.dll "$module_dir/"
  "$module_dir/ffmpeg.exe" -version
else
  cp "$work/install/bin/ffmpeg" "$module_dir/"
  cp -PL "$work/install/lib/"*.dylib "$module_dir/"
  "$module_dir/ffmpeg" -version
fi
