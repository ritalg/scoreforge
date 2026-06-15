import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { PageSpinner } from '../../components/ui/Spinner';
import { TOPIC_LABELS } from '@scoreforge/shared';

interface Deck {
  id: number; name: string; topicKey: string | null;
  isSystemDeck: boolean; published: boolean; cardCount: number; createdAt: string;
}
interface Flashcard {
  id: number; deckId: number; frontText: string; backText: string; hint: string | null;
}

export default function FlashcardManager() {
  const { data: decks, loading, refetch } = useApi<Deck[]>('/api/admin/flashcards/decks');
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const { data: deckData, refetch: refetchCards } = useApi<{ deck: Deck; cards: Flashcard[] }>(
    selectedDeck ? `/api/flashcards/decks/${selectedDeck.id}/cards` : '',
    [selectedDeck?.id]
  );

  const [newDeck, setNewDeck] = useState({ name: '', topicKey: '', isSystemDeck: true });
  const [newCard, setNewCard] = useState({ frontText: '', backText: '', hint: '' });
  const [editCard, setEditCard] = useState<Flashcard | null>(null);
  const [bulkCsv, setBulkCsv] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [creating, setCreating] = useState(false);

  async function createDeck() {
    if (!newDeck.name.trim()) return;
    await api.post('/api/admin/flashcards/decks', { ...newDeck, topicKey: newDeck.topicKey || null });
    setNewDeck({ name: '', topicKey: '', isSystemDeck: true });
    refetch();
  }

  async function togglePublish(deck: Deck) {
    await api.put(`/api/admin/flashcards/decks/${deck.id}`, { published: !deck.published });
    refetch();
    if (selectedDeck?.id === deck.id) setSelectedDeck({ ...deck, published: !deck.published });
  }

  async function deleteDeck(deck: Deck) {
    if (!confirm(`Delete deck "${deck.name}" and all its cards?`)) return;
    await api.delete(`/api/admin/flashcards/decks/${deck.id}`);
    if (selectedDeck?.id === deck.id) setSelectedDeck(null);
    refetch();
  }

  async function addCard() {
    if (!selectedDeck || !newCard.frontText.trim() || !newCard.backText.trim()) return;
    setCreating(true);
    try {
      await api.post(`/api/admin/flashcards/decks/${selectedDeck.id}/cards`, newCard);
      setNewCard({ frontText: '', backText: '', hint: '' });
      refetchCards();
      refetch();
    } finally { setCreating(false); }
  }

  async function saveEditCard() {
    if (!editCard) return;
    await api.put(`/api/admin/flashcards/cards/${editCard.id}`, editCard);
    setEditCard(null);
    refetchCards();
  }

  async function deleteCard(id: number) {
    if (!confirm('Delete this card?')) return;
    await api.delete(`/api/admin/flashcards/cards/${id}`);
    refetchCards();
    refetch();
  }

  async function bulkImport() {
    if (!selectedDeck || !bulkCsv.trim()) return;
    const lines = bulkCsv.trim().split('\n');
    const rows = lines.map(l => {
      const [frontText, backText, hint] = l.split('\t');
      return { frontText: frontText?.trim(), backText: backText?.trim(), hint: hint?.trim() };
    }).filter(r => r.frontText && r.backText);

    await api.post(`/api/admin/flashcards/decks/${selectedDeck.id}/cards/bulk`, { rows });
    setBulkCsv(''); setShowBulk(false);
    refetchCards(); refetch();
  }

  if (loading) return <PageSpinner />;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Flashcard Manager</h1>

      <div className="grid grid-cols-3 gap-6">
        {/* Deck list */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Decks</h2>
          {(decks ?? []).map(deck => (
            <div key={deck.id}
              onClick={() => setSelectedDeck(deck)}
              className={`p-3 rounded-xl border cursor-pointer transition-colors ${
                selectedDeck?.id === deck.id
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
              }`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{deck.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{deck.cardCount} cards</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={e => { e.stopPropagation(); togglePublish(deck); }}
                    className={`text-xs px-1.5 py-0.5 rounded ${deck.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {deck.published ? 'Live' : 'Draft'}
                  </button>
                  <button onClick={e => { e.stopPropagation(); deleteDeck(deck); }}
                    className="text-xs text-red-400 hover:text-red-600 px-1">×</button>
                </div>
              </div>
            </div>
          ))}

          {/* Create deck */}
          <Card padding="sm" className="space-y-2">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">New Deck</p>
            <input value={newDeck.name} onChange={e => setNewDeck(d => ({ ...d, name: e.target.value }))}
              placeholder="Deck name…" className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
            <select value={newDeck.topicKey} onChange={e => setNewDeck(d => ({ ...d, topicKey: e.target.value }))}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="">No topic</option>
              {Object.entries(TOPIC_LABELS as Record<string, string>).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <input type="checkbox" checked={newDeck.isSystemDeck} onChange={e => setNewDeck(d => ({ ...d, isSystemDeck: e.target.checked }))} />
              System deck
            </label>
            <button onClick={createDeck} className="w-full py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs rounded-lg">
              Create
            </button>
          </Card>
        </div>

        {/* Card list */}
        <div className="col-span-2 space-y-4">
          {selectedDeck ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 dark:text-white">{selectedDeck.name}</h2>
                <button onClick={() => setShowBulk(b => !b)} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
                  {showBulk ? 'Hide bulk import' : 'Bulk import (TSV)'}
                </button>
              </div>

              {showBulk && (
                <Card padding="sm" className="space-y-2">
                  <p className="text-xs text-gray-500">Tab-separated: front ↦ back ↦ hint (one card per line)</p>
                  <textarea rows={5} value={bulkCsv} onChange={e => setBulkCsv(e.target.value)}
                    placeholder="Front text&#9;Back text&#9;Optional hint"
                    className="w-full px-2 py-1.5 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none" />
                  <button onClick={bulkImport} className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs rounded-lg">Import</button>
                </Card>
              )}

              {/* Add card form */}
              <Card padding="sm" className="space-y-2">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Add Card</p>
                <textarea rows={2} value={newCard.frontText} onChange={e => setNewCard(c => ({ ...c, frontText: e.target.value }))}
                  placeholder="Front (question)…"
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none" />
                <textarea rows={2} value={newCard.backText} onChange={e => setNewCard(c => ({ ...c, backText: e.target.value }))}
                  placeholder="Back (answer)…"
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none" />
                <input value={newCard.hint} onChange={e => setNewCard(c => ({ ...c, hint: e.target.value }))}
                  placeholder="Hint (optional)…"
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                <button onClick={addCard} disabled={creating}
                  className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs rounded-lg">
                  {creating ? 'Adding…' : 'Add Card'}
                </button>
              </Card>

              {/* Card list */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {(deckData?.cards ?? []).map(card => (
                  <div key={card.id} className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    {editCard?.id === card.id ? (
                      <div className="space-y-2">
                        <textarea rows={2} value={editCard.frontText} onChange={e => setEditCard(c => c ? { ...c, frontText: e.target.value } : c)}
                          className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none" />
                        <textarea rows={2} value={editCard.backText} onChange={e => setEditCard(c => c ? { ...c, backText: e.target.value } : c)}
                          className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none" />
                        <div className="flex gap-2">
                          <button onClick={saveEditCard} className="text-xs px-2 py-1 bg-brand-600 text-white rounded">Save</button>
                          <button onClick={() => setEditCard(null)} className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-400">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-800 dark:text-gray-200 truncate">{card.frontText}</p>
                          <p className="text-xs text-gray-400 truncate mt-0.5">{card.backText}</p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => setEditCard(card)} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">Edit</button>
                          <button onClick={() => deleteCard(card.id)} className="text-xs text-red-400 hover:text-red-600 ml-1">×</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {(deckData?.cards ?? []).length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">No cards yet. Add some above.</p>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Select a deck to manage its cards
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
