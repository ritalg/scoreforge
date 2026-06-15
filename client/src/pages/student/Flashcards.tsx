import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import { TOPIC_LABELS } from '@scoreforge/shared';
import { cacheFlashcards, getCachedFlashcards } from '../../lib/offlineStore';

interface Deck {
  id: number; name: string; topicKey: string | null;
  isSystemDeck: boolean; published: boolean; cardCount: number; dueCount: number;
}
interface Flashcard {
  id: number; deckId: number; frontText: string; backText: string; hint: string | null;
  sr: { intervalDays: number; easeFactor: number; repetitionCount: number; nextReviewAt: string } | null;
}

type StudyPhase = 'front' | 'back';
type RatingQuality = 0 | 3 | 5;

export default function Flashcards() {
  const [view, setView] = useState<'decks' | 'study' | 'create-card'>('decks');
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
  const [studyCards, setStudyCards] = useState<any[]>([]);
  const [studyIdx, setStudyIdx] = useState(0);
  const [studyPhase, setStudyPhase] = useState<StudyPhase>('front');
  const [studyDone, setStudyDone] = useState(false);
  const [ratingCounts, setRatingCounts] = useState({ again: 0, hard: 0, easy: 0 });
  const [createForm, setCreateForm] = useState({ deckId: 0, frontText: '', backText: '', hint: '' });
  const [newDeckName, setNewDeckName] = useState('');
  const [showNewDeck, setShowNewDeck] = useState(false);

  const { data: decks, loading, refetch: refetchDecks } = useApi<Deck[]>('/api/flashcards/decks');
  const { data: stats } = useApi<any>('/api/flashcards/stats');

  async function startStudy(deck: Deck) {
    let allCards: any[] = [];
    try {
      const data = await api.get<any>(`/api/flashcards/due?deckId=${deck.id}`);
      allCards = [...(data.due ?? []), ...(data.unseen ?? [])];
      // Cache fetched cards for offline use
      const toCache = allCards.map((c: any) => ({
        id: c.card?.id ?? c.id,
        deckId: deck.id,
        deckName: deck.name,
        frontText: c.card?.frontText ?? c.frontText,
        backText: c.card?.backText ?? c.backText,
        hint: c.card?.hint ?? c.hint ?? null,
      }));
      cacheFlashcards(toCache).catch(() => {});
    } catch {
      // Offline: load from IndexedDB
      const cached = await getCachedFlashcards(deck.id);
      allCards = cached.map(c => ({ id: c.id, frontText: c.frontText, backText: c.backText, hint: c.hint }));
    }
    if (allCards.length === 0) {
      alert('No cards due for review in this deck!');
      return;
    }
    // Shuffle
    for (let i = allCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allCards[i], allCards[j]] = [allCards[j], allCards[i]];
    }
    setStudyCards(allCards);
    setStudyIdx(0);
    setStudyPhase('front');
    setStudyDone(false);
    setRatingCounts({ again: 0, hard: 0, easy: 0 });
    setActiveDeck(deck);
    setView('study');
  }

  async function rateCard(quality: RatingQuality) {
    const card = studyCards[studyIdx];
    const cardId = card.card?.id ?? card.id;
    await api.post('/api/flashcards/review', { cardId, quality });

    setRatingCounts(r => ({
      ...r,
      again: quality === 0 ? r.again + 1 : r.again,
      hard: quality === 3 ? r.hard + 1 : r.hard,
      easy: quality === 5 ? r.easy + 1 : r.easy,
    }));

    if (studyIdx + 1 >= studyCards.length) {
      setStudyDone(true);
    } else {
      setStudyIdx(i => i + 1);
      setStudyPhase('front');
    }
  }

  async function createDeck() {
    if (!newDeckName.trim()) return;
    await api.post('/api/flashcards/decks', { name: newDeckName.trim() });
    setNewDeckName('');
    setShowNewDeck(false);
    refetchDecks();
  }

  async function createCard() {
    if (!createForm.frontText.trim() || !createForm.backText.trim() || !createForm.deckId) return;
    await api.post('/api/flashcards/cards', createForm);
    setCreateForm({ deckId: createForm.deckId, frontText: '', backText: '', hint: '' });
    refetchDecks();
    alert('Card created!');
  }

  if (loading) return <PageSpinner />;

  // ─── STUDY SESSION ─────────────────────────────────────────────────────────
  if (view === 'study') {
    if (studyDone) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full text-center space-y-6">
            <div className="text-5xl">🎉</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Session Complete!</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-500">{ratingCounts.again}</div>
                <div className="text-xs text-gray-500 mt-1">Again</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-500">{ratingCounts.hard}</div>
                <div className="text-xs text-gray-500 mt-1">Hard</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">{ratingCounts.easy}</div>
                <div className="text-xs text-gray-500 mt-1">Easy</div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setView('decks'); refetchDecks(); }}
                className="flex-1 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-600 dark:text-gray-400">
                Back to Decks
              </button>
              <button onClick={() => activeDeck && startStudy(activeDeck)}
                className="flex-1 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium">
                Study Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    const card = studyCards[studyIdx];
    const cardData = card.card ?? card;
    const progress = ((studyIdx) / studyCards.length) * 100;

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        {/* Progress bar */}
        <div className="h-1 bg-gray-200 dark:bg-gray-700">
          <div className="h-1 bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-xl space-y-4">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <button onClick={() => { setView('decks'); refetchDecks(); }} className="hover:text-gray-700 dark:hover:text-gray-300">
                ← {activeDeck?.name}
              </button>
              <span>{studyIdx + 1} / {studyCards.length}</span>
            </div>

            {/* Card */}
            <div
              onClick={() => studyPhase === 'front' && setStudyPhase('back')}
              className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 min-h-64 flex flex-col items-center justify-center text-center cursor-pointer transition-transform hover:scale-[1.01] ${studyPhase === 'front' ? 'border-2 border-transparent hover:border-brand-400' : ''}`}>
              {studyPhase === 'front' ? (
                <>
                  <p className="text-gray-900 dark:text-white text-lg leading-relaxed">{cardData.frontText}</p>
                  {cardData.hint && (
                    <p className="text-gray-400 text-sm mt-4 italic">Hint: {cardData.hint}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-6">Tap to reveal answer</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-400 mb-4 uppercase tracking-wide">Answer</p>
                  <p className="text-gray-900 dark:text-white text-lg leading-relaxed whitespace-pre-wrap">{cardData.backText}</p>
                </>
              )}
            </div>

            {/* Rating buttons */}
            {studyPhase === 'back' && (
              <div className="grid grid-cols-3 gap-3">
                <button onClick={() => rateCard(0)}
                  className="py-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl font-medium text-sm border border-red-200 dark:border-red-800">
                  Again
                  <span className="block text-xs opacity-70 mt-0.5">Tomorrow</span>
                </button>
                <button onClick={() => rateCard(3)}
                  className="py-3 bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-xl font-medium text-sm border border-yellow-200 dark:border-yellow-800">
                  Hard
                  <span className="block text-xs opacity-70 mt-0.5">Short interval</span>
                </button>
                <button onClick={() => rateCard(5)}
                  className="py-3 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl font-medium text-sm border border-green-200 dark:border-green-800">
                  Easy
                  <span className="block text-xs opacity-70 mt-0.5">Longer interval</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── DECK LIST ─────────────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Flashcards</h1>
          {stats && (
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
              {stats.totalCards} cards · {stats.due} due · {stats.mastered} mastered
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('create-card')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
            + New Card
          </button>
          <button onClick={() => setShowNewDeck(true)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-lg">
            + New Deck
          </button>
        </div>
      </div>

      {showNewDeck && (
        <Card padding="md" className="space-y-3">
          <h3 className="font-medium text-gray-900 dark:text-white">Create New Deck</h3>
          <input value={newDeckName} onChange={e => setNewDeckName(e.target.value)}
            placeholder="Deck name…"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          <div className="flex gap-2">
            <button onClick={() => setShowNewDeck(false)} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg">Cancel</button>
            <button onClick={createDeck} className="px-3 py-1.5 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-lg">Create</button>
          </div>
        </Card>
      )}

      {/* System decks */}
      {(decks ?? []).some(d => d.isSystemDeck) && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">System Decks</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(decks ?? []).filter(d => d.isSystemDeck).map(deck => (
              <DeckCard key={deck.id} deck={deck} onStudy={() => startStudy(deck)} />
            ))}
          </div>
        </div>
      )}

      {/* Student decks */}
      {(decks ?? []).some(d => !d.isSystemDeck) && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">My Decks</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(decks ?? []).filter(d => !d.isSystemDeck).map(deck => (
              <DeckCard key={deck.id} deck={deck} onStudy={() => startStudy(deck)} />
            ))}
          </div>
        </div>
      )}

      {(decks ?? []).length === 0 && (
        <Card className="text-center py-12 text-gray-400">
          <p>No flashcard decks yet.</p>
          <p className="text-xs mt-1">Ask your admin to seed system decks, or create your own.</p>
        </Card>
      )}
    </div>
  );
}

function DeckCard({ deck, onStudy }: { deck: Deck; onStudy: () => void }) {
  return (
    <Card padding="md" className="hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-white text-sm">{deck.name}</span>
            {deck.isSystemDeck && (
              <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">System</span>
            )}
          </div>
          {deck.topicKey && (
            <p className="text-xs text-gray-400 mt-0.5">
              {(TOPIC_LABELS as Record<string, string>)[deck.topicKey] ?? deck.topicKey}
            </p>
          )}
          <div className="flex gap-3 mt-2 text-xs text-gray-500">
            <span>{deck.cardCount} cards</span>
            {deck.dueCount > 0 && (
              <span className="text-orange-500 font-medium">{deck.dueCount} due</span>
            )}
          </div>
        </div>
        <button onClick={onStudy}
          className="ml-3 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg flex-shrink-0">
          Study
        </button>
      </div>
    </Card>
  );
}
