// Which build of the pack this is. tools/build.py writes the real number (for example "1.2.290") into the
// packed copy of this file, the same number it stamps into the manifests, so the self-test can say which
// build a world is really running. In the repo it stays "dev".
export const BUILD = "dev";
