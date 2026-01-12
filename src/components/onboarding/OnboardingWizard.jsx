import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Check, Rocket, Target, Bell, Layout } from 'lucide-react';
import confetti from 'canvas-confetti';

const getOnboardingSteps = (userName, companyName) => [
  {
    id: 'welcome',
    title: `Welcome, ${userName}!`,
    description: 'Let\'s get you started with a quick tour',
    icon: Rocket,
    content: ({ onNext }) => (
      <div className="text-center space-y-6">
        <div className="w-20 h-20 mx-auto bg-gradient-to-br from-[#7CB342] to-[#9CCC65] rounded-full flex items-center justify-center">
          <Rocket className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">
          Welcome to {companyName}'s Fleet Compliance Portal
        </h2>
        <p className="text-slate-600 max-w-md mx-auto">
          Hi {userName}! We're excited to have you here. This portal will help you track vehicle wash compliance,
          manage maintenance, and monitor your entire fleet - all in one place.
        </p>
        <div className="grid grid-cols-3 gap-4 mt-8">
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="text-3xl font-bold text-[#7CB342]">Real-time</div>
            <div className="text-sm text-slate-600 mt-1">Tracking</div>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="text-3xl font-bold text-[#7CB342]">100%</div>
            <div className="text-sm text-slate-600 mt-1">Visibility</div>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="text-3xl font-bold text-[#7CB342]">24/7</div>
            <div className="text-sm text-slate-600 mt-1">Access</div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'dashboard',
    title: 'Your Dashboard',
    description: 'Understanding your main control center',
    icon: Layout,
    content: () => (
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-slate-800">Your {companyName} Dashboard</h3>
        <p className="text-slate-600">
          Everything you need to monitor vehicle wash compliance and maintain fleet standards.
        </p>
        <div className="space-y-3">
          <div className="flex gap-3 p-3 bg-slate-50 rounded-lg">
            <div className="w-10 h-10 bg-[#7CB342] rounded-lg flex items-center justify-center flex-shrink-0">
              <Check className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-medium text-slate-800">Fleet Overview</div>
              <div className="text-sm text-slate-600">Monitor compliance rates and wash statistics for all {companyName} vehicles</div>
            </div>
          </div>
          <div className="flex gap-3 p-3 bg-slate-50 rounded-lg">
            <div className="w-10 h-10 bg-[#7CB342] rounded-lg flex items-center justify-center flex-shrink-0">
              <Check className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-medium text-slate-800">Recent Activity Feed</div>
              <div className="text-sm text-slate-600">Stay updated with real-time vehicle wash events and maintenance activities</div>
            </div>
          </div>
          <div className="flex gap-3 p-3 bg-slate-50 rounded-lg">
            <div className="w-10 h-10 bg-[#7CB342] rounded-lg flex items-center justify-center flex-shrink-0">
              <Check className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-medium text-slate-800">Analytics & Reports</div>
              <div className="text-sm text-slate-600">Generate detailed reports and visualize trends over time</div>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'favorites',
    title: 'Favorite Vehicles',
    description: 'Bookmark your most important assets',
    icon: Target,
    content: () => (
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-slate-800">Pin Your Priority Vehicles</h3>
        <p className="text-slate-600">
          Click the star icon next to any vehicle to add it to your favorites for quick access.
        </p>
        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center">
              <span className="text-2xl">⭐</span>
            </div>
            <div>
              <div className="font-semibold text-slate-800">Pro Tip!</div>
              <div className="text-sm text-slate-600">Use favorites to monitor your most critical assets</div>
            </div>
          </div>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-[#7CB342] mt-0.5" />
              <span>Star vehicles that require frequent monitoring</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-[#7CB342] mt-0.5" />
              <span>Filter to show only favorites with one click</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-[#7CB342] mt-0.5" />
              <span>Favorites sync across all your devices</span>
            </li>
          </ul>
        </div>
      </div>
    )
  },
  {
    id: 'notifications',
    title: 'Stay Informed',
    description: 'Configure your alerts and notifications',
    icon: Bell,
    content: () => (
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-slate-800">You're All Set, {userName}!</h3>
        <p className="text-slate-600">
          The {companyName} fleet is now at your fingertips. Customize your email digest preferences
          to receive updates on your schedule.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 border-2 border-slate-200 rounded-lg">
            <div className="text-lg font-semibold text-[#7CB342] mb-2">Daily Digest</div>
            <div className="text-sm text-slate-600">Get a summary every morning</div>
          </div>
          <div className="p-4 border-2 border-slate-200 rounded-lg">
            <div className="text-lg font-semibold text-[#7CB342] mb-2">Weekly Report</div>
            <div className="text-sm text-slate-600">Perfect for executive overview</div>
          </div>
        </div>
        <div className="bg-gradient-to-r from-[#7CB342] to-[#9CCC65] rounded-lg p-5 text-white">
          <div className="font-semibold mb-2 text-lg">Ready to Start Tracking!</div>
          <div className="text-sm text-white/90">
            Click "Get Started" to begin managing {companyName}'s vehicle compliance.
            Visit the Users → Email Digest tab to customize your notification preferences anytime.
          </div>
        </div>
      </div>
    )
  }
];

export default function OnboardingWizard({ userEmail, userName = 'User', companyName = 'Your Company', onComplete }) {
  // Disabled for all users
  return null;

  const [currentStep, setCurrentStep] = useState(0);
  const [showWizard, setShowWizard] = useState(false);

  const ONBOARDING_STEPS = getOnboardingSteps(userName, companyName);

  useEffect(() => {
    // Check if user has completed onboarding
    const onboardingKey = `onboarding_completed_${userEmail}`;
    const completed = localStorage.getItem(onboardingKey);

    // Force show for jonny@elora.com.au (for demo purposes)
    const forceShowForUser = userEmail === 'jonny@elora.com.au';

    if (!completed || forceShowForUser) {
      setShowWizard(true);
    }
  }, [userEmail]);

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    const onboardingKey = `onboarding_completed_${userEmail}`;
    localStorage.setItem(onboardingKey, 'true');

    // Celebrate with confetti!
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });

    setShowWizard(false);
    if (onComplete) {
      onComplete();
    }
  };

  const handleSkip = () => {
    const onboardingKey = `onboarding_completed_${userEmail}`;
    localStorage.setItem(onboardingKey, 'true');
    setShowWizard(false);
    if (onComplete) {
      onComplete();
    }
  };

  if (!showWizard) return null;

  const step = ONBOARDING_STEPS[currentStep];
  const Icon = step.icon;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#7CB342] to-[#9CCC65] p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{step.title}</h2>
                  <p className="text-white/80 text-sm">{step.description}</p>
                </div>
              </div>
              <button
                onClick={handleSkip}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="flex gap-2">
              {ONBOARDING_STEPS.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    idx <= currentStep ? 'bg-white' : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {step.content({ onNext: handleNext })}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 p-6 flex items-center justify-between">
            <button
              onClick={handleSkip}
              className="text-slate-600 hover:text-slate-800 text-sm font-medium"
            >
              Skip Tour
            </button>

            <div className="flex gap-2">
              {currentStep > 0 && (
                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex items-center gap-2 bg-[#7CB342] hover:bg-[#6BA032] text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                {currentStep === ONBOARDING_STEPS.length - 1 ? (
                  <>
                    <Check className="w-4 h-4" />
                    Get Started
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// Hook to reset onboarding for testing
export function useResetOnboarding() {
  return (userEmail) => {
    const onboardingKey = `onboarding_completed_${userEmail}`;
    localStorage.removeItem(onboardingKey);
    window.location.reload();
  };
}
