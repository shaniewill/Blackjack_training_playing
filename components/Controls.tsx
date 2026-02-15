import React from 'react';
import { Action } from '../types';

interface ControlsProps {
  onAction: (action: Action) => void;
  canDouble: boolean;
  canSplit: boolean;
  disabled: boolean;
}

const Controls: React.FC<ControlsProps> = ({ onAction, canDouble, canSplit, disabled }) => {
  return (
    <div className="flex flex-wrap gap-3 sm:gap-4 justify-center w-full max-w-2xl px-4">
      <button
        onClick={() => onAction(Action.Hit)}
        disabled={disabled}
        className="flex-1 min-w-[100px] bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-[0_4px_0_rgb(6,95,70)] active:shadow-[0_2px_0_rgb(6,95,70)] active:translate-y-[2px] transition-all text-lg tracking-wide uppercase"
      >
        Hit
      </button>
      <button
        onClick={() => onAction(Action.Stand)}
        disabled={disabled}
        className="flex-1 min-w-[100px] bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-[0_4px_0_rgb(153,27,27)] active:shadow-[0_2px_0_rgb(153,27,27)] active:translate-y-[2px] transition-all text-lg tracking-wide uppercase"
      >
        Stand
      </button>
      
      <button
        onClick={() => onAction(Action.Double)}
        disabled={disabled || !canDouble}
        className={`flex-1 min-w-[100px] font-bold py-4 rounded-xl shadow-[0_4px_0_rgb(180,83,9)] active:shadow-[0_2px_0_rgb(180,83,9)] active:translate-y-[2px] transition-all text-lg tracking-wide uppercase
          ${disabled || !canDouble 
            ? 'bg-slate-700 text-slate-500 cursor-not-allowed shadow-none border-2 border-slate-700' 
            : 'bg-yellow-600 hover:bg-yellow-500 text-white'
          }`}
      >
        Double
      </button>
      
      <button
        onClick={() => onAction(Action.Split)}
        disabled={disabled || !canSplit}
        className={`flex-1 min-w-[100px] font-bold py-4 rounded-xl shadow-[0_4px_0_rgb(30,58,138)] active:shadow-[0_2px_0_rgb(30,58,138)] active:translate-y-[2px] transition-all text-lg tracking-wide uppercase
          ${disabled || !canSplit 
            ? 'bg-slate-700 text-slate-500 cursor-not-allowed shadow-none border-2 border-slate-700' 
            : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
      >
        Split
      </button>
    </div>
  );
};

export default Controls;