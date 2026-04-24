const fs = require('fs');
const path = require('path');

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

  const toggleReadAloud = (index: number, text: string) => {
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
        .replace(/[#*_\`]/g, '')
        .replace(/\\[n]/g, ' ')
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

const insertIndex = content.indexOf('const [isExplaining, setIsExplaining] = useState(false);') + 'const [isExplaining, setIsExplaining] = useState(false);'.length;
content = content.slice(0, insertIndex) + '\n\n' + audioLogic + content.slice(insertIndex);

fs.writeFileSync(filePath, content);
console.log('Audio logic patched successfully.');
