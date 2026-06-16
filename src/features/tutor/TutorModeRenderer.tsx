import React, { useMemo, useState } from 'react';
import { Check, RotateCcw, Send } from 'lucide-react';
import type { DifficultyType, QuizQuestion, TutorContext, TutorEvent } from './types';
import { buildExampleText } from './tutorMachine';

type SendOptions = {
  displayText?: string;
  tutorDirective?: string;
  skipIntent?: boolean;
  localResponse?: string;
};

interface TutorModeRendererProps {
  context: TutorContext;
  compact?: boolean;
  isLoading?: boolean;
  onEvent: (event: TutorEvent) => void;
  onSendPrompt: (prompt: string, options?: SendOptions) => void;
}

const diagnosticOptions: Array<{ label: string; value: DifficultyType }> = [
  { label: 'Mots', value: 'mots' },
  { label: 'Phrase', value: 'phrase' },
  { label: 'Idee', value: 'idee' },
  { label: 'Exemple', value: 'exemple' },
  { label: 'Etapes', value: 'etapes' },
  { label: 'Pas sur', value: 'pas_sur' },
];

const stopWords = new Set([
  'dans', 'avec', 'pour', 'plus', 'leur', 'leurs', 'elle', 'elles', 'nous', 'vous', 'sont', 'est',
  'une', 'des', 'les', 'qui', 'que', 'sur', 'son', 'ses', 'comme', 'cette', 'cela', 'fait',
  'peut', 'dont', 'fois', 'mots', 'mot', 'phrase', 'verbe', 'verbes',
]);

const preferredWords = ['central', 'fonction', 'situer', 'subies', 'variable', 'emploi', "verbe d'action", "verbe d'etat", 'exprime', 'etat'];

