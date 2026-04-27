#!/bin/bash

# Dashboard.tsx
sed -i 's/const activeModules = useMemo/  \/\/ Bolt: Memoize filtered modules to prevent re-creation on every useLiveQuery update\n  const activeModules = useMemo/' src/pages/Dashboard.tsx
sed -i 's/const settingsMap = useMemo.*\[dbSettings\]);/  \/\/ Bolt: Memoize settings map object to prevent cascading re-renders across the dashboard\n  const settingsMap = useMemo(() => Object.fromEntries(dbSettings.map(s => [s.key, s.value])), [dbSettings]);/' src/pages/Dashboard.tsx

# ClassroomView.tsx
sed -i 's/const settingsMap = useMemo.*\[dbSettings\]);/  \/\/ Bolt: Memoize settings map object to preserve referential equality on dbSettings updates\n  const settingsMap = useMemo(() => Object.fromEntries(dbSettings.map(s => [s.key, s.value])), [dbSettings]);/' src/pages/ClassroomView.tsx

# LessonView.tsx
sed -i 's/const settingsMap = useMemo.*\[dbSettings\]);/  \/\/ Bolt: Memoize settings map object to prevent unnecessary re-renders of the complex LessonView component\n  const settingsMap = useMemo(() => Object.fromEntries(dbSettings.map(s => [s.key, s.value])), [dbSettings]);/' src/pages/LessonView.tsx

# Modules.tsx
sed -i 's/const settingsMap = useMemo.*\[dbSettings\]);/  \/\/ Bolt: Memoize settings map object to optimize the Modules view rendering cycle\n  const settingsMap = useMemo(() => Object.fromEntries(dbSettings.map(s => [s.key, s.value])), [dbSettings]);/' src/pages/Modules.tsx
