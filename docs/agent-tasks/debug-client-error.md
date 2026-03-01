# Task: Debug Client-Side Application Error

**Agent:** TestRunner  
**Priority:** CRITICAL  
**Issue:** "Application error: a client-side exception has occurred"

---

## Problem

Boss is seeing client-side error when loading http://157.10.98.227:3000

Error message: "Application error: a client-side exception has occurred (see the browser console for more information)."

---

## What to Check

### 1. Browser Console Errors

Open http://157.10.98.227:3000 in browser and check console for:
- JavaScript errors
- Module loading failures
- React hydration errors
- Missing dependencies

### 2. Check Build Output

```bash
cd /root/.openclaw/workspace/shelfzone-web
npm run build 2>&1 | tee build-check.log
```

Look for:
- TypeScript errors
- Missing modules
- Build warnings that might cause runtime errors

### 3. Check Server Logs

```bash
cd /root/.openclaw/workspace/shelfzone-web
tail -100 frontend-prod.log | grep -i "error\|failed\|exception"
```

### 4. Test Specific Pages

Try loading each page individually:
- http://157.10.98.227:3000/
- http://157.10.98.227:3000/login
- http://157.10.98.227:3000/dashboard
- http://157.10.98.227:3000/dashboard/agents
- http://157.10.98.227:3000/dashboard/agent-trace
- http://157.10.98.227:3000/dashboard/agents/command

Which pages work? Which pages throw errors?

### 5. Check for Missing Imports

The new components might have import errors:

```bash
cd /root/.openclaw/workspace/shelfzone-web

# Check if all imports resolve
node -e "
const fs = require('fs');
const files = [
  'src/components/agents/agent-flow-diagram.tsx',
  'src/components/command-center/agent-selector.tsx',
  'src/components/command-center/chat-interface.tsx',
  'src/components/command-center/live-activity-sidebar.tsx',
  'src/hooks/use-command-center.ts',
  'src/hooks/use-api-key.ts'
];
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const imports = content.match(/from ['\"](.*?)['\"]/g) || [];
  imports.forEach(imp => {
    const path = imp.match(/from ['\"](.*?)['\"]/)![1];
    if (path.startsWith('@/') || path.startsWith('.')) {
      console.log(\`\${f}: \${imp}\`);
    }
  });
});
"
```

### 6. Check ReactFlow Installation

The new components use ReactFlow:

```bash
cd /root/.openclaw/workspace/shelfzone-web
npm list reactflow
```

Verify it's installed correctly.

### 7. Run Dev Server with Verbose Errors

```bash
cd /root/.openclaw/workspace/shelfzone-web
npm run dev
```

Dev server shows better error messages than production build.

### 8. Check Next.js Error Page

The error page itself might have an issue. Check:
```bash
ls -la .next/server/app/_error.js
ls -la .next/server/app/error.js
```

---

## Likely Causes

1. **Import error** - One of the new components has a bad import path
2. **Missing dependency** - A package used by new components isn't installed
3. **React hydration mismatch** - Server-rendered HTML doesn't match client
4. **TypeScript compilation error** - Build succeeded but generated bad JavaScript
5. **Module resolution failure** - Next.js can't find a module at runtime

---

## Testing Steps

1. **Browser test:**
   - Open http://157.10.98.227:3000
   - Open DevTools (F12)
   - Check Console tab for errors
   - Screenshot the error
   - Check Network tab for failed requests

2. **Build verification:**
   ```bash
   cd /root/.openclaw/workspace/shelfzone-web
   rm -rf .next
   npm run build
   # Check for errors
   ```

3. **Component isolation:**
   Comment out new components one-by-one to find which one breaks:
   - In `src/app/dashboard/agents/page.tsx`, comment out AgentFlowDiagram import
   - In `src/app/dashboard/agents/command/page.tsx`, comment out new imports
   - In `src/components/agent-trace/org-tree-view.tsx`, check if changes break it

4. **Rollback test:**
   ```bash
   cd /root/.openclaw/workspace/shelfzone-web
   git stash
   npm run build
   npm start
   # Does it work without new changes?
   ```

---

## Expected Output

Provide:
1. **Exact error message** from browser console
2. **Stack trace** if available
3. **Which page(s) fail** vs which work
4. **Build output** (any warnings/errors)
5. **Root cause** - which component/import is broken
6. **Fix suggestion**

---

## Fix Likely Needed

If you find the broken component/import, either:
- Fix the import path
- Install missing dependency
- Comment out broken code temporarily
- Revert specific file causing issue

**Report findings before making fixes.**

---

**Use browser automation tools if available. Check actual browser console errors.**
