const fs = require('fs');

const path = 'src/app/actions/leads.ts';
let content = fs.readFileSync(path, 'utf8');

// I will just use git checkout to restore leads.ts to what it was before the corruption.
