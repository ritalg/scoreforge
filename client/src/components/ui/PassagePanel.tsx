interface Passage {
  id: number;
  passageText: string;
  passageType: string | null;
}

interface Figure {
  id: number;
  imagePath: string;
  figureType: string | null;
  altText: string | null;
}

interface Props {
  passage?: Passage | null;
  figures?: Figure[];
}

export function PassagePanel({ passage, figures }: Props) {
  if (!passage && (!figures || figures.length === 0)) return null;

  return (
    <div className="space-y-3">
      {passage && (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            {passage.passageType === 'poetry' ? 'Poem' : 'Passage'}
          </p>
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto scroll-smooth"
            aria-label="Reading passage"
          >
            {passage.passageText}
          </div>
        </div>
      )}
      {figures && figures.length > 0 && (
        <div className="space-y-2">
          {figures.map(fig => (
            <figure key={fig.id} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <img
                src={fig.imagePath}
                alt={fig.altText ?? 'Question figure'}
                className="max-w-full h-auto block mx-auto max-h-80 object-contain p-2"
              />
              {fig.altText && (
                <figcaption className="text-xs text-center text-gray-400 pb-2 px-2">{fig.altText}</figcaption>
              )}
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
