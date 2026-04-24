import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'src/pages/LessonView.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const audioLogic = `
  // --- Audio Reading Logic ---
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleReadAloud = (index, text) => {
    if (!('speechSynthesis' in window)) {
      toast.error('Text-to-speech is not supported in this browser.');
      return;
    }

    if (readingBlockIndex === index) {
      // Stop reading
      window.speechSynthesis.cancel();
      setReadingBlockIndex(null);
    } else {
      // Start reading new block
      window.speechSynthesis.cancel();

      // Strip markdown syntax for better reading
      const cleanText = text
        .replace(/[#*_\\\`]/g, '')
        .replace(/\\n/g, ' ')
        .trim();

      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 0.9; // Slightly slower for better comprehension

      utterance.onend = () => {
        setReadingBlockIndex(null);
      };

      utterance.onerror = () => {
        setReadingBlockIndex(null);
        toast.error('Error playing audio.');
      };

      setReadingBlockIndex(index);
      window.speechSynthesis.speak(utterance);
    }
  };
  // -------------------------
`;

const searchString = 'const [isExplaining, setIsExplaining] = useState(false);';
const insertIndex = content.indexOf(searchString);

if (insertIndex === -1) {
    console.error('Could not find search string');
    process.exit(1);
}

const finalInsertIndex = insertIndex + searchString.length;
content = content.slice(0, finalInsertIndex) + '\n\n' + audioLogic + content.slice(finalInsertIndex);

fs.writeFileSync(filePath, content);
console.log('Audio logic patched successfully.');
