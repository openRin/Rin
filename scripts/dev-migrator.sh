#!/bin/bash

# change to the server/sql directory
cd ./server/sql/

# list all SQL files and sort them
sorted_files=$(ls *.sql | sort)

# for each file in the sorted list
for file in $sorted_files; do
    # run the migration
    bunx wrangler d1 execute rin --local --file "$file"
    echo "Executed $file"
done

# back to the root directory
cd -