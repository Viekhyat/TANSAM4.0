$env:GIT_FILTER_BRANCH_FORCE = "1"

# Replace the API key with a placeholder in the specific file
git filter-branch --force --index-filter "git ls-files -z 'src/utils/chatApi.js' | xargs -0 sed -i 's/apiKey = sk-[a-zA-Z0-9_\-]\+/apiKey = \"YOUR_API_KEY_HERE\"/g'" --prune-empty --tag-name-filter cat -- --all

Write-Host "API key has been removed from Git history. You can now try pushing again."
Write-Host "Note: This rewrites Git history. If you've already pushed this branch before, you'll need to force push with:"
Write-Host "git push -f origin Viekhyat"