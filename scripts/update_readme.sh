COLUMNS=72 ./bin.mjs --help > content/help.txt
./bin.mjs "content/**"
# content/README.md is hydrated before the samples it shows, so hydrate it again with the fresh samples.
./bin.mjs content/README.md
./bin.mjs README.md
pnpm exec prettier -w .
