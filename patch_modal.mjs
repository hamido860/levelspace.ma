import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'src/pages/LessonView.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const outlineModalJSX = `
      {/* Lesson Outline Modal */}
      <Modal
        isOpen={showOutlineModal}
        onClose={() => {
          setShowOutlineModal(false);
          // Stop audio when modal closes
          if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            setReadingBlockIndex(null);
          }
        }}
        title="Lesson Outline"
      >
        <div className="space-y-4">
          <div className="p-4 bg-accent/5 rounded-xl border border-accent/10 space-y-2">
            <h3 className="font-bold text-accent">Audio Reading</h3>
            <p className="text-sm text-muted">Click any section title to hear it read aloud. Click again to stop.</p>
          </div>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
            {lesson?.blocks?.map((block, index) => {
              const isReading = readingBlockIndex === index;
              return (
                <button
                  key={block.id || index}
                  onClick={() => toggleReadAloud(index, block.content || '')}
                  className={\`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between gap-4 \${
                    isReading
                      ? 'bg-accent/10 border-accent/30 shadow-sm'
                      : 'bg-surface-low border-ink/5 hover:border-accent/30 hover:bg-surface-mid'
                  }\`}
                >
                  <div className="flex-1">
                    <span className="text-xs font-bold text-muted uppercase tracking-wider mb-1 block">
                      Section {index + 1}
                    </span>
                    <h4 className={\`font-bold \${isReading ? 'text-accent' : 'text-ink'}\`}>
                      {block.title || 'Untitled Section'}
                    </h4>
                  </div>

                  <div className={\`w-10 h-10 rounded-full flex items-center justify-center shrink-0 \${
                    isReading ? 'bg-accent text-paper' : 'bg-surface-mid text-ink-secondary'
                  }\`}>
                    {isReading ? (
                      <div className="w-4 h-4 flex items-center justify-center gap-1">
                        <span className="w-1 h-3 bg-paper rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                        <span className="w-1 h-4 bg-paper rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                        <span className="w-1 h-3 bg-paper rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                      </div>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    )}
                  </div>
                </button>
              );
            })}

            {(!lesson?.blocks || lesson.blocks.length === 0) && (
              <div className="text-center p-8 text-muted">
                No sections found in this lesson.
              </div>
            )}
          </div>
        </div>
      </Modal>
`;

const insertMarker = '{/* Reminder Modal */}';
const insertIndex = content.indexOf(insertMarker);

if (insertIndex === -1) {
    console.error('Could not find modal insertion point');
    process.exit(1);
}

content = content.slice(0, insertIndex) + outlineModalJSX + '\n      ' + content.slice(insertIndex);

// Also need to add the trigger button near the top toolbar
const triggerJSX = `
              <button
                onClick={() => setShowOutlineModal(true)}
                className="p-2.5 rounded-xl bg-surface-low text-ink hover:bg-accent hover:text-paper hover:shadow-lg hover:shadow-accent/20 transition-all group relative"
                aria-label="Lesson Outline & Audio"
              >
                <ListMusic className="w-5 h-5" />
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-ink text-paper text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  Outline & Audio
                </span>
              </button>
`;

// Let's find the pedagogical tools or similar toolbar near the top right
const toolbarSearch = '<PedagogicalTools';
const toolbarIndex = content.indexOf(toolbarSearch);

if (toolbarIndex !== -1) {
    // Insert right before PedagogicalTools
    content = content.slice(0, toolbarIndex) + triggerJSX + '\n              ' + content.slice(toolbarIndex);
}

// Add ListMusic to lucide imports if needed
if (!content.includes('ListMusic')) {
    content = content.replace('import { \n  ArrowLeft', 'import { \n  ListMusic,\n  ArrowLeft');
    // Just in case it's on a single line or something
    if (!content.includes('ListMusic')) {
         content = content.replace('import { ArrowLeft', 'import { ListMusic, ArrowLeft');
    }
}

fs.writeFileSync(filePath, content);
console.log('Modal UI patched successfully.');