function normalizeWord(word: string) {
  return word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function extractCandidateWords(sectionText?: string) {
  if (!sectionText?.trim()) return [];
  const normalizedText = normalizeWord(sectionText);
  const preferred = preferredWords.filter((word) => normalizedText.includes(normalizeWord(word)));
  const words = sectionText
    .replace(/[']/g, ' ')
    .split(/[^A-Za-zÀ-ÿ]+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 4)
    .filter((word) => !stopWords.has(normalizeWord(word)));
  return Array.from(new Set([...preferred, ...words])).slice(0, 10);
}

function normalizeAnswer(value: string) {
  return normalizeWord(value.trim());
}

function isCorrectAnswer(question: QuizQuestion, answer: string) {
  if (!question.correct_answer) return false;
  return normalizeAnswer(question.correct_answer) === normalizeAnswer(answer);
}

export const TutorModeRenderer: React.FC<TutorModeRendererProps> = ({
  context,
  compact = false,
  isLoading,
  onEvent,
  onSendPrompt,
}) => {
  if (context.currentMode === 'reading_mode') return null;

  if (context.currentMode === 'diagnostic_mode') {
    return (
      <Panel>
        <Header title="Qu'est-ce qui bloque ?" subtitle={compact ? undefined : 'Choisis le point le plus difficile.'} />
        <div className="grid grid-cols-3 gap-2">
          {diagnosticOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onEvent({ type: 'SELECT_BLOCK', value: option.value })}
              disabled={isLoading}
              className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-transparent px-2 text-xs font-semibold text-slate-200 transition-colors hover:border-blue-300/40 hover:bg-blue-400/10 disabled:opacity-50"
            >
              <Check size={12} className="text-blue-300" />
              {option.label}
            </button>
          ))}
        </div>
      </Panel>
    );
  }

  if (context.currentMode === 'vocabulary_diagnostic_mode') {
    return (
      <VocabularyPanel
        sectionText={context.currentSectionText}
        isLoading={isLoading}
        onPickWord={(word) => {
          onSendPrompt(`Explique le mot "${word}" dans cette section.`, {
            displayText: word,
            skipIntent: true,
            tutorDirective: `Explique uniquement le mot "${word}" dans le contexte de la section. Donne une definition simple, une reformulation, puis une mini-question.`,
          });
        }}
      />
    );
  }

  if (context.currentMode === 'sentence_diagnostic_mode') {
    return <SentencePanel isLoading={isLoading} onSendPrompt={onSendPrompt} />;
  }

  if (context.currentMode === 'example_mode') {
    return (
      <Panel>
        <Header title="Exemple simple" />
        <div className="whitespace-pre-line text-sm leading-6 text-slate-100">{buildExampleText(context.currentSectionTitle)}</div>
      </Panel>
    );
  }

  if (context.currentMode === 'explanation_mode') {
    return (
      <Panel>
        <Header title="On avance pas a pas" subtitle={`Bloc choisi : ${context.selectedBlockType || 'idee'}`} />
        <div className="flex gap-2">
          <ActionButton label="Voir un exemple" onClick={() => onEvent({ type: 'REQUEST_EXAMPLE' })} />
          <ActionButton label="Mini-check" onClick={() => onEvent({ type: 'START_QUIZ' })} />
        </div>
      </Panel>
    );
  }

  if (context.currentMode === 'quiz_mode') {
    return (
      <QuizPanel
        question={context.currentQuestion}
        attempts={context.attempts}
        masteryScore={context.masteryScore}
        feedback={context.lastFeedback}
        isLoading={isLoading}
        onSubmit={(answer) => {
          onEvent({ type: 'SUBMIT_ANSWER', answer });
          if (context.currentQuestion && isCorrectAnswer(context.currentQuestion, answer)) {
            onEvent({ type: 'ANSWER_CORRECT', feedback: context.currentQuestion.explanation || 'Correct.' });
          } else {
            onEvent({ type: 'ANSWER_WRONG', feedback: "Pas encore. Regarde l'indice, puis essaie encore." });
          }
        }}
      />
    );
  }

  if (context.currentMode === 'repair_mode') {
    return (
      <Panel>
        <Header title="On repare" subtitle={context.lastFeedback || 'Pas encore. On reprend avec un indice.'} />
        <div className="grid grid-cols-3 gap-2">
          <ActionButton label="Expliquer" onClick={() => onEvent({ type: 'REQUEST_EXPLANATION' })} />
          <ActionButton label="Exemple" onClick={() => onEvent({ type: 'REQUEST_EXAMPLE' })} />
          <ActionButton label="Reessayer" onClick={() => onEvent({ type: 'START_QUIZ' })} />
        </div>
      </Panel>
    );
  }

  if (context.currentMode === 'summary_mode') {
    return (
      <Panel>
        <Header title="Resume rapide" subtitle={`Tentatives : ${context.attempts} | Progression : ${context.masteryScore}%`} />
        <button type="button" onClick={() => onEvent({ type: 'RESET_TO_READING' })} className="flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-semibold text-slate-200">
          <RotateCcw size={13} />
          Retour lecture
        </button>
      </Panel>
    );
  }

  return null;
};

const Panel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <section className="space-y-3 border-y border-white/10 py-4">
    {children}
  </section>
);

const Header: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div>
    <p className="text-sm font-bold text-white">{title}</p>
    {subtitle && <p className="mt-0.5 text-xs leading-5 text-slate-400">{subtitle}</p>}
  </div>
);

