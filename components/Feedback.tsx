import React from 'react';
import { HandResult } from '../types';
import { playSound } from '../utils/sound';

interface FeedbackProps {
  result: HandResult | null;
  onNext: () => void;
}

const Feedback: React.FC<FeedbackProps> = ({ result, onNext }) => {
  if (!result) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className={`
        w-full max-w-lg p-6 sm:p-8 rounded-2xl shadow-2xl text-center transform transition-all animate-scale-up my-auto
        ${result.isCorrect ? 'bg-emerald-900 border-2 border-emerald-500' : 'bg-red-900 border-2 border-red-500'}
      `}>
        {/* Header Icon */}
        <div className="mb-4">
          {result.isCorrect ? (
            <div className="text-6xl mb-2 animate-bounce">
              🎉
            </div>
          ) : (
            <div className="text-6xl mb-2 animate-pulse">
              🤦‍♂️
            </div>
          )}

          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1">
            {result.isCorrect ? 'Correct!' : 'Incorrect'}
          </h2>

          <div className="text-white/80 text-base sm:text-lg mb-4">
            You chose <span className="font-bold text-white">{result.userAction}</span>.
            Strategy says <span className="font-bold underline decoration-2 underline-offset-4 text-white">{result.correctAction}</span>.
          </div>
        </div>

        {/* Primary Hint */}
        <div className="bg-black/30 p-4 rounded-lg mb-4 text-left border-l-4 border-white/20">
          <div className="flex gap-2 text-white font-semibold mb-1">
            <span>💡</span>
            <span>The Rule</span>
          </div>
          <div className="text-gray-200 text-sm leading-relaxed">
            {result.explanation}
          </div>
        </div>

        {/* Detailed Analysis */}
        {result.analysis && (
          <div className="bg-black/20 p-4 rounded-lg mb-4 text-left">
            <div className="flex gap-2 text-white/90 font-semibold mb-1 text-xs uppercase tracking-wider">
              Analysis
            </div>
            <div className="text-gray-300 text-sm leading-relaxed">
              {result.analysis}
            </div>
          </div>
        )}

        {/* Example */}
        {result.example && (
          <div className="bg-black/20 p-3 rounded-lg mb-6 text-left border border-white/5">
            <div className="text-white/60 text-xs uppercase tracking-wider mb-1">Scenario Example</div>
            <div className="text-emerald-300 font-mono text-sm">
              {result.example}
            </div>
          </div>
        )}

        <button
          onClick={() => { playSound('click'); onNext(); }}
          className="w-full bg-white text-slate-900 hover:bg-gray-100 font-bold py-3.5 px-6 rounded-xl text-lg shadow-xl hover:shadow-2xl active:scale-[0.98] transition-all focus:ring-4 focus:ring-white/30 outline-none"
        >
          Next Hand
        </button>
      </div>
    </div>
  );
};

export default Feedback;