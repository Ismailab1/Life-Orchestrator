import React, { useState, useEffect } from 'react';

interface Step {
  title: string;
  description: string;
  positionClasses: string; // Tailwind classes for desktop positioning
  highlightArea?: string; // CSS description of what's being highlighted (optional)
}

interface Props {
  onComplete: () => void;
  onSkip: () => void;
  isDemo?: boolean;
}

export const TutorialOverlay: React.FC<Props> = ({ onComplete, onSkip, isDemo = false }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const steps: Step[] = [
    {
      title: isDemo ? "Welcome to Demo Mode" : "Welcome to Life Orchestrator",
      description: isDemo 
        ? "You are entering a sandbox environment. The AI comes pre-loaded with simulated history (e.g., 'Yesterday's Dinner') to demonstrate its memory and reasoning. NOTE: Any data you change here will NOT be saved." 
        : "Your personal AI agent powered by Gemini 3. It helps you manage the delicate balance between career ambitions and personal relationships. Unlike a standard calendar, it actively reasons about conflicts and prioritizes your well-being.",
      positionClasses: "inset-0 m-auto", // Center
    },
    {
      title: "The Kinship Ledger",
      description: "This monitors the 'health' of your relationships. Contacts turn 'Overdue' if neglected. The AI reads this ledger to automatically suggest check-ins during your free moments (e.g., 'Call Mom during your commute').",
      positionClasses: "lg:top-24 lg:left-8", 
    },
    {
      title: "Life Inventory",
      description: "Split into 'Fixed' (Anchors) and 'Flexible' (Flow). You input what you need to do, and the AI decides *when* to do the flexible parts to maximize productivity and connection.",
      positionClasses: "lg:bottom-12 lg:left-8",
    },
    {
      title: "Multimodal Context",
      description: "Use the chat to update your world. Upload a photo of a doctor's note, or use Voice Mode to ramble about your day. The AI extracts the details to update your Ledger and Schedule instantly.",
      positionClasses: "lg:top-1/2 lg:-translate-y-1/2 lg:right-1/4",
    },
    {
      title: "Calendar Sync",
      description: "Connect your Google Calendar to import real meetings. After the AI orchestrates your day, export the optimized schedule back to your calendar with one click.",
      positionClasses: "lg:top-20 lg:right-8",
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const step = steps[currentStep];

  return (
    <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]" onClick={onSkip} />

      {/* Card Container - Flex on mobile, Absolute on Desktop */}
      <div className={`absolute w-full h-full pointer-events-none flex items-center justify-center lg:block`}>
          
          {/* The Card */}
          <div className={`
            pointer-events-auto 
            bg-white text-slate-800 
            p-6 rounded-2xl shadow-2xl 
            border border-white/20 
            max-w-sm w-[90%] mx-auto lg:mx-0
            lg:absolute transition-all duration-500 ease-in-out
            ${step.positionClasses}
          `}>
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                        {currentStep + 1}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900">{step.title}</h3>
                </div>
                <button onClick={onSkip} className="text-slate-400 hover:text-slate-600 text-xs font-medium uppercase tracking-wider">
                    Skip
                </button>
            </div>
            
            <p className="text-slate-600 mb-6 leading-relaxed text-sm">
                {step.description}
            </p>

            <div className="flex justify-between items-center">
                <div className="flex space-x-1">
                    {steps.map((_, idx) => (
                        <div 
                            key={idx} 
                            className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentStep ? 'w-6 bg-indigo-600' : 'w-1.5 bg-slate-200'}`} 
                        />
                    ))}
                </div>
                <button 
                    onClick={handleNext}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/30"
                >
                    {currentStep === steps.length - 1 ? "Get Started" : "Next"}
                </button>
            </div>
          </div>
      </div>
    </div>
  );
};