const ActionButton: React.FC<{ label: string; onClick: () => void; disabled?: boolean }> = ({ label, onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="h-9 rounded-lg border border-white/10 px-3 text-xs font-semibold text-slate-200 transition-colors hover:border-blue-300/40 hover:bg-blue-400/10 disabled:opacity-50"
  >
    {label}
  </button>
);

const VocabularyPanel: React.FC<{
  sectionText?: string;
  isLoading?: boolean;
  onPickWord: (word: string) => void;
}> = ({ sectionText, isLoading, onPickWord }) => {
  const [otherWord, setOtherWord] = useState('');
  const words = useMemo(() => extractCandidateWords(sectionText), [sectionText]);

  return (
    <Panel>
      <Header
        title="Quel mot bloque ?"
        subtitle={words.length ? 'Choisis un mot du cours.' : 'Colle la phrase ou le paragraphe, et je vais reperer les mots difficiles.'}
      />
      {words.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {words.map((word) => (
            <button
              key={word}
              type="button"
              disabled={isLoading}
              onClick={() => onPickWord(word)}
              className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-blue-300/40 hover:bg-blue-400/10 disabled:opacity-50"
            >
              {word}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={otherWord}
          onChange={(event) => setOtherWord(event.target.value)}
          placeholder="Autre mot..."
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-300/50 focus:outline-none"
        />
        <button
          type="button"
          disabled={!otherWord.trim() || isLoading}
          onClick={() => {
            onPickWord(otherWord.trim());
            setOtherWord('');
          }}
          className="rounded-lg border border-blue-300/30 px-3 py-2 text-xs font-bold text-blue-200 disabled:opacity-50"
        >
          Choisir
        </button>
      </div>
    </Panel>
  );
};

const SentencePanel: React.FC<{
  isLoading?: boolean;
  onSendPrompt: (prompt: string, options?: SendOptions) => void;
}> = ({ isLoading, onSendPrompt }) => {
  const [sentence, setSentence] = useState('');
  return (
    <Panel>
      <Header title="Quelle phrase bloque ?" subtitle="Colle la phrase ici. Je vais la reformuler simplement." />
      <textarea
        value={sentence}
        onChange={(event) => setSentence(event.target.value)}
        placeholder="Colle la phrase..."
        className="min-h-20 w-full resize-none rounded-lg border border-white/10 bg-transparent p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-300/50 focus:outline-none"
      />
      <ActionButton
        label="Reformuler"
        disabled={!sentence.trim() || isLoading}
        onClick={() => {
          onSendPrompt(`Reformule simplement cette phrase : ${sentence}`, {
            displayText: sentence,
            skipIntent: true,
            tutorDirective: 'Reformule la phrase en mots simples, explique un seul point, puis pose une mini-question.',
          });
          setSentence('');
        }}
      />
    </Panel>
  );
};

const QuizPanel: React.FC<{
  question?: QuizQuestion;
  attempts: number;
  masteryScore: number;
  feedback?: string;
  isLoading?: boolean;
  onSubmit: (answer: string) => void;
}> = ({ question, attempts, masteryScore, feedback, isLoading, onSubmit }) => {
  const [answer, setAnswer] = useState('');

  if (!question) {
    return (
      <Panel>
        <Header title="Mini-check" subtitle="Une question arrive dans la reponse du tuteur." />
      </Panel>
    );
  }

  return (
    <Panel>
      <Header title="Mini-check" subtitle={`Tentatives : ${attempts} | Progression : ${masteryScore}%`} />
      <p className="text-sm leading-6 text-slate-100">{question.question_text}</p>
      {question.question_type === 'mcq_single' && question.options?.length ? (
        <div className="grid gap-2">
          {question.options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setAnswer(option)}
              className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold ${answer === option ? 'border-blue-300/50 bg-blue-400/10 text-blue-100' : 'border-white/10 text-slate-200'}`}
            >
              {option}
            </button>
          ))}
        </div>
      ) : (
        <input
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Ta reponse..."
          className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-300/50 focus:outline-none"
        />
      )}
      {question.hint && <p className="text-xs text-amber-100">Indice : {question.hint}</p>}
      {feedback && <p className="text-xs text-slate-300">{feedback}</p>}
      <button
        type="button"
        onClick={() => answer.trim() && onSubmit(answer)}
        disabled={!answer.trim() || isLoading}
        className="flex h-9 w-fit items-center gap-2 rounded-lg border border-blue-300/30 px-3 text-xs font-bold text-blue-200 disabled:opacity-50"
      >
        <Send size={13} />
        Valider
      </button>
    </Panel>
  );
};
