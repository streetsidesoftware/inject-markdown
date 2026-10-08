COLUMNS=72 ./bin.mjs --help > content/help.txt
./bin.mjs "content/**"
./bin.mjs README.md
pnpm exec prettier -w .
